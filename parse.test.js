// Tests for parse.js's pure, source-agnostic logic — run with `node --test`.
// No network, no DOM: only the exported pure functions.
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseWaterLevelRecord, deriveStatus, toIsoBangkok } = require("./parse.js");

// A real record captured from api-v3.thaiwater.net's waterlevel_load feed
// for station id 710 ("โพธาราม") on 2026-09-29, trimmed to the fields
// parseWaterLevelRecord reads.
const RAW_PHOTHARAM = {
  waterlevel_datetime: "2026-09-29 12:30",
  waterlevel_msl: "4.96",
  diff_wl_bank: "2.84",
  station: {
    id: 710,
    tele_station_name: { en: "Ratchaburi 1", th: "โพธาราม" },
    min_bank: 7.8,
    warning_level_m: null,
    critical_level_m: null,
  },
};

test("parseWaterLevelRecord extracts stationId, name, levelMsl, bankMsl, updatedAt", () => {
  const parsed = parseWaterLevelRecord(RAW_PHOTHARAM);
  assert.equal(parsed.stationId, 710);
  assert.equal(parsed.name, "โพธาราม");
  assert.equal(parsed.levelMsl, 4.96);
  assert.equal(parsed.bankMsl, 7.8);
  assert.equal(parsed.updatedAt, "2026-09-29T12:30:00+07:00");
});

test("parseWaterLevelRecord carries the station's own thresholds through untouched", () => {
  const withThresholds = {
    ...RAW_PHOTHARAM,
    station: { ...RAW_PHOTHARAM.station, warning_level_m: 6.5, critical_level_m: 7.2 },
  };
  const parsed = parseWaterLevelRecord(withThresholds);
  assert.deepEqual(parsed.thresholds, { warningM: 6.5, criticalM: 7.2 });
});

test("parseWaterLevelRecord's thresholds are null when the source has no published threshold", () => {
  const parsed = parseWaterLevelRecord(RAW_PHOTHARAM);
  assert.equal(parsed.thresholds, null);
});

test("toIsoBangkok treats a naive ThaiWater timestamp as Bangkok time (UTC+7), not the runtime's local timezone", () => {
  // "2026-09-29 12:30" Bangkok local == "2026-09-29T05:30:00.000Z" UTC.
  assert.equal(toIsoBangkok("2026-09-29 12:30"), "2026-09-29T12:30:00+07:00");
  assert.equal(new Date(toIsoBangkok("2026-09-29 12:30")).toISOString(), "2026-09-29T05:30:00.000Z");
});

test("deriveStatus returns null (neutral) when no threshold is known — never guesses a color", () => {
  assert.equal(deriveStatus(4.96, null), null);
});

test("deriveStatus bands a level below its warning threshold as green", () => {
  assert.equal(deriveStatus(5, { warningM: 6.5, criticalM: 7.2 }), "green");
});

test("deriveStatus bands a level at/above warning but below critical as yellow", () => {
  assert.equal(deriveStatus(6.5, { warningM: 6.5, criticalM: 7.2 }), "yellow");
  assert.equal(deriveStatus(7, { warningM: 6.5, criticalM: 7.2 }), "yellow");
});

test("deriveStatus bands a level at/above critical as red", () => {
  assert.equal(deriveStatus(7.2, { warningM: 6.5, criticalM: 7.2 }), "red");
  assert.equal(deriveStatus(8, { warningM: 6.5, criticalM: 7.2 }), "red");
});
