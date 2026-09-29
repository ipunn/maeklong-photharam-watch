# 01: Repo scaffold + single-station pipeline (Photharam)

**What to build:** A brand-new, permanently-separate public repo (cloned from
BKK-Road-Flood-Checker with `.git` history stripped and re-initialized —
no GitHub fork/template link back), deployed via GitHub Pages, with the full
data pipeline working end-to-end for one series: the "โพธาราม" ThaiWater
river station (station id 710 at spec time — re-verify by re-fetching
`waterlevel_load` and matching on `geocode.tumbon_name`/`amphoe_name`, not an
assumed array index).

A GitHub Action on a 15-minute cron fetches
`https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load`,
extracts the โพธาราม record, runs it through a pure, tested parse/derive
seam, and appends one row to a committed, append-only history file (never
overwritten). The static site reads that file directly (no live browser
fetch to ThaiWater) and renders: current level (m.MSL), age since last
update, a status color from `deriveStatus` (neutral, since ThaiWater's
`warning_level_m`/`critical_level_m` are `null` for this station at spec
time — must render as neutral, not a guessed color), and a trend line chart
built from the accumulated history.

UI copy is Thai-only; no language toggle or i18n infrastructure.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] New repo created: cloned from BKK-Road-Flood-Checker, `.git` history
      stripped, fresh `git init`, pushed as a new public GitHub repo (no
      fork/template relationship to the original)
- [ ] Repo deploys as a static site via GitHub Pages
- [ ] `parseWaterLevelRecord(raw)` is a pure function (no network/DOM) that
      extracts `{ stationId, name, levelMsl, bankMsl, updatedAt }` from a raw
      ThaiWater record, with unit tests using a captured real-response
      fixture, following this repo's `data.test.js` pattern (Node's built-in
      test runner, no bundler)
- [ ] `deriveStatus(levelMsl, thresholds)` is a pure function returning
      `"red" | "yellow" | "green" | null`, with an explicit test asserting
      `null` thresholds produce `null` (neutral) — never a guessed color
- [ ] GitHub Action runs on a 15-minute cron, fetches the ThaiWater feed,
      filters to the โพธาราม station, parses it via the tested function, and
      **appends** (never overwrites) one row to a committed history file
- [ ] Static site reads the committed history file and renders: current
      level, human-readable age-since-update for the โพธาราม station, its
      status color (neutral at launch), and a trend chart plotted from the
      full accumulated history
- [ ] All UI copy is in Thai
- [ ] A stale/missing-data state is visibly distinguishable from a fresh
      reading (matching the "never show stale data as if it were fresh"
      discipline from the source repo) rather than silently showing an old
      number as current
