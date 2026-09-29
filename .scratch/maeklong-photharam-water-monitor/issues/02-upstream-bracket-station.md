# 02: Add the upstream bracket station (Ban Pong)

**What to build:** The second of the two ThaiWater river stations that
bracket the user's location in Photharam, since no station
sits at that exact point. This is the upstream station near Ban Pong
("บ้านโป่ง" / "สะพานค่ายหลวง" area — station id 505018 at spec time,
re-verify the same way as ticket 01). It must flow through the exact same
scrape → parse → append-history → render pipeline as the โพธาราม station,
proving the pattern generalizes to a second station of the same source type
rather than being special-cased.

**Blocked by:** 01

**Status:** done

- [x] The Ban Pong-area station is fetched, filtered, and parsed via the same
      `parseWaterLevelRecord` function from ticket 01 (no duplicate/forked
      parsing logic for this second station)
- [x] The 15-minute cron Action appends this station's reading to the
      history file each run, alongside โพธาราม's row (both present after
      every run)
- [x] The site renders this station's current level, age-since-update,
      status color (neutral, since this station's thresholds are also `null`
      at spec time), and its own trend chart, positioned so the two stations
      read as an upstream/downstream bracket rather than two unrelated
      entries
- [x] Existing โพธาราม data/behavior from ticket 01 is unaffected

## Comments

Spec's station id 505018 is now "บ้านปากแซง" (Sai Yok, 54 m MSL) — wrong. Used
832066 "สะพานค่ายหลวง" (Ban Pong, RID K.55A), the name this ticket cites. Note it
reports roughly hourly, vs ~10 min for โพธาราม. Alternative if preferred: 709
"บ้านโป่ง" (HII, RAJ002).
