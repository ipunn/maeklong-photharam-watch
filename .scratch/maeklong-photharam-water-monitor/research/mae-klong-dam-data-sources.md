# เขื่อนแม่กลอง (Mae Klong Dam): is there an automatic data source?

Researched 2026-09-30 (~11:00-11:40 +07) by live requests (curl) against the owners' own endpoints. Everything below was fetched that day unless marked UNVERIFIED. "Automatic" = machine-readable, no login, updates without a person publishing it.

## Verdict (read this first)

**(a) Release / discharge and gate operations of the dam itself: NO automatic source found.** Not in ThaiWater (dam, watergate, flow feeds), not in EGAT's telemetry page, not in RID's hydro portals. The dam's own announced release (e.g. "ระบายท้ายเขื่อนรวม 1,762 ลบ.ม./วินาที", "ปรับเพิ่มเป็น 2,000 ลบ.ม./วินาที เวลา 13.00 น.") is published only by สำนักงานชลประทานที่ 13 as press releases / a manually updated image, and reaches us only through news articles. That is NOT automatic.

**(b) But two things ARE automatic and much better than what the site uses today:**

1. **Upstream (pool) level at the dam, hourly: EGAT telemetry station SND04 "เขื่อนแม่กลอง"** (ThaiWater station id 700554). Today 11:00 = 22.76 m MSL, always fresh. Reachable two ways (below). The current site has no upstream-of-dam level at all.
2. **Measured discharge just below the dam: RID station K.63 บ้านใหม่** (ThaiWater station id 4007644), 4.26 km below K.11A, hourly, e.g. 2,195.1 m3/s at 10:00 and 11:00. K.11A itself has no discharge (only a level). This is a measured river flow, the best available stand-in for "release", but it is not the dam's release figure and it lags the dam.

**(c) Best proxy and honest labelling.** Keep K.11A บ้านวังขนาย for the downstream level, and add K.63 บ้านใหม่ for downstream discharge. RID's own daily report now *sources* the order (see D3): เขื่อนแม่กลอง -> 1.96 km -> K.11A -> 4.26 km -> K.63. So "K.11A is below the dam" is no longer merely inferred. Suggested wording: "ระดับ/ปริมาณน้ำที่สถานีวัดใต้เขื่อนแม่กลอง (K.11A ห่างเขื่อน 1.96 กม., K.63 ห่าง 6.2 กม.), ไม่ใช่ปริมาณที่เขื่อนระบายโดยตรง; ตัวเลขการระบายของเขื่อนประกาศโดยสำนักงานชลประทานที่ 13 ไม่มีข้อมูลอัตโนมัติ".

**(d) Next steps (maintainer decisions) are at the bottom.**

## Comparison table

| # | Source / URL | Format | Freshness (source's own stamp) | Dam release? | Upstream level? | Downstream level? | Gates? | Fit |
|---|---|---|---|---|---|---|---|---|
| D1 | ThaiWater `public/waterlevel_graph?station_type=tele_waterlevel&station_id=700554&start_date=..&end_date=..` (SND04 เขื่อนแม่กลอง) | JSON | hourly, latest 11:00 at 11:32 | NO (`discharge` null) | **YES** 22.757 m MSL | no | NO | extra call in `river` Source; NOT in `waterlevel_load` |
| D2 | Same endpoint, `station_id=4007644` (K.63 บ้านใหม่) | JSON | hourly (latest complete 10:00) | NO, but **measured Q below dam: 2,195.1 m3/s** | no | YES 17.47 m MSL | NO | same as D1 |
| D3 | RID ศูนย์อุทกวิทยาชลประทานภาคตะวันตก daily PDF `http://hydro-7.rid.go.th/main/Report06.00/report_daily.pdf` | PDF, 10 pp | daily (file Last-Modified 2026-09-30 07:54 +07) | NO | no | levels + Q for K.11A/K.63/K.55A | NO | reference/sourcing only; not worth scraping |
| D4 | RID Real-time Hydro `https://hyd-app-db.rid.go.th/webservice/SWOCService.svc/getHourlyWaterLevelFromStationCode` | JSON (POST) | hourly | NO | no | K.11A level, K.63 level+Q | NO | possible primary for K.63/K.11A; needs Origin/Referer header, undocumented |
| D5 | EGAT `https://water.egat.co.th/telemeter/schematic/index.php` | server-rendered HTML tables | hourly ("ทุก 1 ชม."), 11:00 | NO (`N/A`) | **YES** SND04 1.62 m gauge / 22.76 m MSL | K.11A (RID copy, 18.55) | NO | HTML like the EGAT reservoir source; second route to the same SND04 value |
| D6 | ThaiWater dam feed `analyst/dam` (dam_hourly/daily/medium/small_tele) | JSON | hourly/daily | NO: no record named เขื่อนแม่กลอง | NO | NO | NO | nothing to add |
| D7 | ThaiWater `public/watergate_load`, `frontend/shared/watergate_station` | JSON | per row | NO: no Mae Klong Dam row; the TK.11A row is dated 2022-09-16 | NO | stale | NO (gate fields null) | nothing to add |
| D8 | ThaiWater `public/flow` | JSON | n/a | NO (Bangkok only; 40 KB) | | | | none |
| D9 | RID `https://app.rid.go.th/reservoir/telemetry/api/telemetryGeojson?basin=...` | GeoJSON | daily | NO | NO | NO | floodgates: Chao Phraya/Yom/Nan only | no Mae Klong basin in any basin value I tried |
| D10 | RID `https://hydro.rid.go.th/api/cache/reservoir` and `/api/cache/irrigation` | JSON | `"source":"fallback","stale":true` | NO | NO | NO | NO | national totals only, stale fallback |
| D11 | สำนักงานชลประทานที่ 13 "สถานการณ์น้ำรายวัน" `https://rio-13.rid.go.th/main13/data/images/water%20to%20day/water-to-day.jpg` | JPEG (1024x867) | Last-Modified 2025-04-19 (stale) | not readable as data | | | | NOT automatic (image) |
| D12 | RID Office 13 announcements (via Daily News, Thairath, Matichon, etc.) | news text | ad hoc | **YES, but manual** | YES (e.g. 22.90 m MSL) | YES (17.60) | mentions of increasing release | NOT automatic |
| D13 | HII TIWRM station page `tiwrm.hii.or.th/DATA/REPORT/php/maeklong/station/show_detail.php?code=TD03` | HTML | static station metadata | NO | station facts only | | | metadata only |
| D14 | `http://mkmonitor.ddns.net/` (linked from RID Office 13) | web app | unknown | UNVERIFIED | | | | not an owner-grade source; see D14 note |

## Details

### D1/D2. ThaiWater `waterlevel_graph` carries stations that `waterlevel_load` omits

- `waterlevel_load` (the feed we scrape, 806 rows, checked 2026-09-30 11:31) contains neither 700554 (SND04) nor 4007644 (K.63). Grep of the raw file for `700554` and `4007644`: 0 hits. Its Mae Klong-area rows are K.58, K.11A (2679), K.55A (832066, discharge 2,037.61), K.37, K.35A, K.3A, EGAT MKSND/MKVKD rows, and RAJ001/002.
- Station catalog `https://api-v3.thaiwater.net/api/v1/thaiwater30/frontend/shared/station_all` (6 MB) does list them: `{"station_id":700554,"station_name":{"th":"เขื่อนแม่กลอง"},"station_old_code":"MKSND04","station_lat":13.95678,"station_long":99.61505,"amphoe":"ท่าม่วง","agency_id":8,"station_type":"A"}` and `{"station_id":4007644,"station_name":{"th":"บ้านใหม่"},"station_old_code":"K.63","station_lat":13.92983,"station_long":99.668228,"agency_id":12,"station_type":"W","hydro_id":7}`. (Also 3455 "U/S Mae Klong Dam (RID.)" MKTD03, type R: graph returned all null.)
- The endpoint is one the ThaiWater web app itself calls (`thaiwater30/public/waterlevel_graph` appears in `https://www.thaiwater.net/dist/js/app.chunk.js`). I called it as `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph?station_type=tele_waterlevel&station_id=700554&start_date=2026-09-29&end_date=2026-09-30`. The parameter names are my reconstruction from the app bundle listing and a working response, not from documentation.
- Response: `{"result":"OK","data":{"graph_data":[{"datetime":"2026-09-30 11:00","value":22.757,"value_out":null,"discharge":null},...],"min_bank":26.1,"warning_level":null,"critical_level":null,"ground_level":13.79,"qmax":null}}`. Hourly rows, one per hour; the current hour's row appears with a value when the source has it (SND04 had 11:00 at 11:32; for RID stations (K.11A, K.63, K.55A) the 11:00 row was still `null` at 11:32 and 10:00 was the newest). `value` is m MSL (K.63 `min_bank` 18, values 17.x consistent; SND04 22.757 matches EGAT's 22.76 m MSL).
- Cross-check of SND04 against RID's public statement: on 2026-09-29 11:00 RID (via Daily News/Thairath, see D12) said upstream 22.90 m MSL; graph at 2026-09-29 11:00 = 22.854. Difference 4.6 cm, so same quantity, different sensor/rounding. K.11A on the same hour was 17.60 = RID's stated downstream level exactly.
- History is retrievable: `start_date=2026-09-01&end_date=2026-09-30` returned 708 hourly rows (SND04). Useful for backfill.
- No `discharge` for SND04 (null). K.63 `discharge` populated (2,025 at 01:00 rising to 2,195.1 at 10:00 on 2026-09-30). K.63 has no `warning_level_m`/`critical_level_m`; `min_bank` 18 (m MSL).
- Risk: same class as ADR 0001 (undocumented, no SLA), plus one more: this endpoint is a per-station chart query, one call per station, and is not the bulk feed. Different endpoint, so its own failure mode. api-v3.thaiwater.net `/robots.txt` = 404; www.thaiwater.net robots.txt has only `User-agent: *` and a Sitemap line (no Disallow). Terms of use: UNVERIFIED (not found).
- Fit: an additional fetch inside the `river` Source (or a new Source `damArea` with its own `status.json` stamp so its failure cannot be hidden by `river`). Not a `TRACKED_STATIONS` entry as-is, because `parseWaterLevelRecord` reads `waterlevel_load` records; these come as `graph_data` points and would need a small second parser.

### D3. RID daily "ผังแสดงสถานการณ์น้ำ ลุ่มน้ำแม่กลอง" (ศูนย์อุทกวิทยาชลประทานภาคตะวันตก)

- URL `http://hydro-7.rid.go.th/main/Report06.00/report_daily.pdf`, 1.66 MB, header `Last-Modified: Wed, 30 Sep 2026 00:54:28 GMT`. Page title on p.1: "สรุปรายงานสภาพอากาศและสภาพน้ำท่า ปริมาณน้ำท่า วันที่ 30 กันยายน 2569", by ศูนย์อุทกวิทยาชลประทานภาคตะวันตก.
- Page 6 (rendered and read): diagram of the river order เขื่อนแม่กลอง -> 1.96 km -> K.11A (8.78 m, Q "*") -> 4.26 km -> K.63 (9.44 m, Q 2,142.53) -> 36.7 km (11 h travel) -> K.55A (10.07 m, Q 1,969.0) -> 15.2 km (4 h) -> K.56A -> K.2B -> K.57. Bank/capacity: K.11A ตลิ่ง 6.20 m / 1,300 m3/s.
- Includes NO dam release or gate data; the dam is a label on the diagram.
- These values are the 06:00 readings (K.11A 8.78 = the 06:00 value in D4). Daily, PDF: not worth scraping, but it is the primary source for the K.11A-below-the-dam order.
- The other page in the diagram set: `http://hydro-7.rid.go.th/main/Diagrame/ลุ่มน้ำแม่กลอง.html` embeds `https://hyd-app-db.rid.go.th/SVG/flow_diagram.html?svg=hydro7_639253429079252769` (a live version of the same diagram, filled by D4).

### D4. RID Real-time Hydro webservice (hyd-app-db.rid.go.th)

- The diagram page's `js/flow_diagram.js` POSTs `{"hydro":{"stationcode":"K.63"}}` to `https://hyd-app-db.rid.go.th/webservice/SWOCService.svc/getHourlyWaterLevelFromStationCode`. With no headers it answered HTTP 401; with `Origin` and `Referer` set to `https://hyd-app-db.rid.go.th` (what the diagram page itself sends) it answered 200 and JSON, with no login and `access-control-allow-origin: *`. I sent only these headers; I did not try to bypass anything else.
- Returns the last 12 hourly rows: `hourlydateString` "30/09/2026 11:00", `waterlevelvalue` (gauge-relative m), `Q` (m3/s or null), `QMax`, `notationString`. Values at 11:32: K.11A 8.85 m, Q null; K.63 9.57 m, Q 2195.11; K.55A 10.31 m, Q 2051.33; K.37 11.95 m, Q 1991.5. These equal ThaiWater's copies (K.63 2,195.115, K.55A 2,037.61 at 10:00), so ThaiWater is a republisher of this RID data and RID is the owner.
- Station codes tried for the dam itself (`MK`, `TD03`): empty response. No dam station in this service that I could find (station list endpoint not found; UNVERIFIED that none exists).
- Risk: undocumented, requires a browser-like Origin/Referer, session cookie set, gauge-relative levels not MSL. `hyd-app-db.rid.go.th/robots.txt` = 404. Terms UNVERIFIED. Since ThaiWater already carries K.63 with MSL level and Q, D4 has no advantage except being the owner; use only as a fallback.

### D5. EGAT telemetry schematic (page the maintainer pointed at)

- `https://water.egat.co.th/telemeter/schematic/index.php` (identical `mk_anni.php`). Server-rendered HTML, UTF-8, no JS data calls, no login, `robots.txt` 404. Timestamps Buddhist-era `dd-mm-yyyy hh:mm:ss`.
- Header of the image version (`tele_mk_anni.php`, a 1400x1600 GIF, read directly) says: "กฟผ. : 30-09-2569 11:00 (ทุก 1 ชม.)" and "กรมชลประทาน : 30-09-2569 11:00 (ทุก 1 ชม.)", so hourly is the source's own statement.
- Table 1 row: `12 | SND04 | เขื่อนแม่กลอง | 1.62 | 22.76 | N/A | 30-09-2569 11:00:00 | -` (gauge m, m MSL, discharge, time, channel capacity). Discharge is `N/A`: **no release**. Table 2 re-publishes RID K-stations (K.11A 8.85 / 18.55, discharge `-`, 10:00) with stale rows (K.17 dated 18-10-2567, K.32A 27-09-2569).
- The schematic image does show inflow/release (น้ำไหลเข้า/น้ำระบาย) boxes with percent for EGAT's big dams (values seen: 479.83/468.72 cms, 2,250.94/0 cms, 0/95.75 cms), not for Mae Klong Dam. Those figures are only in the GIF, not in the HTML tables.
- Parent `http://water.egat.co.th/telemeter/` is a login form (Username/Password). `http://watertele.egat.co.th/` is a frameset to `map.php`, not explored. No historical or gate feed found at the two links checked. `ratingcurve/#mk` not examined beyond a 200 (UNVERIFIED content).
- SND04 in this table equals ThaiWater's D1 series (22.76 vs 22.757): D1 is EGAT's data republished. The gauge-relative "ระดับน้ำ (ม.)" column differs between tables for the same station (K.35A 3.85 vs 5.19), so compare only m MSL.
- Fit: reachable, but D1 already gives the same reading as JSON with history. Use D5 only as a second, independent route (would need column-by-position parsing, the same fragility as the EGAT reservoir source in ADR 0001).

### D6-D8. Other ThaiWater feeds (searched, nothing)

- `analyst/dam` 2026-09-30: `dam_hourly` 17 rows, `dam_medium` 862, `dam_daily` 50, `dam_small_tele` 60. Searched all for แม่กลอง / ท่าม่วง / Mae Klong: matches are only basin labels on unrelated reservoirs (ลำตะเพิน, ห้วยกระพร้อย, etc.) and the EGAT dams already used; no record for เขื่อนแม่กลอง. (`dam_medium` id 58959 "เขื่อนท่าทุ่งนา" is `1970-01-01` empty.) Dam id 15/56 "วชิราลงกรณ" appear, and station_all also has a mis-named "เขื่อนวชิราลงกรณ์ อ.ท่าม่วง" (id 1128043, type R, an EGAT/agency 13 rain station), which is not the dam.
- `public/watergate_load` (2,315 rows, 3.6 MB): floodgate/regulator feed. Rows for the Mae Klong area are HII rain/level points and RID TK.* stations with 2020-2022 dates (e.g. `709158 TK.11A` last 2022-09-16 13:15, `watergate_in` 12.72). `floodgate_open`, `floodgate` and `floodgate_height` are null for these. No Mae Klong Dam.
- `public/flow`: 40 KB, Bangkok drainage flow only.

### D9-D11. RID portals

- RID reservoir database `https://app.rid.go.th/reservoir/` covers storage reservoirs; the SWOC map's floodgate layer calls `https://app.rid.go.th/reservoir/telemetry/api/telemetryGeojson?basin=floodgate` (22 features, basins เจ้าพระยา/ท่าจีน/ยม only; every other `basin=` value I tried, including แม่กลอง, just returns the same 75-feature default set with no Mae Klong entry). NO.
- `https://hydro.rid.go.th` (สำนักบริหารจัดการน้ำและอุทกวิทยา) is a Nuxt app; its only data calls are `/api/cache/irrigation` (`"data":[]`, `"source":"fallback"`, `"stale":true`) and `/api/cache/reservoir` (national totals, also fallback/stale). NO. `www.rid.go.th/robots.txt` disallows `/api/`.
- Office 13 site `https://rio-13.rid.go.th/main13/index.php/th/` has "สถานการณ์น้ำรายวัน" = `water-to-day.jpg` (Last-Modified 2025-04-19), a "ประวัติเขื่อนแม่กลอง" history article, links to `wq-maeklong.rid.go.th` (water quality/salinity, not read), and to `rio13.rid.go.th/water/2021/` which links to the D3 PDF and D4 diagram. None publishes gate operations as data.

### D12. Where the dam's release is announced (not automatic)

- Daily News 2026-09-29 14:40: RID Office 13 says increase release "มากกว่า 2,000 ลบ.ม./วินาที", downstream level to rise >80 cm (https://www.dailynews.co.th/news/6232519/, read via fetch, checked 2026-09-30).
- Search results 2026-09-30 (headline snippets only, articles NOT individually read; UNVERIFIED beyond snippet): Thairath `https://www.thairath.co.th/news/local/central/2962959`, Matichon `https://www.matichon.co.th/region/news_5910795`, Spacebar `https://spacebar.th/social/mae-klong-dam-warning-28-sep-2026`. Snippets quote 1,800 / 1,900 / 2,000 m3/s at 11:00 / 12:00 / 13:00 on 29 Sep and "ระบายท้ายเขื่อนรวม 1,762 ลบ.ม./วินาที, ระดับน้ำท้ายเขื่อน 17.60 ม.รทก. เพิ่มขึ้น 16 ซม.".
- The original channel of the RID Office 13 statement (Facebook page / LINE) could not be identified from primary pages; UNVERIFIED. `prd.go.th` (also in results) did not resolve from this machine.
- Because the announced release is 1,800-2,000 m3/s and K.63 measures 2,195 m3/s (K.37 alone 1,991, K.35A 382) the measured downstream flow includes inflow between the dam and K.63 and is therefore not equal to the dam's release; a sanity check, not a conversion.

### D13-D14

- HII page for TD03 (the dam station): static metadata (ต.ท่าม่วง อ.ท่าม่วง จ.กาญจนบุรี; ระดับท้องน้ำ 14.364; ตลิ่งซ้าย 26.811; ตลิ่งขวา 25.915; เตือนภัย 25.42; วิกฤติ 25.92 m MSL; เริ่มตรวจวัด 21-11-2549; max 23.47 m MSL 29-11-2549). Warning/critical levels here are HII station metadata for a station that is not in the ThaiWater bulk feed as a level with thresholds (ThaiWater shows `warning_level`/`critical_level` null for 700554), so they are NOT "published thresholds" in the sense of CONTEXT.md `Status`, and I did not verify that TD03 = SND04 (same place, different code; UNVERIFIED equivalence). The observation that 22.76 m MSL is 2.7 m below 25.42 is context, not an alert.
- `mkmonitor.ddns.net`: a dynamic-DNS web app linked from an RID Office 13 page (rio13.rid.go.th/water/2021/). Contains a login, water-quality (`/api/v1/wq`), dashboard and CCTV snapshot API calls; the `/api/v1/dashboard` call returned 502 when tried. Its page source also embeds what look like admin credentials and IP-address admin tools. Not an owner-grade source; do not depend on it, and consider telling RID Office 13 about the exposed credentials (I did not use them).

## What was NOT found / UNVERIFIED

- No source of gate openings/operations (จำนวนบานที่เปิด, ระดับเปิดบาน) for Mae Klong Dam anywhere.
- No documented API or terms of use for ThaiWater, RID hyd-app-db, or the EGAT schematic (not found); only robots.txt checked (results per candidate above).
- Whether an official RID "ท้ายเขื่อนแม่กลอง" telemetry code exists in hyd-app-db (the station-list endpoint was not found).
- Whether the EGAT `http://water.egat.co.th/ratingcurve/` page or `watertele.egat.co.th/map.php` hold anything about the dam release (only fetched the landing/frameset).
- Update cadence measured by two fetches in the same minute (11:33:34 both) returned identical data; hourly cadence is from the sources' own labels ("ทุก 1 ชม.") and the hourly rows in D1/D4, not from a multi-hour observation.
- The 12-row window in D4 (`getHourly...`) is what I saw at 11:32; whether it is always 00:00 to now (a day window) or always 12 rows is UNVERIFIED.

## Next steps (need maintainer decisions)

1. **Decide whether to show the upstream pool level (SND04, 22.76 m MSL).** Recommended yes: it is the only automatic, dam-specific number and it pairs with K.11A to show the head across the dam (today about 4.2 m: 22.76 vs 18.55). Decide Source name, and whether it lives in `river` or its own stamped Source (recommended own Source: it uses a different endpoint, so `river`'s success must not hide its failure).
2. **Decide whether to add K.63 บ้านใหม่ (4007644) as a gauge for downstream discharge**, and how to label a river flow that is not a release (wording in verdict c). This needs a second parser for `waterlevel_graph` `graph_data`, with fixtures from the live response, and a note added to ADR 0001 (another undocumented endpoint).
3. **Update CONTEXT.md wording** for K.11A: "below Mae Klong Dam" is sourced by RID's daily diagram (1.96 km below the dam), not just inferred; and update `river-line-order.md` accordingly (out of scope for this task, nothing was modified).
4. **Keep the "ไม่มีข้อมูลอัตโนมัติ" text for the dam's own release/gates**, but make it specific: name RID สำนักงานชลประทานที่ 13 as the announcer and link its page, instead of a generic message.
5. Optional: ask HII (info_thaiwater@hii.or.th, footer of thaiwater.net) why SND04 and K.63 are absent from `waterlevel_load` but present in `waterlevel_graph`, and ask RID Office 13 / hydro-7 whether a release feed exists. Both are questions, not implementation work.
