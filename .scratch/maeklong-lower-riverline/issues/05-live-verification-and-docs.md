# 05: Live verification and docs

**What to build:** Confirm the feature works against the live feeds and that both pages still hold up on a phone, then bring the docs in line.

**Blocked by:** 04

**Status:** done

- [ ] One live Collector run: each new Gauge's id matches its name in the feed and `data/status.json` records each Source
- [ ] `index.html` and `bangkruai.html` checked at 375 px in an iframe: `documentElement.scrollWidth <= 375`, nothing wider than the viewport, chart tick labels not overlapping, tap targets at least 44 px, sticky element not eating too much screen; desktop also checked
- [ ] The Bang Kruai page and the dam sections are unchanged
- [ ] README and `CONTEXT.md` match what shipped (**Riverline**, **Tide** wording)
- [ ] The K.11A discrepancy (ThaiWater 12.03 m vs RID 17.56 m) is recorded as a separate bug, not fixed here
