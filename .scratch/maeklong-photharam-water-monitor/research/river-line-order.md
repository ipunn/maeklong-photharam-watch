# River-line order: what is sourced, what is inferred

Purpose: the page draws measuring points in flow order. Coordinates and levels can
suggest an order but cannot prove which side of a dam a gauge is on, so each link is
listed with its source. Checked 2026-09-29.

## Sourced

| Claim | Source |
|---|---|
| แควใหญ่ and แควน้อย merge at ต.ปากแพรก, อ.เมืองกาญจนบุรี to form the Mae Klong | Wikipedia "แม่น้ำแม่กลอง" (th.wikipedia.org/wiki/แม่น้ำแม่กลอง); search result summary of Museum Siam / Matichon |
| The Mae Klong then flows through อ.เมือง, อ.ท่าม่วง, อ.ท่ามะกา (Kanchanaburi), then อ.บ้านโป่ง, อ.โพธาราม, อ.เมืองราชบุรี (Ratchaburi), then Samut Songkhram to the Gulf | same sources |
| เขื่อนศรีนครินทร์ is on แควใหญ่ (ต.ท่ากระดาน อ.ศรีสวัสดิ์) | EGAT, egat.co.th/home/srinakarin-dm-about/ |
| เขื่อนวชิราลงกรณ (เขาแหลม) is on แควน้อย (ต.ท่าขนุน อ.ทองผาภูมิ) | EGAT, egat.co.th/home/vajiralongkorn-dm/ |
| เขื่อนท่าทุ่งนา is downstream of Srinagarind | EGAT, egat.co.th/home/tha-thung-na-dm-about/ |
| เขื่อนแม่กลอง is at ต.ท่าม่วง อ.ท่าม่วง จ.กาญจนบุรี (downstream of the confluence) | HII station page tiwrm.hii.or.th/DATA/REPORT/php/maeklong/station/show_detail.php?code=TD03; EGAT egat.co.th/home/mae-klong-rohpp/ |
| Gauge identities: บ้านปากแซง = K.58 on แม่น้ำแควน้อย (ไทรโยค); บ้านวังขนาย = K.11A on แม่น้ำแม่กลอง (ท่าม่วง); สะพานค่ายหลวง = K.55A on แม่น้ำแม่กลอง (บ้านโป่ง) | ThaiWater feed waterlevel_load, fields tele_station_oldcode / river_name / geocode |
| RID statement 2026-09-29 11:00: dam upstream 22.90 m MSL, downstream 17.60 m MSL | Irrigation Dept, Regional Office 13, as reported by Daily News / Thairath |

## Inferred (strong, not stated outright)

- **บ้านวังขนาย (K.11A) is downstream of Mae Klong Dam.** No source found that says so
  in words. Basis: (1) it reads 17.60 -> 17.73 m MSL, exactly RID's stated
  downstream-of-dam level (17.60); (2) a gauge on the dam's pool would read about the
  pool level (22.90), not 17.7; (3) it is in the same district as the dam. If a source
  contradicts this, the card label "ท้ายเขื่อนแม่กลอง" must change.

## Not sourced / known gaps

- The dam's own release has no automatic source (out of scope).
- Order of gauges within Tha Maka is not needed: none is used there.
- Tools note: several "facts" came through search-result summaries or a small
  summariser; the summariser once mis-placed K.58 in Tha Muang (the feed and the
  provincial notice both say Sai Yok). Feed field values were re-read directly.
