# 01: K.11A level: ThaiWater and RID disagree

Status: needs-triage

**Found:** 2026-10-01, while researching the lower Mae Klong (`.scratch/maeklong-photharam-water-monitor/research/lower-mae-klong-riverline.md`, "Avoid"). Deliberately kept out of the lower-riverline work.

**What is wrong:** ThaiWater's bulk feed showed K.11A บ้านวังขนาย at 12.03 m (previous 18.65, discharge 237.64, storage 48.88 %) on 1 Oct 23:00, while RID's own API reads 7.86 m on the gauge (+9.7 = 17.56 m MSL, flagged "*"). An 18.65 to 12.03 drop in one step is not physical. Cause unknown. Our K.11A is collected from the per-station graph feed (`data/wang-khanai.json`), which showed 17.56 on the Riverline strip at 22:00, so the graph feed and the bulk feed also differ.

**To do:** run `/diagnosing-bugs`: check the collector's K.11A history against both feeds, decide which is right, and whether the page ever showed the bad value.

## Comments
