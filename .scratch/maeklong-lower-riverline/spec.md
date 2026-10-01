Status: done

# Lower Mae Klong Riverline (dam to the sea) — Spec

Research: `.scratch/maeklong-photharam-water-monitor/research/lower-mae-klong-riverline.md` (verified / inferred / gaps; flood counts are news-only). Vocabulary: `CONTEXT.md` (**Riverline**, **Gauge**, **Site**, **Tide**, **Window**, **Status**, **Reference line**, **Source**). Constraint: `docs/adr/0001-thaiwater-undocumented-public-endpoint.md`. Look and motion: `docs/design/look.md`.

## Problem Statement

The Mae Klong page tells me whether อ.โพธาราม is at risk, from gauges above it. On 1 Oct 2026 the water is pooling further down, in อ.เมือง, อัมพวา and บางคนที of สมุทรสงคราม, reportedly because the dam release (2,227 m³/s) is meeting high tide at the lower reach. The page shows nothing below โพธาราม, so I cannot see how the river runs from the dam to the sea, how long a release takes to arrive, or whether the tide is blocking the drain.

## Solution

Add a **Riverline** section at the bottom of the Mae Klong page: a strip of stations in order from the Mae Klong Dam to the Gulf, with RID's distances and travel times between them, where each tracked **Gauge** shows its latest level. Three new Gauges join the Mae Klong **Site**: K.2B สะพานธนะรัชต์ and K.57 สะพานบางนกแขวก on the ordinary **Window** chart, and MKG006 พระรามสอง (the mouth) on the **Tide** rule (daily high and low). Untracked stations (K.56A) appear as "not tracked". A fixed line says the dam release meets high tide at the lower reach and that flooded land is not measured here. No new status colour and no new alert.

## User Stories

1. As a reader worried about สมุทรสงคราม, I want to see the river as an ordered chain from the dam to the Gulf, so that I understand where my area sits on it.
2. As a reader, I want the distance between neighbouring stations, so that I can see how far water must travel.
3. As a reader, I want the travel time between stations where RID prints one, so that I can estimate when a release reaches me.
4. As a reader, I want the 28 h dam-to-Gulf figure attributed to RID Region 13, so that I know who says it.
5. As a reader, I want each tracked station on the strip to show its latest level with the source's own time, so that I know how fresh it is.
6. As a reader, I want a reading older than 6 hours flagged "ข้อมูลอาจไม่อัพเดทล่าสุด", so that stale data is never read as current.
7. As a reader, I want stations we do not track (K.56A) shown as "not tracked", so that the strip is not misleadingly shorter than the real river.
8. As a reader, I want K.2B's level and bank height, so that I can see how close Ratchaburi city is to its bank.
9. As a reader, I want K.57's raw reading with a note that its datum is local and not comparable with other gauges, so that I do not read 15 m next to 5.9 m as the river rising downstream.
10. As a reader, I want K.57's RID gauge zero (-13.2) stated next to the note, so that a curious reader can check it.
11. As a reader, I want K.57 and K.2B on the ordinary Window chart, so that their small current swings (about 0.1 to 0.15 m) read as a trend.
12. As a reader, I want a fixed note that K.2B and K.57 are tidally influenced at low flow, so that a low-flow swing is not read as flooding.
13. As a reader, I want พระรามสอง shown as each day's high and low, not a rising/falling arrow, so that a tide swing is not read as a flood rising.
14. As a reader, I want today's partial high and low marked as partial, so that half a day is not shown as the day's high.
15. As a reader, I want bank height drawn on the chart as a plain labelled line in words, with no colour, so that I can see how near the water is to the bank without an invented threshold.
16. As a reader, I want a fixed line that the dam release meets high tide at the lower reach and flooded land is not measured here, so that a normal level at พระรามสอง is not taken to mean no flooding at my house.
17. As a reader, I want the headline, situation card and sticky pill to stay about โพธาราม, so that the page's main job does not change.
18. As a reader, I want the new section at the bottom, so that it adds context without pushing the headline down.
19. As a reader on a phone, I want the Riverline strip to fit 375 px without horizontal scroll and with tap targets of at least 44 px, so that I can read it where most people read this page.
20. As a reader, I want the Window toggle to apply to K.2B and K.57 charts like every other hourly chart, so that the same x means the same clock time.
21. As a reader, I want the tide box not to follow the Window, like other daily boxes, so that its day-by-day view stays stable.
22. As a reader, I want no status colour and no Site alert on these gauges, so that no colour implies an official flood level.
23. As the maintainer, I want the new Gauges tagged with the Mae Klong Site in the one station list, so that the Bang Kruai page never shows them.
24. As the maintainer, I want K.2B and K.57 read from the per-station graph feed, because they are absent from the bulk feed, so that they are collected at all.
25. As the maintainer, I want พระรามสอง read from the bulk feed with its tide flag set in the station configuration, not inferred at runtime.
26. As the maintainer, I want the new stations' ids re-verified by name against the live feed when added, so that id drift (ADR 0001) cannot put the wrong gauge on the page.
27. As the maintainer, I want fixtures captured from real feed records for each new station, so that a feed shape change breaks one parse function and its tests.
28. As the maintainer, I want each new Gauge's History to follow the existing append-only rule, so that history stays truthful.
29. As the maintainer, I want `data/status.json` to keep recording per-source success so that a missing new gauge cannot hide behind another gauge's success.
30. As the maintainer, I want the distances and hours on the Riverline held as one small attributed data block, not scattered through markup, so that a RID revision is one edit.
31. As the maintainer, I want the existing Mae Klong gauges, data files and headline unchanged, so that this cannot regress the page people already trust.
32. As the maintainer, I want the K.11A level discrepancy kept out of this work and filed as its own bug, so that this scope stays clean.
33. As the maintainer, I want the unofficial-data notice and official-help pointer to stay on the page, so that readers follow official announcements.

## Implementation Decisions

- **Same Site, no new page.** The three new Gauges join the Mae Klong Site. The Site tag lives in the one tracked-station list that the Collector and the pages both read.
- **Gauges** (ThaiWater `station.id`, re-verify by name when adding): K.2B สะพานธนะรัชต์ (832068) and K.57 สะพานบางนกแขวก (832069), both graph-feed only; MKG006 พระรามสอง (755), bulk feed. K.56A (not in ThaiWater by id, RID API only) and PTTEP1 คลองโคน (1373690) are deliberately not added.
- **Graph-feed gauges.** K.2B and K.57 are collected through the existing per-station graph path, like K.63, appending only hours newer than the last stored one. They join the existing `damArea` Source or a sibling Source of the same shape; whichever is chosen, a failure of one Source must not stop the others and must be recorded per Source in `data/status.json`.
- **Tide.** MKG006 is flagged tidal in station configuration and uses the existing daily high/low summary and the tide display. K.2B and K.57 are not flagged tidal and use the ordinary Window trend. The page carries a fixed note that they are tidally influenced at low flow.
- **K.57 datum.** The page shows the raw reading, the bank height, a fixed "local datum, not comparable" note and RID's gauge zero (-13.2) attributed to RID. It does not show a derived level above sea level; the derivation (about 1.92 m) is an inference from one source and ThaiWater's own ground level disagrees.
- **Bank height.** Drawn as a plain labelled **Reference line** on each new Gauge's chart, named in words, with no colour, never a **Status** and never a **Site alert**.
- **Riverline strip.** One ordered list of stations from the dam to the Gulf: K.11A, K.63, K.55A, K.56A, K.2B, K.57, Gulf, with the distance to the next station and RID's printed travel time where one exists (only two links have one). The total (about 123 km, about 28 h) is attributed to RID. Tracked stations show their latest reading and its time; untracked stations show "not tracked". The strip is data plus a pure ordering/formatting function, kept apart from the markup.
- **Placement.** A new section at the bottom of the Mae Klong page. The headline, situation card and sticky pill are unchanged.
- **Fixed pooling line.** A permanent, non-dismissible sentence: the dam release meets high tide at the lower reach, and flooded land is not measured here. Same style as the Bang Kruai note that the canal itself is not measured.
- **Look.** Follow `docs/design/look.md`; use no new colours that read as a status.
- **Vocabulary.** **Riverline** is added to `CONTEXT.md`; **Tide** is updated so the Mae Klong mouth counts as tidal. No ADR: nothing here is hard to reverse.

## Testing Decisions

- A good test checks external behaviour through the pure functions with real fixtures, not implementation details.
- **One seam: the pure functions in the parse module**, tested with the Node test runner against fixtures. This is the existing seam, so no new seam is proposed. New behaviour goes in as pure functions at that seam: the Riverline ordering and formatting, the station-configuration lookup for the Mae Klong Site (including the tide flag), and parsing of any new record shape.
- Cases to cover: the Site-to-gauge mapping (a Bang Kruai page never gets a Mae Klong lower-reach gauge); the tide flag set for MKG006 and not for K.2B and K.57; a graph row with a non-numeric level is dropped, never 0; the Riverline keeps an untracked station as "not tracked"; the strip order matches the RID diagram; stale detection uses the source's own time.
- Prior art: the existing parse tests for `parseWaterLevelRecord`, `parseWaterLevelGraph`, `newGraphRows`, `dailyHighLow`, `stationsForSite` and `isSameReading`.
- Not unit-tested: the rendered page. It is verified by the phone-width check required in `AGENTS.md` (no horizontal scroll, tap targets, sticky height), and by one live run of the Collector.

## Out of Scope

- Flooded-land or pooling-water data: no feed exists for สมุทรสงคราม.
- K.56A, PTTEP1 คลองโคน, MKG005, GLF003 and any gauge from RID's own API.
- A derived level above sea level for K.57.
- A new **Site alert**, status colour or threshold.
- The K.11A discrepancy (ThaiWater 12.03 m against RID 17.56 m): a separate bug for `/diagnosing-bugs`.
- Changes to the Bang Kruai page and the dam sections.
- Compaction of old History.

## Further Notes

- The flood counts and causes in the research are news only (Thai PBS, DDPM via news). Primary provincial announcements, TMD and EGAT were not read, so the page states no counts.
- The travel-time figures are RID's, and only two links print one, so the strip must not invent the rest.
- The K.57 datum rests on one RID figure; ThaiWater's ground level (-6.2) is unexplained.
- History for the new 10-minute tidal gauge grows like the Bang Kruai gauges; this is accepted.
