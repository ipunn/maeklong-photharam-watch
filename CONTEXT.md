# Domain glossary

**Gauge** — a river water-level station tracked via ThaiWater, identified by its ThaiWater `station.id` and (where it has one) an agency code: K.58 บ้านปากแซง (แควน้อย), K.11A บ้านวังขนาย (แม่กลอง, 1.96 km below the Mae Klong Dam per RID's daily basin diagram, see `.scratch/**/research/mae-klong-dam-data-sources.md`), K.63 บ้านใหม่ (4.26 km further down; the nearest Gauge below the dam that reports a discharge), K.37 บ้านวังเย็น (above the Mae Klong Dam by level, not by any source's statement of river order; reports a discharge), K.55A สะพานค่ายหลวง (บ้านโป่ง), RAJ001 โพธาราม, and below it K.2B สะพานธนะรัชต์ and K.57 สะพานบางนกแขวก (graph feed; K.57's reading is on a local gauge scale, RID zero -13.2, not comparable with other Gauges) and MKG006 พระรามสอง (the tidal mouth). For the Mae Klong Site the situation card shows โพธาราม and the nearest gauge upstream of it.

**Riverline** — the ordered chain of stations from the Mae Klong Dam to the Gulf, with the distance (and, where RID prints it, the travel time) between neighbours: K.11A, K.63, K.55A, K.56A, K.2B, K.57, Gulf (about 123 km, about 28 h per RID Region 13). Distances and hours are RID's diagram and always attributed to it. A station on the Riverline that we do not track is shown as "not tracked", never dropped. Not a Gauge list: it is the order and spacing, the Gauges are the readings on it.

**Site** — a watched place with its own gauges, headline and page. Two: อ.โพธาราม (Mae Klong) and พื้นที่ บางกรวย, บางคูเวียง (อ.บางกรวย, นนทบุรี; the waterway nearest the area is คลองบางค้อ). Sites share one Collector and one set of History.

**Proxy gauge** — a Gauge that is near a Site but not on the waterway that threatens it. คลองบางค้อ has no gauge of its own, so the Bang Kruai Site shows only proxy gauges (e.g. BKK003 on คลองมหาสวัสดิ์, Chao Phraya gauges), each labelled with its relation to the area, side by side with no headline, under a fixed note that the canal itself is not measured.

**Window** — the span of time, ending at the newest data hour, that every hourly chart and trend line covers: 6, 12 or 24 h, one choice for the whole page, default 6 h. Boxes share the same right edge, so the same x means the same clock time everywhere. A box with hours of no data inside the Window shows them as a named gap and breaks its line there; it is never redrawn to a different size and never draws across the gap. Daily boxes (EGAT storage bars, Tide high/low), the headline and the Site alert do not follow the Window.

**Reference line** — a level the maintainer marks on a Gauge's chart so people can see how far the water is from it. โพธาราม has three, in metres above sea level: 6.00 (yellow), 6.50 (amber), 6.75 (red). The page's own lines, like the **Site alert**: the colours are a display choice, they are not official thresholds and never a **Status** (which comes only from source-published thresholds), and they are always labelled as the page's own and named in words, not by colour alone.

**Tide** — the twice-daily rise and fall of a tidal Gauge (Chao Phraya and its canals, and the Mae Klong mouth at MKG006 พระรามสอง; not the Mae Klong above it). A rising/falling trend is not meaningful there; the page shows each day's high and low instead.

**Daily summary** — the small derived file `data/daily-<gauge>.json` per Bang Kruai gauge: each Bangkok day's high and low (tidal gauges; today is marked partial) plus the last 48 h of readings. Derived from History, never a replacement for it.

**Barrage** — a structure that holds a river up rather than storing water: the Mae Klong Dam (เขื่อนแม่กลอง, อ.ท่าม่วง). All we can read is its water level (EGAT station SND04): no stored volume, no release, no gate data exist as an automatic source. Its release is announced by RID Office 13 by hand. Its level is not a release. Not a Gauge (a Gauge is a river reading) and not a Dam (a Dam has storage).

**Dam** — Vajiralongkorn (แควน้อย) or Srinakarin (แควใหญ่). The two rivers merge at ปากแพรก, Kanchanaburi, into the Mae Klong. A dam is not a Gauge: it has stored volume, level and release rather than a river reading.

**Channel capacity** (ความจุลำน้ำ) — the discharge, in m³/s, that EGAT publishes as a river channel's limit at a station (e.g. 1,955 at K.37). It is the *source's* figure and different sources disagree on it (K.11A: 1,495 EGAT, 1,300 RID), so it is always attributed to its source. It is not a Status threshold. It is an attribute of a station kept as a snapshot with the source's own time, not a History. Not the same as **Capacity (derived)**, which is a Dam's stored volume.

**Reading** — one value set reported by a source at *its own* time (`updatedAt` for gauges, `reportedAt` for dams), distinct from `scrapedAt` (when we fetched it). Freshness is always judged from the source's own time, never from `scrapedAt`. Any reading older than 6 hours is flagged "ข้อมูลอาจไม่อัพเดทล่าสุด". The one exception is EGAT's daily table, which is stamped as of the previous midnight and is flagged after 36 hours.

**Source** — one of six independent feeds: `river` (ThaiWater `waterlevel_load`), `reservoir` (EGAT's daily HTML table), `damHourly` (ThaiWater `analyst/dam`, hourly), `damArea` (ThaiWater's per-station `waterlevel_graph`: the Barrage level and K.63, which are absent from `waterlevel_load`), `lowerReach` (the same graph feed for K.2B and K.57 below โพธาราม, a Source of its own so one cannot hide the other), `egatTelemetry` (EGAT's telemetry page, read only for Channel capacity). Each can fail without stopping the others. `data/status.json` records when each last *succeeded*. The `river` Source is stamped once per Site (`river` for Mae Klong, `riverBangkruai` for Bang Kruai), so one Site's gauges missing from the feed cannot be hidden by the other's success.

**Release** — water let out of a dam, shown in m³/s. Headline value: ThaiWater's hourly feed (million m³ over the hour, × 1,000,000 ÷ 3,600). EGAT's daily figure (MCM/day) is secondary.

**Capacity (derived)** — a dam's stored volume as a % of capacity, and the room left. ThaiWater's own percent is 0 for these dams, so capacity is backed out of EGAT's row (storage MCM ÷ storage %). It is an estimate and is labelled "(ประมาณ)".

**Band** — the official Royal Irrigation Dept reservoir-status band for a capacity %: ≤30 น้ำน้อยวิกฤต, >30–50 น้ำน้อย, >50–80 น้ำปานกลาง, >80–100 น้ำมาก, >100 เกินความจุเก็บกัก. The page colours the top two red (a display choice); the band names are the agency's.

**Status** — red/yellow/green severity of a Gauge reading, derived only from thresholds the source publishes. With no published threshold, or no level, status is **neutral** (null). We never guess one. None of the tracked gauges currently has a published threshold, so no gauge is coloured. Bank height may be shown as a fact next to a level; it does not colour anything.

**Site alert** — the Bang Kruai page's own red signal: BKK003 (the one Gauge near the area) at least 1 m above its bank height (`aboveBankAlert`; margin is a placeholder set by the maintainer). It is display-only: never written to History, never a Status (no source publishes a threshold), and always labelled on the page as this site's own rule, not an official threshold.

**History** — the append-only per-series log under `data/`. A reading identical to the last stored one is not appended again; a series fed hour by hour from a per-station graph appends only hours newer than the last stored one.

**Collector** — the GitHub Actions workflow that scrapes the sources. Each run starts the next one itself (GitHub's `schedule` proved unreliable). It is judged from `data/status.json`, per source, not from the data itself.
