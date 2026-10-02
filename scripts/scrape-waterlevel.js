// Runs on a GitHub Actions cron. Fetches six independent public sources, extracts the
// tracked river gauges and dams, and appends to per-series history files under data/
// (an append-only log, never a "latest reading" snapshot — see
// .scratch/maeklong-photharam-water-monitor/spec.md).
//
// The sources are independent: one failing (HTTP error, changed shape, corrupt file) must
// never stop the others. Each successful source stamps data/status.json with when it last
// succeeded, so the site can tell "the collector stopped" from "the source is slow".
//
// An unchanged reading is not appended again (isSameReading), and every file is written
// atomically (temp file + rename) so a crash cannot leave truncated JSON behind.
//
// This script is a thin I/O wrapper: parsing and derivation live in parse.js and are unit
// tested there.
const fs = require("node:fs");
const path = require("node:path");
const {
  parseWaterLevelRecord,
  deriveStatus,
  parseReservoirRecord,
  parseReservoirReportDate,
  parseDamHourlyRecord,
  pickLatestDamHourly,
  isSameReading,
  parseWaterLevelGraph,
  newGraphRows,
  correctedGraphRows,
  parseEgatChannelCapacity,
  graphStationsForSource,
  bangkokDate,
  dailyHighLow,
  seriesOf,
  TRACKED_STATIONS,
  isFutureReading,
} = require("../parse.js");

// DATA_DIR overrides the data folder so a run can be checked without touching the repo's data/.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

// ThaiWater's own web app's data source — public, unauthenticated JSON, undocumented,
// can change or break without notice (see docs/adr/0001).
const WATERLEVEL_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load";

// Tracked gauges (every Site's) live in parse.js, TRACKED_STATIONS.

// EGAT's reservoir table: a server-rendered HTML page. A daily report, so its figures are
// stamped with the report's own as-of time (reportedAt), not with our scrape time.
const RESERVOIR_URL = "https://water.egat.co.th/water_crisis.php";
const RESERVOIRS = [
  { name: "วชิราลงกรณ", file: "reservoir-vajiralongkorn.json" },
  { name: "ศรีนครินทร์", file: "reservoir-srinakarin.json" },
];

// ThaiWater's dam feed: hourly, with its own timestamp.
const DAM_HOURLY_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam";
const DAMS_HOURLY = [
  { id: 56, file: "dam-hourly-vajiralongkorn.json" },
  { id: 54, file: "dam-hourly-srinakarin.json" },
];

// ThaiWater's per-station chart feed: hourly points for a date range. It serves stations the bulk
// feed above omits (the Mae Klong Dam's station, K.63). Same status as the bulk feed (docs/adr/0001).
const GRAPH_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph";
// Days of history requested each run. The first run stores all of them (a backfill); later runs
// add only the hours newer than the last stored one.
const GRAPH_DAYS = 2;

// EGAT's telemetry page: server-rendered HTML, read only for Channel capacity.
const EGAT_TELEMETRY_URL = "https://water.egat.co.th/telemeter/schematic/index.php";

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err; // corrupt JSON: fail this item loudly, never overwrite it
  }
}

function writeJsonAtomic(file, value) {
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, target);
}

// Appends the row unless the source's reading is unchanged since the last stored row.
// `onHistory` (optional) receives the full history after a successful append.
function appendHistory(file, row, onHistory) {
  const history = readJson(file, []);
  if (!Array.isArray(history)) throw new Error(`${file} is not a JSON array`);
  if (isSameReading(history[history.length - 1], row)) return "unchanged";
  history.push(row);
  writeJsonAtomic(file, history);
  if (onHistory) onHistory(history);
  return "appended";
}

// How much recent raw history the page's chart gets (it never downloads the full history).
const SUMMARY_RECENT_HOURS = 48;

// Small derived file per Bang Kruai gauge: the latest reading, daily high/low (tidal gauges
// only) and the last SUMMARY_RECENT_HOURS of readings. Derived from the raw history, which stays the record.
function writeSummary(summaryFile, history, tidal, nowMs) {
  const cutoff = nowMs - SUMMARY_RECENT_HOURS * 3600000;
  const recent = seriesOf(history, "levelMsl", "updatedAt")
    .filter((p) => p.t >= cutoff)
    .map((p) => ({ t: new Date(p.t).toISOString(), v: p.v }));
  writeJsonAtomic(summaryFile, { latest: history[history.length - 1] || null, days: tidal ? dailyHighLow(history, nowMs) : [], recent });
}

// Appends several rows in one write. Same guarantees as appendHistory: append-only, atomic.
function appendRows(file, rows) {
  const history = readJson(file, []);
  if (!Array.isArray(history)) throw new Error(`${file} is not a JSON array`);
  if (!rows.length) return 0;
  history.push(...rows);
  writeJsonAtomic(file, history);
  return rows.length;
}

// A hung request must not hold up the sources after it (they run one after another): give up after 30 s.
const FETCH_TIMEOUT_MS = 30000;

async function fetchOk(url, asJson) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), ...(asJson ? { headers: { Accept: "application/json" } } : {}) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return asJson ? res.json() : res.text();
}

// Runs one tracked item; an exception in one item is reported but does not stop the rest.
// Returns "found" | "missing" | "failed".
function runItem(label, fn) {
  try {
    const outcome = fn();
    console.log(`${label}: ${outcome}`);
    return "found";
  } catch (err) {
    if (err && err.missing) {
      console.error(`${label}: not in this run's feed — skipping, no gap entry written.`);
      return "missing";
    }
    console.error(`${label}: FAILED`, err);
    return "failed";
  }
}

const missing = (msg) => Object.assign(new Error(msg), { missing: true });

// A source "succeeds" (and stamps status.json) when it was fetched, at least one tracked item
// was found, and no item failed.
const succeeded = (outcomes) => outcomes.includes("found") && !outcomes.includes("failed");

// Each Site is judged on its own gauges, so one Site's gauges vanishing from the feed cannot be
// hidden by the other's success, and cannot make the other look unhealthy. The Mae Klong Site
// keeps the original `river` stamp, so its page is unaffected.
const SITE_STATUS_KEY = { maeklong: "river", bangkruai: "riverBangkruai" };

// One fetch, one stamp per Site: returns { statusKey: succeeded } for every Site.
async function scrapeRivers(scrapedAt) {
  const raw = await fetchOk(WATERLEVEL_URL, true);
  const records = (raw.waterlevel_data && raw.waterlevel_data.data) || [];
  const outcomes = TRACKED_STATIONS.map(({ id, file, summary, tidal }) =>
    runItem(file, () => {
      // Number() so a feed that starts sending ids as strings is not silently skipped.
      const record = records.find((r) => r.station && Number(r.station.id) === id);
      if (!record) throw missing(`station ${id}`);
      const parsed = parseWaterLevelRecord(record);
      // A mis-dated reading (the source once sent tomorrow's date) would stretch every chart's time axis.
      if (isFutureReading(parsed.updatedAt, new Date(scrapedAt).getTime())) throw missing(`station ${id} dated in the future: ${parsed.updatedAt}`);
      const row = {
        scrapedAt,
        updatedAt: parsed.updatedAt,
        levelMsl: parsed.levelMsl,
        bankMsl: parsed.bankMsl,
        status: deriveStatus(parsed.levelMsl, parsed.thresholds),
      };
      // Discharge only where the source supplies it, so other gauges' rows keep their shape.
      if (parsed.dischargeM3s != null) row.dischargeM3s = parsed.dischargeM3s;
      const nowMs = new Date(scrapedAt).getTime();
      const result = appendHistory(file, row, summary && ((h) => writeSummary(summary, h, tidal, nowMs)));
      // First run after the summary was introduced: build it from the existing history.
      if (summary && result === "unchanged" && !fs.existsSync(path.join(DATA_DIR, summary))) {
        writeSummary(summary, readJson(file, []), tidal, nowMs);
      }
      return `${result} level=${parsed.levelMsl} updatedAt=${parsed.updatedAt}`;
    }),
  );
  return Object.fromEntries(
    Object.entries(SITE_STATUS_KEY).map(([site, key]) => [
      key,
      succeeded(outcomes.filter((_, i) => TRACKED_STATIONS[i].site === site)),
    ]),
  );
}

async function scrapeReservoirs(scrapedAt) {
  const html = await fetchOk(RESERVOIR_URL, false);
  const records = parseReservoirRecord(html);
  const reportedAt = parseReservoirReportDate(html);
  if (!reportedAt) console.error("Could not read the EGAT report date — storing reportedAt: null (the UI will not show it as fresh).");
  const outcomes = RESERVOIRS.map(({ name, file }) =>
    runItem(file, () => {
      const record = records.find((r) => r.name === name);
      if (!record) throw missing(`dam ${name}`);
      const result = appendHistory(file, {
        scrapedAt,
        reportedAt,
        storageMcm: record.storageMcm,
        storagePercent: record.storagePercent,
        levelMsl: record.levelMsl,
        releaseRateM3s: record.releaseRateM3s,
      });
      return `${result} storage=${record.storagePercent}% release=${record.releaseRateM3s} m3/s reportedAt=${reportedAt}`;
    }),
  );
  return succeeded(outcomes);
}

async function scrapeDamsHourly(scrapedAt) {
  const raw = await fetchOk(DAM_HOURLY_URL, true);
  const records = (raw.data && raw.data.dam_hourly) || [];
  const outcomes = DAMS_HOURLY.map(({ id, file }) =>
    runItem(file, () => {
      const record = pickLatestDamHourly(records, id);
      if (!record) throw missing(`dam ${id}`);
      const p = parseDamHourlyRecord(record);
      const result = appendHistory(file, {
        scrapedAt,
        reportedAt: p.reportedAt,
        levelMsl: p.levelMsl,
        storageMcm: p.storageMcm,
        inflowMcm: p.inflowMcm,
        releaseMcm: p.releaseMcm,
        releaseM3s: p.releaseM3s,
      });
      return `${result} release=${p.releaseMcm} MCM/h (~${p.releaseM3s} m3/s) reportedAt=${p.reportedAt}`;
    }),
  );
  return succeeded(outcomes);
}

// Stations from the per-station graph feed, one request per station. Each Source (a group of
// GRAPH_STATIONS) stamps status.json on its own, so one broken station cannot hide behind, or be
// blamed on, another group's: "damArea" is the Barrage, K.63 and the other dam-area gauges;
// "lowerReach" is K.2B and K.57 below โพธาราม.
const scrapeGraphSource = (source) => async function (scrapedAt) {
  const nowMs = new Date(scrapedAt).getTime();
  const outcomes = [];
  for (const { id, file, graphType } of graphStationsForSource(source)) {
    let raw;
    try {
      const url = `${GRAPH_URL}?station_type=${graphType}&station_id=${id}&start_date=${bangkokDate(nowMs, GRAPH_DAYS - 1)}&end_date=${bangkokDate(nowMs, 0)}`;
      raw = await fetchOk(url, true);
    } catch (err) {
      console.error(`${file}: FAILED`, err);
      outcomes.push("failed");
      continue;
    }
    outcomes.push(
      runItem(file, () => {
        const { rows: allRows, bankMsl } = parseWaterLevelGraph(raw);
        const rows = allRows.filter((r) => !isFutureReading(r.updatedAt, nowMs));
        if (!rows.length) throw missing(`station ${id} returned no readings`);
        const history = readJson(file, []);
        const toRow = (r) => {
          const row = { scrapedAt, updatedAt: r.updatedAt, levelMsl: r.levelMsl, bankMsl };
          if (r.dischargeM3s != null) row.dischargeM3s = r.dischargeM3s;
          return row;
        };
        // Corrections first (hours the source has since revised), then the hours newer than any we hold.
        const corrections = correctedGraphRows(history, rows).map(toRow);
        const fresh = newGraphRows(history, rows).map(toRow);
        const added = appendRows(file, [...corrections, ...fresh]);
        return `appended ${added} of ${rows.length} rows (${corrections.length} corrected), newest ${rows[rows.length - 1].updatedAt}`;
      }),
    );
  }
  return succeeded(outcomes);
};

// EGAT's Channel capacity for the stations we show. An attribute of a station, not a Reading, so
// it is a small snapshot (with the page's own time) and not a History. A page whose layout is not
// recognised gives no rows: this fails, the old snapshot stays, and the stamp does not advance.
const EGAT_CAPACITY_FILE = "egat-channel-capacity.json";
const EGAT_CAPACITY_CODES = ["VKD06"]; // K.37 บ้านวังเย็น

async function scrapeEgatTelemetry(scrapedAt) {
  const html = await fetchOk(EGAT_TELEMETRY_URL, false);
  const rows = parseEgatChannelCapacity(html);
  const outcome = runItem(EGAT_CAPACITY_FILE, () => {
    const stations = {};
    for (const code of EGAT_CAPACITY_CODES) {
      const row = rows.find((r) => r.stationCode === code);
      if (!row) throw missing(`EGAT station ${code}`);
      if (!row.asOf) throw new Error(`EGAT station ${code}: unreadable time`);
      stations[code] = { name: row.name, capacityM3s: row.capacityM3s, asOf: row.asOf };
    }
    writeJsonAtomic(EGAT_CAPACITY_FILE, { scrapedAt, stations });
    return Object.entries(stations).map(([c, v]) => `${c}=${v.capacityM3s} asOf=${v.asOf}`).join(" ");
  });
  return succeeded([outcome]);
}

const SOURCES = {
  river: scrapeRivers,
  reservoir: scrapeReservoirs,
  damHourly: scrapeDamsHourly,
  damArea: scrapeGraphSource("damArea"),
  lowerReach: scrapeGraphSource("lowerReach"),
  egatTelemetry: scrapeEgatTelemetry,
};

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const scrapedAt = new Date().toISOString();

  let status = {};
  try {
    status = readJson("status.json", {});
  } catch (err) {
    console.error("status.json unreadable — starting it fresh:", err.message);
  }

  let failed = 0;
  for (const [key, scrape] of Object.entries(SOURCES)) {
    try {
      // A scrape returns true/false, or { statusKey: true/false } when it stamps several keys
      // (the river source stamps one per Site).
      const result = await scrape(scrapedAt);
      const stamps = typeof result === "object" ? result : { [key]: result };
      for (const [stampKey, ok] of Object.entries(stamps)) {
        if (ok) status[stampKey] = scrapedAt; // last SUCCESS per stamp
        else console.error(`${stampKey}: no usable data this run — its last-success time is not advanced.`);
      }
      // The source counts as failed for the run's exit code only if none of its stamps advanced.
      if (!Object.values(stamps).some(Boolean)) failed += 1;
    } catch (err) {
      failed += 1;
      console.error(`${key}: scrape failed:`, err);
    }
  }
  writeJsonAtomic("status.json", status);

  // Only a total failure fails the run; otherwise the sources that worked still get committed.
  process.exitCode = failed === Object.keys(SOURCES).length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
