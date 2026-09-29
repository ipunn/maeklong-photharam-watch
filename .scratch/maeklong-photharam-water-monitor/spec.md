Status: ready-for-agent

# Mae Klong / Photharam Water-Level Monitor — Spec

> **Note on tracker location**: this spec is authored and tracked here, in the
> BKK-Road-Flood-Checker repo's `.scratch/`, because the target repo does not
> exist yet. This directory is the seed: the first implementation ticket is
> "create the new repo" (per the decision below), and every ticket after that
> is implemented *in the new repo*, not this one. This repo's issue tracker is
> being used purely as scratch space until the new repo exists and can host
> its own `.scratch/`.

## Problem Statement

The user needs to monitor and understand the water-level trend of the Mae
Klong river near their location in Photharam district, Ratchaburi
(13°43'42.0"N 99°50'48.3"E), during an active, ongoing flood event (dam
releases from upstream reservoirs began stepping up from Sep 28, 2026). No
dedicated gauge sits at that exact coordinate, and no single existing tool
shows both the current local reading and the upstream signal (reservoir
levels/release rates) that predicts it days in advance. Checking this today
means manually cross-referencing multiple government sites and news articles
each time — too slow for something the user wants to track repeatedly during
an active event.

This is a distinct problem from the one BKK-Road-Flood-Checker solves (Bangkok
road passability for drivers): different geography (~100km from Bangkok),
different question ("is the river rising" vs. "can a car pass"), different
audience (one person tracking a river near a specific coordinate, not the
public checking city roads).

## Solution

A new, permanently-separate static site and repo that:

1. Shows the current water level at the two real gauge stations that bracket
   the user's coordinate (upstream and downstream), since none sits exactly
   there.
2. Shows the upstream leading indicator — the two EGAT reservoir dams whose
   staged release increases are what's driving the river level up over the
   coming days.
3. Renders both as trend charts (not just current-moment numbers), built from
   a history that accumulates over time via a scheduled scrape, so the user
   can see the shape of the rise as it happens.
4. Applies a sourced status color to each river reading when (and only when)
   an official warning/critical threshold is available for that station —
   never guesses one.

It deliberately reuses this repo's proven patterns (a pure parse/derive-status
seam, the "never show stale data as fresh" discipline, the "never guess a
missing threshold" discipline) without reusing its Bangkok-scoped code,
domain language, or deployment target.

## User Stories

1. As the user monitoring their location near Photharam, I want to see the
   current water level at the nearest upstream and downstream gauge stations,
   so that I know roughly where the level stands at my own point on the river
   right now.
2. As that user, I want each station's reading's age clearly shown, so that I
   never mistake a stale reading for a current one.
3. As that user, I want to see a trend chart of each station's level over
   time (not just the latest number), so that I can see whether it's rising,
   falling, or flat, and how fast.
4. As that user, I want to see the upstream reservoir picture — Vajiralongkorn
   and Srinakarin's storage percentage and release rate over time — so that I
   have days of advance warning before a release-driven rise reaches my
   stations, not just a same-moment reading.
5. As that user, I want a station's reading colored by severity (e.g.
   red/yellow/green) whenever an official threshold is actually known for
   that station, so that I can tell severity at a glance without reading raw
   numbers.
6. As that user, I want a station with no known official threshold to show a
   neutral (non-color-coded) state rather than a guessed color, so that I'm
   never misled by a made-up severity band. (Both bracket stations currently
   have no published threshold — this is the default state at launch.)
7. As that user, I want the whole page in Thai, so that I can read it at a
   glance without a language toggle to manage.
8. As that user, I want the site to keep working (i.e. keep showing the
   latest scraped data) even when I'm not actively looking at it, so that
   when I do check in, the trend chart already reflects everything that
   happened while I was away.
9. As the user setting this up, I want it on a repo and site fully separate
   from BKK-Road-Flood-Checker, so that this work can never accidentally
   affect the existing production flood-checker site.
10. As the user setting this up, I want the new repo seeded from this one's
    proven patterns (pure parse/derive-status functions, the test approach,
    the "sourced, never-guessed" threshold discipline) rather than rebuilt
    from scratch, so that the same care already validated in production
    carries over.
11. As the user, I want the data pipeline to keep running unattended (no
    manual refresh step), so that "urgency" doesn't mean babysitting a script.
12. As the user, I want to be able to come back weeks or months later and
    still see the full history, so that I can review how a whole flood event
    played out, not just the last few hours.

## Implementation Decisions

**Repo**
- A brand-new GitHub repo, created by `git clone`-ing BKK-Road-Flood-Checker
  locally, stripping `.git` history, and `git init`-ing fresh — no GitHub
  fork/template relationship to the original (permanent divergence, no
  upstream-sync nudge).
- Public repo, deployed via GitHub Pages — static site, no backend at request
  time.
- Working title: placeholder, to be chosen at repo-creation time (not yet
  decided by the user).
- `CONTEXT.md` starts empty; the domain glossary is built fresh for this
  product's own concepts as they're resolved — no inherited Bangkok
  road-passability vocabulary (Sensor report, Passability status,
  Corroboration, etc. do not apply here).
- Thai-only UI. No language toggle, no `i18n.js`-equivalent infrastructure.

**Monitored signal**
- **River level**: two ThaiWater stations bracketing the user's coordinate
  (13°43'42.0"N 99°50'48.3"E), since no station sits at that exact point:
  - Upstream: "บ้านโป่ง" / "สะพานค่ายหลวง" area, Ban Pong, Ratchaburi
    (station id 505018 in the ThaiWater feed used during research; re-verify
    id at implementation time since the feed returns ~800 records and ids may
    shift).
  - Downstream: "โพธาราม" (station id 710), tumbon เจ็ดเสมียน, amphoe
    โพธาราม, Ratchaburi.
- **Upstream leading indicator**: Vajiralongkorn and Srinakarin dam reservoir
  storage %, level, and release rate (from EGAT).
- **Explicitly out of scope for this pass**: Mae Klong Dam's own release
  rate. No automatable public source was found for it (checked RID's public
  API — a generic CMS with no water-data endpoints; the RID SWOC daily PDF —
  covers major storage reservoirs and the Chao Phraya Dam only, not Mae
  Klong; ThaiWater's feed — no record for this dam, since it's a diversion
  weir without a tracked storage percentage). Can be revisited later if a
  source turns up; not a blocker for v1.

**Data sources**
- River levels: `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load`
  — public, unauthenticated JSON API (ThaiWater's own React SPA's data
  source). Same "undocumented but genuinely public" category as
  BKK-Road-Flood-Checker's existing canal endpoint (see that repo's
  ADR-0004) — worth a matching ADR in the new repo documenting the same
  trade-off (can change/break without notice, no SLA). Returns all Mae Klong
  basin stations (and other basins) in one ~1.4MB call; filter by
  `station.id` client-side (or Action-side) rather than assuming a
  per-station endpoint exists.
  - This same response includes `warning_level_m` / `critical_level_m`
    fields per station when RID/ThaiWater has published them — confirmed
    populated for at least one other basin's station, `null` for both of
    this feature's two river stations at spec time. `deriveStatus` must
    treat `null` as "no threshold known" (neutral), not fall back to a
    guessed value — same discipline as the existing `waterLevelStatus`.
- Reservoir data: `https://water.egat.co.th/water_crisis.php` — plain
  server-rendered HTML table, curl-scrapable, no JS rendering needed.
  Contains reservoir level (m.MSL), storage (MCM + %), usable water (MCM +
  %), and inflow/release **in MCM/day** — convert to m³/s if displayed
  alongside the river stations' m³/s-flavored context (`MCM/day × 1,000,000 /
  86,400`). Column headers carry the report date; there's no per-row
  timestamp, so the scrape should record its own fetch time as the
  timestamp for that reading.
- Both sources were confirmed reachable via plain `curl` during spec
  research (no headless browser needed for either).

**Pipeline**
- A GitHub Action on a **15-minute cron** (`schedule: cron`) fetches both
  sources, runs them through the parse seam (see Testing Decisions), and
  **appends** one row per station per run to a committed history file (JSON
  or CSV — implementer's choice, but must be a single append-only file per
  logical series, not overwritten each run).
- No retention/rollover/archiving logic for v1 — keep the full history
  indefinitely. At 15-minute cadence across ~5 tracked series this is a few
  MB/year; revisit only if it becomes an actual problem after a full flood
  season.
- The static site reads the committed history file(s) directly (no live
  fetch from the browser to ThaiWater/EGAT at page-load time) and renders:
  - Current value + age-since-updated for each of the 2 river stations and 2
    reservoirs.
  - A trend chart (line graph) per series, plotted from the accumulated
    history.
  - Status color per river station via `deriveStatus`, neutral when no
    threshold is known.
- No alerting (no push notification, no webhook, no issue-opening on
  threshold breach) for v1 — this is a page the user checks, not a system
  that pages them.

**Reused from BKK-Road-Flood-Checker (pattern only, not code coupling)**
- The pure parse / derive-status seam shape (`parseCanalStations` +
  `waterLevelStatus` in that repo's `data.js`).
- "Never show stale data as if it were fresh" — visible per-reading
  timestamps/age, not confident-looking-but-outdated numbers.
- "Never guess a missing threshold" — neutral state instead of a fabricated
  severity band.
- Static/no-build-step approach and GitHub Pages hosting.
- ADR discipline for undocumented-but-public API usage (matching that repo's
  ADR-0004 for the ThaiWater ADR-0004 precedent, and its own README table of
  data sources).

## Testing Decisions

- Test only the pure seam: `parseWaterLevelRecord(raw)`,
  `parseReservoirRecord(raw)`, and `deriveStatus(levelMsl, thresholds)`. No
  I/O, no network, no DOM — inputs are raw JSON/HTML fixtures captured from
  the real APIs during spec research, outputs are plain objects/strings.
- Prior art: BKK-Road-Flood-Checker's `data.test.js`, which tests
  `parseCanalStations`/`waterLevelStatus` the same way, run under Node's
  built-in test runner (no bundler, no test framework dependency) — follow
  that same setup in the new repo.
- `deriveStatus` in particular must have an explicit test case asserting
  `null` thresholds produce a neutral result, not a guessed color — this is
  the single most important behavior to lock down given both launch stations
  currently have no published threshold.
- The GitHub Action's scrape step (network + HTML/JSON parsing glue) and the
  browser-side chart rendering stay untested wrappers around the seam above,
  same as the original app leaves `loadThaiWaterCanal`/`fetchJSON` untested
  and only tests what they feed into.

## Out of Scope

- Mae Klong Dam's own release rate (no automatable source found; revisit
  later).
- Alerting/notifications of any kind.
- Multi-province coverage (the other 4 alerted provinces beyond
  Ratchaburi/Photharam) — this is scoped to the user's one coordinate and its
  bracketing stations.
- History retention/archiving policy.
- Bilingual UI / language toggle.
- Any integration with or code sharing that couples this repo to
  BKK-Road-Flood-Checker's deployment, domain language, or codebase going
  forward — the two are meant to diverge permanently from day one.
- A dedicated gauge station exactly at the user's coordinate — none exists
  publicly; the two-station bracket is the permanent approach, not a
  placeholder pending a better station.

## Further Notes

- Re-verify both ThaiWater station ids (710 for โพธาราม; 505018 for the
  upstream Ban Pong-area station used during spec research) at
  implementation time by re-fetching `waterlevel_load` — the feed returned
  ~800 records across all basins in one call, so filtering logic should key
  off `station.id` and/or `geocode.tumbon_name`/`amphoe_name`, not an
  assumed stable array index.
- The EGAT page's release-rate figures are in MCM/day; the river-level
  context researched during this spec (news reporting on the Mae Klong Dam's
  ~1,500 m³/s release) uses m³/s — pick one unit consistently in the UI and
  convert, rather than mixing units across the two source types.
- Situation at spec time (2026-09-29, for context only, not a target to
  build against): Vajiralongkorn reservoir ~96% full and stepping releases
  from 15→30→42 MCM/day over Sep 29–Oct 4; Srinakarin ~91% full; Photharam
  station read 4.96 m.MSL (2.84m below bank) at 12:30 today, up from 2.04m
  the previous evening.
