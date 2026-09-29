// Runs on a GitHub Actions cron. Fetches three independent public sources, extracts the
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
} = require("../parse.js");

const DATA_DIR = path.join(__dirname, "..", "data");

// ThaiWater's own web app's data source — public, unauthenticated JSON, undocumented,
// can change or break without notice (see docs/adr/0001).
const WATERLEVEL_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load";

// Tracked gauges, by ThaiWater station id, upstream to downstream. All verified against the
// live feed (the spec's original id 505018 turned out to be K.58 บ้านปากแซง on the แควน้อย,
// which is used here as a far-upstream gauge): 505018 K.58, 2679 K.11A บ้านวังขนาย,
// 832066 K.55A สะพานค่ายหลวง, 710 โพธาราม.
const STATIONS = [
  { id: 505018, file: "pak-saeng.json" },
  { id: 2679, file: "wang-khanai.json" },
  { id: 832066, file: "khai-luang.json" },
  { id: 710, file: "photharam.json" },
];

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
function appendHistory(file, row) {
  const history = readJson(file, []);
  if (!Array.isArray(history)) throw new Error(`${file} is not a JSON array`);
  if (isSameReading(history[history.length - 1], row)) return "unchanged";
  history.push(row);
  writeJsonAtomic(file, history);
  return "appended";
}

async function fetchOk(url, asJson) {
  const res = await fetch(url, asJson ? { headers: { Accept: "application/json" } } : undefined);
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

async function scrapeRivers(scrapedAt) {
  const raw = await fetchOk(WATERLEVEL_URL, true);
  const records = (raw.waterlevel_data && raw.waterlevel_data.data) || [];
  const outcomes = STATIONS.map(({ id, file }) =>
    runItem(file, () => {
      // Number() so a feed that starts sending ids as strings is not silently skipped.
      const record = records.find((r) => r.station && Number(r.station.id) === id);
      if (!record) throw missing(`station ${id}`);
      const parsed = parseWaterLevelRecord(record);
      const result = appendHistory(file, {
        scrapedAt,
        updatedAt: parsed.updatedAt,
        levelMsl: parsed.levelMsl,
        bankMsl: parsed.bankMsl,
        status: deriveStatus(parsed.levelMsl, parsed.thresholds),
      });
      return `${result} level=${parsed.levelMsl} updatedAt=${parsed.updatedAt}`;
    }),
  );
  return succeeded(outcomes);
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

const SOURCES = { river: scrapeRivers, reservoir: scrapeReservoirs, damHourly: scrapeDamsHourly };

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
      if (await scrape(scrapedAt)) status[key] = scrapedAt; // last SUCCESS per source
      else {
        failed += 1;
        console.error(`${key}: no usable data this run — its last-success time is not advanced.`);
      }
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
