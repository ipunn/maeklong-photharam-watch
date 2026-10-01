// Tests for parse.js's pure, source-agnostic logic — run with `node --test`.
// No network, no DOM: only the exported pure functions.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseWaterLevelRecord, deriveStatus, toIsoBangkok, parseReservoirRecord, parseReservoirReportDate, parseDamHourlyRecord, pickLatestDamHourly, trendOf, damCapacity, reservoirBand, seriesOf, collectorHealth, isSameReading, SITES, TRACKED_STATIONS, stationsForSite, bankComparison, dailyHighLow, tideTrend, dailyValues, aboveBankAlert, resolveWindow, steadyTolerance, axisTicks, parseWaterLevelGraph, newGraphRows, parseEgatChannelCapacity, channelCapacityComparison, GRAPH_STATIONS, bangkokDate, chartModel, LEVEL_SCALE_STEPS_M, isFutureReading, gaugesForSite, graphStationsForSource, RIVERLINE, riverlineStrip, isStaleReading } = require("./parse.js");

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

test("trendOf uses the same window for every series: nearest reading to the window start, else null", () => {
  // Only 1 h back is outside the ±1 h tolerance of a 3 h window -> no box-specific shorter span.
  assert.equal(trendOf([row("11:00", 1), row("12:00", 2)], "levelMsl", "updatedAt", 3, 0.02), null);
  // 09:10 is 10 min off the 09:00 window start and nearer than 08:40, so it is the reference.
  const t = trendOf([row("08:40", 1), row("09:10", 1.5), row("12:00", 2)], "levelMsl", "updatedAt", 3, 0.02);
  assert.equal(Number(t.spanHours.toFixed(2)), 2.83);
});

test("trendOf only looks back as far as the window and calls a tiny change steady", () => {
  const rows = [row("06:00", 10), row("09:00", 17.60), row("12:00", 17.61)];
  const t = trendOf(rows, "levelMsl", "updatedAt", 3, 0.02);
  assert.equal(t.direction, "steady");
  assert.equal(t.spanHours, 3);
});

test("trendOf reports a fall", () => {
  const t = trendOf([row("09:00", 54.65), row("12:00", 54.55)], "levelMsl", "updatedAt", 3, 0.02);
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
  const t = trendOf(rows, "levelMsl", "updatedAt", 1, 0.02);
  assert.equal(t.direction, "rising");
  assert.equal(Number((t.delta * 100).toFixed(0)), 3);
  assert.equal(Number((t.lastDelta * 100).toFixed(0)), -1);
});

test("trendOf lastDelta follows the newest two distinct readings", () => {
  const t = trendOf([row("09:00", 1), row("11:00", 2), row("12:00", 4)], "levelMsl", "updatedAt", 3, 0.02);
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

test("the bulk feed tracks Photharam; the other Mae Klong gauges come from the per-station graph feed", () => {
  assert.deepEqual(stationsForSite("maeklong").map((s) => s.id), [710, 755]); // 755 = MKG006 พระรามสอง, the mouth
  assert.deepEqual(GRAPH_STATIONS.filter((s) => s.site === "maeklong").map((s) => s.id), [505018, 2571, 2679, 832066, 700554, 4007644, 832068, 832069]);
});

test("stationsForSite returns nothing for an unknown Site — never another Site's gauges", () => {
  assert.deepEqual(stationsForSite("nowhere"), []);
});

test("every tracked station has exactly one known Site and no station is listed twice", () => {
  for (const s of TRACKED_STATIONS) assert.ok(SITES.includes(s.site), `station ${s.id} has unknown site ${s.site}`);
  const ids = TRACKED_STATIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const files = TRACKED_STATIONS.map((s) => s.file);
  assert.equal(new Set(files).size, files.length);
});

test("graph-fed stations have a known Site and never share an id or a history file with a tracked station", () => {
  for (const s of GRAPH_STATIONS) assert.ok(SITES.includes(s.site), `station ${s.id} has unknown site ${s.site}`);
  const all = [...TRACKED_STATIONS, ...GRAPH_STATIONS];
  assert.equal(new Set(all.map((s) => s.id)).size, all.length);
  assert.equal(new Set(all.map((s) => s.file)).size, all.length);
});

// Real records captured from the waterlevel_load feed on 2026-09-29 for the Bang Kruai Site,
// trimmed to the fields parseWaterLevelRecord reads.
const RAW_BKK003 = {
  waterlevel_datetime: "2026-09-29 19:30",
  waterlevel_msl: "2.15",
  discharge: null,
  station: { id: 5, tele_station_name: { th: "คลองมหาสวัสดิ บางกรวย-สวนผัก" }, min_bank: 2.07, warning_level_m: null, critical_level_m: null },
};
const RAW_C12 = {
  waterlevel_datetime: "2026-09-29 20:00",
  waterlevel_msl: "2.06",
  discharge: null,
  station: { id: 2599, tele_station_name: { th: "กรมชลประทานสามเสน" }, min_bank: 2.26, warning_level_m: null, critical_level_m: null },
};
const RAW_CPY014 = {
  waterlevel_datetime: "2026-09-29 20:40",
  waterlevel_msl: "2.51",
  discharge: null,
  station: { id: 26, tele_station_name: { th: "สะพานนวลฉวี" }, min_bank: 2.5, warning_level_m: null, critical_level_m: null },
};
const RAW_CPY015 = {
  waterlevel_datetime: "2026-09-29 20:40",
  waterlevel_msl: "1.40",
  discharge: null,
  station: { id: 4, tele_station_name: { th: "สะพานกรุงเทพ" }, min_bank: 2.16, warning_level_m: null, critical_level_m: null },
};
const RAW_C13 = {
  waterlevel_datetime: "2026-09-29 20:00",
  waterlevel_msl: "14.74",
  discharge: "2022.00",
  station: { id: 2744, tele_station_name: { th: "ท้ายเขื่อนเจ้าพระยา" }, min_bank: 16.34, warning_level_m: null, critical_level_m: 16.34 },
};

test("parseWaterLevelRecord parses each Bang Kruai gauge with the one river parser", () => {
  const expected = [
    [RAW_BKK003, 5, 2.15, 2.07],
    [RAW_C12, 2599, 2.06, 2.26],
    [RAW_CPY014, 26, 2.51, 2.5],
    [RAW_CPY015, 4, 1.4, 2.16],
    [RAW_C13, 2744, 14.74, 16.34],
  ];
  for (const [raw, id, level, bank] of expected) {
    const p = parseWaterLevelRecord(raw);
    assert.equal(p.stationId, id);
    assert.equal(p.levelMsl, level);
    assert.equal(p.bankMsl, bank);
    assert.equal(p.thresholds, null);
    assert.equal(deriveStatus(p.levelMsl, p.thresholds), null);
  }
});

test("C.13's critical_level_m (equal to its bank) is not a threshold: no warning level, so neutral", () => {
  const p = parseWaterLevelRecord(RAW_C13);
  assert.equal(p.thresholds, null);
});

test("parseWaterLevelRecord reads discharge as a number, null when absent or non-numeric — never 0", () => {
  assert.equal(parseWaterLevelRecord(RAW_C13).dischargeM3s, 2022);
  assert.equal(parseWaterLevelRecord(RAW_C12).dischargeM3s, null);
  for (const bad of ["", " ", "-", "n/a", undefined]) {
    assert.equal(parseWaterLevelRecord({ ...RAW_C13, discharge: bad }).dischargeM3s, null, JSON.stringify(bad));
  }
  assert.equal(parseWaterLevelRecord({ ...RAW_C13, discharge: "0.00" }).dischargeM3s, 0); // a real zero is kept
});

test("bankComparison states where the level sits against the bank, with the difference in metres", () => {
  assert.deepEqual(bankComparison(2.15, 2.07), { direction: "above", diffM: 0.08 });
  assert.deepEqual(bankComparison(1.4, 2.16), { direction: "below", diffM: 0.76 });
  assert.deepEqual(bankComparison(2.5, 2.5), { direction: "at", diffM: 0 });
});

test("bankComparison is null when the level or the bank is missing — never guesses", () => {
  assert.equal(bankComparison(null, 2.07), null);
  assert.equal(bankComparison(2.15, null), null);
  assert.equal(bankComparison(undefined, undefined), null);
  assert.equal(bankComparison(NaN, 2), null);
});

const histRow = (updatedAt, levelMsl, scrapedAt = "2026-09-30T00:00:00Z") => ({ scrapedAt, updatedAt, levelMsl });
const NOW = new Date("2026-09-30T12:00:00+07:00").getTime();

test("dailyHighLow gives a day's high and low with their times", () => {
  const days = dailyHighLow(
    [histRow("2026-09-28T03:00:00+07:00", 1.2), histRow("2026-09-28T09:10:00+07:00", 2.4), histRow("2026-09-28T15:00:00+07:00", 0.9), histRow("2026-09-28T21:00:00+07:00", 2.1)],
    NOW,
  );
  assert.deepEqual(days, [
    { date: "2026-09-28", high: 2.4, highAt: "2026-09-28T09:10:00+07:00", low: 0.9, lowAt: "2026-09-28T15:00:00+07:00", partial: false },
  ]);
});

test("dailyHighLow splits days at Bangkok midnight, whatever the runtime timezone", () => {
  const days = dailyHighLow([histRow("2026-09-28T23:50:00+07:00", 2), histRow("2026-09-29T00:10:00+07:00", 1)], NOW);
  assert.deepEqual(days.map((d) => [d.date, d.high, d.low]), [["2026-09-28", 2, 2], ["2026-09-29", 1, 1]]);
});

test("dailyHighLow uses updatedAt, not scrapedAt, and copes with out-of-order rows", () => {
  const days = dailyHighLow(
    [histRow("2026-09-29T10:00:00+07:00", 1.5, "2026-09-30T05:00:00Z"), histRow("2026-09-28T10:00:00+07:00", 2.5, "2026-09-30T06:00:00Z"), histRow("2026-09-29T02:00:00+07:00", 0.5, "2026-09-30T04:00:00Z")],
    NOW,
  );
  assert.deepEqual(days.map((d) => [d.date, d.high, d.low]), [["2026-09-28", 2.5, 2.5], ["2026-09-29", 1.5, 0.5]]);
});

test("dailyHighLow ignores non-numeric levels and unreadable times", () => {
  const days = dailyHighLow([histRow("2026-09-28T10:00:00+07:00", null), histRow("2026-09-28T11:00:00+07:00", "x"), histRow("bad", 3), histRow("2026-09-28T12:00:00+07:00", 1.1)], NOW);
  assert.deepEqual(days.map((d) => [d.date, d.high, d.low]), [["2026-09-28", 1.1, 1.1]]);
});

test("dailyHighLow handles a single-reading day and empty input", () => {
  assert.equal(dailyHighLow([histRow("2026-09-28T10:00:00+07:00", 1.1)], NOW).length, 1);
  assert.deepEqual(dailyHighLow([], NOW), []);
});

test("dailyHighLow marks the current Bangkok day partial, and only that day", () => {
  const days = dailyHighLow([histRow("2026-09-29T10:00:00+07:00", 1), histRow("2026-09-30T00:05:00+07:00", 1.2)], NOW);
  assert.deepEqual(days.map((d) => [d.date, d.partial]), [["2026-09-29", false], ["2026-09-30", true]]);
});

test("Bang Kruai Site gauges: exactly its five, tidal set in config, none shared with Mae Klong", () => {
  const bk = stationsForSite("bangkruai");
  assert.deepEqual(bk.map((s) => s.id), [5, 2599, 26, 4, 2744]);
  assert.deepEqual(bk.filter((s) => s.tidal).map((s) => s.id), [5, 2599, 26, 4]);
  const mk = new Set(stationsForSite("maeklong").map((s) => s.id));
  assert.ok(bk.every((s) => !mk.has(s.id)));
  assert.equal(TRACKED_STATIONS.length, bk.length + mk.size);
});

const D = (date, high, low, partial = false) => ({ date, high, highAt: null, low, lowAt: null, partial });

test("tideTrend gives the latest full day's range and its high/low change against the day before", () => {
  const t = tideTrend([D("2026-09-27", 2.0, 0.9), D("2026-09-28", 2.3, 1.0), D("2026-09-29", 2.4, 1.1, true)]);
  assert.deepEqual(t, { date: "2026-09-28", rangeM: 1.3, highDeltaM: 0.3, lowDeltaM: 0.1 });
});

test("tideTrend gives no change when the previous day is missing or not the day before — never compares across a gap", () => {
  assert.deepEqual(tideTrend([D("2026-09-28", 2.3, 1.0)]), { date: "2026-09-28", rangeM: 1.3, highDeltaM: null, lowDeltaM: null });
  assert.equal(tideTrend([D("2026-09-25", 2, 1), D("2026-09-28", 2.3, 1.0)]).highDeltaM, null);
});

test("tideTrend is null with no full day yet", () => {
  assert.equal(tideTrend([]), null);
  assert.equal(tideTrend([D("2026-09-29", 2.4, 1.1, true)]), null);
});

const rep = (reportedAt, storagePercent, scrapedAt = "2026-10-01T00:00:00Z") => ({ scrapedAt, reportedAt, storagePercent });

test("dailyValues gives one value per report day; EGAT's midnight stamp belongs to the day that just ended", () => {
  const days = dailyValues([rep("2026-09-29T00:00:00+07:00", 92.3), rep("2026-09-28T00:00:00+07:00", 92.1)], "storagePercent", "reportedAt");
  assert.deepEqual(days, [{ date: "2026-09-27", v: 92.1 }, { date: "2026-09-28", v: 92.3 }]);
});

test("dailyValues keeps the latest report per day, drops non-numbers and unreadable times, and caps at the newest N days", () => {
  const rows = [
    rep("2026-09-29T00:00:00+07:00", 90), rep("2026-09-29T00:00:00+07:00", 91, "2026-10-02T00:00:00Z"),
    rep("2026-09-28T00:00:00+07:00", null), rep(null, 50), rep("bad", 60),
    ...[20, 21, 22, 23, 24, 25, 26, 27].map((d, i) => rep(`2026-09-${d}T00:00:00+07:00`, 80 + i)),
  ];
  const days = dailyValues(rows, "storagePercent", "reportedAt", 7);
  assert.equal(days.length, 7);
  assert.deepEqual(days[days.length - 1], { date: "2026-09-28", v: 91 });
  assert.equal(days[0].date, "2026-09-21");
  assert.deepEqual(dailyValues([], "storagePercent", "reportedAt", 7), []);
});

test("aboveBankAlert is true only when the level is at least the alert margin above the bank", () => {
  assert.equal(aboveBankAlert(3.07, 2.07, 1), true); // exactly 1 m above
  assert.equal(aboveBankAlert(3.5, 2.07, 1), true);
  assert.equal(aboveBankAlert(3.06, 2.07, 1), false);
  assert.equal(aboveBankAlert(2.15, 2.07, 1), false);
  assert.equal(aboveBankAlert(1.0, 2.07, 1), false); // below the bank is never an alert
});

test("aboveBankAlert is false — never true — when the level or the bank is missing", () => {
  assert.equal(aboveBankAlert(null, 2.07, 1), false);
  assert.equal(aboveBankAlert(3.5, null, 1), false);
  assert.equal(aboveBankAlert(NaN, 2, 1), false);
});

// ---- Window: the one span (6/12/24 h) every hourly chart and trend follows ----

test("resolveWindow: the URL beats the stored choice, which beats the 6 h default", () => {
  assert.equal(resolveWindow("", null), 6);
  assert.equal(resolveWindow("", "12"), 12);
  assert.equal(resolveWindow("?window=24", "12"), 24);
  assert.equal(resolveWindow("?x=1&window=12", null), 12);
});

test("resolveWindow: an unsupported or garbled value falls back instead of breaking the page", () => {
  assert.equal(resolveWindow("?window=48", null), 6);
  assert.equal(resolveWindow("?window=abc", "24"), 24); // bad URL value: use the stored one
  assert.equal(resolveWindow("", "7"), 6);
  assert.equal(resolveWindow(undefined, undefined), 6); // storage blocked or no location
});

test("steadyTolerance: a longer Window tolerates more drift before it stops reading 'steady'", () => {
  assert.equal(steadyTolerance("gauge", 6), 0.03);
  assert.equal(steadyTolerance("gauge", 12), 0.04);
  assert.equal(steadyTolerance("gauge", 24), 0.05);
  assert.equal(steadyTolerance("release", 6), 10);
  assert.ok(steadyTolerance("release", 24) > steadyTolerance("release", 12));
  assert.ok(steadyTolerance("release", 12) > steadyTolerance("release", 6));
});

test("steadyTolerance: an unsupported Window falls back to the default's tolerance", () => {
  assert.equal(steadyTolerance("gauge", 7), steadyTolerance("gauge", 6));
});

// Bangkok is UTC+7, so 11:00Z is 18:00 in Bangkok and 17:00Z is Bangkok midnight.
const Z = (iso) => Date.parse(iso);

test("axisTicks: 6 h Window ticks every whole Bangkok hour", () => {
  const ticks = axisTicks(Z("2026-09-29T05:00:00Z"), Z("2026-09-29T11:00:00Z"), 6);
  assert.deepEqual(ticks.map((k) => k.hour), [12, 13, 14, 15, 16, 17, 18]);
  assert.ok(ticks.every((k) => !k.midnight));
});

test("axisTicks: 12 h Window ticks every 2 h, on even Bangkok hours", () => {
  const ticks = axisTicks(Z("2026-09-29T04:30:00Z"), Z("2026-09-29T16:30:00Z"), 12);
  assert.deepEqual(ticks.map((k) => k.hour), [12, 14, 16, 18, 20, 22]);
});

test("axisTicks: 24 h Window ticks every 4 h and marks Bangkok midnight as the date change", () => {
  const ticks = axisTicks(Z("2026-09-29T11:00:00Z"), Z("2026-09-30T11:00:00Z"), 24);
  assert.deepEqual(ticks.map((k) => k.hour), [20, 0, 4, 8, 12, 16]);
  assert.deepEqual(ticks.filter((k) => k.midnight).map((k) => k.t), [Z("2026-09-29T17:00:00Z")]);
});

test("axisTicks: a tick on the right edge is kept, and each tick's t lies inside the axis", () => {
  const t0 = Z("2026-09-29T05:00:00Z");
  const tN = Z("2026-09-29T17:00:00Z"); // exactly Bangkok midnight
  const ticks = axisTicks(t0, tN, 12);
  assert.equal(ticks[ticks.length - 1].hour, 0);
  assert.ok(ticks[ticks.length - 1].midnight);
  assert.ok(ticks.every((k) => k.t >= t0 && k.t <= tN));
});

// trendOf across the Window: hourly readings, level rising 1 cm/h for 30 h, newest 2026-09-30 06:00 (+07:00)
const hourlyRise = Array.from({ length: 31 }, (_, i) => ({
  updatedAt: new Date(Date.parse("2026-09-29T00:00:00+07:00") + i * 3600000).toISOString(),
  levelMsl: 5 + i * 0.01,
}));

test("trendOf: the same series reads over 6, 12 and 24 h, each with its real span", () => {
  for (const w of [6, 12, 24]) {
    const t = trendOf(hourlyRise, "levelMsl", "updatedAt", w, steadyTolerance("gauge", w));
    assert.equal(t.spanHours, w);
    assert.equal(t.direction, "rising");
    assert.ok(Math.abs(t.delta - w * 0.01) < 1e-9);
  }
});

test("trendOf: a slow drift is 'steady' over 6 h but 'rising' over 24 h", () => {
  const slow = Array.from({ length: 25 }, (_, i) => ({
    updatedAt: new Date(Date.parse("2026-09-29T00:00:00+07:00") + i * 3600000).toISOString(),
    levelMsl: 5 + i * 0.004, // 0.4 cm/h: 2.4 cm over 6 h, 9.6 cm over 24 h
  }));
  assert.equal(trendOf(slow, "levelMsl", "updatedAt", 6, steadyTolerance("gauge", 6)).direction, "steady");
  assert.equal(trendOf(slow, "levelMsl", "updatedAt", 24, steadyTolerance("gauge", 24)).direction, "rising");
});

test("trendOf: no claim when history does not reach back the Window", () => {
  const eleven = hourlyRise.slice(0, 11); // only 10 h of history
  assert.equal(trendOf(eleven, "levelMsl", "updatedAt", 24, steadyTolerance("gauge", 24)), null);
  assert.ok(trendOf(eleven, "levelMsl", "updatedAt", 6, steadyTolerance("gauge", 6)));
});

// ---- Barrage (SND04) and K.63: ThaiWater's per-station waterlevel_graph, absent from waterlevel_load ----
// Real responses captured 2026-09-30 (fixtures/): 36 hourly rows from 2026-09-29 00:00.
const graphFixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `thaiwater-waterlevel-graph-${name}.json`), "utf8"));

test("parseWaterLevelGraph: the Barrage level series, Bangkok times, no discharge (it has none)", () => {
  const g = parseWaterLevelGraph(graphFixture("barrage-snd04"));
  assert.equal(g.rows.length, 36);
  assert.deepEqual(g.rows[g.rows.length - 1], { updatedAt: "2026-09-30T11:00:00+07:00", levelMsl: 22.757, dischargeM3s: null });
  assert.equal(g.bankMsl, 26.1);
  assert.ok(g.rows.every((r) => r.dischargeM3s === null));
});

test("parseWaterLevelGraph: hours the source has not filled yet are dropped, never stored as zero", () => {
  const g = parseWaterLevelGraph(graphFixture("k63"));
  // 36 rows in the response, 3 of them empty (the first hours and the newest, not yet reported)
  assert.equal(g.rows.length, 33);
  assert.deepEqual(g.rows[g.rows.length - 1], { updatedAt: "2026-09-30T10:00:00+07:00", levelMsl: 17.47, dischargeM3s: 2195.11499 });
  assert.ok(g.rows.every((r) => typeof r.levelMsl === "number"));
  assert.equal(g.bankMsl, 18);
});

test("parseWaterLevelGraph: a changed or empty response gives no rows instead of throwing", () => {
  assert.deepEqual(parseWaterLevelGraph(null).rows, []);
  assert.deepEqual(parseWaterLevelGraph({ result: "OK", data: {} }).rows, []);
  assert.deepEqual(parseWaterLevelGraph({ data: { graph_data: "oops" } }).rows, []);
});

test("newGraphRows: an empty history takes every row (the backfill on the first run)", () => {
  const { rows } = parseWaterLevelGraph(graphFixture("k63"));
  assert.equal(newGraphRows([], rows).length, 33);
});

test("newGraphRows: later runs add only hours newer than the last stored one, oldest first", () => {
  const { rows } = parseWaterLevelGraph(graphFixture("k63"));
  const history = [{ updatedAt: "2026-09-30T08:00:00+07:00", levelMsl: 17.4 }];
  const fresh = newGraphRows(history, [...rows].reverse());
  assert.deepEqual(fresh.map((r) => r.updatedAt), ["2026-09-30T09:00:00+07:00", "2026-09-30T10:00:00+07:00"]);
});

test("newGraphRows: nothing new, or a history already ahead of the response, adds nothing", () => {
  const { rows } = parseWaterLevelGraph(graphFixture("k63"));
  assert.deepEqual(newGraphRows([{ updatedAt: "2026-09-30T10:00:00+07:00" }], rows), []);
  assert.deepEqual(newGraphRows([{ updatedAt: "2026-10-01T00:00:00+07:00" }], rows), []);
});

// ---- EGAT telemetry page: read only for Channel capacity (ความจุลำน้ำ) ----
// The real page captured 2026-09-30 (fixtures/). Columns are read by position, so a layout change
// must give nothing rather than shifted numbers (same risk as the EGAT reservoir page, ADR 0001).
const egatTelemetryHtml = fs.readFileSync(path.join(__dirname, "fixtures", "egat-telemetry-schematic.html"), "utf8");

test("parseEgatChannelCapacity: K.37's capacity and the source's own time, Buddhist year converted", () => {
  const rows = parseEgatChannelCapacity(egatTelemetryHtml);
  assert.equal(rows.length, 14); // EGAT's own telemetry table only, not the RID table below it
  const k37 = rows.find((r) => r.stationCode === "VKD06");
  assert.equal(k37.name, "บ้านวังเย็น (K.37)");
  assert.equal(k37.capacityM3s, 1955);
  assert.equal(k37.asOf, "2026-09-30T11:00:00+07:00");
});

test("parseEgatChannelCapacity: a station with no published capacity is null, never zero", () => {
  const rows = parseEgatChannelCapacity(egatTelemetryHtml);
  assert.equal(rows.find((r) => r.stationCode === "SND04").capacityM3s, null); // the Barrage
  assert.equal(rows.find((r) => r.stationCode === "VKD03").capacityM3s, 970);
});

test("parseEgatChannelCapacity: a reordered or missing capacity column gives nothing, not shifted numbers", () => {
  const swapped = egatTelemetryHtml.replace("ความจุลำน้ำ", "ปริมาณสูงสุด");
  assert.deepEqual(parseEgatChannelCapacity(swapped), []);
  assert.deepEqual(parseEgatChannelCapacity("<html><body>maintenance</body></html>"), []);
  assert.deepEqual(parseEgatChannelCapacity(""), []);
});

test("channelCapacityComparison: a fact, not a Status: above, at or below the source's figure with the difference", () => {
  assert.deepEqual(channelCapacityComparison(1996.98, 1955), { direction: "above", diffM3s: 41.98 });
  assert.deepEqual(channelCapacityComparison(1500, 1955), { direction: "below", diffM3s: 455 });
  assert.deepEqual(channelCapacityComparison(1955, 1955), { direction: "at", diffM3s: 0 });
});

test("channelCapacityComparison: no claim when either figure is missing", () => {
  assert.equal(channelCapacityComparison(null, 1955), null);
  assert.equal(channelCapacityComparison(1996.98, null), null);
  assert.equal(channelCapacityComparison(undefined, undefined), null);
});

test("steadyTolerance: river discharge (about 2,000 m3/s) tolerates far more than a dam release does", () => {
  assert.ok(steadyTolerance("discharge", 6) > steadyTolerance("release", 24));
  assert.ok(steadyTolerance("discharge", 24) > steadyTolerance("discharge", 12));
  assert.ok(steadyTolerance("discharge", 12) > steadyTolerance("discharge", 6));
  assert.equal(steadyTolerance("discharge", 7), steadyTolerance("discharge", 6));
});

test("bangkokDate: the Bangkok calendar day of a moment, N days back, across the UTC midnight boundary", () => {
  // Bangkok is UTC+7: 16:59Z is still 23:59 on the 30th, 17:00Z is already 00:00 on 1 Oct.
  assert.equal(bangkokDate(Date.parse("2026-09-30T16:59:00Z"), 0), "2026-09-30");
  assert.equal(bangkokDate(Date.parse("2026-09-30T17:00:00Z"), 0), "2026-10-01");
  assert.equal(bangkokDate(Date.parse("2026-09-30T04:47:00Z"), 1), "2026-09-29");
  assert.equal(bangkokDate(Date.parse("2026-03-01T03:00:00Z"), 1), "2026-02-28");
});

// ---- chartModel: everything a small time-series chart draws, as numbers (x 0..1 across the axis, y 0..1 top to bottom) ----
// BKK003's real history captured 2026-09-30 (fixtures/): the source reported nothing between 08:30 and 18:40.
const bkkRecent = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bkk003-recent-2026-09-30.json"), "utf8")).map((p) => ({ t: Date.parse(p.t), v: p.v }));
const bkkEnd = Date.parse("2026-09-30T21:00:00+07:00"); // the shared right edge: newest data hour, rounded up

test("chartModel: a 12 h Window over a 10 h outage shows one line and one honest gap, not a line across it", () => {
  const m = chartModel(bkkRecent, { startT: bkkEnd - 12 * 3600000, endT: bkkEnd, minRange: 0.1 });
  assert.equal(m.segments.length, 1);
  assert.equal(m.segments[0].length, 6); // 18:40, 19:10, 19:20, 20:00, 20:10, 20:30
  assert.equal(m.gaps.length, 1);
  assert.ok(Math.abs(m.gaps[0].hours - (9 + 40 / 60)) < 1e-9); // 09:00 -> 18:40
  assert.equal(m.gaps[0].x0, 0);
  assert.ok(Math.abs(m.missingHours - (9 + 40 / 60)) < 1e-9);
});

test("chartModel: a 24 h Window breaks the line at the outage, and a 1 h 40 min pause is not a gap", () => {
  const m = chartModel(bkkRecent, { startT: bkkEnd - 24 * 3600000, endT: bkkEnd, minRange: 0.1 });
  assert.equal(m.segments.length, 2); // 04:30 -> 06:10 (1 h 40) stays joined; 08:30 -> 18:40 splits
  assert.equal(m.gaps.length, 1);
  assert.ok(Math.abs(m.gaps[0].hours - (10 + 10 / 60)) < 1e-9); // 08:30 -> 18:40
  assert.ok(Math.abs(m.segments[1][0].x - (21 + 40 / 60) / 24) < 1e-9); // 18:40 is 21 h 40 min after 21:00 the day before
});

test("chartModel: the vertical scale is the data's own min and max, labelled, larger values higher", () => {
  const m = chartModel(bkkRecent, { startT: bkkEnd - 12 * 3600000, endT: bkkEnd, minRange: 0.1 });
  assert.deepEqual(m.yLabels.map((l) => l.v), [2.21, 1.99]); // max, min
  assert.ok(m.yLabels[0].y < m.yLabels[1].y);
  assert.equal(m.min, 1.99);
  assert.equal(m.max, 2.21);
  assert.equal(m.last.x < 1 && m.last.x > 0.9, true); // newest reading sits just left of the 21:00 edge
});

test("chartModel: reference levels are always inside the scale, so the distance to them is visible", () => {
  // Photharam's level 2026-09-30 (5.52-5.61 m) against a 6.00 m reference: without it the chart would zoom on 9 cm.
  const pts = [5.52, 5.55, 5.57, 5.61].map((v, i) => ({ t: 1000 + i * 3600000, v }));
  const m = chartModel(pts, { startT: 1000, endT: 1000 + 6 * 3600000, minRange: 0.1, references: [{ v: 6 }] });
  assert.equal(m.max, 6);
  assert.equal(m.min, 5.52);
  assert.equal(m.references[0].y, 0.1); // the top of the plot, where the scale ends
  assert.deepEqual(m.yLabels.map((l) => l.v), [6, 5.52]); // one label for 6.00, not two
  assert.ok(m.last.y > m.references[0].y); // the current level is below the reference line
});

test("chartModel: a flat series is not stretched into a dramatic line, and nothing in the Window gives null", () => {
  const flat = [0, 1, 2].map((i) => ({ t: 1000 + i * 3600000, v: 2 }));
  const m = chartModel(flat, { startT: 1000, endT: 1000 + 3 * 3600000, minRange: 0.1 });
  assert.ok(Math.abs(m.max - m.min - 0.1) < 1e-9);
  assert.equal(chartModel(bkkRecent, { startT: 0, endT: 1000, minRange: 0.1 }), null);
  assert.equal(chartModel([], { startT: 0, endT: 1000, minRange: 0.1 }), null);
});

test("chartModel: a gauge whose newest reading is old stops short of the edge and says so", () => {
  const pts = [{ t: 1000, v: 1 }, { t: 1000 + 3600000, v: 1.1 }];
  const m = chartModel(pts, { startT: 1000, endT: 1000 + 8 * 3600000, minRange: 0.1 });
  assert.equal(m.gaps.length, 1); // 1 h -> 8 h with nothing after the last reading
  assert.ok(Math.abs(m.gaps[0].hours - 7) < 1e-9);
  assert.ok(m.last.x < 0.2);
});

test("chartModel: flat data with no minimum range still gives a finite chart, never NaN", () => {
  const flat = [0, 1].map((i) => ({ t: 1000 + i * 3600000, v: 2 }));
  const m = chartModel(flat, { startT: 1000, endT: 1000 + 2 * 3600000, minRange: 0 });
  assert.ok(Number.isFinite(m.last.y));
  assert.ok(m.segments[0].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test("chartModel: an axis that does not run forward has nothing to draw", () => {
  assert.equal(chartModel([{ t: 1000, v: 1 }], { startT: 1000, endT: 1000, minRange: 0.1 }), null);
  assert.equal(chartModel([{ t: 1000, v: 1 }], { startT: 2000, endT: 1000, minRange: 0.1 }), null);
});

test("chartModel: a reference near, but not at, the top of the scale keeps the scale's own maximum labelled", () => {
  // Level 5.00-6.00 against a 5.95 reference: 6.00 is still the scale's top and must not vanish.
  const pts = [5, 5.5, 6].map((v, i) => ({ t: 1000 + i * 3600000, v }));
  const m = chartModel(pts, { startT: 1000, endT: 1000 + 3 * 3600000, minRange: 0.1, references: [{ v: 5.95 }] });
  assert.deepEqual(m.yLabels.map((l) => l.v), [6, 5.95, 5]);
});

test("chartModel: three reference levels (6.00, 6.50, 6.75) all sit inside the scale, in order, each labelled once", () => {
  // Photharam's level was 5.52-5.61 m; the page marks 6.00, 6.50 and 6.75 m. Extra keys (a name, a colour key) ride along.
  const pts = [5.52, 5.55, 5.57, 5.61].map((v, i) => ({ t: 1000 + i * 3600000, v }));
  const refs = [{ v: 6, level: "yellow" }, { v: 6.5, level: "amber" }, { v: 6.75, level: "red" }];
  const m = chartModel(pts, { startT: 1000, endT: 1000 + 6 * 3600000, minRange: 0.1, references: refs });
  assert.equal(m.max, 6.75);
  assert.equal(m.min, 5.52);
  assert.deepEqual(m.references.map((r) => r.level), ["yellow", "amber", "red"]);
  assert.ok(m.references[2].y < m.references[1].y && m.references[1].y < m.references[0].y); // higher level, higher on the chart
  assert.deepEqual(m.yLabels.map((l) => l.v), [6.75, 6.5, 6, 5.52]); // the top of the scale IS 6.75, so it is labelled once
  assert.ok(m.last.y > m.references[0].y); // still below the lowest line
});

test("chartModel: all three reference lines are on the chart at every Window (6, 12 and 24 h), wherever the data sits", () => {
  const refs = [{ v: 6, level: "yellow" }, { v: 6.5, level: "amber" }, { v: 6.75, level: "red" }];
  const end = Date.parse("2026-09-30T21:00:00+07:00");
  // readings across the last 26 h, the level rising from 5.2 to 5.8 m
  const pts = Array.from({ length: 105 }, (_, i) => ({ t: end - (26 * 3600000) + i * 15 * 60000, v: 5.2 + (i / 104) * 0.6 }));
  for (const windowH of [6, 12, 24]) {
    const m = chartModel(pts, { startT: end - windowH * 3600000, endT: end, minRange: 0.1, references: refs });
    assert.deepEqual(m.references.map((r) => r.level), ["yellow", "amber", "red"], `${windowH} h`);
    assert.ok(m.references.every((r) => r.y >= 0.1 - 1e-9 && r.y <= 0.9 + 1e-9), `${windowH} h: every line is inside the plot`);
    assert.equal(m.max, 6.75, `${windowH} h`);
    assert.ok(m.last.y > m.references[0].y, `${windowH} h: the level is below the lowest line`);
  }
});

// ---- reference lines that appear only when the water is near them ----
const photharamRefs = [{ v: 6, level: "yellow" }, { v: 6.5, level: "amber" }, { v: 6.75, level: "red" }];
const levelPts = (vals) => vals.map((v, i) => ({ t: 1000 + i * 3600000, v }));
const nearModel = (vals) => chartModel(levelPts(vals), { startT: 1000, endT: 1000 + vals.length * 3600000, minRange: 0.1, references: photharamRefs, referenceProximity: 0.3 });

test("chartModel: with a proximity, only a line the water is near is drawn, and the scale stays tight on the data", () => {
  // Photharam today: 5.55 -> 5.84 m. 6.00 is 0.16 above the top of the readings; 6.50 and 6.75 are far.
  const m = nearModel([5.55, 5.7, 5.84]);
  assert.deepEqual(m.references.map((r) => r.level), ["yellow"]);
  assert.equal(m.max, 6); // the scale reaches the yellow line and no further
  assert.equal(m.min, 5.55);
});

test("chartModel: lines come into view as the water approaches, and stay while it is just past them", () => {
  assert.deepEqual(nearModel([6.22, 6.26, 6.3]).references.map((r) => r.level), ["yellow", "amber"]); // 0.22 above yellow, 0.20 below amber
  // readings 6.70-6.90: the red line (6.75) is inside them and the amber (6.50) is 0.20 below; yellow (6.00) is 0.70 away
  assert.deepEqual(nearModel([6.7, 6.8, 6.9]).references.map((r) => r.level), ["amber", "red"]);
});

test("chartModel: nothing near means no lines and a scale that is just the data", () => {
  const m = nearModel([4.0, 4.1, 4.2]);
  assert.deepEqual(m.references, []);
  assert.equal(m.max, 4.2);
  assert.equal(m.min, 4);
});

test("chartModel: without a proximity every line is kept, as before", () => {
  const m = chartModel(levelPts([5.55, 5.7, 5.84]), { startT: 1000, endT: 1000 + 3 * 3600000, minRange: 0.1, references: photharamRefs });
  assert.equal(m.references.length, 3);
});

// ---- stepped vertical scales: the smallest step that fits, so charts in the same step compare directly ----
const steppedModel = (vals, extra = {}) =>
  chartModel(levelPts(vals), { startT: 1000, endT: 1000 + vals.length * 3600000, minRange: 0.1, scaleSteps: LEVEL_SCALE_STEPS_M, ...extra });
const spanOf = (m) => Math.round((m.max - m.min) * 1000) / 1000;

test("chartModel: with steps the scale is the smallest step that fits the data, centred on it", () => {
  // Today's real 12 h ranges (cm): Photharam 23, K.55A 30, K.11A 62, K.58 112, K.58 over 24 h 266.
  assert.equal(spanOf(steppedModel([5.61, 5.84])), 0.25);
  assert.equal(spanOf(steppedModel([10.27, 10.57])), 0.5);
  assert.equal(spanOf(steppedModel([18.07, 18.69])), 0.75);
  assert.equal(spanOf(steppedModel([50.63, 51.75])), 1.5);
  assert.equal(spanOf(steppedModel([48.0, 50.66])), 3);
  const m = steppedModel([5.61, 5.84]);
  assert.ok(Math.abs((m.max + m.min) / 2 - (5.61 + 5.84) / 2) < 1e-9); // centred on the data
});

test("chartModel: the data always fills at least half of the scale it is given", () => {
  for (const range of [0.1, 0.24, 0.26, 0.49, 0.51, 0.7, 0.76, 1.0, 1.1, 1.6, 2.1, 2.9]) {
    const m = steppedModel([5, 5 + range]);
    assert.ok(range / spanOf(m) >= 0.5 - 1e-9 || range < 0.125, `range ${range} fills ${range / spanOf(m)}`);
  }
});

test("chartModel: a range beyond the largest step is not cut off", () => {
  assert.equal(spanOf(steppedModel([0, 7])), 7);
});

test("chartModel: a larger minRange holds two charts to the same scale (the awareness panel's pair)", () => {
  const photharam = steppedModel([5.61, 5.84], { minRange: 0.5 });
  const k55a = steppedModel([10.27, 10.57], { minRange: 0.5 });
  assert.equal(spanOf(photharam), 0.5);
  assert.equal(spanOf(k55a), 0.5);
});

test("chartModel: a reference line the water is near is counted in the step, so it stays on the chart", () => {
  // Photharam 5.61-5.84 m with the 6.00 line 0.16 above: the data and the line span 0.39 m, so the step is 0.5 m.
  const m = steppedModel([5.61, 5.84], { references: photharamRefs, referenceProximity: 0.5 });
  assert.deepEqual(m.references.map((r) => r.level), ["yellow"]);
  assert.equal(spanOf(m), 0.5);
  assert.ok(m.references[0].y >= 0.1 - 1e-9 && m.references[0].y <= 0.9 + 1e-9);
  assert.ok(m.last.y > m.references[0].y);
});

test("chartModel: without steps the scale is the data's own, as before", () => {
  const m = chartModel(levelPts([5.61, 5.84]), { startT: 1000, endT: 1000 + 2 * 3600000, minRange: 0.1 });
  assert.equal(spanOf(m), 0.23);
});

// Khai Luang once reported 23:00 on the wrong date (a day ahead). Such a row must not be believed:
// it stretched every chart's shared time axis and blanked Photharam's trend.
test("isFutureReading: a reading dated well ahead of now is future, a current or recent one is not", () => {
  const now = new Date("2026-09-30T17:31:59Z").getTime();
  assert.equal(isFutureReading("2026-10-01T23:00:00+07:00", now), true);
  assert.equal(isFutureReading("2026-09-30T23:00:00+07:00", now), false);
  assert.equal(isFutureReading("2026-10-01T00:20:00+07:00", now), false); // within the 1 h tolerance
  assert.equal(isFutureReading(null, now), false);
});

test("chartModel: a gap shows only past 3 h, and one running to the right edge is marked trailing", () => {
  const H = 3600000;
  const pts = (hs) => hs.map((h) => ({ t: h * H, v: 5 }));
  const small = chartModel(pts([0, 1, 3.9, 6]), { startT: 0, endT: 6 * H, minRange: 0.1 }); // 2.9 h and 2.1 h steps
  assert.equal(small.gaps.length, 0);
  const mid = chartModel(pts([0, 1, 4.5, 6]), { startT: 0, endT: 6 * H, minRange: 0.1 }); // 3.5 h in the middle
  assert.equal(mid.gaps.length, 1);
  assert.equal(mid.gaps[0].trailing, false);
  const end = chartModel(pts([0, 1, 2]), { startT: 0, endT: 6 * H, minRange: 0.1 }); // stops at 2 h, edge at 6 h
  assert.equal(end.gaps.length, 1);
  assert.equal(end.gaps[0].trailing, true);
});

// ---- Lower Mae Klong: the Riverline, K.2B, K.57 (graph feed) and MKG006 พระรามสอง (bulk feed, tidal) ----
// Real captures 2026-10-01 (fixtures/). The graph feed carries no station name, so K.2B and K.57 are
// checked by the bank and ground level the source reports (the same figures the research verified by name).
const rawMkg006 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "thaiwater-waterlevel-record-mkg006.json"), "utf8"));

test("gaugesForSite: the Mae Klong Site has K.2B, K.57 and MKG006; the Bang Kruai Site never gets them", () => {
  const mk = gaugesForSite("maeklong").map((s) => s.id);
  for (const id of [832068, 832069, 755]) assert.ok(mk.includes(id), `Mae Klong lacks ${id}`);
  const bk = gaugesForSite("bangkruai").map((s) => s.id);
  for (const id of [832068, 832069, 755]) assert.ok(!bk.includes(id), `Bang Kruai has ${id}`);
  assert.deepEqual(gaugesForSite("nowhere"), []);
});

test("the tide flag is set for MKG006 and not for K.2B or K.57, in configuration", () => {
  const byId = new Map(gaugesForSite("maeklong").map((s) => [s.id, s]));
  assert.equal(byId.get(755).tidal, true);
  assert.equal(byId.get(832068).tidal, false);
  assert.equal(byId.get(832069).tidal, false);
  assert.ok(byId.get(755).summary, "MKG006 needs the small daily high/low file");
  // the existing Mae Klong gauges are untouched
  assert.equal(byId.get(710).tidal, false);
});

test("K.2B and K.57 are collected as a Source of their own, so their failure cannot hide the dam gauges' success", () => {
  assert.deepEqual(graphStationsForSource("lowerReach").map((s) => s.id), [832068, 832069]);
  assert.ok(!graphStationsForSource("damArea").some((s) => [832068, 832069].includes(s.id)));
  assert.deepEqual(graphStationsForSource("damArea").map((s) => s.id), [505018, 2571, 2679, 832066, 700554, 4007644]);
});

test("parseWaterLevelRecord: MKG006 พระรามสอง from the real bulk record, with its own bank height", () => {
  const p = parseWaterLevelRecord(rawMkg006);
  assert.equal(p.stationId, 755);
  assert.equal(p.name, "พระรามสอง");
  assert.equal(p.levelMsl, 0.11);
  assert.equal(p.bankMsl, 1.99);
  assert.equal(p.updatedAt, "2026-10-01T22:40:00+07:00");
  assert.equal(p.thresholds, null); // no source-published level, so no Status
  assert.equal(deriveStatus(p.levelMsl, p.thresholds), null);
});

test("parseWaterLevelGraph: K.2B and K.57 real series, null hours dropped, bank height from the source", () => {
  for (const [name, bank, last] of [["k2b", 4.3, 4.21], ["k57", 15.5, 15.12]]) {
    const g = parseWaterLevelGraph(graphFixture(name));
    assert.ok(g.rows.length > 40 && g.rows.every((r) => typeof r.levelMsl === "number"), name);
    assert.ok(Math.abs(g.bankMsl - bank) < 1e-9, name);
    assert.ok(Math.abs(g.rows[g.rows.length - 1].levelMsl - last) < 1e-9, name);
    assert.ok(g.rows.every((r) => r.dischargeM3s === null), name); // neither reports a discharge
  }
});

test("parseWaterLevelGraph: a non-numeric K.57 level is dropped, never stored as 0", () => {
  const raw = { data: { min_bank: 15.5, graph_data: [
    { datetime: "2026-10-01 20:00", value: "", discharge: null },
    { datetime: "2026-10-01 21:00", value: "n/a", discharge: null },
    { datetime: "2026-10-01 22:00", value: 15.12, discharge: null },
  ] } };
  assert.deepEqual(parseWaterLevelGraph(raw).rows.map((r) => r.levelMsl), [15.12]);
});

test("newGraphRows: K.57 and K.2B append only hours newer than the last stored one", () => {
  for (const name of ["k2b", "k57"]) {
    const { rows } = parseWaterLevelGraph(graphFixture(name));
    const last = rows[rows.length - 1];
    const stored = [{ updatedAt: rows[rows.length - 3].updatedAt, levelMsl: 0 }];
    assert.deepEqual(newGraphRows(stored, rows).map((r) => r.updatedAt), [rows[rows.length - 2].updatedAt, last.updatedAt]);
    assert.deepEqual(newGraphRows([{ updatedAt: last.updatedAt }], rows), []);
  }
});

test("isStaleReading: judged from the source's own time, past 6 hours, and an unreadable time is stale", () => {
  const now = Date.parse("2026-10-01T18:00:00+07:00");
  assert.equal(isStaleReading("2026-10-01T12:00:00+07:00", now), false); // exactly 6 h
  assert.equal(isStaleReading("2026-10-01T11:59:00+07:00", now), true);
  assert.equal(isStaleReading("2026-10-01T17:50:00+07:00", now), false);
  assert.equal(isStaleReading(null, now), true);
  assert.equal(isStaleReading("not a time", now), true);
});

test("RIVERLINE: the order and spacing are RID's diagram, dam to Gulf, one attributed block", () => {
  assert.deepEqual(RIVERLINE.stops.map((s) => s.code), ["SND04", "K.11A", "K.63", "K.55A", "K.56A", "K.2B", "K.57", "GULF"]);
  assert.deepEqual(RIVERLINE.stops.map((s) => s.kmToNext), [1.96, 4.26, 36.7, 15.2, 23.55, 18.3, 23, null]);
  assert.match(RIVERLINE.source, /ชลประทาน/);
  assert.match(RIVERLINE.totalSource, /ชลประทานที่ 13/);
  const km = RIVERLINE.stops.reduce((sum, s) => sum + (s.kmToNext || 0), 0);
  assert.ok(Math.abs(km - 122.97) < 1e-9);
  assert.equal(RIVERLINE.totalHours, 28);
});

test("RIVERLINE: only two links carry a travel time, and it is RID's (11 h and 4 h), none invented", () => {
  assert.deepEqual(RIVERLINE.stops.filter((s) => s.hoursToNext != null).map((s) => [s.code, s.hoursToNext]), [["K.63", 11], ["K.55A", 4]]);
});

test("RIVERLINE: K.56A is on the strip but not tracked, K.57 carries its local datum, the Gulf is the end", () => {
  const by = Object.fromEntries(RIVERLINE.stops.map((s) => [s.code, s]));
  assert.equal(by["K.56A"].file, undefined);
  assert.equal(by["K.57"].datum.zero, -13.2);
  assert.equal(by["K.2B"].datum, undefined);
  assert.equal(by.GULF.file, undefined);
});

const NOW_RL = Date.parse("2026-10-01T23:00:00+07:00");
const fresh = (levelMsl) => ({ levelMsl, updatedAt: "2026-10-01T22:00:00+07:00" });

test("riverlineStrip: keeps the order, shows an untracked station as not tracked and never drops it", () => {
  const strip = riverlineStrip({ "K.11A": fresh(12.03), "K.63": fresh(9.67), "K.2B": fresh(4.21), "K.57": fresh(15.12) }, NOW_RL);
  assert.deepEqual(strip.map((s) => s.code), RIVERLINE.stops.map((s) => s.code));
  const k56 = strip.find((s) => s.code === "K.56A");
  assert.equal(k56.state, "not-tracked");
  assert.equal(k56.levelMsl, null);
  assert.equal(strip.find((s) => s.code === "GULF").state, "end");
  assert.equal(strip.find((s) => s.code === "K.2B").state, "reading");
  assert.equal(strip.find((s) => s.code === "K.2B").levelMsl, 4.21);
});

test("riverlineStrip: a tracked station with no usable reading says no data, never zero", () => {
  const strip = riverlineStrip({ "K.63": { levelMsl: null, updatedAt: "2026-10-01T22:00:00+07:00" } }, NOW_RL);
  const k63 = strip.find((s) => s.code === "K.63");
  assert.equal(k63.state, "no-data");
  assert.equal(k63.levelMsl, null);
  assert.equal(strip.find((s) => s.code === "K.55A").state, "no-data");
});

test("riverlineStrip: a link with no printed time shows none; the two that have one show RID's", () => {
  const strip = riverlineStrip({}, NOW_RL);
  const link = (code) => { const s = strip.find((x) => x.code === code); return [s.kmToNext, s.hoursToNext]; };
  assert.deepEqual(link("K.63"), [36.7, 11]);
  assert.deepEqual(link("K.55A"), [15.2, 4]);
  assert.deepEqual(link("K.2B"), [18.3, null]);
  assert.deepEqual(link("GULF"), [null, null]);
});

test("riverlineStrip: a reading older than 6 h by the source's own time is flagged stale; fresh ones are not", () => {
  const strip = riverlineStrip({ "K.2B": { levelMsl: 4.21, updatedAt: "2026-10-01T16:00:00+07:00" }, "K.57": fresh(15.12) }, NOW_RL);
  assert.equal(strip.find((s) => s.code === "K.2B").stale, true);
  assert.equal(strip.find((s) => s.code === "K.57").stale, false);
});

test("riverlineStrip: K.57 passes its datum through so the page can say the reading is not comparable", () => {
  const k57 = riverlineStrip({ "K.57": fresh(15.12) }, NOW_RL).find((s) => s.code === "K.57");
  assert.equal(k57.datum.zero, -13.2);
  assert.equal(riverlineStrip({}, NOW_RL).find((s) => s.code === "K.2B").datum, undefined);
});
