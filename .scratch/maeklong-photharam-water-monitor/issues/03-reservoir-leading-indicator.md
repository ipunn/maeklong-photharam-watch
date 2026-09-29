# 03: Add reservoir leading-indicator data (Vajiralongkorn + Srinakarin)

**What to build:** The days-ahead leading indicator called for in the spec:
Vajiralongkorn and Srinakarin dam reservoir storage %, level, and release
rate, scraped from EGAT's `https://water.egat.co.th/water_crisis.php` (a
plain server-rendered HTML table, confirmed curl-scrapable during spec
research — no JS rendering needed). This is a second, independent source
type from the river stations, so it gets its own pure parse function and its
own history series and chart section.

Release rate on this page is reported in MCM/day; convert to m³/s for
consistency with the river-station context researched during the spec
(`MCM/day × 1,000,000 / 86,400`) and use that unit consistently across the
UI. The page carries no per-row timestamp — use the scrape's own fetch time
as the timestamp for each appended row.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `parseReservoirRecord(raw)` is a pure function (no network) that
      extracts `{ name, storagePercent, levelMsl, releaseRateM3s }` from the
      EGAT table's HTML for both Vajiralongkorn and Srinakarin, with unit
      tests using a captured real-response fixture
- [ ] The 15-minute cron Action fetches `water_crisis.php`, parses both dams'
      rows via the tested function, and appends one row per dam per run to a
      committed, append-only history file (separate from, or clearly
      distinguished within, the river-station history)
- [ ] MCM/day release figures are converted to m³/s before display
- [ ] The site renders each dam's current storage %, level, release rate,
      and a trend chart per dam, in its own section distinct from the river
      stations (this is upstream context, not a river reading)
- [ ] Runs independently of ticket 02 — this ticket does not depend on or
      block the Ban Pong station work
