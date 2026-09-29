// Runs on a 15-minute GitHub Actions cron. Fetches ThaiWater's public
// waterlevel feed (and EGAT's reservoir table), extracts the tracked river
// stations and dams, and appends one row per station/dam to its own committed
// history file under data/ (never overwritten — see .scratch/maeklong-photharam-water-monitor/spec.md for
// why this is an append-only log, not a "latest reading" snapshot).
//
// This script is a thin I/O wrapper: all parsing/derivation logic lives in
// parse.js and is unit tested there. Nothing here is tested directly.
const fs = require("node:fs");
const path = require("node:path");
const { parseWaterLevelRecord, deriveStatus, parseReservoirRecord, parseReservoirReportDate, parseDamHourlyRecord, pickLatestDamHourly } = require("../parse.js");

// ThaiWater's own React SPA's underlying data source — public, unauthenticated
// JSON, same "undocumented but genuinely public" category as
// BKK-Road-Flood-Checker's ThaiWater canal endpoint (see that repo's
// ADR-0004). Can change or break without notice; no SLA.
const WATERLEVEL_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load";

// Tracked stations, by ThaiWater station id, upstream to downstream. The last two
// bracket the user's coordinate; the first two are early-warning gauges further
// up the Mae Klong system (both verified against the live feed, not the spec's
// original ids): 505018 บ้านปากแซง (แควน้อย, K.58, Sai Yok) and 2679 บ้านวังขนาย
// (แม่กลอง, Tha Muang). 832066 (สะพานค่ายหลวง, Ban Pong) is upstream of 710.
const STATIONS = [
  { id: 505018, file: "pak-saeng.json" },
  { id: 2679, file: "wang-khanai.json" },
  { id: 832066, file: "khai-luang.json" },
  { id: 710, file: "photharam.json" },
];

// EGAT's reservoir table: a plain server-rendered HTML page, no JS needed.
const RESERVOIR_URL = "https://water.egat.co.th/water_crisis.php";

// Upstream leading-indicator dams, matched by the Thai name on the page. Each
// has its own history series, separate from the river stations. The page has
// no per-row timestamp, so each row is stamped with this run's scrapedAt.
const RESERVOIRS = [
  { name: "วชิราลงกรณ", file: "reservoir-vajiralongkorn.json" },
  { name: "ศรีนครินทร์", file: "reservoir-srinakarin.json" },
];

// ThaiWater's dam feed: hourly, with its own timestamp (unlike EGAT's daily table).
const DAM_HOURLY_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam";
const DAMS_HOURLY = [
  { id: 56, file: "dam-hourly-vajiralongkorn.json" },
  { id: 54, file: "dam-hourly-srinakarin.json" },
];

function appendHistory(dataDir, file, row) {
  const filePath = path.join(dataDir, file);
  const history = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : [];
  history.push(row);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2) + "\n");
}

async function scrapeReservoirs(dataDir, scrapedAt) {
  const res = await fetch(RESERVOIR_URL);
  if (!res.ok) throw new Error(`${RESERVOIR_URL} -> HTTP ${res.status}`);
  const html = await res.text();
  const records = parseReservoirRecord(html);
  // What the figures are as-of (EGAT publishes a daily report), distinct from scrapedAt.
  const reportedAt = parseReservoirReportDate(html);
  if (!reportedAt) console.error("Could not read the EGAT report date — storing reportedAt: null (UI will not show it as fresh).");

  for (const { name, file } of RESERVOIRS) {
    const record = records.find((r) => r.name === name);
    if (!record) {
      console.error(`No row found for dam ${name} in this run — skipping, not writing a gap entry.`);
      continue;
    }
    appendHistory(dataDir, file, {
      scrapedAt,
      reportedAt,
      storagePercent: record.storagePercent,
      levelMsl: record.levelMsl,
      releaseRateM3s: record.releaseRateM3s,
    });
    console.log(`${file}: appended storage=${record.storagePercent}% level=${record.levelMsl} release=${record.releaseRateM3s} m3/s`);
  }
}

async function scrapeDamsHourly(dataDir, scrapedAt) {
  const res = await fetch(DAM_HOURLY_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${DAM_HOURLY_URL} -> HTTP ${res.status}`);
  const raw = await res.json();
  const records = (raw.data && raw.data.dam_hourly) || [];

  for (const { id, file } of DAMS_HOURLY) {
    const record = pickLatestDamHourly(records, id);
    if (!record) {
      console.error(`No hourly record for dam ${id} in this run — skipping, not writing a gap entry.`);
      continue;
    }
    const p = parseDamHourlyRecord(record);
    appendHistory(dataDir, file, {
      scrapedAt,
      reportedAt: p.reportedAt,
      levelMsl: p.levelMsl,
      storageMcm: p.storageMcm,
      inflowMcm: p.inflowMcm,
      releaseMcm: p.releaseMcm,
      releaseM3s: p.releaseM3s,
    });
    console.log(`${file}: appended release=${p.releaseMcm} MCM/h (~${p.releaseM3s} m3/s) reportedAt=${p.reportedAt}`);
  }
}

async function main() {
  const res = await fetch(WATERLEVEL_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${WATERLEVEL_URL} -> HTTP ${res.status}`);
  const raw = await res.json();
  const records = (raw.waterlevel_data && raw.waterlevel_data.data) || [];

  const dataDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const scrapedAt = new Date().toISOString();

  // The reservoir source is independent of the river source: a failure here
  // must not stop the river stations being recorded (and vice versa below).
  try {
    await scrapeReservoirs(dataDir, scrapedAt);
  } catch (err) {
    console.error("Reservoir scrape failed:", err);
  }

  // Independent of the other sources, like the reservoir scrape above.
  try {
    await scrapeDamsHourly(dataDir, scrapedAt);
  } catch (err) {
    console.error("Hourly dam scrape failed:", err);
  }

  for (const { id, file } of STATIONS) {
    const record = records.find((r) => r.station && r.station.id === id);
    if (!record) {
      console.error(`No record found for station ${id} in this run — skipping, not writing a gap entry.`);
      continue;
    }

    const parsed = parseWaterLevelRecord(record);
    const status = deriveStatus(parsed.levelMsl, parsed.thresholds);

    const filePath = path.join(dataDir, file);
    const history = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : [];
    history.push({
      scrapedAt,
      updatedAt: parsed.updatedAt,
      levelMsl: parsed.levelMsl,
      bankMsl: parsed.bankMsl,
      status,
    });
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2) + "\n");
    console.log(`${file}: appended level=${parsed.levelMsl} status=${status} updatedAt=${parsed.updatedAt}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
