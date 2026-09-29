// Renders the Bang Kruai Site: proxy gauges side by side, no headline, no status colour.
// Reads only each gauge's small summary file (daily high/low + recent readings), never the
// full 10-minute history. Static and client-side; the GitHub Action does the scraping.
(function () {
  const STALE_MINUTES = 6 * 60;
  const STALE_TEXT = "ข้อมูลอาจไม่อัพเดทล่าสุด";
  const COLLECTOR_WARN_MINUTES = 60;

  // Labels state the waterway and relation to the area; the feed geocodes BKK003 to
  // Taling Chan, so nothing here implies a gauge is in the area. Order: closest to the area
  // first, then by potential impact; distances are rough straight-line estimates from the
  // middle of บางกรวย–บางคูเวียง.
  const LABELS = {
    5: { kind: "คลอง · ใกล้พื้นที่ที่สุด", name: "คลองมหาสวัสดิ์ บางกรวย-สวนผัก", code: "BKK003", where: "จุดวัดอยู่เขตตลิ่งชัน กรุงเทพฯ · ห่างประมาณ 4 กม." },
    2599: { kind: "แม่น้ำเจ้าพระยา", name: "สามเสน", code: "C.12", where: "เขตดุสิต กรุงเทพฯ · ห่างประมาณ 5 กม." },
    4: { kind: "แม่น้ำเจ้าพระยา", name: "สะพานกรุงเทพ", code: "CPY015", where: "เขตธนบุรี กรุงเทพฯ · ห่างประมาณ 12 กม." },
    26: { kind: "แม่น้ำเจ้าพระยา", name: "สะพานนวลฉวี ปากเกร็ด", code: "CPY014", where: "อ.ปากเกร็ด นนทบุรี · ห่างประมาณ 15 กม." },
    2744: { kind: "ต้นน้ำ · อัตราการไหล", name: "ท้ายเขื่อนเจ้าพระยา", code: "C.13", where: "อ.สรรพยา จ.ชัยนาท · ต้นน้ำห่างมาก", discharge: true },
  };
  const ORDER = [5, 2599, 4, 26, 2744];

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

  function bankText(level, bank) {
    const c = bankComparison(level, bank);
    if (!c) return "ไม่มีข้อมูลความสูงตลิ่ง";
    if (c.direction === "at") return "เท่ากับตลิ่ง";
    return `<b>${c.direction === "above" ? "สูงกว่า" : "ต่ำกว่า"}ตลิ่ง ${c.diffM.toFixed(2)} ม.</b> (ตลิ่ง ${bank.toFixed(2)})`;
  }

  // Tidal gauges: the latest two Bangkok days' high and low, one line each.
  function dailyHtml(days) {
    const shown = days.slice(-2).reverse();
    if (!shown.length) return `<div class="bk-line">รอข้อมูลสะสมเพื่อแสดงสูงสุด–ต่ำสุดรายวัน</div>`;
    return shown
      .map(
        (d) => `<div class="bk-line">${dayLabel(d.date)}${d.partial ? " (ยังไม่ครบวัน)" : ""}: สูงสุด <b>${d.high.toFixed(2)}</b> ${clock(d.highAt)} · ต่ำสุด <b>${d.low.toFixed(2)}</b> ${clock(d.lowAt)}</div>`,
      )
      .join("");
  }

  function chartHtml(recent) {
    const pts = recent.map((p) => ({ t: new Date(p.t).getTime(), v: p.v }));
    if (pts.length < 2) return `<div class="spark"><div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงกราฟ</div></div>`;
    const w = 300, h = 56, pad = 6;
    const t0 = pts[0].t, tN = pts[pts.length - 1].t;
    let min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
    if (max - min < 0.2) { const mid = (min + max) / 2; min = mid - 0.1; max = mid + 0.1; }
    const xy = pts.map((p) => [pad + ((p.t - t0) / (tN - t0)) * (w - pad * 2), h - pad - ((p.v - min) / (max - min)) * (h - pad * 2)]);
    const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [ex, ey] = xy[xy.length - 1];
    const spanH = (tN - t0) / 3600000;
    return `<div class="spark">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="ระดับผิวน้ำ"><polyline class="spark-line" points="${line}" /><path class="spark-dot" d="M${ex.toFixed(1)} ${ey.toFixed(1)}h0" /></svg>
      <div class="bk-line">${spanH.toFixed(0)} ชม.ที่ผ่านมา: ${pts[0].v.toFixed(2)} → ${pts[pts.length - 1].v.toFixed(2)} ม.</div></div>`;
  }

  function trendHtml(recent) {
    const t = trendOf(recent.map((p) => ({ t: p.t, v: p.v })), "v", "t", 3, 0.02);
    if (!t) return "";
    const [arrow, word] = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] }[t.direction];
    return `<div class="bk-line"><span class="trend" data-dir="${t.direction}">${arrow} ${word} ราว 3 ชม.</span></div>`;
  }

  async function loadGauge(station) {
    const label = LABELS[station.id];
    const card = document.createElement("div");
    card.className = "bk-card";
    const head = `<div class="bk-kind">${label.kind}</div>
      <div class="bk-name">${label.name} <span class="bk-where">${label.code}</span></div>
      <div class="bk-where">${label.where}</div>`;
    const summary = await getJson("data/" + station.summary).catch(() => ({ latest: null, days: [], recent: [] }));
    const latest = summary.latest;
    if (!latest || typeof latest.levelMsl !== "number") {
      card.innerHTML = `${head}<div class="chart-empty">${latest ? "ไม่มีข้อมูลระดับน้ำจากแหล่งข้อมูลในรอบล่าสุด" : "ยังไม่มีข้อมูล"}</div>`;
      return card;
    }
    const mins = ageMinutes(latest.updatedAt);
    const stale = !(mins <= STALE_MINUTES);
    const discharge =
      label.discharge && typeof latest.dischargeM3s === "number"
        ? `<div class="bk-line"><b>อัตราการไหล ${latest.dischargeM3s.toLocaleString("en")} ลบ.ม./วินาที</b> (ของแม่น้ำท้ายเขื่อนทดน้ำ ไม่ใช่อัตราระบายเขื่อน)</div>`
        : "";
    card.innerHTML = `${head}
      <div class="station-level">${latest.levelMsl.toFixed(2)} <span class="unit">ม.รทก.</span></div>
      <div class="bk-line">${bankText(latest.levelMsl, latest.bankMsl)}</div>
      ${discharge}
      ${station.tidal ? dailyHtml(summary.days) : trendHtml(summary.recent)}
      <div class="bk-line" data-stale="${stale}">ข้อมูล ${clock(latest.updatedAt)} · ${formatDuration(mins)}ที่แล้ว${stale ? ` — ${STALE_TEXT}` : ""}</div>
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
        card.className = "bk-card";
        card.innerHTML = `<div class="bk-name">${LABELS[s.id].name}</div><div class="chart-empty">โหลดข้อมูลไม่สำเร็จ</div>`;
        root.appendChild(card);
      }
    }
  }
  main();
})();
