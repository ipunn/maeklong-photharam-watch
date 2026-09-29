# Second location (13°49'59.9"N 100°25'16.8"E): can this repo's sources serve it?

Checked 2026-09-29. Live calls were made by curl that day; "verified" means I read the value from the source myself. Raw feed captures were kept only in the session scratchpad, not in the repo.

Where this lives: the repo keeps research under `.scratch/<feature-slug>/research/` (see `docs/agents/issue-tracker.md`, existing `.scratch/maeklong-photharam-water-monitor/research/`). This is a different feature, so it gets its own slug directory. Move it if you would rather keep one feature.

## Short answer

Yes for river levels. The same `waterlevel_load` feed the repo already scrapes carries every Chao Phraya / Bangkok-area gauge worth watching. It carries no warning or critical thresholds for any of them, so status would be neutral, as at Mae Klong today. The physics differ: this is tidal water, so a raw "is it rising" trend reads as noise unless the chart or the rule accounts for the tide.

## 1. What the location is

Verified. OpenStreetMap Nominatim reverse geocode of 13.833306, 100.421333 returns a residential road, "Pruekpirom Regent Pinklao", ต.บางคูเวียง, เทศบาลเมืองปลายบาง, **อ.บางกรวย, จ.นนทบุรี** 11130.
Source: https://nominatim.openstreetmap.org/reverse?lat=13.833306&lon=100.421333&format=jsonv2&zoom=18&accept-language=th

So it is Bang Kruai, Nonthaburi, not Bang Yai or Bang Sue as guessed.

Inference (not verified): it is on the west bank side of the Chao Phraya, inland from the main river. The nearest feed gauge on a named waterway is on Khlong Mahasawat (4.2 km), and the nearest Chao Phraya gauge (C.12, Samsen) is ~10.7 km away. Which waterway matters most to the user's spot (Chao Phraya, Khlong Bang Kruai-Sai Noi, Khlong Mahasawat, a local drain) is not known from coordinates alone.

## 2. Nearest gauges in the endpoint the repo already scrapes

Verified by calling `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load` (HTTP 200, 1.40 MB, 806 stations, all `station_type` = `tele_waterlevel`) and ranking by haversine distance from the coordinates. This is the endpoint in `scripts/scrape-waterlevel.js` (`WATERLEVEL_URL`) and ADR 0001.

Values are at the feed's own timestamps on 2026-09-29 evening.

| km | station.id | code | name | river | agency | level (m MSL) | min bank (m) |
|---|---|---|---|---|---|---|---|
| 4.2 | 5 | BKK003 | คลองมหาสวัสดิ บางกรวย-สวนผัก | คลองมหาสวัสดิ์ | HII | 2.15 | 2.07 |
| 10.7 | 2599 | C.12 | กรมชลประทานสามเสน | เจ้าพระยา | RID | 2.04 | 2.26 |
| 15.1 | 747 | BKK019 | คลองนราภิรมย์ (บางเลน) | คลองนราภิรมย์ | HII | 2.17 | 3.96 |
| 16.1 | 749 | VLGE20 | ศาลาดิน | คลองหม่อมเจ้าเฉลิมศรี | HII | 1.05 | 2.31 |
| 16.7 | 4 | CPY015 | สะพานกรุงเทพ | เจ้าพระยา | HII | 1.50 | 2.16 |
| 17.7 | 26 | CPY014 | สะพานนวลฉวี (ปากเกร็ด) | เจ้าพระยา | HII | 2.48 | 2.50 |
| 19.1 | 24 | BKK018 | คลองพระพิมล (ไทรน้อย) | คลองพระพิมล | HII | 2.33 | 4.05 |

Chao Phraya main-stem gauges in the same feed, downstream to upstream: CPY015 สะพานกรุงเทพ (id 4), C.12 สามเสน (2599), CPY014 ปากเกร็ด (26), CPY012 บางปะอิน (49), CPY011 / C.35 อยุธยา (39 / 2609), C.7A บางแก้ว (2626), C.3 บางพุทรา (2723), and C.13 ท้ายเขื่อนเจ้าพระยา (2744, RID, 15.164 N 100.188 E, 14.67 m MSL, discharge 2,000 m³/s, `qmax` 2,720, min bank 16.34). Further up: C.2 นครสวรรค์ (2795).

Ids are as of today. ADR 0001 already says ids drift and must be re-verified by name when added.

What the feed exposes per station: `waterlevel_msl`, `waterlevel_datetime`, bank levels, `min_bank`, `discharge` (only some RID stations, e.g. C.12 has none, C.13 has 2,000), and `situation_level` (an integer whose scale I did not find documented; I did not use it).

Thresholds: `warning_level_m` and `critical_level_m` are **null for all seven nearby stations above**. The only Chao Phraya-line gauges with any value I saw are C.13 (critical_level_m 16.34, warning null) and C.2 (warning 7.6, critical 26.2). C.13's 16.34 equals its min bank level. So the repo's rule "thresholds only from the feed, never guessed" would give neutral status at Bang Kruai exactly as it does at Mae Klong. `min_bank` is present and could be shown as a fact ("ระดับตลิ่งต่ำสุด") without being a threshold; whether to treat it as one is a policy decision (open question).

Also verified: `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph?station_type=tele_waterlevel&station_id=<id>&start_time=YYYY-MM-DD&end_time=YYYY-MM-DD` returns `graph_data` (datetime, value, value_out, discharge) plus `min_bank`, `warning_level`, `critical_level`, `ground_level`, `qmax`. It is undocumented (same status as ADR 0001). It returned ~3.5 days regardless of the dates I passed (both a 2026-09-29-only request and a 09-27 request started at 09-26 00:00), so I cannot claim how far back it goes. A secondary write-up claims up to 365 days of hourly history; I did not verify that. It is useful for backfilling a chart, but its window behaviour needs testing before relying on it.
Source for the endpoint itself: my own curl calls on 2026-09-29.

## 3. Tidal influence: verified from the gauge series

From `waterlevel_graph`, 2026-09-26 to 09-29 (10-minute for HII, hourly for RID stations):

| Station | daily min-max range (m) | timing of min / max | reading |
|---|---|---|---|
| CPY015 สะพานกรุงเทพ | 1.42-1.53 | min ~12:50-14:00, max ~18:10-18:50 or 06:50-07:50 | strongly tidal |
| C.12 สามเสน | 0.95-1.00 | min ~13:00-14:00 or 03:00-04:00, max ~19:00 or 07:00-08:00 | strongly tidal |
| BKK003 มหาสวัสดิ | 0.63-0.70 | min ~14:20-15:00 or 03:40-04:20, max ~08:00 or 20:00 | tidal |
| CPY014 ปากเกร็ด | 0.42-0.54 | min ~03:00-04:30, max ~08:00-09:10 or 20:00 | damped tidal |
| C.13 ท้ายเขื่อนเจ้าพระยา | 0.00-0.56 | flat after 09-26 | not tidal, follows dam release |

The tide has a roughly 12.4 h period, i.e. about two highs and two lows a day, and the phase shifts about 50 minutes later each day. Amplitude fades upstream: ~1.5 m at Bangkok Bridge, ~1.0 m at Samsen, ~0.5 m at Pak Kret. Mae Klong's Photharam gauge is far up a river with a dam and weir and is not read as tidal; the existing history there is a slow trend. Whether Photharam has any tide at all I did not test.

Consequence (inference): a rising-or-falling arrow and the repo's "identical reading is not appended" rule (`isSameReading`) behave differently here. At 10-minute source cadence almost every reading changes, so history would grow about 10x faster than at Mae Klong (history per HII gauge is 144 rows/day, versus the RID hourly gauges). The signal a flood watcher wants is the daily high and the daily-mean or low-pass level, not the instantaneous level.

Near-mouth tide sources:
- ThaiWater's own sea-level page https://tiwrm.hii.or.th/v3/sealevel lists ป้อมพระจุลจอมเกล้า and ท่าเรือกรุงเทพ with actual and forecast values (4-hourly forecasts, "1 year in advance"), in m MSL, attributed to the Royal Thai Navy Hydrographic Department and the Marine Department. Verified only through a fetch of the page text. I found **no JSON endpoint** for it: `public/sea_level`, `public/sealevel_load`, `public/tide_graph`, `public/tide`, `tide/tide_load` and `analyst/tide` all returned 404, and `waterlevel_load` has no sea/tide station (ปากน้ำ / ป้อมพระจุลฯ are absent; the only "จุลจอมเกล้า" hit is an unrelated Phunphin bridge). It would need its own scrape or page parse, which would be a new source under ADR 0001's risk category (and likely another "undocumented" one).
- The Navy hydrographic department's river-level page (https://www.hydro.navy.mi.th/3chaophraya/rtnhq.html) returned 404 to my fetch; a sibling URL was in search results but I did not read it. Tide-table values are otherwise available from third-party aggregators, which I did not treat as primary.
- `https://fews2.hii.or.th` returned 403 to curl. A secondary summary says it serves a Gulf tide table; unverified.

## 4. Chao Phraya Dam (C.13) and upstream

Verified from the repo's own feed:
- C.13 ท้ายเขื่อนเจ้าพระยา (station id 2744): 14.67 m MSL, discharge 2,000 m³/s at 2026-09-29 19:00 (the feed timestamp). Over 09-26 to 09-29 the hourly level went 13.96 to 14.52 to 14.67. Source: `waterlevel_load` and `waterlevel_graph` (station 2744), my curl calls.
- ThaiWater dam feed `https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam` (the repo's `DAM_HOURLY_URL`), `dam_hourly` has 17 records including Bhumibol (id 43, 243.34 m, release field 1.13) and Sirikit (id 52, 154.36 m, release 1.97) with `dam_date` 2026-09-29 19:00. It has **no Chao Phraya Dam record**: the barrage is a diversion structure, as with Mae Klong Dam in the repo's spec. So the C.13 gauge is the practical "release" proxy, and its discharge is a river discharge measured just below the barrage, not a dam release figure. The repo's dam-feed unit note (`.scratch/maeklong-photharam-water-monitor/research/thaiwater-dam-feed-units.md`) would apply to Bhumibol/Sirikit fields too; I did not re-derive units.
- Search results (secondary, not primary) repeat 1,750-2,000 m³/s at the dam. Treat only the C.13 feed value as verified.
- RID's own daily situation PDF exists: `https://water.rid.go.th/flood/flood/daily.pdf` (HTTP 200, application/pdf). I did not read it, so I do not claim its contents cover C.13 or C.12.

Travel time from C.13 to Bang Kruai: not sourced. I did not find a primary statement. One secondary result quoted a "one to nine days" window for the effect of 1,500-2,000 m³/s; treat that as unverified and ask an RID source before building a lead-time claim.

## 5. Other agencies

- **Bangkok Drainage and Sewerage Department (DDS):** https://weather.bangkok.go.th/water returned 200. A page-text summary says 255 stations, one Chao Phraya point (ส.ปากคลองตลาด, Pak Khlong Talat), colour-coded green / orange / red per station with warning and critical thresholds shown (e.g. "1.80-2.00" warning), and no public API. This is the only source I saw that publishes per-station thresholds. It is a web page, not a feed; the page text was summarised by a fetch tool, so I did not verify units, datum or the exact threshold per station. Pak Khlong Talat is downstream of Bang Kruai, and Bang Kruai/Nonthaburi is outside BMA's jurisdiction, so threshold coverage for the actual spot is not established.
- **HII / ThaiWater** BKK-series gauges (BKK003 etc.): these are already in the repo's feed.
- **DDPM** (Department of Disaster Prevention and Mitigation): not investigated.
- **Nonthaburi provincial or RID Regional Office notices:** not investigated; the Mae Klong work used a RID regional statement as a corroborating source (see `river-line-order.md`). The same could exist here.
- Flood-wall heights I saw quoted (2.8-3.5 m MSL, sandbag lines 2.4-2.7 m) came from a search summary of Bangkok Post, so they are secondary and cover Bangkok's wall, not Bang Kruai. Do not use them as thresholds without a primary source.

## 6. Verified vs inferred, in one place

Verified (I read it from the source):
- The location is อ.บางกรวย, จ.นนทบุรี.
- `waterlevel_load` already contains the stations in section 2, with the values shown, and null warning and critical thresholds for them.
- `waterlevel_graph` works for these stations and shows tidal cycles at CPY015, C.12, BKK003, CPY014, and none at C.13.
- The dam feed has no Chao Phraya Dam record; C.13 gauge shows 2,000 m³/s.
- No tide endpoint exists in the repo's ThaiWater API that I could find; the sea-level page exists as HTML.

Inferred:
- The spot is inland west of the Chao Phraya; the relevant waterway is unknown.
- History would grow about 10x faster because HII gauges report every 10 minutes.
- C.12 and CPY014 bracket the river for this spot; BKK003 is the nearest local canal gauge.
- Semidiurnal period and 50-minute daily drift (my reading of the data; this is the standard lunar-tide pattern but I did not cite a source).

Not established: travel time from C.13 to Bang Kruai; what any threshold means for the user's building or street; `situation_level` scale.

## 7. What would change in the repo

Fit: the collector, parser and per-series history file are reusable as they are. `STATIONS` in `scripts/scrape-waterlevel.js` is a flat list for a single site; nothing in it names Mae Klong, but files, the page and the glossary do.

- **Config / data model:** add site grouping. Today `STATIONS`, `RESERVOIRS` and `DAMS_HOURLY` are flat arrays, `data/*.json` files are unprefixed (`photharam.json`), and the page (`index.html`, `app.js`) is hard-wired to one area, with copy about แม่กลอง/โพธาราม and two reservoirs. Options: a second repo (the spec chose a fully separate repo for a similar split), or a `site` key on each item with a per-site data directory and page.
- **Stations to add (candidates, for the user to choose):** BKK003 (id 5), C.12 (2599), CPY014 (26), CPY015 (4), C.13 (2744). Optional: BKK019 / BKK018 / VLGE20 if a canal near the user matters.
- **Reservoir / dam block:** replace with C.13 discharge, and possibly Bhumibol (id 43) and Sirikit (id 52) via the existing `analyst/dam` parse. The EGAT HTML source (`water.egat.co.th/water_crisis.php`) already has those dams' rows; whether to include them is a scope decision.
- **Tide handling:** either a second series for sea level (needs a new source, section 3), or a derived daily-high and daily-mean per gauge computed from the stored history. Both need a spec decision; the Mae Klong page's slope logic would mislead on tidal series.
- **Cadence and history size:** the workflow runs about every 13 minutes (`.github/workflows/scrape.yml`) and would sample HII's 10-minute data at roughly that rate. Check repository size growth in `data/`, since HII series would append nearly every run.
- **Freshness rule:** `CONTEXT.md` says readings older than 6 hours are flagged. The HII stations appear to report every 10 minutes. The 6 h rule still works, but a tighter one is possible; one station in the feed had a `waterlevel_datetime` two days old (CPY011 อยุธยา, 2026-09-27 23:00), so per-station staleness matters.
- **Thresholds and alerts:** no published threshold, so status is neutral (the repo's discipline). The repo says "no alerting" deliberately (ADR 0001, Consequences). If the user wants alerts for the second site, that is a new decision and would need an ADR, and a source of thresholds (DDS, or the RID or Nonthaburi provincial notices) that this research did not find for Bang Kruai.
- **CONTEXT.md:** add terms or update definitions. **Gauge** says "tracked via ThaiWater ... ThaiWater station.id", still true. **Source** lists three feeds; a tide feed would be a fourth. Add **Tide-affected gauge** (or similar) and **Site**. **Dam** is defined as the two Mae Klong dams and would need to widen, and "not a Gauge" would need care for C.13, a gauge below a barrage. **Reading** uses one freshness rule, which may need a per-source cadence.
- **ADR:** ADR 0001 already covers `waterlevel_load` and `analyst/dam`. Add to it or write a new ADR for `waterlevel_graph` if used, the sea-level source if scraped, and the DDS page if parsed. Record any threshold-source decision. If the second site becomes a second repo, no ADR change is needed beyond the new repo's own.
- **Tests:** add fixtures for one HII station (10-minute, `discharge` null) and one tidal series in `parse.test.js`. The `min_bank`-as-fact display, if chosen, needs a test.

## 8. Open questions for the user

1. What exactly are you protecting at that spot, and which waterway is nearest to it (Chao Phraya, Khlong Mahasawat, Khlong Bang Kruai-Sai Noi, a local drain)? This decides which gauges are primary.
2. Same repo with two sites, or a second repo like the original spec did for Bangkok?
3. Is a status colour needed? With no published threshold the site will show neutral, as now. Would you accept `min_bank` (bank height) as a shown fact, or DDS thresholds, or your own chosen level labelled as yours (a departure from the "never guess" rule)?
4. Is the question "will the river overtop" (driven by dam release and tide together) or "is the tide high right now"? That decides whether a sea-level source is worth a new scrape.
5. Do you want alerts (push or message) for this site? ADR 0001 currently says there is deliberately none.
6. Is the C.13 discharge plus the daily high at C.12 and CPY014 enough as the "upstream signal", or do you want Bhumibol and Sirikit as well (they exist in the same dam feed)?
7. Ok to keep the repo's history-append frequency for 10-minute stations, or should tidal series be stored at hourly resolution?

## Sources

- https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load (called 2026-09-29)
- https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_graph (called 2026-09-29)
- https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam (called 2026-09-29)
- https://nominatim.openstreetmap.org/reverse (OpenStreetMap; called 2026-09-29)
- https://tiwrm.hii.or.th/v3/sealevel (page text via fetch tool)
- https://weather.bangkok.go.th/water (page text via fetch tool; DDS)
- https://water.rid.go.th/flood/flood/daily.pdf (exists, not read)
- Repo files: `scripts/scrape-waterlevel.js`, `CONTEXT.md`, `docs/adr/0001-thaiwater-undocumented-public-endpoint.md`, `.github/workflows/scrape.yml`, `.scratch/maeklong-photharam-water-monitor/spec.md`

## Addendum: คลองบางค้อ

Checked 2026-09-29. Question: the user says the waterway most likely to affect their village is คลองบางค้อ (typed "บ้างค้อ"), closest to 13.8333, 100.4213. "Verified" = I read it from the source myself (Overpass, Nominatim, the ThaiWater feed, or a fetched page). Raw Overpass and feed captures stayed in the session scratchpad.

### Short answer

The canal is real, is in Bang Kruai, and passes about 80 m from the coordinates. It is a small link canal off Khlong Om Non (the Bangkok Noi line). No source I found publishes a level, a gate status or a threshold for it, and no gauge sits on it. The nearest gauge that shows the same water is likely the Chao Phraya tide-driven network, with BKK003 (Mahasawat) as the closest local proxy. That last part is inference.

### 1. Spelling and identity

Verified:
- Correct spelling is **คลองบางค้อ** (OSM `name`, `name:en` = "Khlong Bang Kho"). "บ้างค้อ" and "บางข้อ" match nothing in OSM; the Nominatim text search for คลองบางค้อ returns the right canal. A municipal page (plaibang.go.th, below) also spells it คลองบางค้อ.
- **There are two different canals with this exact name.** One is at 13.70 N, 100.47 E in เขตจอมทอง, กรุงเทพมหานคร (OSM ways 30754512, 830066273, 830066274, about 15 km away, near Thon Buri). The other is in อ.บางกรวย, จ.นนทบุรี (OSM ways 200043254 and 200043256). They are unrelated. Anyone searching the name in news or DDS pages may get the Bangkok one.
- Nearby place: วัดบางค้อ (Wat Bang Koh), OSM way 451963457, at 13.8275, 100.4112, on the canal.
- I found no alternate name for the Bang Kruai canal. The other names in the area are separate canals (คลองคูลัด, คลองบางคูเวียง, คลองบางราวนก).

Sources: Overpass API queries on 2026-09-29 (`name~บางค้อ` in a bbox around Bangkok/Nonthaburi); https://nominatim.openstreetmap.org/search?q=คลองบางค้อ ; https://plaibang.go.th/public/list/data/index/menu/1144

### 2. Where it runs (OSM geometry)

Verified from OSM (Overpass, geometry and shared nodes):
- Way 200043254 (`waterway=river`, tagged admin_level 6): starts at **13.8366, 100.4255** and runs about 2.2 km south-west to **13.8281, 100.4120**. Its start node is shared with **คลองอ้อมนนท์** (ways 883309467 and 200043248), so it branches off Khlong Om Non there. Its closest point to 13.8333, 100.4213 is about **0.08 km**.
- At 13.8281, 100.4120 it meets **คลองคูลัด** (ways 200043267, 252477998, 881656546), and the canal continues as way 200043256 (`waterway=canal`, about 1.1 km) west to **13.8240, 100.4030**.
- That west end is a junction with **คลองหัวคูนอก** (200043262, north-west to 13.8313, 100.3990), **คลองขื่อขวาง** (200043275, south to 13.8051, 100.4132) and **คลองบางนา** (1125006183, from the west). Total OSM length about 3.3 km.
- Wat Bang Koh (13.8275, 100.4112) is on the canal, by the Khu Lat junction.

Verified from Thai sources: Wikipedia says Khlong Om Non is "considered part of Khlong Bangkok Noi as well", and Khlong Bangkok Noi begins from the Chao Phraya north of Thonburi Railway Station, 3.3 km long, meeting Khlong Chak Phra and Khlong Lat Bang Kruai opposite Wat Suwannakiri (https://th.wikipedia.org/wiki/คลองบางกอกน้อย). The Plai Bang municipal page lists Khlong Bang Kho among 15 secondary canals, under three main canals: Bangkok Noi, Mahasawat, Wat Bot.

Inference (not verified end to end): the Om Non end connects to the Chao Phraya via Khlong Bangkok Noi (downstream) and via Khlong Bang Kruai and Bang Yai links (upstream), and the west end reaches the Bang Yai / Bang Muang / Mahasawat side network through Hua Khu Nok, Khue Khwang and Bang Na. I did not trace every junction to a river mouth. OSM does not tag flow direction.

### 3. Tidal? Gates? Pumps? Operator?

- **Tidal:** not stated by any source I read. Inference: it is part of a canal network that is open to the Chao Phraya through Khlong Bangkok Noi, and the nearest canal gauge BKK003 (Mahasawat) has a daily range of about 0.65 m in the earlier section 3, so the water here very likely moves with the tide too. Unverified for Bang Kho itself.
- **Gates/regulators/pumps on the canal itself:** none in OSM. The only gate node near it is an untagged `waterway=sluice_gate` at 13.8320, 100.4681 (OSM node 7621064814), about 5 km east on the river side. I have no source saying which canal it serves, so I do not attribute it to Bang Kho. Overpass searches for pumping stations and for names containing ประตูระบาย or สถานีสูบ in a bbox around the canal (13.78-13.88 N, 100.36-100.48 E) returned nothing else.
- **Nearby official gate (not on this canal):** search results describe RID's ประตูระบายน้ำและสถานีสูบน้ำคลองบางกรวย at the mouth of Khlong Bang Kruai on the Chao Phraya (gates 6 m wide, three pumps, 9 m³/s, flood wall 165 m long and 4 m MSL), project run by RID Irrigation Office 11, behind วัดลุ่มคงคาราม, ต.บางกรวย. This came from a search summary, not a page I read in full, so it is secondary. It protects the Khlong Bang Kruai mouth, and I found no evidence it controls Bang Kho.
- **Operator of Bang Kho:** not found. Inference: as a small municipal canal in เทศบาลเมืองปลายบาง (ต.บางคูเวียง) it would be a local government or RID Office 11 matter. Not verified.
- The Plai Bang municipal page says the area floods almost every year in the high-water season ("ฤดูน้ำหลากมักประสบปัญหาน้ำท่วมเสมอเกือบทุกปี"). It mentions no gate or pump.

### 4. Gauges

Verified by re-calling `waterlevel_load` on 2026-09-29 (806 tele_waterlevel stations, plus 35 `waterlevel_manual_data` rows):
- **No station name contains บางค้อ, คูลัด, อ้อมนนท์, บางกอกน้อย, ปลายบาง, บางคูเวียง or ประตู in either list.** Only two names contain บางกรวย or ไทรน้อย: BKK003 (below) and BKK018 (19 km).
- Nearest to 13.8333, 100.4213: BKK003 คลองมหาสวัสดิ บางกรวย-สวนผัก (HII, id 5) at 4.18 km, 2.15 m MSL at 19:30; then C.12 สามเสน at 10.73 km; then BKK019, VLGE20, BKK005 (คลองภาษีเจริญ), CPY015, CPY014, all more than 15 km. This matches section 2 above; nothing new nearer.
- Manual-data rows near the canal: none I could match by coordinates (the rows carry no usable lat/lon for this area).
- Probed for other ThaiWater endpoints for canals, gates or pumps: `public/canal_load`, `gate_load`, `floodgate`, `watergate`, `canal`, `waterlevel_canal`, `pump_load`, `water_gate`, `gate` and `analyst/gate` all returned 404. I did not find a gate or canal station feed.

Which gauge reflects Bang Kho: none directly. Inference: BKK003 is the best proxy for the tide and network level (4.2 km, same canal network side), and CPY014 / C.12 for the Chao Phraya driving it. Whether BKK003's level matches Bang Kho's level (there may be gates or sills between them) is not established. A ground check with a staff gauge or a photo of the canal at a known bank level would settle that.

### 5. Published levels, gate status or thresholds

Nothing found. No feed, page or notice I read publishes a level, gate status, or warning or critical threshold for คลองบางค้อ. BKK003 has null warning and critical levels (section 2). The DDS page (weather.bangkok.go.th/water) covers Bangkok's stations, not Nonthaburi, and the Bangkok canal of the same name is the wrong one. I did not read any Nonthaburi provincial or RID Office 11 notice that names it.

### 6. Verified vs inferred

Verified: the spelling and the two same-named canals; OSM geometry and junctions of the Bang Kruai one (Om Non to Khu Lat and on to Hua Khu Nok / Khue Khwang / Bang Na); distance about 0.08 km; no gauge named for it in the feed; no gate or pump on it in OSM; the municipal page lists it as a secondary canal; the area floods most years per that page.

Inferred: tidal behaviour; the canal's operator; that BKK003 is a fair proxy; the far connections to the Chao Phraya.

Not established: any level or gate status source; who operates it; whether a gate or sill separates it from Om Non.

### 7. Effect on the plan

Section 8 question 1 is now answered: primary gauges are BKK003 (nearest canal gauge, tidal) with CPY014 and C.12 (river driving it), plus C.13 upstream. The Bang Kho canal itself cannot get its own reading from the current sources. If the site page names Khlong Bang Kho, label the gauges as "nearby and tidal, not on this canal". Contact เทศบาลเมืองปลายบาง or RID Irrigation Office 11 to ask about gates and any local warning level.

### Addendum sources

- Overpass API (OSM data, ODbL), queries run 2026-09-29: named waterways in the bbox 13.70-13.95 N, 100.30-100.55 E; connected ways at shared nodes of ways 200043254, 200043256, 883309467, 200043248; gate and pump nodes in the bbox 13.78-13.88 N, 100.36-100.48 E.
- https://nominatim.openstreetmap.org/search (query คลองบางค้อ)
- https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load (called 2026-09-29)
- https://plaibang.go.th/public/list/data/index/menu/1144 (fetched page; municipality)
- https://th.wikipedia.org/wiki/คลองบางกอกน้อย (fetched; secondary)
- Search summaries only, not read in full: the RID Khlong Bang Kruai gate and pump project (http://km.rdpb.go.th/Project/View/6430 turned out to be a different project, in Bang Pai, Mueang Nonthaburi, and is not used).
