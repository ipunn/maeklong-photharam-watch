// Pure, source-agnostic parsing/derivation logic — no network, no DOM.
// The scrape script (scripts/scrape-waterlevel.js) and the site (app.js) are both thin
// I/O wrappers around these functions; only these are unit tested.

// ThaiWater's `waterlevel_datetime` (and similar fields elsewhere in this
// app) come back as a naive "YYYY-MM-DD HH:MM" string with no timezone
// marker, but the value is always Bangkok local time. Treating it as the
// runtime's local time instead would silently shift it by the runtime's own
// UTC offset — this makes the Bangkok offset explicit instead.
function toIsoBangkok(naive) {
  if (!naive) return null;
  const str = String(naive).replace(" ", "T");
  const withSeconds = /T\d\d:\d\d:\d\d$/.test(str) ? str : `${str}:00`;
  return /[Zz]|[+-]\d\d:?\d\d$/.test(withSeconds) ? withSeconds : `${withSeconds}+07:00`;
}

// A station is deliberately NOT report-shaped (no passability status, no
// road-report fields) — this app has no concept of a road report at all.
function parseWaterLevelRecord(raw) {
  const station = raw.station || {};
  const warningM = station.warning_level_m;
  const criticalM = station.critical_level_m;
  const thresholds =
    warningM != null && criticalM != null ? { warningM: Number(warningM), criticalM: Number(criticalM) } : null;

  return {
    stationId: station.id,
    name: (station.tele_station_name && station.tele_station_name.th) || null,
    levelMsl: raw.waterlevel_msl != null ? Number(raw.waterlevel_msl) : null,
    bankMsl: station.min_bank != null ? Number(station.min_bank) : null,
    updatedAt: toIsoBangkok(raw.waterlevel_datetime),
    thresholds,
    // Only some gauges (e.g. C.13) carry a discharge; the feed sends it as a string.
    dischargeM3s: strictNumberOrNull(raw.discharge),
  };
}

// Like Number(), but blank/whitespace/non-numeric become null — Number("") is 0, and a
// missing discharge must never read as "no flow".
function strictNumberOrNull(v) {
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Where a level sits against the bank, as a fact (not a Status, not a flood level).
// Null when either input is missing. Difference is in metres, 2 dp, always >= 0.
function bankComparison(levelMsl, bankMsl) {
  const ok = (v) => typeof v === "number" && Number.isFinite(v);
  if (!ok(levelMsl) || !ok(bankMsl)) return null;
  const diffM = Math.round(Math.abs(levelMsl - bankMsl) * 100) / 100;
  const direction = diffM === 0 ? "at" : levelMsl > bankMsl ? "above" : "below";
  return { direction, diffM };
}

// One entry per Bangkok calendar day: the day's high and low (with the source times of each).
// Days come from the source's `updatedAt`, never `scrapedAt`. Rows with a non-numeric level or
// unreadable time are ignored. The day containing `nowMs` is still filling, so it is marked
// `partial`. Bangkok has no DST, so the fixed +7 h offset is exact.
function dailyHighLow(rows, nowMs) {
  const BKK_MS = 7 * 3600000;
  const dayOf = (ms) => new Date(ms + BKK_MS).toISOString().slice(0, 10);
  const today = dayOf(nowMs);
  const days = new Map();
  for (const r of rows) {
    const ms = new Date(r.updatedAt).getTime();
    if (Number.isNaN(ms) || typeof r.levelMsl !== "number" || !Number.isFinite(r.levelMsl)) continue;
    const date = dayOf(ms);
    const d = days.get(date) || { date, high: -Infinity, highAt: null, low: Infinity, lowAt: null, partial: date === today };
    if (r.levelMsl > d.high) (d.high = r.levelMsl), (d.highAt = r.updatedAt);
    if (r.levelMsl < d.low) (d.low = r.levelMsl), (d.lowAt = r.updatedAt);
    days.set(date, d);
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Bands a station's current level against its own sourced thresholds.
// Deliberately never defaults to "green"/any color when no threshold is
// known — an unsourced guess is worse than no color at all.
function deriveStatus(levelMsl, thresholds) {
  if (!thresholds) return null;
  // A missing level must never be banded: `null < x` is true in JS and would read as green.
  if (typeof levelMsl !== "number" || !Number.isFinite(levelMsl)) return null;
  if (levelMsl < thresholds.warningM) return "green";
  if (levelMsl < thresholds.criticalM) return "yellow";
  return "red";
}

// EGAT's water_crisis.php is one big server-rendered table, one <tr> per dam.
// Tracked dams are matched by their Thai name (never by row position — the
// page's row order and the other dams' rows are not ours to depend on).
const TRACKED_RESERVOIRS = ["วชิราลงกรณ", "ศรีนครินทร์"];
// Column offsets among the cells after the name cell.
const RESERVOIR_COL = { levelMsl: 0, storageMcm: 1, storagePercent: 2, releaseMcmPerDay: 10 };

function cellNumber(text) {
  const n = Number(text.replace(/,/g, ""));
  return text !== "" && Number.isFinite(n) ? n : null;
}

// `raw` is the page's HTML. Returns one record per tracked dam found; a dam
// with no row is omitted (the caller decides how to report the gap). The page
// reports release in MCM/day; it is converted here to m3/s (2 dp) so the whole
// UI uses one unit. The page has no per-row timestamp — that is the scraper's.
function parseReservoirRecord(raw) {
  const records = [];
  for (const [, rowHtml] of String(raw).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(([, c]) =>
      c.replace(/<[^>]*>/g, "").trim(),
    );
    const name = cells[0];
    if (!TRACKED_RESERVOIRS.includes(name)) continue;
    const values = cells.slice(1).map(cellNumber);
    const mcmPerDay = values[RESERVOIR_COL.releaseMcmPerDay];
    records.push({
      name,
      storageMcm: values[RESERVOIR_COL.storageMcm] ?? null,
      storagePercent: values[RESERVOIR_COL.storagePercent] ?? null,
      levelMsl: values[RESERVOIR_COL.levelMsl] ?? null,
      releaseRateM3s: mcmPerDay == null ? null : Math.round(((mcmPerDay * 1e6) / 86400) * 100) / 100,
    });
  }
  return records;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

// The EGAT page is a daily report, headed e.g. "28 กันยายน 2569 เวลา 24.00 น."
// (Buddhist year; 24.00 == end of that day). That is the time the figures
// are AS OF — not when we scraped — so the UI must age them from here.
// Returns null when the header isn't recognisable: never guess a date.
function parseReservoirReportDate(raw) {
  const m = String(raw).match(/(\d{1,2})\s+(\S+)\s+(\d{4})\s+เวลา\s+(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const month = THAI_MONTHS.indexOf(m[2]);
  if (month < 0) return null;
  // The page uses the Buddhist era. A year that is not plausibly Buddhist is unrecognised.
  if (Number(m[3]) < 2400) return null;
  const year = Number(m[3]) - 543;
  // An impossible date (e.g. 31 September) is unrecognised, not silently rolled over.
  const day = new Date(Date.UTC(year, month, Number(m[1])));
  if (day.getUTCMonth() !== month || day.getUTCDate() !== Number(m[1])) return null;
  // Date.UTC rolls hour 24 over to 00:00 of the next day for us.
  const bangkokAsUtc = new Date(Date.UTC(year, month, Number(m[1]), Number(m[4]), Number(m[5])));
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${bangkokAsUtc.getUTCFullYear()}-${p(bangkokAsUtc.getUTCMonth() + 1)}-${p(bangkokAsUtc.getUTCDate())}` +
    `T${p(bangkokAsUtc.getUTCHours())}:${p(bangkokAsUtc.getUTCMinutes())}:00+07:00`
  );
}

const numOrNull = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);

// One `dam_hourly` record from ThaiWater's dam feed. Inflow/release are million
// m3 over the hour ending at `dam_date` (unit high confidence, per-hour basis
// medium — see .scratch/maeklong-photharam-water-monitor/research/thaiwater-dam-feed-units.md),
// so m3/s is MCM * 1e6 / 3600. Unlike EGAT's daily table this has its own
// hourly timestamp. A missing value stays null — never 0.
function parseDamHourlyRecord(raw) {
  const dam = raw.dam || {};
  const releaseMcm = numOrNull(raw.dam_released);
  return {
    damId: dam.id,
    name: (dam.dam_name && dam.dam_name.th) || null,
    levelMsl: numOrNull(raw.dam_level),
    storageMcm: numOrNull(raw.dam_storage),
    inflowMcm: numOrNull(raw.dam_inflow),
    releaseMcm,
    releaseM3s: releaseMcm == null ? null : Math.round((releaseMcm * 1e6) / 3600),
    reportedAt: toIsoBangkok(raw.dam_date),
  };
}

// The feed holds stale rows for some dams alongside current ones, so pick the
// newest record for the given dam id rather than the first match.
function pickLatestDamHourly(records, damId) {
  let best = null;
  for (const r of records) {
    if (!r.dam || r.dam.id !== damId) continue;
    if (!best || String(r.dam_date) > String(best.dam_date)) best = r;
  }
  return best;
}

// Hourly stored volume as a % of capacity. Capacity is backed out of EGAT's own row
// (storage MCM / storage %) because ThaiWater's dam_storage_percent is 0 for these
// dams. Null if any input is missing — no capacity is ever assumed.
function damCapacity(hourlyStorageMcm, egatStorageMcm, egatStoragePercent) {
  const ok = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (!ok(hourlyStorageMcm) || !ok(egatStorageMcm) || !ok(egatStoragePercent)) return null;
  const capacityMcm = egatStorageMcm / (egatStoragePercent / 100);
  return {
    capacityMcm,
    percent: (hourlyStorageMcm / capacityMcm) * 100,
    remainingMcm: Math.max(0, capacityMcm - hourlyStorageMcm),
  };
}

// Official reservoir-storage status bands by % of capacity (Royal Irrigation
// Department criteria, as printed in ThaiWater's report notes). Lower bounds are
// exclusive: exactly 80% is น้ำปานกลาง, exactly 100% is น้ำมาก.
function reservoirBand(percent) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return null;
  if (percent > 100) return { key: "over", label: "เกินความจุเก็บกัก" };
  if (percent > 80) return { key: "high", label: "น้ำมาก" };
  if (percent > 50) return { key: "medium", label: "น้ำปานกลาง" };
  if (percent > 30) return { key: "low", label: "น้ำน้อย" };
  return { key: "critical-low", label: "น้ำน้อยวิกฤต" };
}

// True when `next` carries the same source values as the last stored row, ignoring
// when we scraped it. Used so an unchanged reading is not appended every 15 minutes.
function isSameReading(prev, next) {
  if (!prev) return false;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  keys.delete("scrapedAt");
  for (const k of keys) if (prev[k] !== next[k]) return false;
  return true;
}

// Is the automatic collector alive? Uses the newest `scrapedAt` (when WE last ran)
// across all data files, which is separate from how old the SOURCE data is.
// "unknown" when no usable timestamp exists — never claims the collector is fine.
function collectorHealth(scrapedAts, nowMs, warnMinutes) {
  let latestMs = -Infinity;
  let latest = null;
  for (const iso of scrapedAts) {
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latest = iso;
    }
  }
  if (latest === null) return { status: "unknown", latest: null, ageMinutes: null };
  const ageMinutes = (nowMs - latestMs) / 60000;
  return { status: ageMinutes > warnMinutes ? "stale" : "ok", latest, ageMinutes };
}

// One point per SOURCE timestamp, oldest first (repeated scrapes of one unchanged
// reading collapse to a single point).
// How a series moved, using only the readings we have. `timeKey` is the SOURCE's
// own timestamp (repeated scrapes of one unchanged reading collapse to one point).
// Compares the newest reading with the oldest one still inside `windowHours`, and
// reports the real span so the UI never claims "3 h" when only 1 h of data exists.
// Returns null when there aren't two distinct readings: no data, no trend.
function seriesOf(rows, valueKey, timeKey) {
  const byTime = new Map();
  for (const r of rows) {
    const t = new Date(r[timeKey]).getTime();
    if (!Number.isNaN(t) && typeof r[valueKey] === "number") byTime.set(t, r[valueKey]);
  }
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));
}

// True when a source's own timestamp is later than `nowMs` by more than `toleranceMs`: the source
// mis-dated it (e.g. a day ahead), so it must not be stored or stretch the charts' shared time axis.
function isFutureReading(updatedAt, nowMs, toleranceMs = 3600000) {
  const t = new Date(updatedAt).getTime();
  return !Number.isNaN(t) && t > nowMs + toleranceMs;
}

const WINDOW_TOLERANCE_MS = 60 * 60000;

function trendOf(rows, valueKey, timeKey, windowHours, tolerance) {
  const points = seriesOf(rows, valueKey, timeKey).map((p) => [p.t, p.v]);
  if (points.length < 2) return null;
  const [latestT, latestV] = points[points.length - 1];
  const cutoff = latestT - windowHours * 3600000;
  // Every box compares over the same window: the reading nearest to `windowHours`
  // back, within ±1 h. A shorter/longer span reads as "not enough data" rather
  // than a differently-sized box that cannot be compared with its neighbours.
  const candidates = points.filter(([t]) => t < latestT && Math.abs(t - cutoff) <= WINDOW_TOLERANCE_MS);
  if (!candidates.length) return null;
  const first = candidates.reduce((a, b) => (Math.abs(b[0] - cutoff) < Math.abs(a[0] - cutoff) ? b : a));
  const delta = latestV - first[1];
  const prevV = points[points.length - 2][1];
  return {
    delta,
    // The newest step on its own: the net change can hide a late reversal.
    lastDelta: latestV - prevV,
    spanHours: (latestT - first[0]) / 3600000,
    direction: Math.abs(delta) <= tolerance ? "steady" : delta > 0 ? "rising" : "falling",
  };
}

// What the tide hides and a flood shows: the latest FULL Bangkok day's tidal range, and how its
// high and low moved against the day before (a tide swing cancels out; a real rise lifts both).
// The change is null unless the previous entry is exactly the day before. Null with no full day.
function tideTrend(days) {
  const full = days.filter((d) => !d.partial);
  if (!full.length) return null;
  const last = full[full.length - 1];
  const prev = full[full.length - 2];
  const dayBefore = new Date(new Date(`${last.date}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const round2 = (n) => Math.round(n * 100) / 100;
  const adjacent = prev && prev.date === dayBefore;
  return {
    date: last.date,
    rangeM: round2(last.high - last.low),
    highDeltaM: adjacent ? round2(last.high - prev.high) : null,
    lowDeltaM: adjacent ? round2(last.low - prev.low) : null,
  };
}

// This site's OWN alert rule, chosen by the maintainer (not an official threshold, and not a
// source-published one, so it is never written into Status): true when the level is at least
// `marginM` above the bank height. False, never true, when either input is missing.
function aboveBankAlert(levelMsl, bankMsl, marginM) {
  const c = bankComparison(levelMsl, bankMsl);
  return c !== null && c.direction === "above" && Math.round((levelMsl - bankMsl) * 100) >= Math.round(marginM * 100);
}

// One value per Bangkok day from a series of reports, newest `maxDays` days, oldest first.
// A report stamped exactly midnight (EGAT's daily table, "24.00 น.") is the end of the day that
// just finished, so its day is the minute before. Where a day has several reports the one with
// the newest source time wins. Non-numeric values and unreadable times are ignored.
function dailyValues(rows, valueKey, timeKey, maxDays = 7) {
  const BKK_MS = 7 * 3600000;
  const byDay = new Map();
  for (const r of rows) {
    const ms = new Date(r[timeKey]).getTime();
    if (r[timeKey] == null || Number.isNaN(ms) || typeof r[valueKey] !== "number" || !Number.isFinite(r[valueKey])) continue;
    const date = new Date(ms - 60000 + BKK_MS).toISOString().slice(0, 10);
    const prev = byDay.get(date);
    if (!prev || ms >= prev.ms) byDay.set(date, { ms, v: r[valueKey] });
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-maxDays)
    .map(([date, { v }]) => ({ date, v }));
}

// A Site is a watched place with its own gauges and page (see CONTEXT.md). Every tracked
// river gauge belongs to exactly one Site; the Collector serves them all in one run.
const SITES = ["maeklong", "bangkruai"];

// Tracked river gauges, by ThaiWater station id, upstream to downstream within a Site.
// All verified against the live feed (the spec's original id 505018 turned out to be K.58
// บ้านปากแซง on the แควน้อย, which is used as a far-upstream gauge): 505018 K.58,
// 2679 K.11A บ้านวังขนาย, 832066 K.55A สะพานค่ายหลวง, 710 โพธาราม.
const TRACKED_STATIONS = [
  { id: 505018, file: "pak-saeng.json", site: "maeklong" },
  // K.37 บ้านวังเย็น (อ.ด่านมะขามเตี้ย): reports a discharge. Above the Mae Klong Dam by level
  // (31.77 m MSL against the dam's 22.76), so it sits before the Barrage in the river line.
  { id: 2571, file: "k37.json", site: "maeklong" },
  { id: 2679, file: "wang-khanai.json", site: "maeklong" },
  { id: 832066, file: "khai-luang.json", site: "maeklong" },
  { id: 710, file: "photharam.json", site: "maeklong" },
  // Bang Kruai Site (proxy gauges; ids re-verified by name against the live feed 2026-09-29).
  // `tidal` is configuration, not inferred: tidal gauges get a daily high/low, not a trend.
  // `summary` is the small per-gauge file the page reads instead of the full 10-minute history.
  { id: 5, file: "bkk003.json", summary: "daily-bkk003.json", site: "bangkruai", tidal: true }, // BKK003 คลองมหาสวัสดิ บางกรวย-สวนผัก
  { id: 2599, file: "c12.json", summary: "daily-c12.json", site: "bangkruai", tidal: true }, // C.12 สามเสน
  { id: 26, file: "cpy014.json", summary: "daily-cpy014.json", site: "bangkruai", tidal: true }, // CPY014 สะพานนวลฉวี ปากเกร็ด
  { id: 4, file: "cpy015.json", summary: "daily-cpy015.json", site: "bangkruai", tidal: true }, // CPY015 สะพานกรุงเทพ
  { id: 2744, file: "c13.json", summary: "daily-c13.json", site: "bangkruai", tidal: false }, // C.13 ท้ายเขื่อนเจ้าพระยา
];

// Stations ThaiWater serves only through the per-station `waterlevel_graph`, not the bulk
// `waterlevel_load`. `graphType` is that endpoint's station_type. Ids checked against the live
// station catalogue 2026-09-30 (.scratch/**/research/mae-klong-dam-data-sources.md).
const GRAPH_STATIONS = [
  { id: 700554, file: "barrage-snd04.json", site: "maeklong", graphType: "tele_waterlevel" }, // เขื่อนแม่กลอง (EGAT SND04): the Barrage, level only
  { id: 4007644, file: "k63.json", site: "maeklong", graphType: "tele_waterlevel" }, // K.63 บ้านใหม่, 4.26 km below K.11A: level and discharge
];

function stationsForSite(site) {
  return TRACKED_STATIONS.filter((s) => s.site === site);
}

// The Window: one span, in hours, for every hourly chart and trend on a page. The URL
// (`?window=12`, so a link can carry a view) beats the stored choice, which beats the default.
// A value that is not one of WINDOWS_H is ignored, never trusted.
const WINDOWS_H = [6, 12, 24];
const DEFAULT_WINDOW_H = 6;

function resolveWindow(search, stored) {
  const fromUrl = Number(new URLSearchParams(search || "").get("window"));
  const fromStore = Number(stored);
  if (WINDOWS_H.includes(fromUrl)) return fromUrl;
  if (WINDOWS_H.includes(fromStore)) return fromStore;
  return DEFAULT_WINDOW_H;
}

// When a trend reads "steady", per Window: a longer span lets a small drift add up, so it
// tolerates more. Gauge in metres; release in m3/s. PLACEHOLDERS for the maintainer to tune
// (24 h gauge = the old long-view value; release scaled from the old 10 m3/s at the same ratio).
// Discharge is in m3/s too.
const STEADY_TOLERANCE = {
  gauge: { 6: 0.03, 12: 0.04, 24: 0.05 },
  release: { 6: 10, 12: 13, 24: 17 },
  // River flow at K.37 / K.63 / K.55A runs around 2,000 m3/s, where 10 m3/s is noise. PLACEHOLDER,
  // about 2.5 % of that flow at 6 h, for the maintainer to tune.
  discharge: { 6: 50, 12: 75, 24: 100 },
};

function steadyTolerance(kind, windowH) {
  const table = STEADY_TOLERANCE[kind];
  return table[windowH] ?? table[DEFAULT_WINDOW_H];
}

// Time-axis ticks for a Window: every 1 / 2 / 4 h for 6 / 12 / 24 h, on whole Bangkok clock
// hours that are multiples of the step (so every box shares the same ticks). Bangkok is
// UTC+7, a whole-hour offset. `midnight` marks the date change, which a 24 h axis crosses.
const TICK_STEP_H = { 6: 1, 12: 2, 24: 4 };

function axisTicks(t0, tN, windowH) {
  const HOUR = 3600000;
  const step = TICK_STEP_H[windowH] ?? TICK_STEP_H[DEFAULT_WINDOW_H];
  const ticks = [];
  for (let t = Math.ceil(t0 / HOUR) * HOUR; t <= tN; t += HOUR) {
    const hour = (Math.floor(t / HOUR) + 7) % 24;
    if (hour % step === 0) ticks.push({ t, hour, midnight: hour === 0 });
  }
  return ticks;
}

// "YYYY-MM-DD" in Bangkok for a moment, `daysAgo` calendar days back. Bangkok is UTC+7 with no DST,
// so the fixed offset is exact. Used for the date range asked of the per-station graph feed.
function bangkokDate(ms, daysAgo) {
  return new Date(ms + 7 * 3600000 - daysAgo * 86400000).toISOString().slice(0, 10);
}

// Everything a small time-series chart draws, as numbers, so both pages draw the same thing.
// x is 0..1 across [startT, endT]; y is 0..1 from the TOP (larger values higher). `points` are
// { t: ms, v } and only those inside the Window count. The vertical scale is the data's own min and
// max (labelled by the caller), widened to `minRange` so a 1 cm wiggle does not look like a collapse,
// and widened again to include every `references[].v` (levels the page marks) so the distance to
// them shows (optionally only the ones near the readings, see `referenceProximity`). With `scaleSteps`
// (an ascending list, in the value's unit) the scale is rounded up to one of those steps instead of
// being exactly the data's range; `minRange` can still hold several charts to one larger scale. Extra keys on a
// reference (a name, a colour key) are passed through untouched.
// A stretch longer than `maxStepMs` between readings is a GAP: the line breaks there instead of a
// straight line crossing hours nobody measured, and the gap is reported (leading, internal or trailing).
// Null when no point is in the Window.
const CHART_PAD_Y = 0.1;
// Steps (metres) for a level chart's scale: 0.25 to 5 m, fine enough that the data fills over half of it.
const LEVEL_SCALE_STEPS_M = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5];
const CHART_SAME_LEVEL_Y = 0.03; // two levels closer than this (as a fraction of the plot height) are the same line

function chartModel(points, { startT, endT, minRange = 0, scaleSteps = null, references = [], referenceProximity = null, maxStepMs = 2 * 3600000 }) {
  if (!(endT > startT)) return null; // an axis that does not run forward has nothing to draw
  const pts = points
    .filter((p) => p.t >= startT && p.t <= endT && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  const xOf = (t) => (t - startT) / (endT - startT);
  // With `referenceProximity` (same unit as v) a reference is used only when it lies within that
  // distance of the readings in the Window (inside their range, or up to that far above or below it):
  // a line the water is nowhere near takes no space, and comes into view as the water approaches.
  const dataMin = Math.min(...pts.map((p) => p.v));
  const dataMax = Math.max(...pts.map((p) => p.v));
  references = references.filter(
    (r) => Number.isFinite(r.v) && (referenceProximity === null || (r.v >= dataMin - referenceProximity && r.v <= dataMax + referenceProximity)),
  );
  const refVals = references.map((r) => r.v);

  let min = Math.min(...pts.map((p) => p.v), ...refVals);
  let max = Math.max(...pts.map((p) => p.v), ...refVals);
  let range = Math.max(minRange, 1e-6); // never zero: a flat line must not divide by zero
  if (scaleSteps) {
    // The scale is the smallest step that holds the data (and the reference lines drawn), centred on
    // it: charts that land in the same step compare directly, and the data fills over half of it.
    const fit = scaleSteps.find((step) => step >= max - min - 1e-9);
    if (fit) range = Math.max(range, fit);
  }
  if (max - min < range) {
    const mid = (min + max) / 2;
    min = mid - range / 2;
    max = mid + range / 2;
  }
  const yOf = (v) => CHART_PAD_Y + (1 - 2 * CHART_PAD_Y) * ((max - v) / (max - min));

  const segments = [];
  let run = [];
  pts.forEach((p, i) => {
    if (i && p.t - pts[i - 1].t > maxStepMs) {
      segments.push(run);
      run = [];
    }
    run.push({ x: xOf(p.t), y: yOf(p.v) });
  });
  segments.push(run);

  const gaps = [];
  const edges = [startT, ...pts.map((p) => p.t), endT];
  for (let i = 1; i < edges.length; i++) {
    if (edges[i] - edges[i - 1] > maxStepMs) {
      gaps.push({ x0: xOf(edges[i - 1]), x1: xOf(edges[i]), hours: (edges[i] - edges[i - 1]) / 3600000 });
    }
  }

  const refPoints = references.filter((r) => Number.isFinite(r.v)).map((r) => ({ ...r, y: yOf(r.v) }));
  // Labels for the scale's two ends; each reference gets its own. An end label is dropped only when it
  // IS a reference (a reference is the highest or lowest value); one that is merely close stays, and
  // the renderer spaces the labels apart.
  const ends = [{ v: max, y: yOf(max) }, { v: min, y: yOf(min) }].filter((l) => !refPoints.some((r) => Math.abs(l.y - r.y) <= CHART_SAME_LEVEL_Y));
  const yLabels = [...refPoints, ...ends].sort((a, b) => a.y - b.y);

  const lastPt = pts[pts.length - 1];
  return {
    segments,
    gaps,
    missingHours: gaps.reduce((sum, g) => sum + g.hours, 0),
    min,
    max,
    yLabels,
    references: refPoints,
    last: { x: xOf(lastPt.t), y: yOf(lastPt.v) },
  };
}

// Where a discharge sits against a Channel capacity, as a fact (never a Status). Null when either
// figure is missing. The difference is in m3/s, 2 dp, always >= 0.
function channelCapacityComparison(dischargeM3s, capacityM3s) {
  const ok = (v) => typeof v === "number" && Number.isFinite(v);
  if (!ok(dischargeM3s) || !ok(capacityM3s)) return null;
  const diffM3s = Math.round(Math.abs(dischargeM3s - capacityM3s) * 100) / 100;
  return { direction: diffM3s === 0 ? "at" : dischargeM3s > capacityM3s ? "above" : "below", diffM3s };
}

// ThaiWater's per-station `waterlevel_graph` (the feed behind its chart): hourly points for a
// date range. It carries stations the bulk `waterlevel_load` omits (the Mae Klong Dam's station
// SND04, K.63). Hours the source has not filled yet come back with a null value: they are dropped,
// never stored as zero. Anything malformed gives no rows, not an exception.
function parseWaterLevelGraph(raw) {
  const data = raw && raw.data;
  const points = data && Array.isArray(data.graph_data) ? data.graph_data : [];
  const rows = points
    .filter((p) => p && strictNumberOrNull(p.value) !== null)
    .map((p) => ({
      updatedAt: toIsoBangkok(p.datetime),
      levelMsl: strictNumberOrNull(p.value),
      dischargeM3s: strictNumberOrNull(p.discharge),
    }));
  return { rows, bankMsl: data ? strictNumberOrNull(data.min_bank) : null };
}

// Which graph rows are not yet in the History: those strictly newer than the last stored
// `updatedAt`, oldest first. An empty History takes them all, which is how the first run
// backfills the days the response covers. History stays append-only and truthful.
function newGraphRows(history, rows) {
  const last = history.length ? new Date(history[history.length - 1].updatedAt).getTime() : -Infinity;
  return rows
    .filter((r) => new Date(r.updatedAt).getTime() > last)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

// EGAT's telemetry page (water.egat.co.th/telemeter/schematic): server-rendered HTML tables.
// Read ONLY for Channel capacity (ความจุลำน้ำ) of EGAT's own stations (VKD/SND codes; the RID
// K-station table below them is not read, we get those from ThaiWater). Columns are read by
// position, so the header is checked first: an unrecognised layout gives [], never shifted numbers.
// Dates are Buddhist-era dd-mm-yyyy hh:mm:ss in Bangkok time.
const EGAT_TELEMETRY_COLS = { code: 1, name: 2, time: 6, capacity: 7 };

function parseEgatChannelCapacity(html) {
  if (typeof html !== "string") return [];
  const text = (cell) => cell.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const out = [];
  for (const table of html.match(/<table[\s\S]*?<\/table>/g) || []) {
    const rows = (table.match(/<tr[\s\S]*?<\/tr>/g) || []).map((r) => (r.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || []).map(text));
    const header = rows.find((cells) => cells.length === 8 && cells[EGAT_TELEMETRY_COLS.code] === "รหัสสถานี");
    if (!header) continue;
    if (!header[EGAT_TELEMETRY_COLS.capacity].startsWith("ความจุลำน้ำ") || !header[EGAT_TELEMETRY_COLS.time].startsWith("ณ วัน")) return [];
    for (const cells of rows) {
      if (cells.length !== 8 || !/^(VKD|SND)\d+$/.test(cells[EGAT_TELEMETRY_COLS.code])) continue;
      const stamp = cells[EGAT_TELEMETRY_COLS.time].match(/^(\d\d)-(\d\d)-(\d{4}) (\d\d:\d\d:\d\d)$/);
      out.push({
        stationCode: cells[EGAT_TELEMETRY_COLS.code],
        name: cells[EGAT_TELEMETRY_COLS.name],
        capacityM3s: strictNumberOrNull(cells[EGAT_TELEMETRY_COLS.capacity].replace(/,/g, "")),
        asOf: stamp ? `${Number(stamp[3]) - 543}-${stamp[2]}-${stamp[1]}T${stamp[4]}+07:00` : null,
      });
    }
    break; // the first table with this header is EGAT's own
  }
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LEVEL_SCALE_STEPS_M, chartModel, bangkokDate, GRAPH_STATIONS, channelCapacityComparison, parseEgatChannelCapacity, newGraphRows, parseWaterLevelGraph, axisTicks, steadyTolerance, WINDOWS_H, DEFAULT_WINDOW_H, resolveWindow, aboveBankAlert, dailyValues, tideTrend, bankComparison, dailyHighLow, SITES, TRACKED_STATIONS, stationsForSite, isSameReading, collectorHealth, reservoirBand, seriesOf, isFutureReading, damCapacity, trendOf, parseWaterLevelRecord, deriveStatus, toIsoBangkok, parseReservoirRecord, parseReservoirReportDate, parseDamHourlyRecord, pickLatestDamHourly };
}
