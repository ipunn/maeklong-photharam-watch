# เฝ้าระวังระดับน้ำ อำเภอโพธาราม

Static site (Thai only) for the Mae Klong river near Photharam, Ratchaburi. It leads with the
watched area (the Photharam gauge and the nearest gauge upstream), then shows the river line
from the upstream dams down to Photharam. It is a convenience view of public data, **not an
official notice**: follow Ratchaburi province, DDPM (1784) and the Royal Irrigation Department.

A GitHub Actions workflow scrapes the sources every ~15 minutes and appends to per-series
history files under `data/`; GitHub Pages serves the site. No build step, no backend.

## Data sources

| Data | Source | Notes |
| --- | --- | --- |
| River gauges: K.58 บ้านปากแซง, K.11A บ้านวังขนาย, K.55A สะพานค่ายหลวง, โพธาราม | ThaiWater `waterlevel_load` JSON | Undocumented but public; no SLA; may change without notice ([ADR 0001](docs/adr/0001-thaiwater-undocumented-public-endpoint.md)). Gauges report roughly every 10 min to 1 h and ThaiWater can lag. |
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
