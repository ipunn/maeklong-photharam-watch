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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseWaterLevelRecord, deriveStatus, toIsoBangkok };
}
