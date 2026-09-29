Status: done

# Second Site: พื้นที่ บางกรวย, บางคูเวียง (Bang Kruai) — Spec

Research: `research/second-location-feasibility.md` (including the คลองบางค้อ addendum). Vocabulary: `CONTEXT.md` (**Site**, **Proxy gauge**, **Tide**, **Status**). Constraint: `docs/adr/0001-thaiwater-undocumented-public-endpoint.md`.

## Problem Statement

I live in the area of บางกรวย, บางคูเวียง (อ.บางกรวย, นนทบุรี), where flooding is a recurring risk (the municipality says the area floods almost every year). The waterway closest to my home is คลองบางค้อ, a small tidal canal off คลองอ้อมนนท์. No gauge sits on it and no source publishes a level, gate status or flood threshold for it. I have no single place to see whether the water around us is high, rising because of the tide, or rising because of upstream release. The repo I already trust for Mae Klong / Photharam only covers that area.

## Solution

Add a second **Site** to the existing repo and Collector, with its own page. The Bang Kruai page shows nearby **Proxy gauges** (คลองมหาสวัสดิ์, Chao Phraya) side by side, each labelled with how it relates to the area, plus the C.13 (Chao Phraya Dam) discharge as the upstream signal. Because these gauges are tidal, it shows each day's high and low rather than a rising/falling trend. A fixed note says the canal itself is not measured. As with Mae Klong there is no status colour and no alert; levels are stated as facts, including "above the bank" where the source's bank height says so.

## User Stories

1. As a resident of the area, I want a page for my area separate from the Mae Klong page, so that I see only the gauges relevant to me.
2. As a resident, I want the page to state plainly that คลองบางค้อ itself has no gauge, so that I do not mistake a nearby gauge's level for the canal's level.
3. As a resident, I want each gauge labelled with its waterway and its distance or relation to the area, so that I can judge how much it says about my street.
4. As a resident, I want to see nearby gauges side by side without one being the "headline", so that the page does not claim more certainty than the data gives.
5. As a resident, I want each gauge's current level in m MSL with the source's own timestamp, so that I know how fresh it is.
6. As a resident, I want a gauge older than 6 hours flagged "ข้อมูลอาจไม่อัพเดทล่าสุด", so that stale data is never read as current.
7. As a resident, I want each gauge's bank height shown as a fact, so that I can compare the level to the bank myself.
8. As a resident, I want to see "สูงกว่าตลิ่ง x.xx ม." or "ต่ำกว่าตลิ่ง x.xx ม." computed from the level and the bank height, with no colour, so that I know where the water sits without the page inventing a flood threshold.
9. As a resident, I want the daily high and low of each tidal gauge, so that I can tell tide-driven swings from a real rise.
10. As a resident, I want a chart per gauge that is not a misleading rising/falling arrow, so that a tide swing is not read as a flood rising.
11. As a resident, I want the C.13 (ท้ายเขื่อนเจ้าพระยา) discharge in m³/s with its timestamp, so that I can see how much water is being sent down the Chao Phraya.
12. As a resident, I want the C.13 discharge to be clearly labelled as a river discharge below the barrage, not a dam release figure, so that it is not confused with the Mae Klong dam figures.
13. As a resident, I want the page to show C.12 and CPY014 daily highs as the upstream context, so that I can see the Chao Phraya level next to the discharge.
14. As a resident, I want no status colour on any gauge, so that no colour implies an official flood level that does not exist.
15. As a resident, I want a notice on the page that this is unofficial public data and where to get official help, so that I follow official announcements.
16. As a resident, I want a way to see how the collector is doing (last success per source), so that a dead collector cannot hide behind old numbers.
17. As a resident, I want a link between the Mae Klong page and the Bang Kruai page, so that I can move between Sites.
18. As the maintainer, I want one Collector and one `data/` folder for both Sites, so that an endpoint break is fixed once.
19. As the maintainer, I want each tracked station tagged with its Site, so that the two pages never show each other's gauges.
20. As the maintainer, I want the Site-to-gauge mapping tested, so that a wrong tag cannot silently put Mae Klong gauges on the Bang Kruai page.
21. As the maintainer, I want the raw readings of every Bang Kruai gauge kept in the append-only history, so that history stays truthful and complete.
22. As the maintainer, I want a small daily high/low summary derived from the raw history and stored per tidal gauge, so that the page does not download the much larger 10-minute history to draw a chart.
23. As the maintainer, I want the daily summary keyed by Bangkok calendar day using the source's own timestamps, so that a day's high and low are not shifted by the runtime's timezone or by scrape delays.
24. As the maintainer, I want an incomplete current day either excluded or labelled as partial, so that a half-day high is not shown as the day's high.
25. As the maintainer, I want a missing discharge to be `null`, never 0, so that "no data" is never displayed as "no flow".
26. As the maintainer, I want a station missing from a run to write no gap entry (existing rule), so that history stays truthful.
27. As the maintainer, I want the Mae Klong Site's behaviour, data files and page to be unchanged, so that the second Site cannot regress the first.
28. As the maintainer, I want the new stations' ids re-verified by name against the live feed when added, so that id drift (ADR 0001) does not put the wrong gauge on the page.
29. As the maintainer, I want the new gauge and discharge fixtures captured from real feed records, so that a feed shape change breaks one parse function and its tests, not the site.
30. As the maintainer, I want the history file growth from 10-minute gauges to be understood and bounded in the notes, so that the repo does not silently become unwieldy.

## Implementation Decisions

- **Two Sites, one repo.** Mae Klong stays as is. Bang Kruai is a second Site with its own page, sharing the Collector, the parse functions and the data folder. The repo is not renamed now; revisit after the page is live.
- **Site tag on stations.** Each tracked gauge in the Collector's station list carries a Site. Site membership lives in one place and both the Collector and the pages read from it. The Mae Klong Site's existing stations are tagged with the Mae Klong Site and their history files are untouched.
- **Stations for the Bang Kruai Site** (ThaiWater `station.id`, re-verify by name when adding): BKK003 คลองมหาสวัสดิ บางกรวย-สวนผัก (5), C.12 สามเสน (2599), CPY014 สะพานนวลฉวี ปากเกร็ด (26), CPY015 สะพานกรุงเทพ (4), C.13 ท้ายเขื่อนเจ้าพระยา (2744). All are in the feed already fetched by the existing river Source, so no new Source is added. Optional canal-adjacent gauges (BKK018, BKK019, VLGE20) are out of scope unless the maintainer asks.
- **Proxy gauges, no headline.** The page shows the five gauges equally, each with a label for its waterway and its relation to the area (for example "คลองมหาสวัสดิ์ · อยู่ห่างประมาณ 4 กม." and "แม่น้ำเจ้าพระยา"). BKK003 is geocoded by the feed to Taling Chan, Bangkok, so labels must not imply that any gauge is in the area.
- **Fixed note.** A permanent note near the top states that คลองบางค้อ has no gauge and that the levels shown are from nearby gauges. It is not dismissible and not conditional.
- **Status stays neutral.** No published warning or critical level exists for these gauges, so Status is neutral, per the glossary. C.13's `critical_level_m` equals its bank height and is not treated as a threshold unless the feed publishes both thresholds for it (existing rule: both must be present).
- **Bank comparison as a fact.** The parsed record already carries bank height. The page shows the level relative to the bank ("สูงกว่าตลิ่ง" / "ต่ำกว่าตลิ่ง" with the difference in metres), computed from level and bank height, with no colour. It is not a Status and is not described as a flood level. Note: at spec time BKK003 and CPY014 were at or slightly above their banks according to the feed's own comparison, so this wording will be visible immediately.
- **Discharge.** The parse function for a river record is extended to carry the feed's discharge as a number, with `null` when the feed has none or a non-numeric value (never 0). Only C.13 has one at spec time. The history row for a gauge includes discharge only where the source supplies it. The page labels C.13's figure as a river discharge below the barrage, not a dam release. The Mae Klong "Release" concept is not reused for it.
- **Tide handling.** Tidal gauges (BKK003, C.12, CPY014, CPY015) are shown with their daily high and low, not a rising/falling arrow over a short window. C.13 is not tidal and may keep the ordinary trend display. The tide/non-tide distinction is a property of the station configuration, not inferred at runtime.
- **Daily high/low summary.** A new pure function takes a gauge's raw history rows and returns one entry per Bangkok calendar day (date, high, low, and the times of each), using the source's `updatedAt`, not `scrapedAt`. Rows with a non-numeric level are ignored. The current day is excluded or marked partial. The Collector writes the summary as a separate small file per tidal gauge after appending readings; the page reads the summary and the recent raw history for the chart, never the full 10-minute history.
- **History.** Every changed reading is appended (existing `isSameReading` rule, unchanged). Because these gauges report about every 10 minutes and tide changes almost every reading, history grows roughly ten times faster than Mae Klong. This is accepted for now; compaction of old raw data is deferred and noted below.
- **Page.** A second static page for the Bang Kruai Site, sharing the stylesheet and the existing shared behaviours (age display, stale flag, collector health). The two pages link to each other. The Mae Klong page's content is not changed except for the link.
- **Health.** The existing per-source last-success stamps continue to apply; the river Source now covers both Sites. If one Site's gauges are all missing while the other's are found, the run still counts as a river success (existing rule), so the page relies on each reading's own age for staleness.
- **No alerts.** No push or message alerts, consistent with ADR 0001 and the maintainer's decision. No new ADR is needed: none of these decisions is hard to reverse.
- **Vocabulary.** `CONTEXT.md` already has Site, Proxy gauge and Tide. If implementation surfaces a new term (for example a name for the daily summary), add it there.

## Testing Decisions

- **What makes a good test:** it exercises external behaviour of a pure function from real captured feed data, not implementation details. Tests must fail if the behaviour breaks and must not depend on the network, the DOM or the clock unless the clock is passed in.
- **One seam:** the pure functions in the shared parse module, tested with the built-in Node test runner. No new module or seam is introduced. The Collector's I/O wiring and the page rendering are not unit-tested (as today) and are verified by running the Collector once against the live feed with the data folder pointed at a scratch location, not the repo's data folder.
- **Tests to add:**
  - The river record parser: real captured records for BKK003, C.12, CPY014, CPY015 and C.13; discharge parsed as a number for C.13 (from the feed's string), `null` for gauges without one and for non-numeric values, never 0; existing Mae Klong parse tests keep passing unchanged.
  - The daily high/low function: a day with a clear high and low; the high/low times; a day boundary at Bangkok midnight (a reading at 23:50 and 00:10 land on different days regardless of the runtime timezone); readings out of order; non-numeric levels ignored; a single-reading day; the current day excluded or marked partial; empty input.
  - The bank comparison: level above, below and exactly at the bank; `null` when either the level or the bank is missing.
  - The Site-to-gauge mapping: each Site returns exactly its own stations, no station belongs to both, and every configured station has a Site.
- **Prior art:** `parse.test.js` already tests `parseWaterLevelRecord`, `deriveStatus`, `trendOf`, `seriesOf` and `isSameReading` with real trimmed feed records as constants, and asserts "never guess" behaviour (null, not 0 or green).
- **Baseline:** 39 tests pass at spec time; they must still pass.

## Out of Scope

- Alerts of any kind.
- A status colour or any flood threshold, including a user-chosen "your level" (deferred until the maintainer knows the level at which water reaches the area).
- A sea-level (Tide) source, since there is no JSON endpoint; only a page with HTML.
- Bhumibol and Sirikit dam data on the Bang Kruai page.
- A flood travel-time estimate from C.13 to Bang Kruai (no primary source).
- Gauges on or near คลองบางค้อ itself; none exist. A local sensor or citizen observation is a separate idea.
- Renaming the repository.
- Compacting old raw history.
- Changing the Mae Klong Site's data files, page content or behaviour.

## Further Notes

- `waterlevel_graph` is undocumented and ignored a date range when tested; this spec does not depend on it.
- Not established by the research: whether BKK003's level tracks คลองบางค้อ's level, who operates the canal, and whether a possible RID gate and pump station on Khlong Bang Kruai influences it. The fixed note on the page and the Proxy gauge labels exist because of these gaps.
- There are two unrelated canals named คลองบางค้อ (one in Bang Kruai, one in Chom Thong, Bangkok, about 15 km away); use the Bang Kruai one when researching further.
- The run-once verification must not write into the repo's `data/` folder; the Collector's data location needs to be overridable for that, or the run done on a copy.
- At spec time the feed reported BKK003 about 0.09 m and CPY014 about 0.01 m above their banks (`ล้นตลิ่ง`), C.12 about 0.22 m below, CPY015 0.71 m below and C.13 1.67 m below.
