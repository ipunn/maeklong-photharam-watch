# 01: Tide gauge at the mouth (MKG006 พระรามสอง), end to end

**What to build:** A reader of the Mae Klong page sees, in a new "downstream" section at the bottom, the tidal Gauge nearest the Gulf (MKG006 พระรามสอง, ThaiWater 755, bulk feed) as each Bangkok day's high and low (today marked partial), not a rising/falling arrow. Bank height is a plain labelled **Reference line** in words, no colour, no **Status**, no **Site alert**. A fixed, non-dismissible sentence says the dam release meets high tide at the lower reach and flooded land is not measured here. The Gauge is tagged to the Mae Klong **Site** and flagged tidal in station configuration; its History follows the append-only rule. Headline, situation card and sticky pill are unchanged. This ticket creates the section that later tickets fill.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Station id re-verified by name against the live feed; a fixture is captured from a real record
- [ ] Tests at the parse seam: Site mapping (Bang Kruai never gets this Gauge), tide flag set, non-numeric level dropped (never 0), stale detection from the source's own time
- [ ] Daily high/low shown with the partial day marked; reading older than 6 h flagged "ข้อมูลอาจไม่อัพเดทล่าสุด"
- [ ] The fixed pooling sentence is always present
- [ ] Existing Mae Klong gauges, data files and headline are unchanged
- [ ] Phone-width check (375 px): no horizontal scroll, tap targets at least 44 px, sticky bar not taller
