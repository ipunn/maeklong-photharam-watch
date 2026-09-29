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

function stationsForSite(site) {
  return TRACKED_STATIONS.filter((s) => s.site === site);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { aboveBankAlert, dailyValues, tideTrend, bankComparison, dailyHighLow, SITES, TRACKED_STATIONS, stationsForSite, isSameReading, collectorHealth, reservoirBand, seriesOf, damCapacity, trendOf, parseWaterLevelRecord, deriveStatus, toIsoBangkok, parseReservoirRecord, parseReservoirReportDate, parseDamHourlyRecord, pickLatestDamHourly };
}
