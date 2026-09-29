// Renders the Bang Kruai Site: proxy gauges side by side, no headline, no status colour.
// Reads only each gauge's small summary file (daily high/low + recent readings), never the
// full 10-minute history. Static and client-side; the GitHub Action does the scraping.
(function () {
  const STALE_MINUTES = 6 * 60;
  const STALE_TEXT = "ข้อมูลอาจไม่อัพเดทล่าสุด";
  const COLLECTOR_WARN_MINUTES = 60;

  // Labels state the waterway and relation to the area; the feed geocodes BKK003 to
  // Taling Chan, so nothing here implies a gauge is in the area. Upstream to downstream.
  const LABELS = {
    2744: { name: "ท้ายเขื่อนเจ้าพระยา (C.13)", where: "แม่น้ำเจ้าพระยา · จ.ชัยนาท ต้นน้ำห่างจากพื้นที่มาก", discharge: true },
    26: { name: "สะพานนวลฉวี ปากเกร็ด (CPY014)", where: "แม่น้ำเจ้าพระยา · อ.ปากเกร็ด นนทบุรี" },
    2599: { name: "สามเสน (C.12)", where: "แม่น้ำเจ้าพระยา · เขตดุสิต กรุงเทพฯ" },
    4: { name: "สะพานกรุงเทพ (CPY015)", where: "แม่น้ำเจ้าพระยา · เขตธนบุรี กรุงเทพฯ" },
    5: { name: "คลองมหาสวัสดิ์ บางกรวย-สวนผัก (BKK003)", where: "คลองมหาสวัสดิ์ · จุดวัดอยู่เขตตลิ่งชัน กรุงเทพฯ ห่างพื้นที่ประมาณ 4 กม." },
  };
  const ORDER = [2744, 26, 2599, 4, 5];

  const ageMinutes = (iso) => {
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? Infinity : Math.max(0, (Date.now() - ms) / 60000);
  };
  function formatDuration(mins) {
    if (mins < 60) return `${Math.round(mins)} นาที`;
    const h = mins / 60;
    return h < 24 ? `${h.toFixed(1)} ชั่วโมง` : `${(h / 24).toFixed(1)} วัน`;
  }
  const bkk = (iso, opts) =>
    new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hourCycle: "h23", ...opts }).format(new Date(iso));
  const clock = (iso) => bkk(iso, { hour: "2-digit", minute: "2-digit" }) + " น.";
  const dayLabel = (date) =>
    new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00Z`));

  async function getJson(file) {
    const res = await fetch(file, { cache: "no-store" });
    if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`);
    return res.json();
  }

  function bankHtml(level, bank) {
    const c = bankComparison(level, bank);
    if (!c) return `<div class="station-meta">ไม่มีข้อมูลความสูงตลิ่ง</div>`;
    const text = c.direction === "at" ? "เท่ากับตลิ่ง" : `${c.direction === "above" ? "สูงกว่า" : "ต่ำกว่า"}ตลิ่ง ${c.diffM.toFixed(2)} ม.`;
    return `<div class="station-meta">${text} <span class="unit">(ตลิ่ง ${bank.toFixed(2)} ม.รทก.)</span></div>`;
  }

  function dailyHtml(days) {
    const shown = days.slice(-4);
    if (!shown.length) return `<div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงสูงสุด–ต่ำสุดรายวัน</div>`;
    const rows = shown
      .map(
        (d) => `<tr><td>${dayLabel(d.date)}${d.partial ? " (ยังไม่ครบวัน)" : ""}</td>
          <td>${d.high.toFixed(2)} <span class="unit">${clock(d.highAt)}</span></td>
          <td>${d.low.toFixed(2)} <span class="unit">${clock(d.lowAt)}</span></td></tr>`,
      )
      .join("");
    return `<table class="stations-table"><thead><tr><th>วัน</th><th>สูงสุด (ม.รทก.)</th><th>ต่ำสุด (ม.รทก.)</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function chartHtml(recent) {
    const pts = recent.map((p) => ({ t: new Date(p.t).getTime(), v: p.v }));
    if (pts.length < 2) return `<div class="spark"><div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงกราฟ</div></div>`;
    const w = 300, h = 56, pad = 6;
    const t0 = pts[0].t, tN = pts[pts.length - 1].t;
    let min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
    if (max - min < 0.2) { const mid = (min + max) / 2; min = mid - 0.1; max = mid + 0.1; }
    const line = pts
      .map((p) => `${(pad + ((p.t - t0) / (tN - t0)) * (w - pad * 2)).toFixed(1)},${(h - pad - ((p.v - min) / (max - min)) * (h - pad * 2)).toFixed(1)}`)
      .join(" ");
    const spanH = (tN - t0) / 3600000;
    return `<div class="spark"><div class="spark-label">ระดับผิวน้ำ</div>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="ระดับผิวน้ำ"><polyline class="spark-line" points="${line}" /></svg>
      <div class="spark-cap">${spanH.toFixed(1)} ชม.: ${pts[0].v.toFixed(2)} → ${pts[pts.length - 1].v.toFixed(2)} ม.</div></div>`;
  }

  function trendHtml(recent) {
    const t = trendOf(recent.map((p) => ({ t: p.t, v: p.v })), "v", "t", 3, 0.02);
    if (!t) return "";
    const [arrow, word] = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] }[t.direction];
    return `<div class="station-meta"><span class="trend" data-dir="${t.direction}">${arrow} ${word} ราว 3 ชม.</span></div>`;
  }

  async function loadGauge(station) {
    const label = LABELS[station.id];
    const card = document.createElement("div");
    card.className = "station-card";
    const head = `<div class="station-header"><span class="station-name">${label.name}</span></div>
      <div class="station-meta">${label.where}</div>`;
    const summary = await getJson("data/" + station.summary).catch(() => ({ latest: null, days: [], recent: [] }));
    const history = summary.latest;
    if (!history || typeof history.levelMsl !== "number") {
      card.innerHTML = `${head}<div class="chart-empty">${history ? "ไม่มีข้อมูลระดับน้ำจากแหล่งข้อมูลในรอบล่าสุด" : "ยังไม่มีข้อมูล"}</div>`;
      return card;
    }
    const mins = ageMinutes(history.updatedAt);
    const stale = !(mins <= STALE_MINUTES);
    const discharge =
      label.discharge && typeof history.dischargeM3s === "number"
        ? `<div class="reservoir-stats"><div><span class="stat-label">อัตราการไหลท้ายเขื่อนทดน้ำ</span> ${history.dischargeM3s.toLocaleString("en")} <span class="unit">ลบ.ม./วินาที</span>
            <span class="unit">(อัตราการไหลของแม่น้ำ ไม่ใช่อัตราระบายเขื่อน)</span></div></div>`
        : "";
    card.innerHTML = `${head}
      <div class="station-level">${history.levelMsl.toFixed(2)} <span class="unit">ม.รทก.</span></div>
      ${bankHtml(history.levelMsl, history.bankMsl)}
      <div class="station-meta" data-stale="${stale}">ข้อมูลของแหล่งเมื่อ ${clock(history.updatedAt)} (${formatDuration(mins)}ที่แล้ว)${stale ? ` — ${STALE_TEXT}` : ""}</div>
      ${discharge}
      ${station.tidal ? dailyHtml(summary.days) : trendHtml(summary.recent)}
      ${chartHtml(summary.recent)}`;
    return card;
  }

  async function renderHealth() {
    const el = document.getElementById("health");
    let status = null;
    try { status = await getJson("data/status.json"); } catch (err) { /* shown as unknown below */ }
    const h = status && collectorHealth([status.river], Date.now(), COLLECTOR_WARN_MINUTES);
    if (!h || h.status === "unknown") el.innerHTML = `<span class="health-warn">ไม่ทราบสถานะตัวดึงข้อมูลอัตโนมัติ — ${STALE_TEXT}</span>`;
    else if (h.status === "stale") el.innerHTML = `<span class="health-warn">ตัวดึงข้อมูลอัตโนมัติไม่สำเร็จมาแล้ว ${formatDuration(h.ageMinutes)} — ${STALE_TEXT}</span>`;
    else el.textContent = `ตัวดึงข้อมูลอัตโนมัติ: ดึงสำเร็จล่าสุดเมื่อ ${formatDuration(h.ageMinutes)}ที่แล้ว`;
  }

  async function main() {
    renderHealth();
    setInterval(renderHealth, 60000);
    const root = document.getElementById("gauges");
    const stations = stationsForSite("bangkruai").sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    for (const s of stations) {
      try {
        root.appendChild(await loadGauge(s));
      } catch (err) {
        console.error(err);
        const card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `<div class="station-header"><span class="station-name">${LABELS[s.id].name}</span></div><div class="chart-empty">โหลดข้อมูลไม่สำเร็จ</div>`;
        root.appendChild(card);
      }
    }
  }
  main();
})();
