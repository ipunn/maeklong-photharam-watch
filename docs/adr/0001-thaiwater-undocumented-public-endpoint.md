# 0001: Rely on undocumented public endpoints (ThaiWater river + dam feeds, EGAT HTML)

Status: accepted

## Context

River levels come from `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load`,
the JSON feed behind ThaiWater's own web app. It is public and needs no
authentication, but it is not a documented API: no SLA, no versioning
promise, and it can change shape or disappear without notice. One call
returns ~800 stations across all basins (~1.4 MB), so we filter by
`station.id`.

No documented alternative covers the two Mae Klong stations we need.

## Also covered by this decision

- `https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam` (hourly `dam_hourly` records): same
  status as `waterlevel_load`. Its `dam_storage_percent` is 0 for the dams we track, and
  release/inflow carry no unit, so the unit was established by mass balance
  (`.scratch/**/research/thaiwater-dam-feed-units.md`).
- `https://water.egat.co.th/water_crisis.php`: server-rendered HTML, not an API at all. Rows are
  matched by dam name but columns are read by position (`RESERVOIR_COL` in `parse.js`), so a
  layout change silently shifts values. The real page is kept as `fixtures/egat-water-crisis.html`
  and the parse tests fail if the columns move.

- `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph` (per-station hourly
  points for a date range): same status, a different endpoint with its own failure mode. It carries
  two stations the bulk feed omits: the Mae Klong Dam's station (EGAT SND04, station id 700554,
  level only) and K.63 บ้านใหม่ (id 4007644, level and discharge). One request per station.
  The parameter names come from ThaiWater's own web app and a working response, not from
  documentation (`.scratch/**/research/mae-klong-dam-data-sources.md`). Hours the source has not
  filled yet come back null and are dropped, never stored as zero. The first run backfills the
  days the response covers; later runs add only newer hours. Its own Source: `damArea`.
- `https://water.egat.co.th/telemeter/schematic/index.php`: server-rendered HTML like the reservoir
  page, columns read by position, header checked first (an unrecognised layout yields nothing, the
  old snapshot stays and the Source's stamp does not advance). Read only for Channel capacity
  (ความจุลำน้ำ), which no other source we use publishes. Real page kept as
  `fixtures/egat-telemetry-schematic.html`. Its own Source: `egatTelemetry`.

## Decision

Use it anyway, and contain the risk:

- All parsing lives in one pure function, `parseWaterLevelRecord` (`parse.js`),
  covered by fixtures captured from the real feed. A shape change breaks one
  function and its tests, not the site.
- The five sources are independent: one failing does not stop the others, and `data/status.json`
  records each source's last success so a dead source cannot hide behind the rest.
- The scraper never writes a gap entry when a station is missing from a run;
  history stays truthful. The site shows each reading's age and flags stale
  ones, so a broken feed reads as old data, not fresh data.
- Station ids are re-verified by name against the live feed when added — ids
  drift (the spec's 505018 had become a different station).
- Thresholds are taken only from the feed's `warning_level_m` /
  `critical_level_m`; when null, the status is neutral, never guessed.

## Consequences

The site can silently go stale if the endpoint changes; the visible age is the
only alarm, and there is deliberately no alerting. Fixing a break means
updating the parser and fixtures.
