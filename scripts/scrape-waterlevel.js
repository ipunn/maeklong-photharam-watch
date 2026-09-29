// Runs on a 15-minute GitHub Actions cron. Fetches ThaiWater's public
// waterlevel feed, extracts the tracked river stations, and appends one row
// per station to its own committed history file under data/ (never
// overwritten — see .scratch/maeklong-photharam-water-monitor/spec.md for
// why this is an append-only log, not a "latest reading" snapshot).
//
// This script is a thin I/O wrapper: all parsing/derivation logic lives in
// parse.js and is unit tested there. Nothing here is tested directly.
const fs = require("node:fs");
const path = require("node:path");
const { parseWaterLevelRecord, deriveStatus } = require("../parse.js");

// ThaiWater's own React SPA's underlying data source — public, unauthenticated
// JSON, same "undocumented but genuinely public" category as
// BKK-Road-Flood-Checker's ThaiWater canal endpoint (see that repo's
// ADR-0004). Can change or break without notice; no SLA.
const WATERLEVEL_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load";

// Tracked stations, by ThaiWater station id. Only เจ็ดเสมียน/โพธาราม is
// wired in for this ticket; the upstream Ban Pong-area bracket station is
// added in a later ticket.
const STATIONS = [{ id: 710, file: "photharam.json" }];

async function main() {
  const res = await fetch(WATERLEVEL_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${WATERLEVEL_URL} -> HTTP ${res.status}`);
  const raw = await res.json();
  const records = (raw.waterlevel_data && raw.waterlevel_data.data) || [];

  const dataDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const scrapedAt = new Date().toISOString();

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
