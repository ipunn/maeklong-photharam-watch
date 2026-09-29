// Renders the committed history files under data/ as station cards + trend
// charts. Static, client-side only — reads a local file the GitHub Action
// already scraped and committed; never fetches ThaiWater/EGAT directly from
// the browser.
(function () {
  // A reading older than the station's own reporting cadence (plus slack) is
  // flagged, not hidden. Cadence differs per gauge, so it is per-station.

  // Upstream first, so the cards read top-to-bottom as the water flows down to the user.
  // Hourly gauges report about hourly (90 min slack); โพธาราม about every 10 min.
  const STATIONS = [
    { file: "data/pak-saeng.json", name: "บ้านปากแซง (แควน้อย, อ.ไทรโยค)", role: "ต้นน้ำไกล", staleMinutes: 90 },
    { file: "data/wang-khanai.json", name: "บ้านวังขนาย (แม่กลอง, อ.ท่าม่วง)", role: "ใกล้ท้ายเขื่อนแม่กลอง", staleMinutes: 90 },
    { file: "data/khai-luang.json", name: "สะพานค่ายหลวง (อ.บ้านโป่ง)", role: "ต้นน้ำ", staleMinutes: 90 },
    { file: "data/photharam.json", name: "โพธาราม (เจ็ดเสมียน, อ.โพธาราม)", role: "ปลายน้ำ", staleMinutes: 30 },
  ];

  // One fetch per history file, shared by the river-line overview and the cards.
  const historyCache = new Map();
  function getHistory(file) {
    if (!historyCache.has(file)) {
      historyCache.set(
        file,
        fetch(file, { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`);
          return res.json();
        }),
      );
    }
    return historyCache.get(file);
  }

  function ageMinutes(iso) {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return Infinity;
    return (Date.now() - ms) / 60000;
  }

  function formatDuration(mins) {
    if (mins < 60) return `${Math.round(mins)} นาที`;
    const hours = mins / 60;
    if (hours < 24) return `${hours.toFixed(1)} ชั่วโมง`;
    return `${(hours / 24).toFixed(1)} วัน`;
  }

  function formatAge(mins) {
    if (!Number.isFinite(mins)) return "ไม่ทราบเวลาที่อัปเดต";
    return `อัปเดตเมื่อ ${formatDuration(mins)}ที่แล้ว`;
  }

  // EGAT publishes a daily report; its figures are "as of" the report time, not
  // the time we scraped it. A 00:00 report time means "end of the previous day".
  function formatReportTime(iso) {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return null;
    const fmt = (opts) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", ...opts });
    const dateOpts = { day: "numeric", month: "short", year: "numeric" };
    const parts = fmt({ hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(ms);
    const hour = Number(parts.find((p) => p.type === "hour").value);
    const minute = Number(parts.find((p) => p.type === "minute").value);
    if (hour === 0 && minute === 0) return `สิ้นวันที่ ${fmt(dateOpts).format(ms - 60000)}`;
    const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return `${fmt(dateOpts).format(ms)} ${clock} น.`;
  }

  const STATUS_LABEL = {
    red: "วิกฤต",
    yellow: "เฝ้าระวัง",
    green: "ปกติ",
  };

  // Upstream context, not a river reading: rendered in its own section.
  // Each dam has two sources: ThaiWater's hourly feed (headline release, own
  // timestamp, 3 h slack) and EGAT's daily report (storage %). Freshness of each is
  // judged from its OWN as-of time, never from scrapedAt. Freshness for EGAT is judged from the report's own as-of time
  // (reportedAt), with a day and a half of slack before flagging it.
  const RESERVOIRS = [
    { file: "data/reservoir-vajiralongkorn.json", hourlyFile: "data/dam-hourly-vajiralongkorn.json", name: "เขื่อนวชิราลงกรณ", staleMinutes: 36 * 60 },
    { file: "data/reservoir-srinakarin.json", hourlyFile: "data/dam-hourly-srinakarin.json", name: "เขื่อนศรีนครินทร์", staleMinutes: 36 * 60 },
  ];

  function renderChart(history, key = "levelMsl") {
    if (history.length < 2) {
      return `<div class="chart-empty">ยังไม่มีข้อมูลย้อนหลังพอสำหรับกราฟแนวโน้ม</div>`;
    }
    const w = 600;
    const h = 120;
    const pad = 8;
    const levels = history.map((r) => r[key]).filter((v) => typeof v === "number");
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    const range = max - min || 1;

    const points = history
      .map((r, i) => {
        const x = pad + (i / (history.length - 1)) * (w - pad * 2);
        const y = h - pad - ((r[key] - min) / range) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline class="chart-line" points="${points}" />
    </svg>`;
  }

  function stationNameHtml(name, role) {
    return `<span class="station-name">${name} <span class="station-role">${role}</span></span>`;
  }

  async function loadStation({ file, name, role, staleMinutes }) {
    const history = await getHistory(file);
    const latest = history[history.length - 1];

    const card = document.createElement("div");
    card.className = "station-card";

    if (!latest) {
      card.innerHTML = `<div class="station-header">${stationNameHtml(name, role)}</div>
        <div class="chart-empty">ยังไม่มีข้อมูล</div>`;
      return card;
    }

    const mins = ageMinutes(latest.updatedAt);
    const stale = mins > staleMinutes;
    const statusLabel = latest.status ? STATUS_LABEL[latest.status] : "ไม่มีเกณฑ์เปรียบเทียบ";

    card.innerHTML = `
      <div class="station-header">
        ${stationNameHtml(name, role)}
        <span class="status-dot" data-status="${latest.status || ""}" title="${statusLabel}"></span>
      </div>
      <div class="station-level">${latest.levelMsl.toFixed(2)} <span class="unit">ม.รทก.</span></div>
      <div class="station-meta" data-stale="${stale}">${formatAge(mins)}${stale ? " — ข้อมูลอาจไม่ล่าสุด" : ""}</div>
      ${renderChart(history)}
    `;
    return card;
  }

  const HOURLY_STALE_MINUTES = 180;

  // The hourly feed is an extra: if it fails, the card still shows EGAT's data.
  async function fetchHourlyHistory(file) {
    try {
      return await getHistory(file);
    } catch (err) {
      return [];
    }
  }

  function renderHourlyRelease(hourly) {
    const latest = hourly[hourly.length - 1];
    if (!latest || latest.releaseMcm == null) {
      return `<div class="reservoir-stats"><div><span class="stat-label">อัตราระบายรายชั่วโมง</span> ไม่มีข้อมูล</div></div>`;
    }
    const mins = ageMinutes(latest.reportedAt);
    const stale = !(mins <= HOURLY_STALE_MINUTES);
    const asOf = latest.reportedAt ? formatReportTime(latest.reportedAt) : null;
    const meta = asOf
      ? `ThaiWater (รายชั่วโมง) ณ ${asOf} (ผ่านมา ${formatDuration(mins)})${stale ? " — ข้อมูลเก่า อาจไม่ล่าสุด" : ""}`
      : "ไม่ทราบเวลาของข้อมูล — อย่าใช้เป็นข้อมูลล่าสุด";
    return `<div class="reservoir-stats">
        <div><span class="stat-label">อัตราระบาย (ล่าสุด)</span> ≈ ${latest.releaseM3s} <span class="unit">ลบ.ม./วินาที</span>
          <span class="unit">(${latest.releaseMcm.toFixed(2)} ล้าน ลบ.ม./ชม.)</span></div>
      </div>
      <div class="station-meta" data-stale="${stale}">${meta}</div>
      ${renderChart(hourly, "releaseM3s")}`;
  }

  async function loadReservoir({ file, hourlyFile, name, staleMinutes }) {
    const history = await getHistory(file);
    const hourly = await fetchHourlyHistory(hourlyFile);
    const latest = history[history.length - 1];

    const card = document.createElement("div");
    card.className = "station-card";

    if (!latest) {
      card.innerHTML = `<div class="station-header"><span class="station-name">${name}</span></div>
        <div class="chart-empty">ยังไม่มีข้อมูล</div>`;
      return card;
    }

    // Freshness is the report's own as-of time, never scrapedAt: the page is a
    // daily report, so "scraped 2 minutes ago" says nothing about the figures' age.
    const mins = ageMinutes(latest.reportedAt);
    const asOf = latest.reportedAt ? formatReportTime(latest.reportedAt) : null;
    const stale = !asOf || mins > staleMinutes;
    const fmt = (v, digits) => (typeof v === "number" ? v.toFixed(digits) : "–");
    const metaText = asOf
      ? `ข้อมูลรายวันของ กฟผ. ณ ${asOf} (ผ่านมา ${formatDuration(mins)})${stale ? " — ข้อมูลเก่ากว่า 1 วัน อาจไม่ล่าสุด" : ""}`
      : "ไม่ทราบวันที่ของข้อมูล — อย่าใช้เป็นข้อมูลล่าสุด";

    card.innerHTML = `
      <div class="station-header"><span class="station-name">${name}</span></div>
      ${renderHourlyRelease(hourly)}
      <div class="station-level">${fmt(latest.storagePercent, 2)} <span class="unit">% ของความจุ</span></div>
      <div class="reservoir-stats">
        <div><span class="stat-label">ระดับน้ำ</span> ${fmt(latest.levelMsl, 2)} <span class="unit">ม.รทก.</span></div>
        <div><span class="stat-label">อัตราระบายเฉลี่ยรายวัน (กฟผ.)</span> ${fmt(latest.releaseRateM3s, 2)} <span class="unit">ลบ.ม./วินาที</span></div>
      </div>
      <div class="station-meta" data-stale="${stale}">${metaText}</div>
      ${renderChart(history, "storagePercent")}
    `;
    return card;
  }


  // ---- River line: every measuring point in flow order, upstream -> downstream ----
  // Trends are computed only from the source's own timestamps and only over the data
  // we really have (the real span is printed). No official thresholds exist for these
  // gauges, so there is deliberately NO danger colour: direction of change only.
  const GAUGE_TREND_WINDOW_H = 3;
  const GAUGE_STEADY_M = 0.02; // <= 2 cm over the span reads as "steady"
  const RELEASE_STEADY_M3S = 10;

  const FLOW = [
    { kind: "dam", branch: "แควใหญ่", name: "เขื่อนศรีนครินทร์", hourlyFile: RESERVOIRS[1].hourlyFile },
    { kind: "dam", branch: "แควน้อย", name: "เขื่อนวชิราลงกรณ", hourlyFile: RESERVOIRS[0].hourlyFile },
    { kind: "gauge", branch: "แควน้อย", station: STATIONS[0] },
    {
      kind: "gap",
      branch: "แม่กลอง",
      name: "เขื่อนแม่กลอง",
      text: "ไม่มีข้อมูลอัตโนมัติ — อัตราระบายต้องดูจากประกาศของกรมชลประทาน/จังหวัด/ปภ.",
    },
    { kind: "gauge", branch: "แม่กลอง", station: STATIONS[1] },
    { kind: "gauge", branch: "แม่กลอง", station: STATIONS[2] },
    { kind: "you", name: "พื้นที่ของคุณ", text: "อำเภอโพธาราม จังหวัดราชบุรี" },
    { kind: "gauge", branch: "แม่กลอง", station: STATIONS[3] },
  ];

  const TREND_TEXT = { rising: ["▲", "เพิ่มขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] };

  function trendHtml(t, unit, digits) {
    if (!t) return `<span class="trend" data-dir="none">ยังไม่มีข้อมูลพอเทียบแนวโน้ม</span>`;
    const [arrow, word] = TREND_TEXT[t.direction];
    const amount = t.direction === "steady" ? "" : ` ${Math.abs(t.delta).toFixed(digits)} ${unit}`;
    return `<span class="trend" data-dir="${t.direction}">${arrow} ${word}${amount} ใน ${t.spanHours.toFixed(1)} ชม.ที่ผ่านมา</span>`;
  }

  function flowNodeHtml(node, data) {
    if (node.kind === "you") {
      return `<li class="flow-node flow-you"><div class="flow-name">📍 ${node.name}</div><div class="flow-meta">${node.text}</div></li>`;
    }
    if (node.kind === "gap") {
      return `<li class="flow-node flow-gap"><div class="flow-name"><span class="flow-branch">${node.branch}</span> ${node.name}</div><div class="flow-meta">${node.text}</div></li>`;
    }
    if (!data || !data.latest) {
      const name = node.kind === "dam" ? node.name : node.station.name;
      return `<li class="flow-node"><div class="flow-name">${name}</div><div class="flow-meta">ไม่มีข้อมูล</div></li>`;
    }
    const { latest, trend, stale, asOf } = data;
    const age = asOf ? `ข้อมูล ณ ${asOf}` : "ไม่ทราบเวลาของข้อมูล";
    const staleNote = stale ? " — ข้อมูลเก่า อาจไม่ล่าสุด" : "";
    if (node.kind === "dam") {
      const release = latest.releaseM3s == null ? "ไม่มีข้อมูล" : `≈ ${latest.releaseM3s} <span class="unit">ลบ.ม./วินาที</span>`;
      return `<li class="flow-node"><div class="flow-name"><span class="flow-branch">${node.branch}</span> ${node.name} <span class="flow-role">เขื่อน</span></div>
        <div class="flow-value"><span class="flow-label">ระบายน้ำ</span> ${release}</div>
        <div class="flow-meta">${trendHtml(trend, "ลบ.ม./วินาที", 0)}</div>
        <div class="flow-meta" data-stale="${stale}">${age}${staleNote}</div></li>`;
    }
    const st = node.station;
    return `<li class="flow-node"><div class="flow-name"><span class="flow-branch">${node.branch}</span> ${st.name} <span class="flow-role">${st.role}</span></div>
      <div class="flow-value"><span class="flow-label">ระดับน้ำ</span> ${latest.levelMsl.toFixed(2)} <span class="unit">ม.รทก.</span></div>
      <div class="flow-meta">${trendHtml(trend, "ม.", 2)}</div>
      <div class="flow-meta" data-stale="${stale}">${age}${staleNote}</div></li>`;
  }

  async function nodeData(node) {
    if (node.kind === "dam") {
      const rows = await getHistory(node.hourlyFile).catch(() => []);
      const latest = rows[rows.length - 1];
      if (!latest) return null;
      const mins = ageMinutes(latest.reportedAt);
      return {
        latest,
        trend: trendOf(rows, "releaseM3s", "reportedAt", GAUGE_TREND_WINDOW_H, RELEASE_STEADY_M3S),
        stale: !(mins <= HOURLY_STALE_MINUTES),
        asOf: latest.reportedAt ? formatReportTime(latest.reportedAt) : null,
      };
    }
    const rows = await getHistory(node.station.file).catch(() => []);
    const latest = rows[rows.length - 1];
    if (!latest || typeof latest.levelMsl !== "number") return null;
    const mins = ageMinutes(latest.updatedAt);
    return {
      latest,
      trend: trendOf(rows, "levelMsl", "updatedAt", GAUGE_TREND_WINDOW_H, GAUGE_STEADY_M),
      stale: !(mins <= node.station.staleMinutes),
      asOf: latest.updatedAt ? formatReportTime(latest.updatedAt) : null,
    };
  }

  async function renderFlow() {
    const root = document.getElementById("flow");
    const datas = await Promise.all(FLOW.map((n) => (n.kind === "gauge" || n.kind === "dam" ? nodeData(n).catch(() => null) : null)));
    const gaugeTrends = FLOW.map((n, i) => (n.kind === "gauge" && datas[i] ? datas[i].trend : undefined)).filter((t) => t !== undefined);
    const count = (dir) => gaugeTrends.filter((t) => t && t.direction === dir).length;
    const unknown = gaugeTrends.filter((t) => !t).length;
    const summary = `สถานีวัดระดับน้ำ ${gaugeTrends.length} แห่ง: ▲ เพิ่มขึ้น ${count("rising")} · ► ทรงตัว ${count("steady")} · ▼ ลดลง ${count("falling")}${unknown ? ` · ยังเทียบไม่ได้ ${unknown}` : ""}`;
    root.innerHTML = `<div class="flow-summary">${summary}</div>
      <ol class="flow">${FLOW.map((n, i) => flowNodeHtml(n, datas[i])).join("")}</ol>`;
  }

  async function renderInto(rootId, items, load, nameHtml) {
    const root = document.getElementById(rootId);
    for (const item of items) {
      try {
        root.appendChild(await load(item));
      } catch (err) {
        const card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `<div class="station-header">${nameHtml(item)}</div>
          <div class="chart-empty">โหลดข้อมูลไม่สำเร็จ: ${err.message}</div>`;
        root.appendChild(card);
      }
    }
  }

  function main() {
    renderFlow().catch((err) => {
      document.getElementById("flow").innerHTML = `<div class="chart-empty">โหลดแผนภาพลำน้ำไม่สำเร็จ: ${err.message}</div>`;
    });
    renderInto("stations", STATIONS, loadStation, (s) => stationNameHtml(s.name, s.role));
    renderInto("reservoirs", RESERVOIRS, loadReservoir, (r) => `<span class="station-name">${r.name}</span>`);
  }

  main();
})();
