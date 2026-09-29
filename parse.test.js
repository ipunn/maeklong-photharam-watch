// Tests for parse.js's pure, source-agnostic logic — run with `node --test`.
// No network, no DOM: only the exported pure functions.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseWaterLevelRecord, deriveStatus, toIsoBangkok, parseReservoirRecord, parseReservoirReportDate, parseDamHourlyRecord, pickLatestDamHourly, trendOf, damCapacity, reservoirBand, seriesOf, collectorHealth, isSameReading } = require("./parse.js");

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

// A real record captured from the same feed for station id 832066
// ("สะพานค่ายหลวง", Ban Pong) — the upstream bracket station. Deliberately run
// through the same parseWaterLevelRecord as โพธาราม, no station-specific parsing.
const RAW_KHAI_LUANG = {
  waterlevel_datetime: "2026-09-29 12:00",
  waterlevel_msl: "9.29",
  station: {
    id: 832066,
    tele_station_name: { th: "สะพานค่ายหลวง" },
    min_bank: 9,
    warning_level_m: null,
    critical_level_m: null,
  },
};

test("parseWaterLevelRecord parses the upstream Ban Pong station with the same function, neutral thresholds", () => {
  const parsed = parseWaterLevelRecord(RAW_KHAI_LUANG);
  assert.equal(parsed.stationId, 832066);
  assert.equal(parsed.name, "สะพานค่ายหลวง");
  assert.equal(parsed.levelMsl, 9.29);
  assert.equal(parsed.bankMsl, 9);
  assert.equal(parsed.updatedAt, "2026-09-29T12:00:00+07:00");
  assert.equal(parsed.thresholds, null);
  assert.equal(deriveStatus(parsed.levelMsl, parsed.thresholds), null);
});

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

// Real records from ThaiWater's dam feed (api-v3 .../analyst/dam, `dam_hourly`),
// captured 2026-09-29, trimmed to the fields parseDamHourlyRecord reads. Per the
// units research (.scratch/.../research/thaiwater-dam-feed-units.md), inflow and
// released are million m3 over the hour ending at dam_date (unit high confidence,
// per-hour basis medium), storage is million m3 stock.
const RAW_DAM_VAJIRALONGKORN = {
  dam_date: "2026-09-29 12:00",
  dam_storage: 8625.26,
  dam_inflow: 5.12,
  dam_level: 154.39,
  dam_released: 1.24,
  dam: { id: 56, dam_name: { th: "วชิราลงกรณ" } },
};

test("parseDamHourlyRecord extracts level, storage, inflow, release and the source's own timestamp", () => {
  const parsed = parseDamHourlyRecord(RAW_DAM_VAJIRALONGKORN);
  assert.equal(parsed.damId, 56);
  assert.equal(parsed.name, "วชิราลงกรณ");
  assert.equal(parsed.levelMsl, 154.39);
  assert.equal(parsed.storageMcm, 8625.26);
  assert.equal(parsed.inflowMcm, 5.12);
  assert.equal(parsed.releaseMcm, 1.24);
  assert.equal(parsed.reportedAt, "2026-09-29T12:00:00+07:00");
});

test("parseDamHourlyRecord converts the hourly release (million m3/h) to m3/s: 1.24 -> 344", () => {
  // 1.24 * 1,000,000 / 3600 = 344.4 m3/s, rounded to a whole number.
  assert.equal(parseDamHourlyRecord(RAW_DAM_VAJIRALONGKORN).releaseM3s, 344);
  assert.equal(parseDamHourlyRecord({ ...RAW_DAM_VAJIRALONGKORN, dam_released: 0 }).releaseM3s, 0);
});

test("parseDamHourlyRecord yields null, never 0, when the source omits a value", () => {
  const parsed = parseDamHourlyRecord({ ...RAW_DAM_VAJIRALONGKORN, dam_released: null });
  assert.equal(parsed.releaseMcm, null);
  assert.equal(parsed.releaseM3s, null);
});

test("pickLatestDamHourly returns the newest record for the dam, ignoring other dams and stale duplicates", () => {
  const records = [
    { ...RAW_DAM_VAJIRALONGKORN, dam_date: "2021-04-29 14:00", dam_released: 9 },
    RAW_DAM_VAJIRALONGKORN,
    { ...RAW_DAM_VAJIRALONGKORN, dam: { id: 54, dam_name: { th: "ศรีนครินทร์" } }, dam_released: 0 },
  ];
  const picked = pickLatestDamHourly(records, 56);
  assert.equal(picked.dam_released, 1.24);
  assert.equal(pickLatestDamHourly(records, 999), null);
});

// Real capture of https://water.egat.co.th/water_crisis.php (28 ก.ย. 2569).
const EGAT_HTML = fs.readFileSync(path.join(__dirname, "fixtures", "egat-water-crisis.html"), "utf8");
const byName = (records, name) => records.find((r) => r.name === name);

test("parseReservoirRecord extracts Vajiralongkorn's storage %, level and release rate from the real EGAT page", () => {
  const dam = byName(parseReservoirRecord(EGAT_HTML), "วชิราลงกรณ");
  // Page row: level 154.15, storage 96.32%, release 0.00 MCM/day.
  assert.deepEqual(dam, { name: "วชิราลงกรณ", storagePercent: 96.32, storageMcm: 8534, levelMsl: 154.15, releaseRateM3s: 0 });
});

test("parseReservoirRecord extracts Srinakarin and converts its MCM/day release to m3/s", () => {
  const dam = byName(parseReservoirRecord(EGAT_HTML), "ศรีนครินทร์");
  // Page row: level 176.65, storage 92.27%, release 0.66 MCM/day
  // == 0.66 * 1,000,000 / 86,400 = 7.64 m3/s (hand-worked, 2 dp).
  assert.deepEqual(dam, { name: "ศรีนครินทร์", storagePercent: 92.27, storageMcm: 16374, levelMsl: 176.65, releaseRateM3s: 7.64 });
});

test("parseReservoirRecord returns only the two tracked dams, ignoring every other row", () => {
  const names = parseReservoirRecord(EGAT_HTML).map((r) => r.name).sort();
  assert.deepEqual(names, ["วชิราลงกรณ", "ศรีนครินทร์"].sort());
});

test("parseReservoirReportDate reads the page's own report time (Buddhist year, 24.00 = end of day)", () => {
  // Header: "28 กันยายน 2569 เวลา 24.00 น." == end of 28 Sep 2026 == 00:00 on 29 Sep, Bangkok time.
  assert.equal(parseReservoirReportDate(EGAT_HTML), "2026-09-29T00:00:00+07:00");
});

test("parseReservoirReportDate handles an ordinary clock time", () => {
  assert.equal(
    parseReservoirReportDate("<h2>3 ตุลาคม 2569 เวลา 08.30 น.</h2>"),
    "2026-10-03T08:30:00+07:00",
  );
});

test("parseReservoirReportDate returns null when the page has no recognisable report time — never guesses", () => {
  assert.equal(parseReservoirReportDate("<h2>สถานการณ์น้ำ</h2>"), null);
  assert.equal(parseReservoirReportDate("<h2>3 เดือนลับ 2569 เวลา 08.30 น.</h2>"), null);
});

test("parseReservoirRecord omits a dam whose row is absent, and yields nulls for non-numeric cells", () => {
  const row = (name, cells) => `<tr><td><p4>${name}</p4></td>${cells.map((c) => `<td><p4>${c}</p4></td>`).join("")}</tr>`;
  const html = `<table>${row("ศรีนครินทร์", ["176.65", "16,374", "92.27", "1", "1", "1", "1", "1", "1", "1", "-", "1"])}</table>`;
  const records = parseReservoirRecord(html);
  assert.equal(records.length, 1);
  assert.equal(records[0].releaseRateM3s, null);
  assert.equal(records[0].storagePercent, 92.27);
});

// trendOf: how a series moved over the data we actually have, up to a window.
// Rows are history rows; timeKey names the source's own timestamp (never scrapedAt,
// which repeats an unchanged reading).
const row = (t, v) => ({ updatedAt: `2026-09-29T${t}:00+07:00`, levelMsl: v });

test("trendOf reports a rise with its real time span and change", () => {
  const t = trendOf([row("09:00", 17.5), row("11:00", 17.6), row("12:00", 17.73)], "levelMsl", "updatedAt", 3, 0.02);
  assert.equal(t.direction, "rising");
  assert.equal(Number(t.delta.toFixed(2)), 0.23);
  assert.equal(t.spanHours, 3);
});

test("trendOf only looks back as far as the window and calls a tiny change steady", () => {
  const rows = [row("06:00", 10), row("11:00", 17.60), row("12:00", 17.61)];
  const t = trendOf(rows, "levelMsl", "updatedAt", 3, 0.02);
  assert.equal(t.direction, "steady");
  assert.equal(t.spanHours, 1);
});

test("trendOf reports a fall", () => {
  const t = trendOf([row("10:00", 54.65), row("12:00", 54.55)], "levelMsl", "updatedAt", 3, 0.02);
  assert.equal(t.direction, "falling");
});

test("trendOf ignores repeated readings and returns null when there is too little to compare — never guesses", () => {
  // Same source timestamp scraped several times is ONE reading.
  const repeated = [row("12:00", 9.29), row("12:00", 9.29), row("12:00", 9.29)];
  assert.equal(trendOf(repeated, "levelMsl", "updatedAt", 3, 0.02), null);
  assert.equal(trendOf([], "levelMsl", "updatedAt", 3, 0.02), null);
  assert.equal(trendOf([row("11:00", null), row("12:00", 1)], "levelMsl", "updatedAt", 3, 0.02), null);
});

// damCapacity: hourly stored volume as a % of capacity. ThaiWater's own
// dam_storage_percent is 0 for these dams, so capacity is backed out of EGAT's
// row (storage MCM / storage %) instead. Both figures come from the sources.
test("damCapacity turns hourly storage into % of capacity and the room left (Vajiralongkorn)", () => {
  // EGAT 28 Sep: 8,534 MCM = 96.32% -> capacity ~8,860 MCM. Hourly 29 Sep 12:00: 8,625.26 MCM.
  const c = damCapacity(8625.26, 8534, 96.32);
  assert.equal(Math.round(c.capacityMcm), 8860);
  assert.ok(Math.abs(c.percent - 97.35) < 0.05, `percent ${c.percent}`);
  assert.equal(Math.round(c.remainingMcm), 235);
});

test("damCapacity returns null when any input is missing or unusable — never guesses a capacity", () => {
  assert.equal(damCapacity(null, 8534, 96.32), null);
  assert.equal(damCapacity(8625, null, 96.32), null);
  assert.equal(damCapacity(8625, 8534, 0), null);
  assert.equal(damCapacity(8625, 8534, null), null);
});

// reservoirBand: the official reservoir-storage status bands (Royal Irrigation Dept,
// as printed in ThaiWater's report notes): >100 over capacity, >80-100 น้ำมาก,
// >50-80 น้ำปานกลาง, >30-50 น้ำน้อย, <=30 น้ำน้อยวิกฤต. Boundaries are exclusive-low.
test("reservoirBand follows the official bands, including the exact boundaries", () => {
  assert.equal(reservoirBand(100.01).key, "over");
  assert.equal(reservoirBand(100).key, "high"); // >80-100
  assert.equal(reservoirBand(97.4).key, "high");
  assert.equal(reservoirBand(80.01).key, "high");
  assert.equal(reservoirBand(80).key, "medium"); // >50-80
  assert.equal(reservoirBand(50.01).key, "medium");
  assert.equal(reservoirBand(50).key, "low"); // >30-50
  assert.equal(reservoirBand(30.01).key, "low");
  assert.equal(reservoirBand(30).key, "critical-low"); // <=30
  assert.equal(reservoirBand(0).key, "critical-low");
});

test("reservoirBand labels are the official Thai terms and unknown input is null", () => {
  assert.equal(reservoirBand(97.4).label, "น้ำมาก");
  assert.equal(reservoirBand(101).label, "เกินความจุเก็บกัก");
  assert.equal(reservoirBand(null), null);
  assert.equal(reservoirBand(NaN), null);
});

test("seriesOf keeps one point per source timestamp, sorted, dropping non-numeric values", () => {
  const rows = [row("12:00", 5), row("11:00", 4), row("12:00", 5), row("10:00", null)];
  const pts = seriesOf(rows, "levelMsl", "updatedAt");
  assert.deepEqual(pts.map((p) => p.v), [4, 5]);
  assert.ok(pts[0].t < pts[1].t);
});

// The net change can hide a reversal: 4.96 -> 5.00 -> 4.99 is "up 3 cm" overall
// but the latest step is DOWN 1 cm. trendOf exposes that last step so the UI can say so.
test("trendOf reports the latest step separately, so a late dip is not hidden by the net rise", () => {
  const rows = [row("12:40", 4.96), row("12:50", 4.98), row("13:00", 4.99), row("13:30", 5.0), row("13:40", 4.99)];
  const t = trendOf(rows, "levelMsl", "updatedAt", 3, 0.02);
  assert.equal(t.direction, "rising");
  assert.equal(Number((t.delta * 100).toFixed(0)), 3);
  assert.equal(Number((t.lastDelta * 100).toFixed(0)), -1);
});

test("trendOf lastDelta follows the newest two distinct readings", () => {
  const t = trendOf([row("10:00", 1), row("11:00", 2), row("12:00", 4)], "levelMsl", "updatedAt", 3, 0.02);
  assert.equal(t.lastDelta, 2);
});

// collectorHealth: is the automatic collector alive? Judged from the newest scrapedAt
// across every data file (when WE last ran), separate from how old the source data is.
const T = (iso) => new Date(iso).getTime();

test("collectorHealth uses the newest scrapedAt and reports its age", () => {
  const h = collectorHealth(["2026-09-29T07:00:00Z", "2026-09-29T07:10:00Z", "2026-09-29T06:00:00Z"], T("2026-09-29T07:25:00Z"), 45);
  assert.equal(h.status, "ok");
  assert.equal(h.ageMinutes, 15);
  assert.equal(h.latest, "2026-09-29T07:10:00Z");
});

test("collectorHealth flags a collector that has not run within the threshold", () => {
  const h = collectorHealth(["2026-09-29T07:00:00Z"], T("2026-09-29T07:46:00Z"), 45);
  assert.equal(h.status, "stale");
  assert.equal(collectorHealth(["2026-09-29T07:00:00Z"], T("2026-09-29T07:45:00Z"), 45).status, "ok"); // exactly at the limit
});

test("collectorHealth is 'unknown' with no usable timestamp — never claims the collector is fine", () => {
  assert.equal(collectorHealth([], Date.now(), 45).status, "unknown");
  assert.equal(collectorHealth([null, undefined, "garbage"], Date.now(), 45).status, "unknown");
});

// ---- review fixes ----

test("deriveStatus never guesses a colour for a missing level, even when thresholds exist", () => {
  const th = { warningM: 5, criticalM: 7 };
  assert.equal(deriveStatus(null, th), null); // null < 5 is true in JS: must not read as green
  assert.equal(deriveStatus(undefined, th), null);
  assert.equal(deriveStatus(NaN, th), null);
  assert.equal(deriveStatus("4.9", th), null); // only real numbers are banded
});

test("damCapacity never reports negative room left when storage exceeds the derived capacity", () => {
  const c = damCapacity(9000, 8534, 96.32); // more than the ~8,860 capacity backed out of EGAT
  assert.equal(c.remainingMcm, 0);
  assert.ok(c.percent > 100);
});

test("parseReservoirReportDate rejects a Gregorian year and an impossible calendar date instead of guessing", () => {
  assert.equal(parseReservoirReportDate("<h2>28 กันยายน 2026 เวลา 24.00 น.</h2>"), null); // year must be Buddhist
  assert.equal(parseReservoirReportDate("<h2>31 กันยายน 2569 เวลา 08.00 น.</h2>"), null); // September has 30 days
  assert.equal(parseReservoirReportDate("<h2>30 กันยายน 2569 เวลา 08.00 น.</h2>"), "2026-09-30T08:00:00+07:00");
});

test("isSameReading ignores scrapedAt and compares the source's values", () => {
  const a = { scrapedAt: "2026-09-29T07:00:00Z", updatedAt: "2026-09-29T14:00:00+07:00", levelMsl: 5, status: null };
  assert.equal(isSameReading(a, { ...a, scrapedAt: "2026-09-29T07:15:00Z" }), true);
  assert.equal(isSameReading(a, { ...a, levelMsl: 5.01 }), false);
  assert.equal(isSameReading(a, { ...a, updatedAt: "2026-09-29T14:10:00+07:00" }), false);
  assert.equal(isSameReading(undefined, a), false); // nothing to compare with: append
  assert.equal(isSameReading({ ...a, extra: 1 }, a), false); // different shape is not the same reading
});
