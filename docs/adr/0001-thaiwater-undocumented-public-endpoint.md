# 0001: Use ThaiWater's undocumented public endpoint for river levels

Status: accepted

## Context

River levels come from `https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load`,
the JSON feed behind ThaiWater's own web app. It is public and needs no
authentication, but it is not a documented API: no SLA, no versioning
promise, and it can change shape or disappear without notice. One call
returns ~800 stations across all basins (~1.4 MB), so we filter by
`station.id`.

No documented alternative covers the two Mae Klong stations we need.

## Decision

Use it anyway, and contain the risk:

- All parsing lives in one pure function, `parseWaterLevelRecord` (`parse.js`),
  covered by fixtures captured from the real feed. A shape change breaks one
  function and its tests, not the site.
- The scraper never writes a gap entry when a station is missing from a run;
  history stays truthful. The site shows each reading's age and flags stale
  ones, so a broken feed reads as old data, not fresh data.
- Station ids are re-verified by name against the live feed when added — ids
  drift (the spec's 505018 had become a different station).
- Thresholds are taken only from the feed's `warning_level_m` /
  `critical_level_m`; when null, the status is neutral, never guessed.

## Consequences

The site can silently go stale if the endpoint changes; the visible age is the
only alarm, and there is deliberately no alerting. Fixing a break means
updating the parser and fixtures.
