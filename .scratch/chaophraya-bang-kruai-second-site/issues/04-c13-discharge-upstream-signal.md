# 04: C.13 discharge as the upstream signal

**What to build:** C.13 ท้ายเขื่อนเจ้าพระยา (station id 2744) is tracked and shown on the Bang Kruai page with its level, its discharge in m³/s and the source's timestamp. The river parser carries the feed's discharge as a number, `null` when the feed has none or a non-numeric value, never 0. The page labels it a river discharge below the barrage, not a dam release, so it is not confused with the Mae Klong dam **Release**.

**Blocked by:** 02 (Bang Kruai page, first gauge end to end).

**Status:** ready-for-agent

- [ ] Tests, from a real captured C.13 record: discharge parsed from the feed's string to a number; `null` for gauges without discharge (for example C.12) and for non-numeric values; never 0.
- [ ] Existing Mae Klong parse tests still pass unchanged.
- [ ] The history row includes discharge only where the source supplies it.
- [ ] C.13 is not coloured; a bank-height value that equals its `critical_level_m` is not treated as a threshold unless the feed publishes both thresholds.
- [ ] The label on the page says river discharge below the barrage, not dam release.
