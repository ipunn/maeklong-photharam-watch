# Domain glossary

**Gauge** — a river water-level station tracked via ThaiWater, identified by its ThaiWater `station.id` and (where it has one) an agency code: K.58 บ้านปากแซง (แควน้อย), K.11A บ้านวังขนาย (แม่กลอง, below Mae Klong Dam — inferred, see `.scratch/**/research/river-line-order.md`), K.55A สะพานค่ายหลวง (บ้านโป่ง), RAJ001 โพธาราม. The watched area is อ.โพธาราม; the situation card shows โพธาราม and the nearest gauge upstream of it.

**Dam** — Vajiralongkorn (แควน้อย) or Srinakarin (แควใหญ่). The two rivers merge at ปากแพรก, Kanchanaburi, into the Mae Klong. A dam is not a Gauge: it has stored volume, level and release rather than a river reading.

**Reading** — one value set reported by a source at *its own* time (`updatedAt` for gauges, `reportedAt` for dams), distinct from `scrapedAt` (when we fetched it). Freshness is always judged from the source's own time, never from `scrapedAt`. Any reading older than 6 hours is flagged "ข้อมูลอาจไม่อัพเดทล่าสุด". The one exception is EGAT's daily table, which is stamped as of the previous midnight and is flagged after 36 hours.

**Source** — one of three independent feeds: `river` (ThaiWater `waterlevel_load`), `reservoir` (EGAT's daily HTML table), `damHourly` (ThaiWater `analyst/dam`, hourly). Each can fail without stopping the others. `data/status.json` records when each last *succeeded*.

**Release** — water let out of a dam, shown in m³/s. Headline value: ThaiWater's hourly feed (million m³ over the hour, × 1,000,000 ÷ 3,600). EGAT's daily figure (MCM/day) is secondary.

**Capacity (derived)** — a dam's stored volume as a % of capacity, and the room left. ThaiWater's own percent is 0 for these dams, so capacity is backed out of EGAT's row (storage MCM ÷ storage %). It is an estimate and is labelled "(ประมาณ)".

**Band** — the official Royal Irrigation Dept reservoir-status band for a capacity %: ≤30 น้ำน้อยวิกฤต, >30–50 น้ำน้อย, >50–80 น้ำปานกลาง, >80–100 น้ำมาก, >100 เกินความจุเก็บกัก. The page colours the top two red (a display choice); the band names are the agency's.

**Status** — red/yellow/green severity of a Gauge reading, derived only from thresholds the source publishes. With no published threshold, or no level, status is **neutral** (null). We never guess one. None of the tracked gauges currently has a published threshold, so no gauge is coloured.

**History** — the append-only per-series log under `data/`. A reading identical to the last stored one is not appended again.

**Collector** — the GitHub Actions job that scrapes the sources. It is judged from `data/status.json`, per source, not from the data itself.
