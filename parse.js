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
  };
}

// Bands a station's current level against its own sourced thresholds.
// Deliberately never defaults to "green"/any color when no threshold is
// known — an unsourced guess is worse than no color at all.
function deriveStatus(levelMsl, thresholds) {
  if (!thresholds) return null;
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
  const year = Number(m[3]) - 543;
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
    remainingMcm: capacityMcm - hourlyStorageMcm,
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

function trendOf(rows, valueKey, timeKey, windowHours, tolerance) {
  const points = seriesOf(rows, valueKey, timeKey).map((p) => [p.t, p.v]);
  if (points.length < 2) return null;
  const [latestT, latestV] = points[points.length - 1];
  const cutoff = latestT - windowHours * 3600000;
  const first = points.find(([t]) => t >= cutoff && t < latestT);
  if (!first) return null;
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { collectorHealth, reservoirBand, seriesOf, damCapacity, trendOf, parseWaterLevelRecord, deriveStatus, toIsoBangkok, parseReservoirRecord, parseReservoirReportDate, parseDamHourlyRecord, pickLatestDamHourly };
}
