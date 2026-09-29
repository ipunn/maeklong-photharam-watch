# 01: Site tag and scratch data folder (prefactor)

**What to build:** Every tracked station carries a **Site**, so one Collector can serve both Sites without their gauges ever mixing. The Mae Klong stations are tagged with the Mae Klong Site, and Site membership lives in one place that both the Collector and the pages can read. The Collector's data folder can be pointed at a scratch location, so a run can be verified without touching the repo's `data/`. Behaviour and data files for Mae Klong do not change.

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] Each configured station has exactly one Site; the Mae Klong stations are tagged Mae Klong.
- [ ] A test asserts each Site returns exactly its own stations, no station belongs to two Sites, and every configured station has a Site.
- [ ] The data folder can be overridden (for example by an environment variable); with no override the Collector behaves as before.
- [ ] A run against a scratch folder produces the same Mae Klong history and status files as before (verified once, live), and writes nothing into the repo's `data/`.
- [ ] The existing 39 tests still pass; Mae Klong page, history files and file names are unchanged.
