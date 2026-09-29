# Domain glossary

**Station** — a river gauge tracked by ThaiWater, identified by its ThaiWater `station.id`. This product tracks two that bracket the user's coordinate: the **upstream** station (สะพานค่ายหลวง, Ban Pong) and the **downstream** station (โพธาราม).

**Reading** — one water level (m MSL) reported by a station at its own `updatedAt` time. Distinct from `scrapedAt`, when we fetched it. Stations report at different cadences, so a reading's age is judged against its own station's cadence.

**Status** — red/yellow/green severity of a reading, derived only from thresholds the source publishes for that station. With no published threshold the status is **neutral** (null); we never guess one.

**History** — the append-only per-station log of readings under `data/`; never overwritten.
