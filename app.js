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
    { file: "data/pak-saeng.json", name: "บ้านปากแซง", role: "", staleMinutes: STALE_MINUTES },
    { file: "data/wang-khanai.json", name: "บ้านวังขนาย", role: "ท้ายเขื่อนแม่กลอง", staleMinutes: STALE_MINUTES },
    { file: "data/khai-luang.json", name: "สะพานค่ายหลวง", role: "", staleMinutes: STALE_MINUTES },
    { file: "data/photharam.json", name: "โพธาราม", role: "", staleMinutes: STALE_MINUTES },
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
    return Math.max(0, (Date.now() - ms) / 60000);
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

  // Compact "as of": time only when it is today in Bangkok, otherwise the full date+time.
  function formatShortTime(iso) {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return null;
    const day = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(t);
    if (day(ms) !== day(Date.now())) return formatReportTime(iso);
    return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms) + " น.";
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
  // EGAT's table is a daily report stamped as of the previous midnight, so it is 6-30 h old
  // for most of every day by design. Flagging it at 6 h would fire all day and teach people
  // to ignore the warning; it gets a day and a half. The hourly feed uses the 6 h rule.
  const EGAT_DAILY_STALE_MINUTES = 36 * 60;
  const RESERVOIRS = [
    { file: "data/reservoir-vajiralongkorn.json", hourlyFile: "data/dam-hourly-vajiralongkorn.json", name: "เขื่อนวชิราลงกรณ", staleMinutes: EGAT_DAILY_STALE_MINUTES },
    { file: "data/reservoir-srinakarin.json", hourlyFile: "data/dam-hourly-srinakarin.json", name: "เขื่อนศรีนครินทร์", staleMinutes: EGAT_DAILY_STALE_MINUTES },
  ];

  function stationNameHtml(name, role) {
    return `<span class="station-name">${name}${role ? ` <span class="station-role">${role}</span>` : ""}</span>`;
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

    if (typeof latest.levelMsl !== "number") {
      card.innerHTML = `<div class="station-header">${stationNameHtml(name, role)}</div>
        <div class="chart-empty">ไม่มีข้อมูลระดับน้ำจากแหล่งข้อมูลในรอบล่าสุด</div>`;
      return card;
    }

    const mins = ageMinutes(latest.updatedAt);
    const stale = !(mins <= staleMinutes);
    const statusLabel = latest.status ? STATUS_LABEL[latest.status] : "ไม่มีเกณฑ์เปรียบเทียบ";

    card.innerHTML = `
      <div class="station-header">
        ${stationNameHtml(name, role)}
        <span class="status-dot" data-status="${latest.status || ""}" title="${statusLabel}"></span>
      </div>
      <div class="station-level">${latest.levelMsl.toFixed(2)} <span class="unit">ม.รทก.</span></div>
      <div class="station-meta" data-stale="${stale}">${formatAge(mins)}${stale ? ` — ${STALE_TEXT}` : ""}</div>
      ${sparklineHtml(history, "levelMsl", "updatedAt", "ระดับผิวน้ำ", "ม.", 2, 0.1, 24, true)}
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
      ${sparklineHtml(hourly, "releaseM3s", "reportedAt", "อัตราระบาย", "ลบ.ม./วินาที", 0, 50, 24, true)}`;
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
      ${sparklineHtml(history, "storagePercent", "reportedAt", "% ความจุ (รายงานรายวัน 1 จุด/วัน)", "%", 2, 1, 24 * 30)}
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
  const MERGE_TEXT = "<span class=\"merge-lead\">แควใหญ่ + แควน้อย รวมเป็น <b>แม่น้ำแม่กลอง</b> → </span>ผ่าน <b>เขื่อนแม่กลอง</b> (ไม่มีข้อมูลอัตโนมัติ) แล้วถึงจุดวัดด้านล่าง";
  // Phones stack the two branches, which reads as one line. This small Y diagram shows
  // two rivers converging into one. Hidden on wide screens, where the branches sit side
  // by side and a real join bar already shows it.
  const MERGE_DIAGRAM = `<div class="merge-diagram" aria-hidden="true">
      <div class="md-top"><span>แควใหญ่</span><span>แควน้อย</span></div>
      <svg viewBox="0 0 300 70" preserveAspectRatio="none">
        <path d="M50 0 C50 34 150 26 150 48 V70" /><path d="M250 0 C250 34 150 26 150 48" />
      </svg>
      <div class="md-bottom">รวมเป็นแม่น้ำแม่กลอง ที่ปากแพรก จ.กาญจนบุรี</div></div>`;
  const MAIN = [
    { kind: "gauge", station: STATIONS[1] },
    { kind: "gauge", station: STATIONS[2] },
    { kind: "you", name: "พื้นที่ของคุณ", text: "อำเภอโพธาราม จังหวัดราชบุรี" },
    { kind: "gauge", station: STATIONS[3] },
  ];
  const FLOW = [...BRANCHES.flatMap((b) => b.nodes), ...MAIN];

  const TYPE_LABEL = { dam: "เขื่อน", gauge: "จุดวัดระดับน้ำในแม่น้ำ" };
  const TREND_TEXT = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] };

  // Gauges: centimetres and cm/hour (people read cm, not "0.13 m"). Dams: m3/s.
  function trendHtml(t, kind) {
    if (!t) return `<span class="trend" data-dir="none">ยังไม่มีข้อมูลพอเทียบแนวโน้ม</span>`;
    const [arrow, word] = TREND_TEXT[t.direction];
    const span = `ใน ${t.spanHours.toFixed(1)} ชม.`;
    if (t.direction === "steady") return `<span class="trend" data-dir="steady">${arrow} ${word} ${span}</span>`;
    // The net change can hide a late reversal, so say so when the newest reading
    // moved against it (by at least the source's own 1 cm resolution).
    const against = t.direction === "rising" ? t.lastDelta < 0 : t.lastDelta > 0;
    const stepArrow = t.lastDelta < 0 ? "▼" : "▲";
    if (kind === "dam") {
      const note = against && Math.abs(t.lastDelta) >= RELEASE_STEADY_M3S
        ? ` <span class="trend-note">· รอบล่าสุด ${stepArrow} ${Math.abs(Math.round(t.lastDelta))} ลบ.ม./วินาที</span>` : "";
      return `<span class="trend" data-dir="${t.direction}">${arrow} อัตราระบาย${word} ${Math.abs(Math.round(t.delta))} ลบ.ม./วินาที ${span}</span>${note}`;
    }
    const cm = Math.abs(t.delta) * 100;
    const perHour = cm / t.spanHours;
    const note = against && Math.round(Math.abs(t.lastDelta) * 100) >= 1
      ? ` <span class="trend-note">· รอบล่าสุด ${stepArrow} ${Math.round(Math.abs(t.lastDelta) * 100)} ซม.</span>` : "";
    return `<span class="trend" data-dir="${t.direction}">${arrow} ${word} ${Math.round(cm)} ซม. ${span} (≈ ${perHour.toFixed(1)} ซม./ชม.)</span>${note}`;
  }

  // Small trend chart: x is real time (not index), only distinct source timestamps,
  // last 24 h. Caption prints the real span and first -> last so it can't overstate.
  function sparklineHtml(rows, valueKey, timeKey, label, unit, digits, minRange, windowHours = 24, hourlyAxis = false, compact = false) {
    const all = seriesOf(rows, valueKey, timeKey);
    const latestT = all.length ? all[all.length - 1].t : 0;
    const pts = all.filter((p) => p.t >= latestT - windowHours * 3600000);
    if (pts.length < 2) {
      return `<div class="spark"><div class="spark-label">${label}</div><div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงกราฟ</div></div>`;
    }
    const w = 300;
    const h = 56;
    const pad = 6;
    const t0 = pts[0].t;
    const tN = pts[pts.length - 1].t;
    const vs = pts.map((p) => p.v);
    // Never auto-zoom below a meaningful range, or a 1 cm wiggle looks like a collapse.
    let min = Math.min(...vs);
    let max = Math.max(...vs);
    if (max - min < minRange) {
      const mid = (min + max) / 2;
      min = mid - minRange / 2;
      max = mid + minRange / 2;
    }
    const range = max - min;
    const xy = pts.map((p) => [
      pad + ((p.t - t0) / (tN - t0)) * (w - pad * 2),
      h - pad - ((p.v - min) / range) * (h - pad * 2),
    ]);
    const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [ex, ey] = xy[xy.length - 1];
    const spanH = (tN - t0) / 3600000;
    // Hourly ticker: one tick per whole hour (Bangkok is UTC+7, a whole-hour offset).
    // Only for short windows; labels are HTML so the stretched svg cannot distort them.
    const HOUR = 3600000;
    const ticks = [];
    if (hourlyAxis && spanH <= 24) {
      for (let t = Math.ceil(t0 / HOUR) * HOUR; t <= tN; t += HOUR) {
        const frac = (t - t0) / (tN - t0);
        ticks.push({ x: pad + frac * (w - pad * 2), hour: (Math.floor(t / HOUR) + 7) % 24 });
      }
    }
    const grid = ticks.map((k) => `<line class="spark-grid" x1="${k.x.toFixed(1)}" y1="0" x2="${k.x.toFixed(1)}" y2="${h}" />`).join("");
    const axis = ticks.length
      ? `<div class="spark-axis${ticks.length > 6 ? " dense" : ""}">${ticks
          .map((k) => `<span class="tick" style="left:${((k.x / w) * 100).toFixed(2)}%">${String(k.hour).padStart(2, "0")}:00</span>`)
          .join("")}</div>`
      : "";
    return `<div class="spark">${compact ? "" : `<div class="spark-label">${label}</div>`}
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${label}">
        ${grid}<polyline class="spark-line" points="${line}" /><path class="spark-dot" d="M${ex.toFixed(1)} ${ey.toFixed(1)}h0" />
      </svg>${axis}
      ${compact ? "" : `<div class="spark-cap">${spanH > 48 ? `${(spanH / 24).toFixed(1)} วัน` : `${spanH.toFixed(1)} ชม.`}: ${pts[0].v.toFixed(digits)} → ${pts[pts.length - 1].v.toFixed(digits)} ${unit}</div>`}</div>`;
  }

  function freshnessHtml(d) {
    const age = d.asOf ? `ข้อมูล ${d.asOf} · ${formatDuration(d.mins)}ที่แล้ว` : "ไม่ทราบเวลาของข้อมูล";
    const warn = d.stale ? ` <span class="stale-badge">${STALE_TEXT}</span>` : "";
    return `<div class="flow-meta" data-stale="${d.stale}">${age}${warn}</div>`;
  }

  function flowNodeHtml(node, d, roleOverride) {
    if (node.kind === "you") {
      return `<li class="flow-node flow-you"><div class="flow-type">พื้นที่ของคุณ</div><div class="flow-name">${node.text}</div></li>`;
    }
    const type = `<div class="flow-type" data-type="${node.kind}">${TYPE_LABEL[node.kind]}</div>`;
    const st = node.station;
    const role = roleOverride ?? (st && st.role);
    const title = node.kind === "dam" ? node.name : `${st.name}${role ? ` <span class="flow-role">${role}</span>` : ""}`;
    if (!d) {
      return `<li class="flow-node">${type}<div class="flow-name">${title}</div><div class="flow-meta">ไม่มีข้อมูล</div></li>`;
    }
    const cls = d.stale ? "flow-node flow-stale" : "flow-node";
    if (node.kind === "dam") {
      const band = d.capacity ? reservoirBand(d.capacity.percent) : null;
      const cap = d.capacity
        ? `<div class="flow-value"><span class="flow-label">น้ำในเขื่อน (ประมาณ)</span>
             <span class="band" data-band="${band.key}">${d.capacity.percent.toFixed(1)} <span class="unit">% ของความจุ</span></span></div>
           <div class="flow-meta"><span class="band-tag" data-band="${band.key}">${band.label}</span> · รับน้ำได้อีก ≈ ${Math.round(d.capacity.remainingMcm).toLocaleString("en-US")} ล้าน ลบ.ม.</div>`
        : `<div class="flow-meta">ไม่มีข้อมูลความจุรายชั่วโมง</div>`;
      const release = d.latest.releaseM3s == null ? "ไม่มีข้อมูล" : `≈ ${d.latest.releaseM3s} <span class="unit">ลบ.ม./วินาที</span>`;
      return `<li class="${cls}">${type}<div class="flow-name">${title}</div>
        <div class="flow-body"><div class="flow-text">${cap}
        <div class="flow-value"><span class="flow-label">ระบายน้ำลงแม่น้ำ</span> ${release}</div>
        <div class="flow-meta">${trendHtml(d.trend, "dam")}</div>${freshnessHtml(d)}</div></div></li>`;
    }
    return `<li class="${cls}">${type}<div class="flow-name">${title}</div>
      <div class="flow-body"><div class="flow-text">
      <div class="flow-value"><span class="flow-label">ระดับผิวน้ำ</span> ${d.latest.levelMsl.toFixed(2)} <span class="unit">ม. เหนือระดับทะเล</span></div>
      <div class="flow-meta">${trendHtml(d.trend, "gauge")}</div>${freshnessHtml(d)}</div>
      <div class="flow-sparks">${sparklineHtml(d.rows, "levelMsl", "updatedAt", "ระดับผิวน้ำ", "ม.", 2, 0.1, 12, true, true)}</div></div></li>`;
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
      const capacity = egatRow ? damCapacity(latest.storageMcm, egatRow.storageMcm, egatRow.storagePercent) : null;
      return {
        latest,
        rows,
        trend: trendOf(rows, "releaseM3s", "reportedAt", TREND_WINDOW_H, RELEASE_STEADY_M3S),
        capacity,
        mins,
        stale: !(mins <= STALE_MINUTES),
        asOf: latest.reportedAt ? formatShortTime(latest.reportedAt) : null,
      };
    }
    const rows = await getHistory(node.station.file).catch(() => []);
    const latest = rows[rows.length - 1];
    if (!latest || typeof latest.levelMsl !== "number") return null;
    const mins = ageMinutes(latest.updatedAt);
    return {
      latest,
      rows,
      trend: trendOf(rows, "levelMsl", "updatedAt", TREND_WINDOW_H, GAUGE_STEADY_M),
      mins,
      stale: !(mins <= STALE_MINUTES),
      asOf: latest.updatedAt ? formatShortTime(latest.updatedAt) : null,
    };
  }

  async function renderFlow() {
    const root = document.getElementById("flow");
    const datas = new Map();
    await Promise.all(
      FLOW.filter((n) => n.kind !== "you").map(async (n) => datas.set(n, await nodeData(n).catch(() => null))),
    );
    const items = (nodes) => nodes.map((n) => flowNodeHtml(n, datas.get(n))).join("");
    // Situation card: what matters most for the user's area first (Photharam, the gauge in
    // the area, and สะพานค่ายหลวง, the nearest gauge upstream of it), then a plain summary
    // of the upstream signal. Facts only: counts and figures, no risk verdict.
    const here = document.getElementById("here");
    if (here) {
      const nodeOf = (st) => FLOW.find((n) => n.station === st);
      const phNode = nodeOf(STATIONS[3]);
      const bpNode = nodeOf(STATIONS[2]);
      const upstreamGauges = FLOW.filter((n) => n.kind === "gauge" && n.station !== STATIONS[3] && datas.get(n));
      const upTrends = upstreamGauges.map((n) => datas.get(n).trend);
      const count = (dir) => upTrends.filter((t) => t && t.direction === dir).length;
      const unknown = upTrends.filter((t) => !t).length;
      const staleUp = upstreamGauges.filter((n) => datas.get(n).stale).length;
      const damLines = FLOW.filter((n) => n.kind === "dam" && datas.get(n) && datas.get(n).latest.releaseM3s != null)
        .map((n) => `${n.name.replace("เขื่อน", "")} ≈ ${datas.get(n).latest.releaseM3s.toLocaleString("en-US")}${datas.get(n).stale ? ` (${STALE_TEXT})` : ""}`);
      here.innerHTML = `<h2 class="section-title">พื้นที่เฝ้าระวัง <span class="here-sub">อ.โพธาราม จ.ราชบุรี</span></h2>
        <ul class="here-grid">${flowNodeHtml(phNode, datas.get(phNode), "ในพื้นที่ / ท้ายน้ำ")}${flowNodeHtml(bpNode, datas.get(bpNode), "เหนือน้ำใกล้สุด")}</ul>
        <div class="here-summary">
          <div><b>สัญญาณจากต้นน้ำ</b> — จุดวัด ${upstreamGauges.length} แห่งเหนือพื้นที่ของคุณ: ▲ สูงขึ้น ${count("rising")} · ► ทรงตัว ${count("steady")} · ▼ ลดลง ${count("falling")}${unknown ? ` · ยังเทียบไม่ได้ ${unknown}` : ""}${staleUp ? ` · <span class="health-warn">${STALE_TEXT} ${staleUp} จุด</span>` : ""}</div>
          ${damLines.length ? `<div>เขื่อนระบายน้ำ (ลบ.ม./วินาที): ${damLines.join(" · ")}</div>` : ""}
          <div class="here-more">ดูต้นน้ำและเขื่อนเพิ่มเติมด้านล่าง</div>
        </div>`;
    }
    // One continuous line per river: each branch's line runs down into the merge point,
    // and the Mae Klong line continues from it — so nothing looks disconnected.
    const branch = (b, i) => `<div class="branch" data-branch="${i}"><div class="branch-title">${b.title}</div>
        <ol class="flow">${items(b.nodes)}</ol></div>`;
    root.innerHTML = `<div class="branches">${BRANCHES.map(branch).join("")}</div>
      ${MERGE_DIAGRAM}
      <ol class="flow flow-main"><li class="flow-merge">${MERGE_TEXT}</li>${items(MAIN)}</ol>`;
  }

  // ---- Collector health: is each automatic source still being collected? ----
  // data/status.json holds, per source, when it last SUCCEEDED (the scraper only advances a
  // source's time when that source was fetched and parsed). That is separate from each
  // card's data age (how old the SOURCE's own reading is), and one dead source cannot hide
  // behind the others.
  const COLLECTOR_WARN_MINUTES = 45; // the schedule is every 15 min; allow for GitHub delays
  const SOURCE_LABELS = {
    river: "ระดับน้ำแม่น้ำ (ThaiWater)",
    reservoir: "เขื่อนรายวัน (กฟผ.)",
    damHourly: "เขื่อนรายชั่วโมง (ThaiWater)",
  };
  let collectorStatus = null;

  function renderHealth() {
    const el = document.getElementById("health");
    if (!el) return;
    if (!collectorStatus) {
      el.innerHTML = `<span class="health-warn">ไม่ทราบสถานะตัวดึงข้อมูลอัตโนมัติ — ข้อมูลอาจไม่อัพเดทล่าสุด</span>`;
      return;
    }
    const now = Date.now();
    const per = Object.entries(SOURCE_LABELS).map(([key, label]) => ({
      label,
      h: collectorHealth([collectorStatus[key]], now, COLLECTOR_WARN_MINUTES),
    }));
    const bad = per.filter((x) => x.h.status !== "ok");
    if (bad.length) {
      const parts = bad.map((x) =>
        x.h.status === "unknown" ? `${x.label} ไม่ทราบเวลา` : `${x.label} ไม่สำเร็จมาแล้ว ${formatDuration(x.h.ageMinutes)}`,
      );
      el.innerHTML = `<span class="health-warn">ตัวดึงข้อมูลอัตโนมัติมีปัญหา: ${parts.join(" · ")} — ข้อมูลของแหล่งนั้นอาจไม่อัพเดทล่าสุด</span>`;
      return;
    }
    const newest = per.reduce((a, x) => (x.h.ageMinutes < a.h.ageMinutes ? x : a));
    el.innerHTML = `ตัวดึงข้อมูลอัตโนมัติ: ดึงสำเร็จล่าสุดเมื่อ ${formatDuration(newest.h.ageMinutes)}ที่แล้ว (${formatShortTime(newest.h.latest)})`;
  }

  async function loadHealth() {
    try {
      const res = await fetch("data/status.json", { cache: "no-store" });
      collectorStatus = res.ok ? await res.json() : null;
    } catch (err) {
      collectorStatus = null;
    }
    renderHealth();
    setInterval(renderHealth, 60000); // keep the age current if the page stays open
  }

  async function renderInto(rootId, items, load, nameHtml) {
    const root = document.getElementById(rootId);
    for (const item of items) {
      try {
        root.appendChild(await load(item));
      } catch (err) {
        console.error(err);
        const card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `<div class="station-header">${nameHtml(item)}</div>
          <div class="chart-empty">โหลดข้อมูลไม่สำเร็จ</div>`;
        root.appendChild(card);
      }
    }
  }

  function main() {
    loadHealth();
    renderFlow().catch((err) => {
      console.error(err);
      document.getElementById("flow").innerHTML = `<div class="chart-empty">โหลดแผนภาพลำน้ำไม่สำเร็จ</div>`;
    });
    renderInto("stations", STATIONS, loadStation, (s) => stationNameHtml(s.name, s.role));
    renderInto("reservoirs", RESERVOIRS, loadReservoir, (r) => `<span class="station-name">${r.name}</span>`);
  }

  main();
})();
