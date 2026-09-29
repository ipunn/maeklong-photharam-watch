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
  dailyHighLow,
  seriesOf,
  TRACKED_STATIONS,
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
