# เฝ้าระวังระดับน้ำ อำเภอโพธาราม

Static site (Thai only) for the Mae Klong river near Photharam, Ratchaburi. It leads with the
watched area (the Photharam gauge and the nearest gauge upstream), then shows the river line
from the upstream dams down to Photharam. It is a convenience view of public data, **not an
official notice**: follow Ratchaburi province, DDPM (1784) and the Royal Irrigation Department.

A GitHub Actions workflow scrapes the sources every ~15 minutes and appends to per-series
history files under `data/`; GitHub Pages serves the site. No build step, no backend.

## Two Sites

The repo serves two watched places (**Sites**), sharing one Collector and one `data/` folder:

- `index.html` — อ.โพธาราม (Mae Klong), described above.
- `bangkruai.html` — พื้นที่ บางกรวย, บางคูเวียง (อ.บางกรวย, นนทบุรี). **คลองบางค้อ, the canal nearest
  the area, has no gauge**, so the page shows nearby *proxy gauges* side by side with no headline:
  BKK003 (คลองมหาสวัสดิ์), C.12, CPY014, CPY015 (Chao Phraya, tidal) and C.13 ท้ายเขื่อนเจ้าพระยา
  (river discharge below the barrage, not a dam release). No status colour; the only red is the page's own alert when BKK003 is 1 m or more above its bank (a maintainer-chosen rule, labelled as not official). Tidal
  gauges show each Bangkok day's high and low instead of a rising/falling arrow. Levels are stated
  against the source's bank height ("สูงกว่า/ต่ำกว่าตลิ่ง"), which is a fact, not a flood level.

Which station belongs to which Site lives in `TRACKED_STATIONS` in `parse.js`.
For each Bang Kruai gauge the Collector also writes `data/daily-<gauge>.json` (daily high/low
for tidal gauges + the latest reading and the last 48 h of readings), derived from the raw history, so the page never
downloads the full history.

**Known trade-off — history growth.** The Bang Kruai gauges report about every 10 minutes and the
tide changes almost every reading, so their raw history files grow roughly ten times faster than
Mae Klong's hourly ones. Accepted for now; compacting old raw rows is deferred. To check the size:
`du -h data/`. To verify a Collector change without touching the repo's data, run
`DATA_DIR=/some/scratch/dir npm run scrape`.

## Data sources

| Data | Source | Notes |
| --- | --- | --- |
| River gauges: K.58 บ้านปากแซง, K.11A บ้านวังขนาย, K.55A สะพานค่ายหลวง, โพธาราม; Bang Kruai Site: BKK003, C.12, CPY014, CPY015, C.13 (C.13 also carries `discharge`) | ThaiWater `waterlevel_load` JSON | Undocumented but public; no SLA; may change without notice ([ADR 0001](docs/adr/0001-thaiwater-undocumented-public-endpoint.md)). Gauges report roughly every 10 min to 1 h and ThaiWater can lag. |
| Mae Klong Dam (Barrage) level, hourly (EGAT SND04), and K.63 บ้านใหม่ level + discharge | ThaiWater `waterlevel_graph` JSON, one request per station | Same caveats (ADR 0001). Not in `waterlevel_load`. History for the last 2 days is backfilled on the first run. The dam has a level only: its release and gate data are announced by hand by RID Office 13, so there is no automatic source ([research](.scratch/maeklong-photharam-water-monitor/research/mae-klong-dam-data-sources.md)). |
| Lower reach, below โพธาราม: MKG006 พระรามสอง (the tidal mouth) from `waterlevel_load`; K.2B สะพานธนะรัชต์ and K.57 สะพานบางนกแขวก from `waterlevel_graph` | ThaiWater (as above) | K.2B and K.57 are collected as their own Source (`lowerReach` in `data/status.json`). MKG006 follows the Tide rule (daily high/low in `data/daily-mkg006.json`). K.57's reading is on a local gauge scale, not metres above sea level (RID gauge zero -13.2): the page says so and never converts it. Shown in the "ท้ายน้ำ" section with the **Riverline** strip: distances and the two printed travel times are RID's daily diagram (held in `parse.js` `RIVERLINE`); K.56A is on the strip as "not tracked". No flooded-land data exists for สมุทรสงคราม, and the page says so ([research](.scratch/maeklong-photharam-water-monitor/research/lower-mae-klong-riverline.md)). |
| Channel capacity (ความจุลำน้ำ) for K.37 | EGAT `water.egat.co.th/telemeter/schematic/index.php` HTML table | Scraped HTML, columns read by position, header checked (fixture test). A figure of EGAT's own; other sources can disagree, so it is always attributed. K.37 itself comes from `waterlevel_load`. |
| Dam release, stored volume, level (hourly) | ThaiWater `analyst/dam` JSON (`dam_hourly`) | Same caveats. Release and inflow are million m³ per hour, converted to m³/s. Unit confirmed by mass balance: `.scratch/**/research/thaiwater-dam-feed-units.md`. |
| Dam storage % (daily), used to back out capacity | EGAT `water.egat.co.th/water_crisis.php` HTML table | Scraped HTML; columns are read by position, so a layout change breaks it (caught by the fixture test). A daily report stamped as of the previous midnight. |

Freshness is always the **source's own timestamp**. Anything older than 6 hours is flagged
"ข้อมูลอาจไม่อัพเดทล่าสุด" (EGAT's daily table: 36 hours). A line at the top shows when each
source last *succeeded* (`data/status.json`) and warns if one has not for 45 minutes.

**Colour.** Gauges have no published official thresholds, so none is coloured; the page shows
direction of change instead. Dam capacity is coloured by the Royal Irrigation Department's
reservoir bands (the top two bands red). The capacity % and room left are derived and labelled
as estimates.

**Not covered:** the Mae Klong Dam's own release has no automatic source, so it is not shown.

## Running it

- `npm test` — unit tests for the pure parsing/derivation code (`parse.js`).
- `npm run scrape` — one scrape (writes `data/`).
- GitHub Pages must be set to deploy from `main`, folder `/`. The workflow only commits data.
- **How collection keeps running.** GitHub's `schedule` never fired for this repo, so it is not
  relied on. Each workflow run scrapes, commits, waits ~13 minutes and starts the next run itself
  (with the built-in token; `workflow_dispatch` is allowed to be triggered that way). The
  concurrency group keeps one running and one pending run, so duplicate chains collapse into one.
  The `schedule` (off-peak minutes `7,22,37,52`) stays as a second trigger that can restart a dead
  chain. To stop it on purpose, cancel the running run or disable the workflow. To restart it:
  Actions tab -> "Scrape water levels" -> Run workflow.
- It keeps a runner busy most of the day (free on public repos). If an external timer is added
  later, drop the wait step. The site's health line is what tells you the chain has died.
