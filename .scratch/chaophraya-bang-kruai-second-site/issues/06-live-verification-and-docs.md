# 06: Live verification and docs

**What to build:** Confirm the whole second Site works against the live feed and document it. One real Collector run into a scratch data folder confirms all five gauges, C.13 discharge and the daily summaries, and shows Mae Klong output unchanged. The README covers the second Site, and the growth of 10-minute history is recorded as a known trade-off.

**Blocked by:** 03, 04 and 05.

**Status:** done

- [ ] A live run into a scratch folder found all five Bang Kruai stations and left the repo's `data/` untouched.
- [ ] Mae Klong history and page output are identical to before for the same feed data.
- [ ] The README describes both Sites, the Bang Kruai page, and the limitation that คลองบางค้อ has no gauge.
- [ ] The note that 10-minute gauges grow history roughly ten times faster than Mae Klong, with compaction deferred, is written where a future maintainer will find it.
- [ ] `CONTEXT.md` matches what was built; any new term is added.
- [ ] All tests pass.
