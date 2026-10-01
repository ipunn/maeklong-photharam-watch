# Lower Mae Klong: Mae Klong Dam to the sea (Samut Songkhram) and which gauges to add

Purpose: pick downstream points for the Mae Klong page. Researched 2026-10-01 (~22:00-23:30 +07) by live requests (curl) to ThaiWater, RID and the Navy tide PDF, plus web search. "Verified" = I read it in the owner's own file/feed that day. "News" = only seen in a news article (pointer to a primary source I could not open). "Inferred" = my reasoning, stated as such.

Access note: `prd.go.th` and its provincial sites (Samut Songkhram / Ratchaburi announcements) did not resolve from this machine (curl code 000, WebFetch ENOTFOUND), and ปภ. (disaster.go.th) answers 200 but is a JS page I did not parse. So every provincial/DDPM figure below is NEWS unless it is in the RID daily PDF.

## Verdict (read this first)

1. **Flooding now is mostly the river itself, not only tide.** Samut Songkhram declared 3 อำเภอ (เมือง, อัมพวา, บางคนที) disaster areas (27 ตำบล, 222 villages, 4,237 households) on 30 Sep / 1 Oct, blamed on the dam release (2,227 m3/s at 07:00 on 1 Oct) meeting high tide. NEWS (Thai PBS), primary not opened.
2. **The best, sourced river order exists in RID's own daily diagram** (hydro-7 PDF, 1 Oct): dam, K.11A, K.63, K.55A, K.56A, K.2B, K.57, Gulf, with km and hours between them (table below). Verified.
3. **Gauges to add, in order of value:** K.57 (RID, the last river gauge before the sea), K.2B (Ratchaburi city), then one tidal HII gauge for the mouth (MKG006). K.56A and K.55A are the middle links. Details in section 4.
4. **K.57 datum is explained by RID's own data**: its level is a gauge reading, not metres above sea level (RID zero of gauge ZG = -13.2). Real height is about 1.92 m MSL (inferred from that). Section 3.
5. **Tide:** K.57 and K.2B both still carry the tide. In low flow they swing 1-1.6 m a day; in this flood only 0.1-0.3 m. They need the Tide rule's wording (no rising/falling trend) at low flow. Section 3.

## 1. Where water is pooling / flooding (late Sep to 1 Oct 2026)

| Place | What | Cause stated | Source (type) |
|---|---|---|---|
| Samut Songkhram: อ.เมือง, อ.อัมพวา, อ.บางคนที (3 อำเภอ, 27 ตำบล, 222 villages, 4,237 households, ~20,000 people) declared disaster area; signed 30 Sep, repeated 1 Oct | flooding | dam release 2,227 m3/s (07:00, 1 Oct) plus high tide (น้ำทะเลหนุน) | NEWS: Thai PBS thaipbs.or.th/news/content/558967, Infoquest infoquest.co.th/2026/657504 (cite provincial command + RID). Primary (provincial announcement) NOT opened |
| Samut Songkhram: ต.บางนกแขวก and "บางคนที" (อ.บางคนที) first, then อ.อัมพวา; ตลาดเก่าบางนกแขวก residents compare to 2539 | river overflow over banks, red alert by Cell Broadcast 30 Sep 19:09 | dam release over 2,000 rising to ~2,200; water "linked to Khlong Damnoen Saduak system" | NEWS: Thai PBS thaipbs.or.th/news/content/558935 |
| Samut Songkhram: gauge "3.4 m at Bang Khonthi district office" 07-08, "3.3 m" 18-19 on 1 Oct | | tide peaks | NEWS (Thai PBS). **Inferred:** these two figures match the Navy tide table's two daily highs at the river mouth (3.4 at 08 h, 3.3 at 19 h, below), so they may be tide-table numbers, not a measured flood level. Do not use them as a gauge reading |
| Ratchaburi: 7 อำเภอ (โพธาราม, บางแพ, ดำเนินสะดวก, เมือง, บ้านโป่ง, วัดเพลง, จอมบึง), 41 ตำบล, 198 villages, 3,506 households, level "rising", report 1 Oct 06:00 | flooding | not stated | NEWS: Bangkok Biz Weekly bangkokbiznews.com/news/news-update/1254475 quoting ปภ. Primary NOT opened |
| Ratchaburi: evacuation ordered 29 Sep evening for เมือง, บางแพ, ดำเนินสะดวก, วัดเพลง, ปากท่อ along the river and branch canals; บางแพ 5 very-high-risk + 7 high-risk areas at 30 Sep 23:15; เทศบาลเมืองราชบุรี soi water coming up through drains (tide) | river overflow warning; drains backing up | dam release 2,000 then more; "แม่น้ำแม่กลองล้นตลิ่ง" | NEWS: search summaries of ratchaburi/prd.go.th (iid 546129, 546659), Siam News, Bangkok Insight thebangkokinsight.com/.../1702515. I could not open these; tambon names for บางแพ and ดำเนินสะดวก NOT found |
| RID's own daily (1 Oct) says something narrower for Ratchaburi: only อ.ปากท่อ (3 ตำบล, 10 villages) and อ.เมืองราชบุรี (2 ตำบล, 3 villages), 287 ไร | | | **Verified:** RID SWOC daily PDF water.rid.go.th/flood/flood/daily.pdf, section 6.1. It disagrees with DDPM-via-news (7 อำเภอ). Different time and counting basis, not reconciled |

Not found: which ตำบล in บางแพ / ดำเนินสะดวก, and whether น้ำท่วมขัง there is river overflow, rain, tide blocking drains or canal-gate operation. News says only "dam release + tide". **I could not establish a cause split for บางแพ / ดำเนินสะดวก.**

Tide window: the National Water Resources Office warning (NEWS via prd.go.th iid 545961, thansettakij.com/general-news/670295) covers 29 Sep - 4 Oct 2026, 8 provinces incl. the Mae Klong, said to be tide plus northern runoff plus a fairly strong SW monsoon. **Verified (Navy table, below)** that predicted highs stay ~1.2-1.3 m above MSL at the mouth through 4 Oct, then rise slightly 5-7 Oct (1.4).

Where it is now (verified, ThaiWater feed 22:00): the flood wave has peaked and is falling. K.63 peaked 2,235.6 m3/s at 06:00 on 1 Oct, now 1,958; K.55A peaked 2,192 at 06:00, now 2,110; K.2B reached 4.26 at 13:00 and is flat (4.21, bank 4.30); K.57 15.12 (bank 15.50). The dam pool (SND04) 22.65 m is flat. Releases stated in news: 2,000 (29 Sep 13:00), 2,300 to 2,500 (30 Sep noon, Thairath 2963138; the 2,500 was announced by RID Region 13, K.63 only ever read 2,236), 2,227 (1 Oct 07:00).

## 2. Physical river order, dam to Gulf

**Verified.** RID Western Hydrology Centre daily diagram "ผังแสดงสถานการณ์น้ำ ลุ่มน้ำแม่กลอง", 1 Oct 2026 (http://hydro-7.rid.go.th/main/Report06.00/report_daily.pdf, page 6; file Last-Modified 1 Oct 00:58 UTC). The numbers on the line are km and (for two links) hours of travel as printed:

| Link | km | printed hours | Gauge reached | Place per RID | RID bank (gauge scale) | 1 Oct 06:00 reading (gauge) |
|---|---|---|---|---|---|---|
| เขื่อนแม่กลอง (อ.ท่าม่วง) | | | | | | |
| to K.11A | 1.96 | | K.11A บ้านวังขนาย | อ.ท่าม่วง | 6.20 | telemetry fault ("โทรมาตรขัดข้อง") |
| to K.63 | 4.26 | | K.63 บ้านใหม่ | อ.ท่าม่วง | 10.10 | 9.67, Q 2,235.56 |
| to K.55A | 36.7 | **11 h** | K.55A บ้านหัวเกาะ / สะพานค่ายหลวง | อ.บ้านโป่ง | 9.00 (Q cap 1,730) | 10.72, Q 2,192.0 |
| to K.56A | 15.2 | **4 h** | K.56A บ้านสร้อยฟ้า | อ.โพธาราม | 10.30 (Q cap 1,870) | 10.79, Q 2,021.9 |
| to K.2B | 23.55 | | K.2B สะพานธนะรัชต์ | อ.เมืองราชบุรี | 14.30 | 14.20 |
| to K.57 | 18.30 | | K.57 บ้านกระดังงา (RID API calls it สะพานบางนกแขวก) | อ.บางคนที, สมุทรสงคราม | 15.50 | 14.97 |
| to อ่าวไทย | 23 | | | | | |

Sum: 1.96 + 4.26 + 36.7 + 15.2 + 23.55 + 18.30 + 23 = **122.97 km** dam to the sea. Matches "about 122 km, about 28 hours" quoted from RID Region 13 (NEWS: Thairath thairath.co.th/news/local/central/2963138; the same 28 h figure is in search summaries of other outlets). So **typical travel from the dam to the Gulf is about 28 h by RID's own estimate; the first 11 h gets to Ban Pong's K.55A, and Samut Songkhram's K.57 is the last gauge before the sea.** Hours on the diagram are only printed for two links; I did not find hours for the others, so "time to สมุทรสงคราม" is **not** sourced as a number except the 28 h total. Governor's office timing (NEWS, Thairath 2962655, 28 Sep): about 20 h from Tha Muang to Mae Klong town, timed to meet the 18:00 high tide (that was an early-release estimate, not RID's). Observed: K.63 and K.55A both peaked at 06:00 on 1 Oct, which does not show an 11 h lag because the release was already nearly flat. Not a usable lag measurement.

Other structures (sourced as far as noted):
- **คลองดำเนินสะดวก** links แม่น้ำท่าจีน (อ.บ้านแพ้ว, สมุทรสาคร) through Damnoen Saduak (Ratchaburi) to the Mae Klong at **ประตูน้ำบางนกแขวก, อ.บางคนที** (NEWS/reference: search summary of ททท./MGR/Wikipedia; not a primary source). So the Damnoen Saduak canal system joins the Mae Klong at the same place K.57 sits. **Inferred:** this is why Thai PBS says Bang Nok Khwaek floods via the Damnoen system.
- **ปตร.บางนกแขวก TMK03** exists in ThaiWater's station list (id 709173, RID, อ.บางคนที) but has **no readings** (graph empty on 1 Oct; ThaiWater watergate_load has no row for it). Not usable.
- คลองบางนกแขวก, "คลองแม่กลอง", other diversions: **not found in any source I could open**; do not draw them.
- The Mae Klong Dam is at อ.ท่าม่วง; its own release has no automatic source (see `mae-klong-dam-data-sources.md`).

Where it becomes tidal / where tide backs up drainage:
- **Verified (ThaiWater hourly series, 24 Sep - 1 Oct):** K.57 swung 1.62 m on 24 Sep (low 12:00, high 19:00), shrinking to 0.15 m on 1 Oct as the flow rose. K.2B swung 1.11 m on 24 Sep (high 20:00), 0.11 m on 1 Oct. So both are tide-influenced in low flow, at about 23 km and about 41 km from the Gulf by RID's chain.
- **Inferred, weaker:** RAJ001 โพธาราม (HII) rose ~0.5 m between 15:00 and 23:00 on 25 Sep with no flood wave yet, a tidal-looking shape about 3 h after K.57's peak. I did not separate tide from flow, so I do not claim the tide reaches Photharam. K.55A (Ban Pong) swings 0.3 to 1.8 m but those were flood-wave days; not tidal evidence.
- A ปภ./Navy-style statement of "the tide reaches X" was **not found**. RID's legend footnote `**` = "อิทธิพลจากน้ำทะเลหนุน" appears on the diagram but I could not see it attached to any station on 1 Oct.
- Tide backing up urban drains: Ratchaburi city soi flooding "น้ำล้นท่อ" is NEWS only (Bangkok Insight 1702515).

## 3. Gauges, datum and the Tide rule

All ThaiWater ids use `public/waterlevel_graph?station_type=tele_waterlevel&station_id=<id>&start_date=..&end_date=..` (works for ids absent from `waterlevel_load`). In the bulk `waterlevel_load`, K.2B, K.57 and K.56A are **absent**; K.55A, RAJ001/002, MKG005/006, PTTEP1, GLF003, K.11A are present.

| Gauge | ThaiWater id | Agency | Place / river | Latest (1 Oct) | Notes (verified unless marked) |
|---|---|---|---|---|---|
| K.2B สะพานธนะรัชต์ | 832068 | RID | เมืองราชบุรี, แม่กลอง | 4.21 | bank 4.30, ground -10 (equals RID ZG -10). ThaiWater value = RID reading + ZG (RID API shows 14.21, ZG -10, bank 14.30), so **ThaiWater K.2B is metres above sea level** and matches RID's 14.20 minus 10. Rising all week (0.45 to 4.26), now flat |
| K.57 บ้านกระดังงา | 832069 | RID | บางคนที, แม่กลอง | 15.12 | bank 15.50, ground -6.2. **Equals RID's raw gauge reading**, not MSL (see below) |
| K.56A บ้านสร้อยฟ้า | not in station list as tele_waterlevel; RID code `K.56A` | RID | โพธาราม | 10.63 (RID API, 22:00) | RID: Q 1,972 m3/s, bank 10.30, ZG -2. Only reachable via RID hyd-app-db (undocumented, needs Origin/Referer, same as the dam note's D4). Not tested in ThaiWater by id |
| K.55A สะพานค่ายหลวง | 832066 | RID | บ้านโป่ง | 10.48, Q 2,110 | in `waterlevel_load`; already tracked |
| RAJ001 โพธาราม | 710 | HII | เจ็ดเสมียน | 5.90 | bank 5.92. Already tracked |
| MKG006 พระรามสอง | 755 | HII | อ.เมืองสมุทรสงคราม, แม่กลอง (13.384, 99.984) | 0.23 | tidal, 10-min, last-week range -1.03 to +2.28; bank 1.99, ground -11.86 |
| PTTEP1 สะพานข้ามคลองโคน | 1373690 | HII | อ.เมืองสมุทรสงคราม, คลองโคน (13.332, 99.969) | -0.03 | tidal, range -1.21 to +1.66; bank 1.95 |
| MKG005 บ้านแพ้ว | 754 | HII | บ้านแพ้ว (สมุทรสาคร), คลองดำเนินสะดวก | 0.54 | **ThaiWater is not tidal here**: held 0.5-0.7 for a week except a one-point 2.11 spike on 29 Sep 22:50 (likely a bad reading). Behind a gate. Canal level, not the river |
| GLF003 บางตะบูน | 770 | HII | อ.บ้านแหลม เพชรบุรี, คลองบางตะบูน | 0.44 | tidal, but a different river (Phetchaburi side). Not Mae Klong |
| สะพานสมเด็จพระศรีสุริเยนทร์ (อัมพวา) | 6855747 | agency 3 (not identified) | อ.อัมพวา (13.419, 99.961) | **no data** | station exists, series empty since at least 27 Sep |
| สะพานธนะรัชต์ G09006-TC140103 | 6856078 | agency 3 | เมืองราชบุรี | no data | empty |
| TK.2B วัดท่าโขลง, TK.57, ปตร.บางนกแขวก TMK03 | 709156, 709168, 709173 | RID | | no data | empty |

**K.57 datum.** What RID itself publishes, via its own hydro API (hyd-app-db, same call as the dam note's D4, with Origin/Referer): K.57 reading 15.12 m at 22:00, bank (braelevel) 15.5, **ZG -13.2**. K.2B: reading 14.21, bank 14.30, ZG -10. K.55A: ZG 0. K.56A: ZG -2. K.11A: ZG 9.7. RID's diagram header says "ระดับน้ำ ม.(รสม.)" for all, but the numbers are the readings.
- ThaiWater K.2B = reading + ZG (4.21). ThaiWater K.57 = **reading as is (15.12, equal to RID's), with ground_level -6.2**, which does not equal RID's ZG -13.2. So ThaiWater is inconsistent between K.2B and K.57, and its K.57 ground figure disagrees with RID's.
- **Inferred, strongly:** the true height is reading + ZG = 15.12 - 13.2 = **1.92 m MSL**, bank **2.30 m MSL**. Reasons: the tide-affected sea-side gauges sit at about 0 (MKG006 bank 1.99, PTTEP1 1.95); a river point 23 km from the sea cannot be at 15 m MSL while Ratchaburi city (K.2B, 41 km) is at 4.2 m MSL; and K.57's 1.6 m daily swing matches the Navy's 2.0-2.3 m range. No source explains the -6.2. **Do not put K.57's 15.12 beside RAJ001's 5.90 or MKG006's 0.23 as if the same datum.** Show it in RID's gauge scale with the RID bank 15.50, or convert with a maintainer-set offset labelled as "RID ZG -13.2 (RID hydro API)".
- This also explains why the page's other numbers do not line up: K.56A reads 10.63 in gauge terms with ZG -2, so 8.63 MSL; RAJ001 (HII) reads 5.90. Both are Photharam; I did not reconcile the 2.7 m gap. Do not mix them either.

**Do tidal gauges need the repo's Tide rule?** (CONTEXT.md: Tide = twice-daily rise and fall; the page shows each day's high and low, no rising/falling trend.)
- MKG006, PTTEP1, GLF003: yes, clearly. Daily range 2-3 m, two highs and two lows (mixed tide).
- K.57 and K.2B: **yes in low flow, no in this flood.** The swing is 1.6 m (K.57) and 1.1 m (K.2B) on 24 Sep and collapses to 0.15 and 0.11 m on 1 Oct as the river rises. A rising/falling trend is misleading on 24 Sep and meaningful on 1 Oct. Simplest honest approach: treat both as tidal (daily high/low), plus show the level and bank as facts. This is a **decision for the maintainer**; I only verified the swings, not a rule.
- K.55A: not tidal on the evidence I have (swing follows the flood wave).
- Note: the tide high is **diurnal-looking at K.57** (one dominant peak near 19:00) because the daily peak at the river reaches ~19:00 from the 07:00-08:00 mouth high with the flood tide lag; this is **inferred**, not sourced.

Navy tide table (verified): กรมอุทกศาสตร์ กองทัพเรือ, "มาตราน้ำในน่านน้ำไทย พ.ศ.2569", page https://hydro.navy.mi.th/waterlaveltable (note `.mi.th`), file `MK2026.pdf` (ปากน้ำแม่กลอง, P.157, 13°22'39"N 99°59'34"E). Heights are above lowest low water; **the table's own remark says subtract 2.14 m to get above mean sea level for this station**. Predicted highs/lows (hour, m above LLW; MSL in brackets):

| Date | high | low |
|---|---|---|
| 29 Sep | 3.4 at 07 h (1.26) | 1.2 at 02 h |
| 30 Sep | 3.4 at 07 h | 1.1 at 02 h |
| 1 Oct | 3.4 at 08 h (second high 3.3 at 19 h) | 1.0 at 02 h (-1.14) |
| 2-4 Oct | 3.3 at 09 / 11 / 13 h (1.16) | 1.0 |
| 5-7 Oct | 3.4, 3.5, 3.5 at 14-16 h (1.26-1.36) | 1.1-1.3 |

Observed at MKG006 on 30 Sep: high 2.28 at 07:10 (above the predicted 1.26 MSL by about 1 m, i.e. surge plus river, **inferred**).

## 4. Recommended pick

**Add (in this order):**
1. **K.57 บ้านกระดังงา (id 832069).** The last RID gauge before the sea and at the exact spot (Bang Nok Khwaek) where the flooding is worst. Gauge-scale level 15.12, bank 15.50; **label the datum** (section 3). RID also publishes it (independent confirmation). Verified present, hourly, fresh. Caveat: datum conflict between ThaiWater and RID's ZG.
2. **K.2B สะพานธนะรัชต์ (id 832068).** Ratchaburi city, MSL-converted by ThaiWater and matching RID, bank 4.30, now 0.09 m below bank. Verified. A natural "Ratchaburi" card. Also shows the first slow rise that preceded flooding in บางแพ/เมือง.
3. **MKG006 พระรามสอง (id 755).** The mouth/sea tide: shows when high tide blocks the river and drains. Verified tidal, 10-min, in HII's feed. Already a "candidate". Use with the Tide rule.

**Consider:**
4. **K.56A สะพานบ้านหม้อ-สร้อยฟ้า (RID code K.56A).** The only gauge between Ban Pong and Ratchaburi city with a published discharge (1,972 m3/s) and RID bank. But it is **not in ThaiWater** by id in the lists I read; it needs RID's undocumented API, so likely not worth it unless you want a discharge in Photharam. RAJ001 already covers the town.
5. **PTTEP1 (id 1373690).** Canal near the mouth; adds little beyond MKG006. Skip unless wanted for a second tidal point.

**Avoid / do not use:**
- **K.11A in ThaiWater's bulk feed.** On 1 Oct 23:00 it shows 12.03 m with "previous 18.65" and a discharge of 237.64 and storage 48.88%, while RID's own API says 7.86 m gauge (+9.7 = 17.56 MSL, flagged "*" = flow/weir condition). The two do not agree and an 18.65-to-12.03 drop in one step is not physical. **Verified disagreement; cause unknown.** Check the collector's K.11A history before leaning on that gauge.
- **สะพานสมเด็จพระศรีสุริเยนทร์ (อัมพวา, 6855747), TK.57, TK.2B, ปตร.บางนกแขวก (TMK03):** stations exist but publish no readings; you would show nothing.
- **MKG005 บ้านแพ้ว:** a gated canal, flat except one bad point; not the river.
- **GLF003 บางตะบูน:** a different river (Phetchaburi).
- News figures like "3.4 m at Bang Khonthi" as a gauge: probably tide-table numbers, no station.

**Verified vs inferred summary**
- Verified: river order and distances (RID PDF), release/discharge series (ThaiWater, RID API), datum facts for K.2B/K.57/K.56A (RID API), tide swings (ThaiWater), tide predictions and MSL offset (Navy PDF), RID's own Ratchaburi flood count (RID PDF).
- Inferred: K.57's true MSL (1.92 m), that Bang Khonthi's "3.4 m" is a tide-table figure, tide at Photharam, why drain systems fill (Damnoen Saduak joining at Bang Nok Khwaek).
- News only: all provincial/DDPM flood counts and causes, evacuation orders, release peaks (2,300 to 2,500), the 28 h travel time (the 122 km total I did re-derive from RID).

## Gaps / next steps (maintainer decisions)
- Open the primary provincial announcements once `prd.go.th` is reachable: samutsongkhram.prd.go.th iid 325490 and ratchaburi iid 546129 / 546659, ปภ. daily flood report. They should carry the tambon names and the cause.
- Ask RID Region 13 or HII what ThaiWater's K.57 ground level (-6.2) means against RID's ZG -13.2.
- Decide whether K.57 and K.2B follow the Tide rule (high/low) or a trend, given the swing collapses in flood.
- Check ThaiWater's K.11A row against the collector's history.
- Not checked: กรมอุตุ (TMD) tide or station data (tmd.go.th redirects; no tide product looked at); EGAT's schematic for K.2B/K.57 (not looked at here); กรมอุทกศาสตร์'s disaster-warning PDF.
