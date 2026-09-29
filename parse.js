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
const RESERVOIR_COL = { levelMsl: 0, storagePercent: 2, releaseMcmPerDay: 10 };

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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseWaterLevelRecord, deriveStatus, toIsoBangkok, parseReservoirRecord, parseReservoirReportDate };
}
