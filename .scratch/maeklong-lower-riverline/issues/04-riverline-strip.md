# 04: Riverline strip

**What to build:** The downstream section opens with the **Riverline**: stations in order from the Mae Klong Dam to the Gulf (K.11A, K.63, K.55A, K.56A, K.2B, K.57, Gulf) with the distance to the next station and RID's printed travel time where one exists (only two links print one). The total (about 123 km, about 28 h) is attributed to RID Region 13. Each tracked station shows its latest level and the source's own time; K.56A shows "not tracked" rather than being dropped. Distances and hours live in one attributed data block, and the ordering and formatting is a pure function apart from the markup. No invented hours.

**Blocked by:** 01, 02, 03

**Status:** done

- [ ] Tests at the parse seam: order matches the RID diagram; an untracked station stays as "not tracked"; a link with no printed time shows none; stale readings are flagged
- [ ] Distances and hours are attributed to RID in the page text
- [ ] The strip fits 375 px with no horizontal scroll and tap targets of at least 44 px
- [ ] Follows `docs/design/look.md`; no colour that reads as a status
