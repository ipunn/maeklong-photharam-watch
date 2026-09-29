# 04: Polish and close out domain/doc trail

**What to build:** The finishing pass that makes the site presentable and
documented, and establishes this new repo's own domain-modeling trail
(distinct from BKK-Road-Flood-Checker's, per the decision that
`CONTEXT.md` starts empty and is built fresh rather than inherited).

- A full Thai-only copy pass across every page/section (labels, headings,
  status text, empty/stale states) — no leftover English placeholder text
  from scaffolding.
- A README describing the product, its two data sources, their trade-offs
  (undocumented-but-public endpoints, no SLA, can change/break without
  notice), and the 15-minute refresh cadence — mirroring the source repo's
  README data-source table structure.
- An ADR documenting the ThaiWater undocumented-public-endpoint trade-off for
  this repo specifically (parallel to BKK-Road-Flood-Checker's ADR-0004, not
  a copy of it — this repo's own ADR numbering starts fresh).
- The first real `CONTEXT.md` entries for this product's own domain terms as
  they've crystallized through tickets 01-03 (e.g. whatever term ends up
  naming a river station reading vs. a reservoir reading, if those need
  distinguishing) — only terms that actually came up, not a speculative
  glossary.
- End-to-end verification of the live GitHub Pages deployment with both
  river stations and both reservoirs visible and updating.

**Blocked by:** 02, 03

**Status:** in-progress (waiting on the 3-hour unattended-collection check; started 08:20 UTC 2026-09-29)

- [x] All UI text reviewed and confirmed Thai-only, no leftover English
      scaffolding text
- [x] README documents both data sources, their undocumented-but-public
      nature, and the refresh cadence
- [x] ADR written documenting the ThaiWater public-endpoint trade-off for
      this repo
- [x] `CONTEXT.md` contains at least the domain terms that actually
      crystallized during tickets 01-03
- [ ] Live GitHub Pages deployment verified: both river stations and both
      dams show current data with their own timestamps; each gauge has a working
      hourly trend chart; the collector keeps running unattended for at least 3
      hours with no gap over 30 minutes between runs. (Reworded 2026-09-29: dam
      trend charts were removed on purpose; the dam's EGAT daily chart appears
      once two daily reports exist. The site's health line warns if collection
      stops.)


## Comments

All but the live GitHub Pages verification is done. That needs the repo pushed to GitHub with Pages enabled; nothing has been pushed.

## Comments (2026-09-29, after code review)

README, ADR 0001 and CONTEXT.md rewritten to match the final behaviour. The remaining open
item is the live check: the site is deployed, but confirm the scheduled scrape fires by itself
(no run labelled "schedule" had appeared as of 07:50 UTC; the workflow's cron was moved to
off-peak minutes) and that data commits reach the live site.

## Comments (2026-09-29, later)

GitHub's `schedule` never fired (0 runs in 2+ hours; Actions enabled, repo public, workflow on
main). The workflow now starts its own next run; verified live for two hops (run -> bot-started
run 08:20 -> bot-started run 08:33). Live check done: run -> bot commit -> Pages redeploy -> live
JSON updated. Remaining: watch that the chain survives longer (the site's health line warns if
it stops).
