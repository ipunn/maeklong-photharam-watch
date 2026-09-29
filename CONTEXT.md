# Domain glossary

**Gauge** — a river water-level station tracked via ThaiWater, identified by its ThaiWater `station.id` and (where it has one) an agency code: K.58 บ้านปากแซง (แควน้อย), K.11A บ้านวังขนาย (แม่กลอง, below Mae Klong Dam — inferred, see `.scratch/**/research/river-line-order.md`), K.55A สะพานค่ายหลวง (บ้านโป่ง), RAJ001 โพธาราม. For the Mae Klong Site the situation card shows โพธาราม and the nearest gauge upstream of it.

**Site** — a watched place with its own gauges, headline and page. Two: อ.โพธาราม (Mae Klong) and พื้นที่ บางกรวย, บางคูเวียง (อ.บางกรวย, นนทบุรี; the waterway nearest the area is คลองบางค้อ). Sites share one Collector and one set of History.

**Proxy gauge** — a Gauge that is near a Site but not on the waterway that threatens it. คลองบางค้อ has no gauge of its own, so the Bang Kruai Site shows only proxy gauges (e.g. BKK003 on คลองมหาสวัสดิ์, Chao Phraya gauges), each labelled with its relation to the area, side by side with no headline, under a fixed note that the canal itself is not measured.

**Tide** — the twice-daily rise and fall of a tidal Gauge (Chao Phraya and its canals, unlike Mae Klong). A rising/falling trend is not meaningful there; the page shows each day's high and low instead.

**Daily summary** — the small derived file `data/daily-<gauge>.json` per Bang Kruai gauge: each Bangkok day's high and low (tidal gauges; today is marked partial) plus the last 48 h of readings. Derived from History, never a replacement for it.

**Dam** — Vajiralongkorn (แควน้อย) or Srinakarin (แควใหญ่). The two rivers merge at ปากแพรก, Kanchanaburi, into the Mae Klong. A dam is not a Gauge: it has stored volume, level and release rather than a river reading.

**Reading** — one value set reported by a source at *its own* time (`updatedAt` for gauges, `reportedAt` for dams), distinct from `scrapedAt` (when we fetched it). Freshness is always judged from the source's own time, never from `scrapedAt`. Any reading older than 6 hours is flagged "ข้อมูลอาจไม่อัพเดทล่าสุด". The one exception is EGAT's daily table, which is stamped as of the previous midnight and is flagged after 36 hours.

**Source** — one of three independent feeds: `river` (ThaiWater `waterlevel_load`), `reservoir` (EGAT's daily HTML table), `damHourly` (ThaiWater `analyst/dam`, hourly). Each can fail without stopping the others. `data/status.json` records when each last *succeeded*. The `river` Source is stamped once per Site (`river` for Mae Klong, `riverBangkruai` for Bang Kruai), so one Site's gauges missing from the feed cannot be hidden by the other's success.

**Release** — water let out of a dam, shown in m³/s. Headline value: ThaiWater's hourly feed (million m³ over the hour, × 1,000,000 ÷ 3,600). EGAT's daily figure (MCM/day) is secondary.

**Capacity (derived)** — a dam's stored volume as a % of capacity, and the room left. ThaiWater's own percent is 0 for these dams, so capacity is backed out of EGAT's row (storage MCM ÷ storage %). It is an estimate and is labelled "(ประมาณ)".

**Band** — the official Royal Irrigation Dept reservoir-status band for a capacity %: ≤30 น้ำน้อยวิกฤต, >30–50 น้ำน้อย, >50–80 น้ำปานกลาง, >80–100 น้ำมาก, >100 เกินความจุเก็บกัก. The page colours the top two red (a display choice); the band names are the agency's.

**Status** — red/yellow/green severity of a Gauge reading, derived only from thresholds the source publishes. With no published threshold, or no level, status is **neutral** (null). We never guess one. None of the tracked gauges currently has a published threshold, so no gauge is coloured. Bank height may be shown as a fact next to a level; it does not colour anything.

**Site alert** — the Bang Kruai page's own red signal: BKK003 (the one Gauge near the area) at least 1 m above its bank height (`aboveBankAlert`; margin is a placeholder set by the maintainer). It is display-only: never written to History, never a Status (no source publishes a threshold), and always labelled on the page as this site's own rule, not an official threshold.

**History** — the append-only per-series log under `data/`. A reading identical to the last stored one is not appended again.

**Collector** — the GitHub Actions workflow that scrapes the sources. Each run starts the next one itself (GitHub's `schedule` proved unreliable). It is judged from `data/status.json`, per source, not from the data itself.
