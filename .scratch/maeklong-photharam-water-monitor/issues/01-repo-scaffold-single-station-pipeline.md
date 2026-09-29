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

**Status:** done

- [x] New repo created: cloned from BKK-Road-Flood-Checker, `.git` history
      stripped, fresh `git init`, pushed as a new public GitHub repo (no
      fork/template relationship to the original) — https://github.com/ipunn/maeklong-photharam-watch
- [x] Repo deploys as a static site via GitHub Pages — https://ipunn.github.io/maeklong-photharam-watch/
- [x] `parseWaterLevelRecord(raw)` is a pure function (no network/DOM) that
      extracts `{ stationId, name, levelMsl, bankMsl, updatedAt }` from a raw
      ThaiWater record, with unit tests using a captured real-response
      fixture, following this repo's `data.test.js` pattern (Node's built-in
      test runner, no bundler)
- [x] `deriveStatus(levelMsl, thresholds)` is a pure function returning
      `"red" | "yellow" | "green" | null`, with an explicit test asserting
      `null` thresholds produce `null` (neutral) — never a guessed color
- [x] GitHub Action runs on a 15-minute cron, fetches the ThaiWater feed,
      filters to the โพธาราม station, parses it via the tested function, and
      **appends** (never overwrites) one row to a committed history file
- [x] Static site reads the committed history file and renders: current
      level, human-readable age-since-update for the โพธาราม station, its
      status color (neutral at launch), and a trend chart plotted from the
      full accumulated history
- [x] All UI copy is in Thai
- [x] A stale/missing-data state is visibly distinguishable from a fresh
      reading (matching the "never show stale data as if it were fresh"
      discipline from the source repo) rather than silently showing an old
      number as current

## Comments

Implemented via `/mattpocock-skills:implement`, TDD on the parse.js seam
(8 tests, all passing). Two-axis `/code-review` run before push:

- **Standards**: duplicated `STATIONS` list between `scripts/scrape-waterlevel.js`
  and `app.js` — deferred consolidation to ticket 02, when a real second
  station makes the shared shape worth extracting (avoids premature
  abstraction on a one-item list). Fixed a stale filename reference in
  `parse.js`'s header comment (`scrape.mjs` → `scrape-waterlevel.js`).
- **Spec**: caught that the repo hadn't actually been pushed to GitHub or
  deployed yet at review time — fixed immediately after (repo created,
  pushed, GitHub Pages enabled, both verified live with real scraped data).

Live: https://ipunn.github.io/maeklong-photharam-watch/
Repo: https://github.com/ipunn/maeklong-photharam-watch
Verified in Chrome (local preview) with a temporary multi-point dataset to
confirm the trend chart renders correctly; committed data itself only ever
contains real scraped values.
