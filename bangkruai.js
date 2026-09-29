// Renders the Bang Kruai Site in the same shape as the Mae Klong page: the watched area
// on top (the one gauge nearest to it), then the river line in flow order. Proxy gauges only,
// no headline gauge, no status colour. Reads only each gauge's small summary file
// (latest reading + daily high/low + recent readings), never the full 10-minute history.
// Static and client-side; the GitHub Action does the scraping.
(function () {
  const STALE_MINUTES = 6 * 60;
  const STALE_TEXT = "ข้อมูลอาจไม่อัพเดทล่าสุด";
  const COLLECTOR_WARN_MINUTES = 60;

  // Labels state the waterway and relation to the area; the feed geocodes BKK003 to
  // Taling Chan, so nothing here implies a gauge is in the area. Distances are rough
  // straight-line estimates from the middle of บางกรวย–บางคูเวียง.
  const LABELS = {
    5: { name: "คลองมหาสวัสดิ์ บางกรวย-สวนผัก", code: "BKK003", alert: true, role: "จุดวัดที่ใกล้พื้นที่ที่สุด · ห่างประมาณ 4 กม.", type: "จุดวัดระดับน้ำในคลอง (ขึ้น–ลงตามน้ำทะเล)" },
    2744: { name: "ท้ายเขื่อนเจ้าพระยา", code: "C.13", role: "อ.สรรพยา จ.ชัยนาท · ต้นน้ำห่างมาก", type: "จุดวัดในแม่น้ำเจ้าพระยา", discharge: true },
    26: { name: "สะพานนวลฉวี ปากเกร็ด", code: "CPY014", role: "อ.ปากเกร็ด นนทบุรี · ห่างประมาณ 18 กม.", type: "จุดวัดระดับน้ำในแม่น้ำเจ้าพระยา (ขึ้น–ลงตามน้ำทะเล)" },
    2599: { name: "สามเสน", code: "C.12", role: "เขตดุสิต กรุงเทพฯ · ห่างประมาณ 11 กม.", type: "จุดวัดระดับน้ำในแม่น้ำเจ้าพระยา (ขึ้น–ลงตามน้ำทะเล)" },
    4: { name: "สะพานกรุงเทพ", code: "CPY015", role: "เขตธนบุรี กรุงเทพฯ · ห่างประมาณ 17 กม.", type: "จุดวัดระดับน้ำในแม่น้ำเจ้าพระยา (ขึ้น–ลงตามน้ำทะเล)" },
  };

  // Chao Phraya main line, upstream -> downstream, by position along the river (latitude):
  // C.13 (15.16 N), Pak Kret (13.95), the area (about 13.83), Samsen (13.79), Bangkok Bridge
  // (13.70). The area's canals link to the river at both ends (Khlong Bang Kruai upstream,
  // Khlong Bangkok Noi downstream), so it sits beside the river between Pak Kret and Samsen.
  const LINE = [
    { id: 2744 },
    { id: 26 },
    {
      you: true,
      name: "ริมคลองบางค้อ · บางกรวย นนทบุรี (ไม่มีจุดวัด)",
      text: "ตำแหน่งอยู่ระหว่างปากเกร็ดกับสามเสน คลองในพื้นที่เป็นเครือข่ายที่เปิดสู่เจ้าพระยาทั้งสองด้าน: ด้านเหนือน้ำที่ คลองอ้อมนนท์/คลองลัดบางกรวย (อ.เมืองนนทบุรี–บางกรวย) และด้านท้ายน้ำที่ คลองบางกอกน้อย (เหนือสถานีรถไฟธนบุรี) จุดวัดใกล้สุดคือคลองมหาสวัสดิ์ (BKK003) ด้านบน",
    },
    { id: 2599 },
    { id: 4 },
  ];
  const HERE_ID = 5;

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

  // Level against the bank, as a fact: a pill (text + shape, no severity colour, since no
  // official flood level exists) and a thin bar showing how close the level is. The bank sits in
  // the middle, 0.75 m either side; a level outside it pins to the edge and the scale label says "เกินสเกล".
  // The one alert this page raises: a level at least this far above the bank turns red. It is
  // this site's own rule (chosen by the maintainer), NOT an official or source-published
  // threshold, and the page says so wherever it shows red.
  const ALERT_MARGIN_M = 1;
  const ALERT_NOTE = `เกณฑ์เตือนที่ตั้งเองของเว็บนี้ (สูงกว่าตลิ่งตั้งแต่ ${ALERT_MARGIN_M} ม.) ไม่ใช่เกณฑ์ทางการ`;
  // Only gauges flagged `alert` in LABELS can raise it: BKK003 is the one near the area; the
  // others are context, and a red banner for a gauge 11-150 km away would mislead.
  const alerts = (stationId, level, bank) => LABELS[stationId].alert === true && aboveBankAlert(level, bank, ALERT_MARGIN_M);
  const BAR_BELOW_M = 0.75;
  const BAR_ABOVE_M = 0.75;
  function bankHtml(stationId, level, bank) {
    const c = bankComparison(level, bank);
    if (!c) return `<div class="flow-meta">ไม่มีข้อมูลความสูงตลิ่ง</div>`;
    const pill =
      c.direction === "at"
        ? `<span class="bank-pill" data-side="at">■ เท่ากับตลิ่ง</span>`
        : `<span class="bank-pill" data-side="${c.direction}"${alerts(stationId, level, bank) ? ' data-alert="true"' : ""}>${c.direction === "above" ? "▲ สูงกว่า" : "▼ ต่ำกว่า"}ตลิ่ง ${c.diffM.toFixed(2)} ม.</span>`;
    const span = BAR_BELOW_M + BAR_ABOVE_M;
    const pct = (m) => Math.min(100, Math.max(0, ((m - (bank - BAR_BELOW_M)) / span) * 100));
    return `<div class="flow-meta bank-row">${pill} <span class="unit">ตลิ่ง ${bank.toFixed(2)} ม.รทก.</span></div>
      <div class="bank-bar" role="img" aria-label="ระดับน้ำเทียบตลิ่ง">
        <span class="bank-fill" style="width:${pct(level).toFixed(1)}%"></span>
        <span class="bank-tick" style="left:${pct(bank).toFixed(1)}%"></span>
        <span class="bank-dot" data-side="${c.direction}" style="left:${pct(level).toFixed(1)}%"></span>
      </div>
      <div class="bank-scale"><span>${level < bank - BAR_BELOW_M ? "◀ เกินสเกล" : `${BAR_BELOW_M} ม.ใต้ตลิ่ง`}</span><span>ตลิ่ง</span><span>${level > bank + BAR_ABOVE_M ? "เกินสเกล ▶" : `${BAR_ABOVE_M} ม.เหนือตลิ่ง`}</span></div>${
        alerts(stationId, level, bank) ? `<div class="alert-note">⚠ สูงกว่าตลิ่งเกิน ${ALERT_MARGIN_M} ม. <span class="unit">· ${ALERT_NOTE}</span></div>` : ""
      }`;
  }

  // Tidal gauges: the latest two Bangkok days' high and low, one line each.
  const cm = (m) => `${m > 0 ? "+" : m < 0 ? "−" : "±"}${Math.abs(Math.round(m * 100))} ซม.`;
  function dailyHtml(days) {
    const shown = days.slice(-2).reverse();
    if (!shown.length) return `<div class="flow-meta">รอข้อมูลสะสมเพื่อแสดงสูงสุด–ต่ำสุดรายวัน</div>`;
    // The tide swings the level twice a day, so also show what it cannot explain: the tidal
    // range of the last full day and whether that day's high and low moved against the day before.
    const t = tideTrend(days);
    const trend = t
      ? `<div class="flow-meta">วันที่ ${dayLabel(t.date)} ช่วงน้ำขึ้น–ลง ${t.rangeM.toFixed(2)} ม.${
          t.highDeltaM == null ? " · ยังเทียบกับวันก่อนหน้าไม่ได้" : ` · เทียบวันก่อน: สูงสุด <b>${cm(t.highDeltaM)}</b> ต่ำสุด <b>${cm(t.lowDeltaM)}</b>`
        }</div>`
      : "";
    return trend + shown
      .map(
        (d) => `<div class="flow-meta">${dayLabel(d.date)}${d.partial ? " (ยังไม่ครบวัน)" : ""}: สูงสุด <b>${d.high.toFixed(2)}</b> ${clock(d.highAt)} · ต่ำสุด <b>${d.low.toFixed(2)}</b> ${clock(d.lowAt)}</div>`,
      )
      .join("");
  }

  // Same chart as the Mae Klong page: a 6 h window, one shared right edge (the newest data
  // hour across all gauges) so the same x means the same clock time in every box, and an
  // hourly ticker. A gauge whose newest reading is older stops short of the edge.
  const CHART_WINDOW_H = 6;
  const HOUR = 3600000;
  function chartHtml(recent, endT) {
    const startT = endT - CHART_WINDOW_H * HOUR;
    const pts = recent.map((p) => ({ t: new Date(p.t).getTime(), v: p.v })).filter((p) => p.t >= startT && p.t <= endT);
    if (!pts.length) return `<div class="spark"><div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงกราฟ</div></div>`;
    const w = 300, h = 56, pad = 6, minRange = 0.1;
    let min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
    if (max - min < minRange) { const mid = (min + max) / 2; min = mid - minRange / 2; max = mid + minRange / 2; }
    const xy = pts.map((p) => [pad + ((p.t - startT) / (endT - startT)) * (w - pad * 2), h - pad - ((p.v - min) / (max - min)) * (h - pad * 2)]);
    const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [ex, ey] = xy[xy.length - 1];
    const ticks = [];
    for (let t = Math.ceil(startT / HOUR) * HOUR; t <= endT; t += HOUR) {
      ticks.push({ x: pad + ((t - startT) / (endT - startT)) * (w - pad * 2), hour: (Math.floor(t / HOUR) + 7) % 24 }); // Bangkok = UTC+7
    }
    const grid = ticks.map((k) => `<line class="spark-grid" x1="${k.x.toFixed(1)}" y1="0" x2="${k.x.toFixed(1)}" y2="${h}" />`).join("");
    const axis = `<div class="spark-axis${ticks.length > 6 ? " dense" : ""}">${ticks
      .map((k) => `<span class="tick" style="left:${((k.x / w) * 100).toFixed(2)}%">${String(k.hour).padStart(2, "0")}:00</span>`)
      .join("")}</div>`;
    return `<div class="spark">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="ระดับผิวน้ำ ${CHART_WINDOW_H} ชั่วโมงที่ผ่านมา">${grid}<polyline class="spark-line" points="${line}" /><path class="spark-dot" d="M${ex.toFixed(1)} ${ey.toFixed(1)}h0" /></svg>${axis}</div>`;
  }

  function trendHtml(recent) {
    const t = trendOf(recent.map((p) => ({ t: p.t, v: p.v })), "v", "t", 3, 0.02);
    if (!t) return "";
    const [arrow, word] = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] }[t.direction];
    return `<div class="flow-meta"><span class="trend" data-dir="${t.direction}">${arrow} ${word} ราว 3 ชม.</span></div>`;
  }

  // Non-tidal gauge only (C.13): net change against ~24 h ago. Not used for tidal gauges, where
  // the tide is at a different phase at the same clock time each day; they show the day-on-day
  // change of the daily high and low instead.
  function longTrendHtml(recent) {
    const t = trendOf(recent.map((p) => ({ t: p.t, v: p.v })), "v", "t", 24, 0.05);
    if (!t) return `<div class="flow-meta"><span class="trend" data-dir="none">ยังไม่มีข้อมูลย้อนหลัง 24 ชม. พอเทียบ</span></div>`;
    const [arrow, word] = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] }[t.direction];
    const text = t.direction === "steady" ? word : `${word} ${Math.round(Math.abs(t.delta) * 100)} ซม.`;
    return `<div class="flow-meta"><span class="trend" data-dir="${t.direction}">${arrow} เทียบ 24 ชม.ก่อน: ${text}</span></div>`;
  }

  // One node in the same markup as the Mae Klong river line / watched-area card.
  function nodeHtml(station, d, roleOverride) {
    const axisEndT = state.axisEndT;
    const label = LABELS[station.id];
    const type = `<div class="flow-type" data-type="gauge">${label.type}</div>`;
    const title = `${label.name} <span class="flow-role">${label.code} · ${roleOverride || label.role}</span>`;
    const latest = d && d.summary.latest;
    if (!latest || typeof latest.levelMsl !== "number") {
      return `<li class="flow-node">${type}<div class="flow-name">${title}</div><div class="flow-meta">${latest ? "ไม่มีข้อมูลระดับน้ำในรอบล่าสุด" : "ไม่มีข้อมูล"}</div></li>`;
    }
    const mins = ageMinutes(latest.updatedAt);
    const stale = !(mins <= STALE_MINUTES);
    const discharge =
      label.discharge && typeof latest.dischargeM3s === "number"
        ? `<div class="flow-value"><span class="flow-label">อัตราการไหลของแม่น้ำ</span> ${latest.dischargeM3s.toLocaleString("en")} <span class="unit">ลบ.ม./วินาที</span></div>
           <div class="flow-meta">วัดท้ายเขื่อนทดน้ำ เป็นอัตราการไหลของแม่น้ำ ไม่ใช่อัตราระบายของเขื่อน</div>`
        : "";
    return `<li class="flow-node${stale ? " flow-stale" : ""}${alerts(station.id, latest.levelMsl, latest.bankMsl) ? " flow-alert" : ""}">${type}<div class="flow-name">${title}</div>
      <div class="flow-body"><div class="flow-text">
      <div class="flow-value"><span class="flow-label">ระดับผิวน้ำ</span> ${latest.levelMsl.toFixed(2)} <span class="unit">ม. เหนือระดับทะเล</span></div>
      ${bankHtml(station.id, latest.levelMsl, latest.bankMsl)}
      ${discharge}
      ${station.tidal ? dailyHtml(d.summary.days) : trendHtml(d.summary.recent) + longTrendHtml(d.summary.recent)}
      <div class="flow-meta" data-stale="${stale}">ข้อมูล ${clock(latest.updatedAt)} · ${formatDuration(mins)}ที่แล้ว${stale ? ` <span class="stale-badge">${STALE_TEXT}</span>` : ""}</div></div>
      <div class="flow-sparks">${chartHtml(d.summary.recent, axisEndT)}</div></div></li>`;
  }

  const state = { axisEndT: 0 };

  async function render() {
    const stations = new Map(stationsForSite("bangkruai").map((s) => [s.id, s]));
    const data = new Map();
    await Promise.all(
      [...stations.values()].map(async (s) =>
        data.set(s.id, { summary: await getJson("data/" + s.summary).catch(() => ({ latest: null, days: [], recent: [] })) }),
      ),
    );

    let newest = 0;
    for (const { summary } of data.values()) {
      const r = summary.recent[summary.recent.length - 1];
      if (r) newest = Math.max(newest, new Date(r.t).getTime());
    }
    state.axisEndT = Math.ceil(newest / HOUR) * HOUR;

    const hereStation = stations.get(HERE_ID);
    const chaoPhraya = [2744, 26, 2599, 4].map((id) => ({ s: stations.get(id), d: data.get(id) }));
    const c13 = data.get(2744).summary.latest;
    const highs = [26, 2599, 4]
      .map((id) => {
        const days = data.get(id).summary.days;
        const d = days[days.length - 1];
        return d ? `${LABELS[id].name} ${d.high.toFixed(2)}${d.partial ? " (ยังไม่ครบวัน)" : ""}` : null;
      })
      .filter(Boolean);
    const staleCount = chaoPhraya.filter(({ d }) => d.summary.latest && !(ageMinutes(d.summary.latest.updatedAt) <= STALE_MINUTES)).length;
    const alerting = [...stations.values()]
      .filter((st) => { const l = data.get(st.id).summary.latest; return l && alerts(st.id, l.levelMsl, l.bankMsl); })
      .map((st) => LABELS[st.id].name);
    const alertBanner = alerting.length
      ? `<div class="alert-banner" role="alert">⚠ ระดับน้ำสูงกว่าตลิ่งเกิน ${ALERT_MARGIN_M} ม.: ${alerting.join(" · ")}<div class="unit">${ALERT_NOTE} · โปรดติดตามประกาศทางการ</div></div>`
      : "";
    document.getElementById("here").innerHTML = `${alertBanner}<h2 class="section-title">พื้นที่เฝ้าระวัง <span class="here-sub">พื้นที่ บางกรวย, บางคูเวียง จ.นนทบุรี</span></h2>
      <ul class="here-grid">${nodeHtml(hereStation, data.get(HERE_ID))}</ul>
      <div class="here-summary">
        <div><b>สัญญาณจากแม่น้ำเจ้าพระยา</b> — ${c13 && typeof c13.dischargeM3s === "number" ? `อัตราการไหลท้ายเขื่อนเจ้าพระยา ≈ ${c13.dischargeM3s.toLocaleString("en")} ลบ.ม./วินาที` : "ไม่มีข้อมูลอัตราการไหลท้ายเขื่อนเจ้าพระยา"}${staleCount ? ` · <span class="health-warn">${STALE_TEXT} ${staleCount} จุด</span>` : ""}</div>
        ${highs.length ? `<div>ระดับสูงสุดของวันนี้ (ม.รทก.): ${highs.join(" · ")}</div>` : ""}
        <div class="here-more">ดูแผนภาพลำน้ำเจ้าพระยาด้านล่าง</div>
      </div>`;

    document.getElementById("flow").innerHTML = `<ol class="flow flow-main">${LINE.map((n) =>
      n.you
        ? `<li class="flow-node flow-you"><div class="flow-type">พื้นที่ของคุณ</div><div class="flow-name">${n.name}</div><div class="flow-meta">${n.text}</div></li>`
        : nodeHtml(stations.get(n.id), data.get(n.id)),
    ).join("")}</ol>`;
  }

  async function renderHealth() {
    const el = document.getElementById("health");
    let status = null;
    try { status = await getJson("data/status.json"); } catch (err) { /* shown as unknown below */ }
    // This Site's own stamp, not `river` (Mae Klong's): one Site's gauges vanishing from the feed
    // must not be hidden by the other's success. Absent until the Collector has run once with it.
    const h = status && collectorHealth([status.riverBangkruai], Date.now(), COLLECTOR_WARN_MINUTES);
    if (!h || h.status === "unknown") el.innerHTML = `<span class="health-warn">ไม่ทราบสถานะตัวดึงข้อมูลอัตโนมัติ — ${STALE_TEXT}</span>`;
    else if (h.status === "stale") el.innerHTML = `<span class="health-warn">ตัวดึงข้อมูลอัตโนมัติไม่สำเร็จมาแล้ว ${formatDuration(h.ageMinutes)} — ${STALE_TEXT}</span>`;
    else el.textContent = `ตัวดึงข้อมูลอัตโนมัติ: ดึงสำเร็จล่าสุดเมื่อ ${formatDuration(h.ageMinutes)}ที่แล้ว`;
  }

  renderHealth();
  setInterval(renderHealth, 60000);
  render().catch((err) => {
    console.error(err);
    document.getElementById("flow").innerHTML = `<div class="chart-empty">โหลดข้อมูลไม่สำเร็จ</div>`;
  });
})();
