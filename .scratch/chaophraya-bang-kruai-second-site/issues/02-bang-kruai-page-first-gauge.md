# 02: Bang Kruai page, first gauge end to end (tracer bullet)

**What to build:** A new Bang Kruai page (พื้นที่ บางกรวย, บางคูเวียง) with one **Proxy gauge**, BKK003 (station id 5, คลองมหาสวัสดิ์), flowing from the live feed through the Collector into append-only history and onto the page. The page shows the gauge's label (waterway and relation to the area, without implying it is in the area; the feed geocodes it to Taling Chan, Bangkok), its level in m MSL, the source's own timestamp, the stale flag ("ข้อมูลอาจไม่อัพเดทล่าสุด" after 6 hours), and the level relative to the bank ("สูงกว่าตลิ่ง x.xx ม." / "ต่ำกว่าตลิ่ง x.xx ม.") as a plain fact with no colour. The page also has the permanent note that คลองบางค้อ itself has no gauge, the unofficial-data notice, and collector health. The Mae Klong and Bang Kruai pages link to each other.

**Blocked by:** 01 (Site tag and scratch data folder).

**Status:** ready-for-agent

- [ ] BKK003's id is re-verified by name against the live feed when added (ADR 0001).
- [ ] The bank comparison is a pure function, tested for above, below, exactly at the bank, and null when either level or bank is missing.
- [ ] A fixture is captured from a real feed record for BKK003 and parsed with the existing river parser.
- [ ] No status colour is shown; Status stays neutral because no threshold is published.
- [ ] The permanent "no gauge on คลองบางค้อ" note is visible and not dismissible.
- [ ] Mae Klong page content is unchanged apart from the link; its tests and data files are unaffected.
- [ ] Verified once against the live feed using the scratch data folder.
