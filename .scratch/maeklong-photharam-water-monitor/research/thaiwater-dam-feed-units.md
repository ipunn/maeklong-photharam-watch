# ThaiWater `dam_hourly` units and time basis

Researched 2026-09-29 (~13:40 +07). Feed: https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam

## Conclusion

For EGAT large dams in `dam_hourly`, `dam_inflow` and `dam_released` are most likely **million m3 over the hour ending at `dam_date`** (per-hour volume, not a daily volume, not m3/s, not a cumulative-since-midnight total). `dam_storage` is a **stock** in million m3 at that instant. Confidence: medium-high on "million m3" (official label); medium on "per hour" (inferred from a mass balance, no official statement of the time basis found). Do NOT compare hourly values to EGAT's MCM/day figures without multiplying, and do not sum them as daily.

## Claims and evidence

1. **Unit is million m3 (ล้าน ลบ.ม.) - HIGH.** The thaiwater.net large-dam page (https://www.thaiwater.net/water/dam/large), tab "การไฟฟ้าฝ่ายผลิต (รายชั่วโมง)", columns: วันที่/เวลา; ระดับน้ำ (ม.รทก.); ปริมาณน้ำกักเก็บ (ล้าน ลบ.ม.); น้ำไหลลง (ล้าน ลบ.ม.); น้ำระบาย (ล้าน ลบ.ม.); ระเหย (ล้าน ลบ.ม.). Read in a browser on 2026-09-29. Rows match the feed exactly (Vajiralongkorn 12:00 / 154.39 / 8,625 / 5.12 / 1.24; Srinagarind 8.05 / 0; Sirindhorn 0.34 / 0.29; Ubolratana 0.19 / 0.13; Tha Thung Na -0.12 / 0.33). So `dam_inflow` = "น้ำไหลลง", `dam_released` = "น้ำระบาย". The headings carry no per-hour/per-day qualifier (I did not check hover tooltips).

2. **Not m3/s - HIGH.** The page labels them ล้าน ลบ.ม. Also Sirindhorn 0.29 MCM/h is about 81 m3/s, a plausible release; 0.29 m3/s would be implausible for a dam whose EGAT daily release is 8.64 MCM (= exactly 100 m3/s).

3. **Not the daily figure - HIGH.** The same feed's `dam_daily` section (station_type dam_daily) holds the EGAT daily numbers (e.g. dam 56, dam_date 2026-09-28: dam_inflow 287.63, dam_released 0, storage 8533.56; dam 54: inflow 240.93, released 0.66; dam 44: inflow 6.72, released 8.64), identical to https://water.egat.co.th/water_crisis.php as saved in fixtures/egat-water-crisis.html (column "นำไหลเข้า-ระบาย 28 ก.ย. 2569", ล้าน ลบ.ม., data "24.00 น."). Hourly values (5.12, 8.05, 0.29) are far smaller than the daily ones, so they are not the same quantity.

4. **Per-hour, not cumulative-since-midnight - MEDIUM (inference).** Mass balance between EGAT daily storage at 28 Sep 24:00 (fixtures/egat-water-crisis.html, "ปริมาณน้ำกักเก็บ") and the feed's 29 Sep 12:00 storage (12 h elapsed):
   - Srinagarind: 16,374 -> 16,474.06 = +100 MCM = +8.3/h; feed inflow 8.05, released 0. Matches per-hour within ~3%. (If cumulative since midnight, 12 h of inflow would be ~100, not 8.05.)
   - Bhumibol: 8,642 -> 8,720.84 = +6.6/h; feed inflow 7.22, released 0. Consistent.
   - Sirindhorn: storage flat (1,798 -> 1,798.36); feed net +0.05/h; EGAT daily net -1.92/day = -0.08/h. Consistent in magnitude.
   - Vajiralongkorn: +91.7 over 12 h = +7.6/h vs feed net (5.12-1.24) = 3.88 for the latest hour. Same order; the average over 12 h need not equal the latest hour. Not a clean match.
   Snapshot mean-rate scaling (MCM/day value shown as an instantaneous rate) is ruled out: Srinagarind would need +8/day, but storage rose ~200/day.
   Caveat: I cannot exclude "average of the last few hours" or a 1-hour accumulation window offset. Negative inflows (-0.09, -0.12, -0.31) show inflow is a derived balance (storage change + release), not a metered flow.

5. **Accumulate vs reset test - INCONCLUSIVE.** Two fetches at 13:38 and 13:39 +07 returned identical `dam_hourly` (still 12:00 stamp; the feed lags ~1-2 h). No later hourly record appeared, so I could not observe two consecutive hours. To settle: poll at ~15:00 and 16:00 and confirm storage delta between consecutive stamps is about (inflow - released) of the later stamp; also compare the sum of 24 hourly inflows with EGAT's next-day daily inflow.

6. **Timestamps are Bangkok time (UTC+7) - MEDIUM-HIGH.** `dam_date` is a naive string "2026-09-29 12:00" with no offset. At fetch time the local clock was 13:38 +07, so a 12:00 stamp is a plausible last update in local time (in UTC it would be ~06:38, making a 12:00 stamp a future time, impossible). The storage continuity with EGAT's Bangkok-time "24.00 น." daily figure (item 4) also supports it. thaiwater.net displays the same string unchanged. No official doc found stating the zone.

7. **Stale rows exist.** Ratchaprapa (RID-labelled, "เขื่อนรัชชประภา") shows 10:00 in the hourly list; Mae Ngat shows 2022-07-21. Check `dam_date` per row before use.

## Sources not relied on

A web search returned a secondary GitHub write-up (github.com/gain9999/thaiwater) claiming inflow/outflow are million m3/day for the `public` endpoints and per-hour for hourly. I did not verify it against ThaiWater/HII documentation; I found no official ThaiWater/HII API documentation stating units (the `public/dam_*` guesses I tried return 404 "Unknown service id").

## Residual doubt and how to settle it

Ask HII (info_thaiwater@hii.or.th, listed on the thaiwater.net footer) for the field definition, or run the two-consecutive-hours test in item 5.
