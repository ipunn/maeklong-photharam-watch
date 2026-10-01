# 01: K.11A level: ThaiWater and RID disagree

Status: root-cause-found

**Found:** 2026-10-01, while researching the lower Mae Klong (`.scratch/maeklong-photharam-water-monitor/research/lower-mae-klong-riverline.md`, "Avoid"). Deliberately kept out of the lower-riverline work.

**What is wrong:** ThaiWater's bulk feed showed K.11A บ้านวังขนาย at 12.03 m (previous 18.65, discharge 237.64, storage 48.88 %) on 1 Oct 23:00, while RID's own API reads 7.86 m on the gauge (+9.7 = 17.56 m MSL, flagged "*"). An 18.65 to 12.03 drop in one step is not physical. Cause unknown. Our K.11A is collected from the per-station graph feed (`data/wang-khanai.json`), which showed 17.56 on the Riverline strip at 22:00, so the graph feed and the bulk feed also differ.

**To do:** run `/diagnosing-bugs`: check the collector's K.11A history against both feeds, decide which is right, and whether the page ever showed the bad value.

## Comments

### 2026-10-01 23:20 +07 diagnosis, part 1

Loop (throwaway, in the session scratch): fetch K.11A (id 2679) from the bulk feed and the graph feed and read our stored `data/wang-khanai.json`; then scan stored histories for steps over 1 m/h.

- **The feeds do not disagree.** Bulk, graph and our history all say 12.03 m at 23:00, and all say 17.56 at 22:00. RID's 7.86 (+9.7 offset = 17.56) is the **22:00** reading; the research compared it with the **23:00** one. The "discrepancy" was a time mismatch.
- **The real finding is a one-hour step in the source series:** 22:00 17.56 -> 23:00 12.03 (-5.53 m). Only that row carries a discharge for K.11A (237.64 m3/s, against about 1,960 at K.63 and 2,110 at K.55A) and a storage figure (48.88 %) that a river gauge has no reason to report.
- **Same shape seen at K.63 earlier today:** 07:00 17.55 (Q 2,227) -> 08:00 14.81 (Q 1,238) -> 09:00 17.47 (Q 2,195). A one-hour dip in level and discharge together that recovered. No other stored Mae Klong series has a step over 1 m/h (K.55A, Photharam: none).
- **Our collector stored it faithfully** (append-only, source value); it is the source that is wrong or glitching, not the collector.

Hypotheses, ranked:
1. Time mismatch in the research (confirmed above).
2. The 23:00 value is a transient bad hour like K.63's 08:00. Prediction: K.11A's 00:00 reading returns to about 17.4 and a discharge disappears or returns to about 2,000.
3. A real change at the dam. Weak: 237 m3/s cannot sit 2 km below a 2,000 m3/s release with K.63 4 km further down falling only 0.09 m/h.

Open: confirm 2 with the 00:00 reading; decide what the page should do with a physically impossible hour (it currently shows K.11A 12.03 on the Riverline strip and counts K.11A as "falling" in the upstream signal).

### Display guard (maintainer approved)

`suspectLatest` (parse.js, tested at the parse seam with the real K.11A and K.63 sequences) marks the newest reading of a Mae Klong gauge suspect when the level moved over 2 m/h (placeholder limit, `MAX_STEP_M_PER_H`) against the reading before it and no later reading has confirmed it. The page then shows the last trusted reading with its own time, and a plain note giving the set-aside value, time and step. A later reading that returns to the old level (a spike) or holds the new one (a real shift) clears it, so a real change is never hidden for more than one reading. History is untouched; Bang Kruai and the tidal MKG006 are not guarded. Applied to the flow nodes, the detail cards, the Riverline strip and K.2B/K.57.

Still open: whether the 00:00 reading recovers (confirms hypothesis 2); why ThaiWater reports a discharge and storage figure for K.11A in that hour.

### 2026-10-02 00:30 +07 diagnosis, part 2: root cause

Hypothesis 2 was close but the real cause is in our Collector. ThaiWater's graph feed **revises** hourly values after first publishing them:
- K.11A 23:00 was 12.03 (Q 238) when we read it at 23:11; the feed now says **17.57**.
- K.63 08:00 was 14.81 (Q 1,238) when we read it; the feed now says **17.51 (Q 2,211)**.
Our stored History still holds the provisional values, because `newGraphRows` appends only hours strictly newer than the last stored one, so a corrected value for an hour already stored is never read again. Both "glitches" are the same thing: a provisional first value for the newest hour (a partial hour, with a discharge computed from it) that the source later corrects.

Effects: charts and trends keep a dip the source no longer reports, and the K.63 dip at 08:00 is permanently in History.

Options (not done, needs a decision because History is append-only): (a) each run also re-reads the last few stored hours, and when the source's value for an hour differs, append a corrected row with the same `updatedAt` (the page already lets the later row win per source time, `seriesOf`), keeping the provisional one in the log; (b) leave it and rely on the display guard (`suspectLatest`), which only hides the newest hour. The same rule would apply to K.2B, K.57, K.55A, the Barrage (all graph-fed).
