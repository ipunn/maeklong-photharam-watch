# 05: Tide: daily high and low

**What to build:** Tidal gauges show each Bangkok day's high and low instead of a rising/falling arrow. A new pure function turns a gauge's raw history into one entry per Bangkok calendar day (date, high, low and their times) using the source's `updatedAt`, not `scrapedAt`. The Collector writes a small daily summary per tidal gauge after appending readings, and the page reads that summary plus recent raw history rather than the full 10-minute history. Whether a gauge is tidal is set in the station configuration. C.13 is not tidal.

**Blocked by:** 02 (Bang Kruai page, first gauge end to end).

**Status:** done

- [ ] Tests for the daily function: a day with a clear high and low; the times of each; the Bangkok-midnight boundary (readings at 23:50 and 00:10 fall on different days regardless of the runtime timezone); out-of-order rows; non-numeric levels ignored; a single-reading day; empty input.
- [ ] The current, incomplete day is excluded or clearly marked partial.
- [ ] Raw readings are still appended as before; the summary is derived from them, not a replacement.
- [ ] The summary is written atomically per tidal gauge, like the other data files.
- [ ] The page shows daily high and low for BKK003; gauges added by ticket 03 pick this up through the station configuration.
- [ ] No rising/falling arrow is shown for a tidal gauge.
