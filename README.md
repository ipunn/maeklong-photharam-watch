# เฝ้าระวังระดับน้ำแม่กลอง โพธาราม

Static site tracking Mae Klong river levels near Photharam, Ratchaburi
(13°43'42.0"N 99°50'48.3"E). No gauge sits at that point, so it shows the
two stations that bracket it, plus upstream reservoir data as a leading
indicator. UI is Thai-only.

A GitHub Actions cron runs every 15 minutes, scrapes the sources, and appends
one row per series to a committed history file under `data/`. The site
(GitHub Pages, no build step) reads those files and draws trend charts.

## Data sources

| Data | Source | Notes |
| --- | --- | --- |
| River level (สะพานค่ายหลวง, โพธาราม) | ThaiWater `waterlevel_load` JSON | Undocumented but public; no SLA, may change without notice. See [ADR 0001](docs/adr/0001-thaiwater-undocumented-public-endpoint.md). Gauges report every ~10 min to ~1 h. |
| Reservoirs (Vajiralongkorn, Srinakarin) | EGAT `water.egat.co.th/water_crisis.php` HTML table | Public page, scraped as HTML; no SLA. No per-row timestamp, so the scrape time is recorded. |

Refresh cadence is 15 minutes; each reading shows its age and is flagged when stale.
Status colors appear only where the source publishes an official threshold.

## Development

`npm test` runs the pure parsing tests (Node's built-in runner); `npm run scrape` runs one scrape.
