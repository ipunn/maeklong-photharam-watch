# 02: K.57 สะพานบางนกแขวก via the graph feed

**What to build:** K.57 (ThaiWater 832069, absent from the bulk feed) is collected through the per-station graph path, appending only hours newer than the last stored one, and appears in the downstream section on the ordinary **Window** chart. It shows the raw reading, its bank height as a plain labelled line, a fixed "local datum, not comparable with other gauges" note, RID's gauge zero (-13.2) attributed to RID, and a fixed note that it is tidally influenced at low flow. No derived level above sea level is shown. A failure of this **Source** is recorded in `data/status.json` per Source without stopping the others.

**Blocked by:** 01

**Status:** done

- [ ] Id re-verified by name against the live feed; fixture captured from a real graph record
- [ ] Tests at the parse seam: only newer hours are appended; a non-numeric row is dropped, never 0; K.57 is not flagged tidal; Site mapping
- [ ] The Window toggle drives its chart like every other hourly chart
- [ ] The datum note and gauge zero are always shown with the reading, no colour, no Status
- [ ] A broken K.57 fetch leaves other Sources collecting and is visible in `data/status.json`
- [ ] Phone-width check (375 px)
