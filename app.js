// Renders the committed history files under data/ as station cards + trend
// charts. Static, client-side only — reads a local file the GitHub Action
// already scraped and committed; never fetches ThaiWater/EGAT directly from
// the browser.
(function () {
  // Any data older than 6 hours is highlighted, never hidden or shown as fresh.
  const STALE_MINUTES = 6 * 60;
  const STALE_TEXT = "ข้อมูลอาจไม่อัพเดทล่าสุด";

  // A level the page marks on a gauge's chart so people can see how far the water is from it. The
  // maintainer's own line (Photharam: 6.00 m), NOT an official threshold, and never a Status.
  const REFERENCE_NOTE = "เส้นอ้างอิงที่ตั้งไว้ในเว็บนี้ ไม่ใช่เกณฑ์ทางการ";

  // Upstream first, so the cards read top-to-bottom as the water flows down to the user.
  const STATIONS = [
    { file: "data/pak-saeng.json", name: "บ้านปากแซง", role: "", staleMinutes: STALE_MINUTES },
    { file: "data/wang-khanai.json", name: "บ้านวังขนาย", role: "ท้ายเขื่อนแม่กลอง", staleMinutes: STALE_MINUTES },
    { file: "data/khai-luang.json", name: "สะพานค่ายหลวง", role: "", staleMinutes: STALE_MINUTES },
    { file: "data/photharam.json", name: "โพธาราม", role: "", staleMinutes: STALE_MINUTES, reference: { v: 6, note: REFERENCE_NOTE } },
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

  // How far a level is from the page's reference line, as a fact (never a Status). Empty without one.
  function referenceHtml(levelMsl, reference, cls) {
    const c = reference && bankComparison(levelMsl, reference.v);
    if (!c) return "";
    const rel = c.direction === "at" ? "เท่ากับเส้นอ้างอิง" : `${c.direction === "above" ? "สูงกว่า" : "ต่ำกว่า"}เส้นอ้างอิง ${c.diffM.toFixed(2)} ม.`;
    return `<div class="${cls}">เส้นอ้างอิง ${reference.v.toFixed(2)} ม.รทก. · ระดับปัจจุบัน${rel} <span class="unit">(${reference.note})</span></div>`;
  }

  async function loadStation({ file, name, role, staleMinutes, reference }) {
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
      ${referenceHtml(latest.levelMsl, reference, "station-meta")}
      ${sparklineHtml(history, "levelMsl", "updatedAt", "ระดับผิวน้ำ", "ม.รทก.", 2, 0.1, windowH, true, false, reference)}
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
      ${sparklineHtml(hourly, "releaseM3s", "reportedAt", "อัตราระบาย", "ลบ.ม./วินาที", 0, 50, windowH, true)}`;
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
      ${barsHtml(history, "storagePercent", "reportedAt", "% ของความจุ (รายงานรายวัน สูงสุด 7 วัน)")}
    `;
    return card;
  }


  // ---- River line: every measuring point in flow order, upstream -> downstream ----
  // Only points that update automatically appear here. Trends come from the source's
  // own timestamps, over the data we really have (the real span is printed). No
  // official thresholds exist for these gauges, so there is deliberately NO danger
  // colour: direction of change only.
  // The Window (6 / 12 / 24 h, from the toggle) sets every chart and trend. "Steady" is judged
  // per Window (steadyTolerance in parse.js). The situation card's upstream summary is the one
  // exception: it always uses HEADLINE_WINDOW_H, so it never changes when the toggle does.
  let windowH = WindowToggle.current();
  const HEADLINE_WINDOW_H = 6;

  // River-line only (no detail card). K.37 is above the Mae Klong Dam (its level is higher than the
  // dam's), K.63 is 4.26 km below K.11A; both report a discharge. `capacityCode` links a gauge to
  // EGAT's Channel capacity row (data/egat-channel-capacity.json).
  const K37 = { file: "data/k37.json", name: "บ้านวังเย็น (K.37)", role: "เหนือเขื่อน (ตามระดับน้ำ)", staleMinutes: STALE_MINUTES, capacityCode: "VKD06" };
  const K63 = { file: "data/k63.json", name: "บ้านใหม่ (K.63)", role: "ท้ายจุด K.11A 4.26 กม.", staleMinutes: STALE_MINUTES };
  // The Barrage: a level and nothing else (no release, no gates, no stored volume).
  const BARRAGE = { file: "data/barrage-snd04.json", name: "เขื่อนแม่กลอง", code: "SND04" };

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
  const MERGE_TEXT = "<span class=\"merge-lead\">แควใหญ่ + แควน้อย รวมเป็น <b>แม่น้ำแม่กลอง</b> → </span>ผ่านจุดวัดด้านบน แล้วถึง <b>เขื่อนแม่กลอง</b> ก่อนถึงจุดวัดด้านล่าง";
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
    { kind: "gauge", station: K37 },
    { kind: "barrage", barrage: BARRAGE },
    { kind: "gauge", station: STATIONS[1] },
    { kind: "gauge", station: K63 },
    { kind: "gauge", station: STATIONS[2] },
    { kind: "you", name: "พื้นที่ของคุณ", text: "อำเภอโพธาราม จังหวัดราชบุรี" },
    { kind: "gauge", station: STATIONS[3] },
  ];
  const FLOW = [...BRANCHES.flatMap((b) => b.nodes), ...MAIN];

  const TYPE_LABEL = { dam: "เขื่อน", gauge: "จุดวัดระดับน้ำในแม่น้ำ", barrage: "เขื่อนทดน้ำ · มีข้อมูลระดับน้ำเท่านั้น" };
  const TREND_TEXT = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] };

  // Gauges: centimetres and cm/hour (people read cm, not "0.13 m"). Dams: m3/s.
  function trendHtml(t, kind) {
    if (!t) return `<span class="trend" data-dir="none">ยังไม่มีข้อมูลพอเทียบแนวโน้ม</span>`;
    const [arrow, word] = TREND_TEXT[t.direction];
    const span = `ราว ${windowH} ชม.`;
    if (t.direction === "steady") return `<span class="trend" data-dir="steady">${arrow} ${word} ${span}</span>`;
    // The net change can hide a late reversal, so say so when the newest reading
    // moved against it (by at least the source's own 1 cm resolution).
    const against = t.direction === "rising" ? t.lastDelta < 0 : t.lastDelta > 0;
    const stepArrow = t.lastDelta < 0 ? "▼" : "▲";
    if (kind === "dam" || kind === "discharge") {
      // A dam's release, or a river's flow at a gauge: both in m3/s, each with its own "steady" size.
      const noun = kind === "dam" ? "อัตราระบาย" : "อัตราการไหล";
      const note = against && Math.abs(t.lastDelta) >= steadyTolerance(kind === "dam" ? "release" : "discharge", windowH)
        ? ` <span class="trend-note">· รอบล่าสุด ${stepArrow} ${Math.abs(Math.round(t.lastDelta))} ลบ.ม./วินาที</span>` : "";
      return `<span class="trend" data-dir="${t.direction}">${arrow} ${noun}${word} ${Math.abs(Math.round(t.delta))} ลบ.ม./วินาที ${span}</span>${note}`;
    }
    const cm = Math.abs(t.delta) * 100;
    const perHour = cm / t.spanHours;
    const note = against && Math.round(Math.abs(t.lastDelta) * 100) >= 1
      ? ` <span class="trend-note">· รอบล่าสุด ${stepArrow} ${Math.round(Math.abs(t.lastDelta) * 100)} ซม.</span>` : "";
    return `<span class="trend" data-dir="${t.direction}">${arrow} ${word} ${Math.round(cm)} ซม. ${span} (≈ ${perHour.toFixed(1)} ซม./ชม.)</span>${note}`;
  }

  // Every hourly chart shares ONE time axis: the right edge is the newest data hour across
  // all sources, so the same x position means the same clock time in every box. A series
  // whose newest reading is older simply stops short and is left blank up to the edge.
  let axisEndT = null;
  async function loadAxisEnd() {
    const files = [
      ...STATIONS.map((s) => [s.file, "updatedAt"]),
      ...RESERVOIRS.map((r) => [r.hourlyFile, "reportedAt"]),
    ];
    let newest = 0;
    await Promise.all(
      files.map(async ([file, key]) => {
        const rows = await getHistory(file).catch(() => []);
        const s = seriesOf(rows, key === "updatedAt" ? "levelMsl" : "releaseM3s", key);
        if (s.length) newest = Math.max(newest, s[s.length - 1].t);
      }),
    );
    if (newest) axisEndT = Math.ceil(newest / 3600000) * 3600000;
  }

  // Daily bar chart for a once-a-day report: one bar per day (newest 7), scaled 0-100 % of
  // capacity (or the max if it is over 100), value above each bar and the day below.
  function barsHtml(rows, valueKey, timeKey, label) {
    const days = dailyValues(rows, valueKey, timeKey, 7);
    if (!days.length) return `<div class="spark"><div class="spark-label">${label}</div><div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงกราฟ</div></div>`;
    const top = Math.max(100, ...days.map((d) => d.v));
    const dayFmt = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" });
    const cols = days
      .map(
        (d) => `<div class="bar-col"><span class="bar-val">${d.v.toFixed(1)}</span>
          <div class="bar-track"><div class="bar" style="height:${((d.v / top) * 100).toFixed(1)}%"></div></div>
          <span class="bar-day">${dayFmt.format(new Date(`${d.date}T00:00:00Z`))}</span></div>`,
      )
      .join("");
    return `<div class="spark"><div class="spark-label">${label}</div><div class="bars" role="img" aria-label="${label}">${cols}</div></div>`;
  }

  // Small trend chart for a Window: x is real time, the vertical scale and any gap are drawn by the
  // shared renderer (chart.js). Caption prints the real span and first -> last so it can't overstate.
  // `reference` ({ v, note }) draws a dashed line at a level the page marks (see STATIONS).
  function sparklineHtml(rows, valueKey, timeKey, label, unit, digits, minRange, windowHours = 24, hourlyAxis = false, compact = false, reference = null) {
    const all = seriesOf(rows, valueKey, timeKey);
    const shared = hourlyAxis && axisEndT != null;
    const latestT = all.length ? all[all.length - 1].t : 0;
    const endT = shared ? axisEndT : latestT;
    const startT = endT - windowHours * 3600000;
    const pts = all.filter((p) => p.t >= startT && p.t <= endT);
    if (pts.length < (shared ? 1 : 2)) {
      return `<div class="spark"><div class="spark-label">${label}</div><div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงกราฟ</div></div>`;
    }
    const chart = renderChart({ points: all, startT, endT, windowH: windowHours, minRange, digits, unit, ariaLabel: label, reference });
    const spanH = (pts[pts.length - 1].t - pts[0].t) / 3600000;
    return `<div class="spark">${compact ? "" : `<div class="spark-label">${label}</div>`}${chart}
      ${compact ? "" : `<div class="spark-cap">${spanH > 48 ? `${(spanH / 24).toFixed(1)} วัน` : `${spanH.toFixed(1)} ชม.`}: ${pts[0].v.toFixed(digits)} → ${pts[pts.length - 1].v.toFixed(digits)} ${unit}</div>`}</div>`;
  }

  function freshnessHtml(d) {
    const age = d.asOf ? `ข้อมูล ${d.asOf} · ${formatDuration(d.mins)}ที่แล้ว` : "ไม่ทราบเวลาของข้อมูล";
    const warn = d.stale ? ` <span class="stale-badge">${STALE_TEXT}</span>` : "";
    return `<div class="flow-meta" data-stale="${d.stale}">${age}${warn}</div>`;
  }

  // EGAT's Channel capacity, loaded per redraw (renderFlow). Used only while EGAT's own reading time
  // is fresh, so an old figure is never shown as current. A fact beside the discharge, no colour.
  let egatCapacity = null;
  const fmtM3s = (n) => Math.round(n).toLocaleString("en-US");
  function capacityHtml(station, dischargeM3s) {
    const c = station.capacityCode && egatCapacity && egatCapacity[station.capacityCode];
    if (!c || typeof c.capacityM3s !== "number") return "";
    const cmp = channelCapacityComparison(dischargeM3s, c.capacityM3s);
    const diff = !cmp ? "" : cmp.direction === "at" ? " · เท่ากับความจุลำน้ำ"
      : ` · ${cmp.direction === "above" ? "สูงกว่า" : "ต่ำกว่า"}ความจุลำน้ำ ≈ ${fmtM3s(cmp.diffM3s)} ลบ.ม./วินาที`;
    return `<div class="flow-meta">ความจุลำน้ำตาม กฟผ. ${fmtM3s(c.capacityM3s)} ลบ.ม./วินาที (ณ ${formatShortTime(c.asOf)})${diff}</div>`;
  }

  function flowNodeHtml(node, d, roleOverride) {
    if (node.kind === "you") {
      return `<li class="flow-node flow-you"><div class="flow-type">พื้นที่ของคุณ</div><div class="flow-name">${node.text}</div></li>`;
    }
    const type = `<div class="flow-type" data-type="${node.kind}">${TYPE_LABEL[node.kind]}</div>`;
    const st = node.station;
    const role = roleOverride ?? (st && st.role);
    const title = node.kind === "dam" ? node.name
      : node.kind === "barrage" ? `${node.barrage.name} <span class="flow-role">${node.barrage.code} · ระดับน้ำที่สถานีเขื่อน</span>`
      : `${st.name}${role ? ` <span class="flow-role">${role}</span>` : ""}`;
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
        ${d.trend ? `<div class="flow-group"><div class="flow-meta">${trendHtml(d.trend, "dam")}</div></div>` : ""}
        <div class="flow-group">${freshnessHtml(d)}</div>
        ${d.trend ? "" : `<div class="flow-remark">ยังไม่มีข้อมูลย้อนหลัง ${windowH} ชม. พอเทียบแนวโน้ม</div>`}</div></div></li>`;
    }
    // "No data yet" messages are remarks in small grey text, apart from the measurements.
    const remarks = [];
    if (node.kind === "barrage") {
      // A level only: never presented as a release (the release is announced by hand by RID Office 13).
      remarks.push("ไม่มีข้อมูลอัตโนมัติของอัตราระบายและการเปิดบานของเขื่อน ประกาศโดยสำนักงานชลประทานที่ 13");
    }
    if (!d.trend) remarks.push(`ยังไม่มีข้อมูลย้อนหลัง ${windowH} ชม. พอเทียบแนวโน้ม`);
    const q = node.kind === "gauge" ? d.latestQ : null;
    if (q) remarks.push("เป็นอัตราการไหลของแม่น้ำที่จุดวัด ไม่ใช่อัตราระบายของเขื่อน");
    // The discharge has its own reading time: say so when it is not the newest row's, and flag it when old.
    const qNote = q && (q.updatedAt !== d.latest.updatedAt || d.qStale)
      ? `<div class="flow-meta" data-stale="${d.qStale}">อัตราการไหลข้อมูล ณ ${formatShortTime(q.updatedAt)}${d.qStale ? ` <span class="stale-badge">${STALE_TEXT}</span>` : ""}</div>` : "";
    const flowValue = q
      ? `<div class="flow-group"><div class="flow-value flow-q"><span class="flow-label">อัตราการไหลของแม่น้ำ</span> ≈ ${fmtM3s(q.dischargeM3s)} <span class="unit">ลบ.ม./วินาที</span></div>
         ${d.dischargeTrend ? `<div class="flow-meta">${trendHtml(d.dischargeTrend, "discharge")}</div>` : ""}${d.qStale ? "" : capacityHtml(node.station, q.dischargeM3s)}${qNote}</div>`
      : "";
    return `<li class="${cls}">${type}<div class="flow-name">${title}</div>
      <div class="flow-body"><div class="flow-text">
      <div class="flow-value"><span class="flow-label">${node.kind === "barrage" ? "ระดับน้ำที่เขื่อน" : "ระดับผิวน้ำ"}</span> ${d.latest.levelMsl.toFixed(2)} <span class="unit">ม. เหนือระดับทะเล</span></div>
      ${flowValue}
      ${node.kind === "gauge" && node.station.reference ? `<div class="flow-group">${referenceHtml(d.latest.levelMsl, node.station.reference, "flow-meta")}</div>` : ""}
      ${d.trend ? `<div class="flow-group"><div class="flow-meta">${trendHtml(d.trend, "gauge")}</div></div>` : ""}
      <div class="flow-group">${freshnessHtml(d)}</div>
      ${remarks.length ? `<div class="flow-remark">${remarks.join("<br>")}</div>` : ""}</div>
      <div class="flow-sparks">${sparklineHtml(d.rows, "levelMsl", "updatedAt", "ระดับผิวน้ำ", "ม.รทก.", 2, 0.1, windowH, true, true, node.station && node.station.reference)}</div></div></li>`;
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
        trend: trendOf(rows, "releaseM3s", "reportedAt", windowH, steadyTolerance("release", windowH)),
        capacity,
        mins,
        stale: !(mins <= STALE_MINUTES),
        asOf: latest.reportedAt ? formatShortTime(latest.reportedAt) : null,
      };
    }
    const rows = await getHistory(node.kind === "barrage" ? node.barrage.file : node.station.file).catch(() => []);
    const latest = rows[rows.length - 1];
    if (!latest || typeof latest.levelMsl !== "number") return null;
    const mins = ageMinutes(latest.updatedAt);
    const latestQ = [...rows].reverse().find((r) => typeof r.dischargeM3s === "number") || null;
    return {
      latest,
      rows,
      latestQ,
      qStale: !latestQ || !(ageMinutes(latestQ.updatedAt) <= STALE_MINUTES),
      dischargeTrend: trendOf(rows, "dischargeM3s", "updatedAt", windowH, steadyTolerance("discharge", windowH)),
      trend: trendOf(rows, "levelMsl", "updatedAt", windowH, steadyTolerance("gauge", windowH)),
      headlineTrend: trendOf(rows, "levelMsl", "updatedAt", HEADLINE_WINDOW_H, steadyTolerance("gauge", HEADLINE_WINDOW_H)),
      mins,
      stale: !(mins <= STALE_MINUTES),
      asOf: latest.updatedAt ? formatShortTime(latest.updatedAt) : null,
    };
  }

  // Bumped on every full redraw (a Window change): a redraw still in flight when the next one
  // starts must not write into the page afterwards.
  let renderId = 0;

  async function renderFlow() {
    const myRender = renderId;
    const root = document.getElementById("flow");
    const datas = new Map();
    await Promise.all(
      FLOW.filter((n) => n.kind !== "you").map(async (n) => datas.set(n, await nodeData(n).catch(() => null))),
    );
    egatCapacity = await fetch("data/egat-channel-capacity.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((snap) => {
        if (!snap || !snap.stations) return null;
        // Only figures whose own reading time is fresh; an old one reads as no figure.
        return Object.fromEntries(Object.entries(snap.stations).filter(([, v]) => ageMinutes(v.asOf) <= STALE_MINUTES));
      })
      .catch(() => null);
    if (myRender !== renderId) return;
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
      const upTrends = upstreamGauges.map((n) => datas.get(n).headlineTrend);
      const count = (dir) => upTrends.filter((t) => t && t.direction === dir).length;
      const unknown = upTrends.filter((t) => !t).length;
      const staleUp = upstreamGauges.filter((n) => datas.get(n).stale).length;
      const damLines = FLOW.filter((n) => n.kind === "dam" && datas.get(n) && datas.get(n).latest.releaseM3s != null)
        .map((n) => `${n.name.replace("เขื่อน", "")} ≈ ${datas.get(n).latest.releaseM3s.toLocaleString("en-US")}${datas.get(n).stale ? ` (${STALE_TEXT})` : ""}`);
      // The Barrage is not in the tally above (it holds its pool near a target, so its level barely
      // moves however much it releases). Its own line, on the fixed headline span like the rest.
      const bd = datas.get(MAIN.find((n) => n.kind === "barrage"));
      const bt = bd && bd.headlineTrend ? TREND_TEXT[bd.headlineTrend.direction] : null;
      const barrageLine = bd
        ? `<div><b>เขื่อนแม่กลอง</b> — ระดับน้ำที่เขื่อน ${bd.latest.levelMsl.toFixed(2)} ม.รทก.${bt ? ` ${bt[0]} ${bt[1]} ราว ${HEADLINE_WINDOW_H} ชม.` : ""}${bd.stale ? ` · <span class="health-warn">${STALE_TEXT}</span>` : ""} · ไม่มีข้อมูลอัตโนมัติของอัตราระบาย (ประกาศโดยสำนักงานชลประทานที่ 13)</div>`
        : "";
      const flowPart = (st, label) => {
        const nd = datas.get(FLOW.find((n) => n.station === st));
        return nd && nd.latestQ
          ? `${label} ≈ ${fmtM3s(nd.latestQ.dischargeM3s)}${nd.qStale ? ` (${STALE_TEXT})` : ""}` : null;
      };
      const flowParts = [flowPart(K37, "บ้านวังเย็น K.37 (เหนือเขื่อนตามระดับน้ำ)"), flowPart(K63, "K.63 (ท้ายเขื่อน ท้ายจุด K.11A)"), flowPart(STATIONS[2], "สะพานค่ายหลวง")].filter(Boolean);
      here.innerHTML = `<h2 class="section-title">พื้นที่เฝ้าระวัง <span class="here-sub">อ.โพธาราม จ.ราชบุรี</span></h2>
        <ul class="here-grid">${flowNodeHtml(phNode, datas.get(phNode), "ในพื้นที่ / ท้ายน้ำ")}${flowNodeHtml(bpNode, datas.get(bpNode), "เหนือน้ำใกล้สุด")}</ul>
        <div class="here-summary">
          <div><b>สัญญาณจากต้นน้ำ</b> — จุดวัด ${upstreamGauges.length} แห่งเหนือพื้นที่ของคุณ: ▲ สูงขึ้น ${count("rising")} · ► ทรงตัว ${count("steady")} · ▼ ลดลง ${count("falling")}${unknown ? ` · ยังเทียบไม่ได้ ${unknown}` : ""}${staleUp ? ` · <span class="health-warn">${STALE_TEXT} ${staleUp} จุด</span>` : ""}</div>
          ${damLines.length ? `<div>เขื่อนระบายน้ำ (ลบ.ม./วินาที): ${damLines.join(" · ")}</div>` : ""}
          ${barrageLine}
          ${flowParts.length ? `<div>อัตราการไหลของแม่น้ำ (ลบ.ม./วินาที): ${flowParts.join(" · ")}</div>` : ""}
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
    damArea: "ระดับน้ำเขื่อนแม่กลองและ K.63 (ThaiWater)",
    egatTelemetry: "ความจุลำน้ำ (กฟผ.)",
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
    const myRender = renderId;
    const root = document.getElementById(rootId);
    for (const item of items) {
      if (myRender !== renderId) return;
      try {
        const card = await load(item);
        if (myRender !== renderId) return;
        root.appendChild(card);
      } catch (err) {
        console.error(err);
        if (myRender !== renderId) return;
        const card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `<div class="station-header">${nameHtml(item)}</div>
          <div class="chart-empty">โหลดข้อมูลไม่สำเร็จ</div>`;
        root.appendChild(card);
      }
    }
  }

  // Draws everything that follows the Window. Cheap to repeat: history files are cached.
  function renderAll() {
    renderId++;
    for (const id of ["flow", "stations", "reservoirs"]) document.getElementById(id).innerHTML = "";
    renderFlow().catch((err) => {
      console.error(err);
      document.getElementById("flow").innerHTML = `<div class="chart-empty">โหลดแผนภาพลำน้ำไม่สำเร็จ</div>`;
    });
    renderInto("stations", STATIONS, loadStation, (s) => stationNameHtml(s.name, s.role));
    // Same order as the river line above: แควใหญ่ (ศรีนครินทร์), then แควน้อย (วชิราลงกรณ).
    renderInto("reservoirs", [RESERVOIRS[1], RESERVOIRS[0]], loadReservoir, (r) => `<span class="station-name">${r.name}</span>`);
  }

  async function main() {
    loadHealth();
    await loadAxisEnd();
    WindowToggle.mount(
      document.getElementById("window-toggle"),
      "สรุปด้านบนใช้ 6 ชม. เสมอ · ข้อมูลรายวันของเขื่อนไม่เปลี่ยนตามช่วงเวลา",
      (h) => { windowH = h; renderAll(); },
    );
    renderAll();
  }

  main();
})();
