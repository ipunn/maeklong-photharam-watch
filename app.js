// Renders the committed history files under data/ as station cards + trend
// charts. Static, client-side only — reads a local file the GitHub Action
// already scraped and committed; never fetches ThaiWater/EGAT directly from
// the browser.
(function () {
  // Any data older than 6 hours is highlighted, never hidden or shown as fresh.
  const STALE_MINUTES = 6 * 60;
  const STALE_TEXT = "ข้อมูลอาจไม่อัพเดทล่าสุด";

  // Upstream first, so the cards read top-to-bottom as the water flows down to the user.
    const STATIONS = [
    { file: "data/pak-saeng.json", name: "บ้านปากแซง (แควน้อย, อ.ไทรโยค)", role: "ต้นน้ำไกล", staleMinutes: STALE_MINUTES },
    { file: "data/wang-khanai.json", name: "บ้านวังขนาย (แม่กลอง, อ.ท่าม่วง)", role: "ใกล้ท้ายเขื่อนแม่กลอง", staleMinutes: STALE_MINUTES },
    { file: "data/khai-luang.json", name: "สะพานค่ายหลวง (อ.บ้านโป่ง)", role: "ต้นน้ำ", staleMinutes: STALE_MINUTES },
    { file: "data/photharam.json", name: "โพธาราม (เจ็ดเสมียน, อ.โพธาราม)", role: "ปลายน้ำ", staleMinutes: STALE_MINUTES },
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
    { file: "data/reservoir-vajiralongkorn.json", hourlyFile: "data/dam-hourly-vajiralongkorn.json", name: "เขื่อนวชิราลงกรณ", staleMinutes: STALE_MINUTES },
    { file: "data/reservoir-srinakarin.json", hourlyFile: "data/dam-hourly-srinakarin.json", name: "เขื่อนศรีนครินทร์", staleMinutes: STALE_MINUTES },
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
      <div class="station-meta" data-stale="${stale}">${formatAge(mins)}${stale ? ` — ${STALE_TEXT}` : ""}</div>
      ${renderChart(history)}
    `;
    return card;
  }

  const HOURLY_STALE_MINUTES = STALE_MINUTES;

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
      ? `ThaiWater (รายชั่วโมง) ณ ${asOf} (ผ่านมา ${formatDuration(mins)})${stale ? ` — ${STALE_TEXT}` : ""}`
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
      ? `ข้อมูลรายวันของ กฟผ. ณ ${asOf} (ผ่านมา ${formatDuration(mins)})${stale ? ` — ${STALE_TEXT}` : ""}`
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
  // Only points that update automatically appear here. Trends come from the source's
  // own timestamps, over the data we really have (the real span is printed). No
  // official thresholds exist for these gauges, so there is deliberately NO danger
  // colour: direction of change only.
  const TREND_WINDOW_H = 3;
  const GAUGE_STEADY_M = 0.02; // <= 2 cm over the span reads as "steady"
  const RELEASE_STEADY_M3S = 10;

  // The two upstream rivers are PARALLEL, not in sequence: they merge at Kanchanaburi
  // into the Mae Klong, so they are drawn as separate branches, then one main line.
  const BRANCHES = [
    { title: "สายแควใหญ่", nodes: [{ kind: "dam", name: "เขื่อนศรีนครินทร์", res: RESERVOIRS[1] }] },
    {
      title: "สายแควน้อย",
      nodes: [
        { kind: "dam", name: "เขื่อนวชิราลงกรณ", res: RESERVOIRS[0] },
        { kind: "gauge", station: STATIONS[0] },
      ],
    },
  ];
  const MERGE_TEXT = "แควใหญ่และแควน้อยไหลมารวมกันที่ จ.กาญจนบุรี กลายเป็นแม่น้ำแม่กลอง";
  const MAIN = [
    { kind: "gauge", station: STATIONS[1] },
    { kind: "gauge", station: STATIONS[2] },
    { kind: "you", name: "พื้นที่ของคุณ", text: "อำเภอโพธาราม จังหวัดราชบุรี" },
    { kind: "gauge", station: STATIONS[3] },
  ];
  const FLOW = [...BRANCHES.flatMap((b) => b.nodes), ...MAIN];

  const TYPE_LABEL = { dam: "🏞️ เขื่อน", gauge: "📏 จุดวัดระดับน้ำในแม่น้ำ" };
  const TREND_TEXT = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] };

  // Gauges: centimetres and cm/hour (people read cm, not "0.13 m"). Dams: m3/s.
  function trendHtml(t, kind) {
    if (!t) return `<span class="trend" data-dir="none">ยังไม่มีข้อมูลพอเทียบแนวโน้ม</span>`;
    const [arrow, word] = TREND_TEXT[t.direction];
    const span = `ใน ${t.spanHours.toFixed(1)} ชม.ที่ผ่านมา`;
    if (t.direction === "steady") return `<span class="trend" data-dir="steady">${arrow} ${word} ${span}</span>`;
    if (kind === "dam") {
      return `<span class="trend" data-dir="${t.direction}">${arrow} อัตราระบาย${word} ${Math.abs(Math.round(t.delta))} ลบ.ม./วินาที ${span}</span>`;
    }
    const cm = Math.abs(t.delta) * 100;
    const perHour = cm / t.spanHours;
    return `<span class="trend" data-dir="${t.direction}">${arrow} ${word} ${Math.round(cm)} ซม. ${span} (≈ ${perHour.toFixed(1)} ซม./ชม.)</span>`;
  }

  function freshnessHtml(d) {
    const age = d.asOf ? `ข้อมูล ณ ${d.asOf} (ผ่านมา ${formatDuration(d.mins)})` : "ไม่ทราบเวลาของข้อมูล";
    const warn = d.stale ? ` <span class="stale-badge">⚠ ${STALE_TEXT}</span>` : "";
    return `<div class="flow-meta" data-stale="${d.stale}">${age}${warn}</div>`;
  }

  function flowNodeHtml(node, d) {
    if (node.kind === "you") {
      return `<li class="flow-node flow-you"><div class="flow-type">📍 พื้นที่ของคุณ</div><div class="flow-name">${node.text}</div></li>`;
    }
    const type = `<div class="flow-type" data-type="${node.kind}">${TYPE_LABEL[node.kind]}</div>`;
    const st = node.station;
    const title = node.kind === "dam" ? node.name : `${st.name} <span class="flow-role">${st.role}</span>`;
    if (!d) {
      return `<li class="flow-node">${type}<div class="flow-name">${title}</div><div class="flow-meta">ไม่มีข้อมูล</div></li>`;
    }
    const cls = d.stale ? "flow-node flow-stale" : "flow-node";
    if (node.kind === "dam") {
      const cap = d.capacity
        ? `<div class="flow-value"><span class="flow-label">น้ำในเขื่อน</span> ${d.capacity.percent.toFixed(1)} <span class="unit">% ของความจุ</span></div>
           <div class="flow-meta">รับน้ำได้อีก ≈ ${Math.round(d.capacity.remainingMcm)} ล้าน ลบ.ม.</div>`
        : `<div class="flow-meta">ไม่มีข้อมูลความจุรายชั่วโมง</div>`;
      const release = d.latest.releaseM3s == null ? "ไม่มีข้อมูล" : `≈ ${d.latest.releaseM3s} <span class="unit">ลบ.ม./วินาที</span>`;
      return `<li class="${cls}">${type}<div class="flow-name">${title}</div>${cap}
        <div class="flow-value"><span class="flow-label">ระบายน้ำลงแม่น้ำ</span> ${release}</div>
        <div class="flow-meta">${trendHtml(d.trend, "dam")}</div>${freshnessHtml(d)}</li>`;
    }
    return `<li class="${cls}">${type}<div class="flow-name">${title}</div>
      <div class="flow-value"><span class="flow-label">ระดับผิวน้ำ</span> ${d.latest.levelMsl.toFixed(2)} <span class="unit">ม. เหนือระดับทะเลปานกลาง</span></div>
      <div class="flow-meta">${trendHtml(d.trend, "gauge")}</div>${freshnessHtml(d)}</li>`;
  }

  async function nodeData(node) {
    if (node.kind === "dam") {
      const rows = await getHistory(node.res.hourlyFile).catch(() => []);
      const latest = rows[rows.length - 1];
      if (!latest) return null;
      // Capacity comes from EGAT's row (latest one that carries storage in MCM).
      const egat = await getHistory(node.res.file).catch(() => []);
      const egatRow = [...egat].reverse().find((r) => typeof r.storageMcm === "number");
      const mins = ageMinutes(latest.reportedAt);
      return {
        latest,
        trend: trendOf(rows, "releaseM3s", "reportedAt", TREND_WINDOW_H, RELEASE_STEADY_M3S),
        capacity: egatRow ? damCapacity(latest.storageMcm, egatRow.storageMcm, egatRow.storagePercent) : null,
        mins,
        stale: !(mins <= STALE_MINUTES),
        asOf: latest.reportedAt ? formatReportTime(latest.reportedAt) : null,
      };
    }
    const rows = await getHistory(node.station.file).catch(() => []);
    const latest = rows[rows.length - 1];
    if (!latest || typeof latest.levelMsl !== "number") return null;
    const mins = ageMinutes(latest.updatedAt);
    return {
      latest,
      trend: trendOf(rows, "levelMsl", "updatedAt", TREND_WINDOW_H, GAUGE_STEADY_M),
      mins,
      stale: !(mins <= STALE_MINUTES),
      asOf: latest.updatedAt ? formatReportTime(latest.updatedAt) : null,
    };
  }

  async function renderFlow() {
    const root = document.getElementById("flow");
    const datas = new Map();
    await Promise.all(
      FLOW.filter((n) => n.kind !== "you").map(async (n) => datas.set(n, await nodeData(n).catch(() => null))),
    );
    const list = (nodes) => `<ol class="flow">${nodes.map((n) => flowNodeHtml(n, datas.get(n))).join("")}</ol>`;
    const gaugeTrends = FLOW.filter((n) => n.kind === "gauge" && datas.get(n)).map((n) => datas.get(n).trend);
    const count = (dir) => gaugeTrends.filter((t) => t && t.direction === dir).length;
    const unknown = gaugeTrends.filter((t) => !t).length;
    const summary = `จุดวัดระดับน้ำ ${gaugeTrends.length} แห่ง: ▲ สูงขึ้น ${count("rising")} · ► ทรงตัว ${count("steady")} · ▼ ลดลง ${count("falling")}${unknown ? ` · ยังเทียบไม่ได้ ${unknown}` : ""}`;
    root.innerHTML = `<div class="flow-summary">${summary}</div>
      <div class="branches">${BRANCHES.map((b) => `<div class="branch"><div class="branch-title">${b.title}</div>${list(b.nodes)}</div>`).join("")}</div>
      <div class="merge">⬇ ${MERGE_TEXT}</div>
      <div class="branch-title main-title">แม่น้ำแม่กลอง</div>${list(MAIN)}`;
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
