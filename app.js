// Renders the committed history files under data/ as station cards + trend
// charts. Static, client-side only — reads a local file the GitHub Action
// already scraped and committed; never fetches ThaiWater/EGAT directly from
// the browser.
(function () {
  // Any data older than 6 hours is highlighted, never hidden or shown as fresh.
  const STALE_MINUTES = 6 * 60;
  const STALE_TEXT = "ข้อมูลอาจไม่อัพเดทล่าสุด";

  // Levels the page marks on a gauge's chart so people can see how far the water is from them. The
  // maintainer's own lines (Photharam: 6.00 yellow, 6.50 amber, 6.75 red, m above sea
  // level), NOT official thresholds and never a Status (Status comes only from source-published
  // thresholds). Always shown with the note below; the colour is also named in words.
  const REFERENCE_NOTE = "เส้นอ้างอิงที่ตั้งไว้ในเว็บนี้ ไม่ใช่เกณฑ์ทางการ";
  // A reference line is drawn on the chart only while the water is within this distance of it (m), so a
  // line the water is nowhere near takes no space; it comes into view as the water approaches. The card
  // text always states the distance to every line. A placeholder for the maintainer to tune.
  const REFERENCE_PROXIMITY_M = 0.5;
  const PHOTHARAM_REFERENCES = [
    { v: 6, level: "yellow", name: "เส้นเหลือง" },
    { v: 6.5, level: "amber", name: "เส้นส้ม" },
    { v: 6.75, level: "red", name: "เส้นแดง" },
  ];

  // Upstream first, so the cards read top-to-bottom as the water flows down to the user.
  const STATIONS = [
    { file: "data/pak-saeng.json", name: "บ้านปากแซง", role: "", staleMinutes: STALE_MINUTES },
    { file: "data/wang-khanai.json", name: "บ้านวังขนาย", role: "ท้ายเขื่อนแม่กลอง", staleMinutes: STALE_MINUTES },
    { file: "data/khai-luang.json", name: "สะพานค่ายหลวง", role: "", staleMinutes: STALE_MINUTES },
    { file: "data/photharam.json", name: "โพธาราม", role: "", staleMinutes: STALE_MINUTES, references: PHOTHARAM_REFERENCES },
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
        }).then((rows) => (Array.isArray(rows) && rows.length && rows[0].updatedAt !== undefined ? currentReadings(rows) : rows)), // one row per source time: a revised hour replaces the provisional one
      );
    }
    return historyCache.get(file);
  }

  // The Mae Klong gauges' hourly rows without a newest reading that is a suspect step (suspectLatest in
  // parse.js: one impossible hour, e.g. K.11A 17.56 -> 12.03 m). History is untouched; this is display only.
  // Everything on the page (level, trend, chart, strip) then uses the last trusted reading, and says so.
  function trusted(rows) {
    const s = suspectLatest(rows);
    return s ? { rows: rows.filter((r) => r !== s.row), suspect: s } : { rows, suspect: null };
  }
  const suspectText = (s) =>
    `ค่าล่าสุด ${formatShortTime(s.updatedAt)} = ${s.value.toFixed(2)} ม. เปลี่ยน ${Math.abs(s.deltaM).toFixed(2)} ม. ใน ${+s.hours.toFixed(1)} ชม. ผิดปกติ จึงยังไม่ใช้ รอค่าถัดไปยืนยัน (ระดับที่แสดงคือค่าล่าสุดก่อนหน้านั้น)`;

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

  // How far a level is from each of the page's reference lines, as facts (never a Status). Empty without any.
  function referenceHtml(levelMsl, references, cls) {
    if (!references || !references.length) return "";
    const parts = references
      .map((r) => {
        const c = bankComparison(levelMsl, r.v);
        if (!c) return null;
        return c.direction === "at"
          ? `เท่ากับ${r.name} (${r.v.toFixed(2)})`
          : `${c.direction === "above" ? "สูงกว่า" : "ต่ำกว่า"}${r.name} (${r.v.toFixed(2)}) ${c.diffM.toFixed(2)} ม.`;
      })
      .filter(Boolean);
    if (!parts.length) return "";
    return `<div class="${cls}">ระดับปัจจุบัน ${levelMsl.toFixed(2)} ม.รทก. ${parts.join(" · ")} <span class="unit">(${REFERENCE_NOTE} · เส้นจะแสดงบนกราฟเมื่อระดับน้ำห่างไม่เกิน ${REFERENCE_PROXIMITY_M.toFixed(2)} ม.)</span></div>`;
  }

  async function loadStation({ file, name, role, staleMinutes, references }) {
    const { rows: history, suspect } = trusted(await getHistory(file));
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
      ${suspect ? `<div class="station-meta">${suspectText(suspect)}</div>` : ""}
      ${referenceHtml(latest.levelMsl, references, "station-meta")}
      ${levelChartHtml(history, false, references)}
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
  // Below โพธาราม (see the block further down for how they are drawn).
  const K2B = { code: "K.2B", file: "data/k2b.json", name: "สะพานธนะรัชต์", role: "อ.เมืองราชบุรี จ.ราชบุรี" };
  const K57 = { code: "K.57", file: "data/k57.json", name: "สะพานบางนกแขวก", role: "อ.บางคนที จ.สมุทรสงคราม", datum: RIVERLINE.stops.find((x) => x.code === "K.57").datum };
  const LOWER_GAUGES = [K2B, K57];
  const K56A = RIVERLINE.stops.find((x) => x.code === "K.56A");
  const MOUTH = { code: "MKG006", file: "data/daily-mkg006.json", name: "พระรามสอง", role: "ปากแม่น้ำ อ.เมืองสมุทรสงคราม" };

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
    // Below โพธาราม, in RID's order. K.56A is on the chain but not tracked: kept, never dropped.
    { kind: "untracked", stop: K56A },
    { kind: "lower", g: K2B },
    { kind: "lower", g: K57 },
    { kind: "mouth", g: MOUTH },
  ];
  const FLOW = [...BRANCHES.flatMap((b) => b.nodes), ...MAIN];

  const TYPE_LABEL = { dam: "เขื่อน", gauge: "จุดวัดระดับน้ำในแม่น้ำ", barrage: "เขื่อนทดน้ำ · มีข้อมูลระดับน้ำเท่านั้น" };
  const TREND_TEXT = { rising: ["▲", "สูงขึ้น"], falling: ["▼", "ลดลง"], steady: ["►", "ทรงตัว"] };

  // Gauges: centimetres and cm/hour (people read cm, not "0.13 m"). Dams: m3/s.
  // Why a box shows no trend: the data is old (a trend from it would read as current), or there is not enough of it.
  const noTrendText = (d) => (d.stale ? "ไม่แสดงแนวโน้ม เพราะข้อมูลไม่เป็นปัจจุบัน" : `ยังไม่มีข้อมูลย้อนหลัง ${windowH} ชม. พอเทียบแนวโน้ม`);

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
      ...LOWER_GAUGES.map((g) => [g.file, "updatedAt"]),
      ...RESERVOIRS.map((r) => [r.hourlyFile, "reportedAt"]),
    ];
    let newest = 0;
    await Promise.all(
      files.map(async ([file, key]) => {
        const rows = await getHistory(file).catch(() => []);
        const s = seriesOf(rows, key === "updatedAt" ? "levelMsl" : "releaseM3s", key);
        // A mis-dated reading (in the future) must not stretch the axis every chart shares.
        const ok = s.filter((p) => !isFutureReading(new Date(p.t).toISOString(), Date.now()));
        if (ok.length) newest = Math.max(newest, ok[ok.length - 1].t);
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

  // A gauge's level chart: stepped vertical scale (printed under it), Photharam's near reference lines,
  // and optionally `holdRange`, a scale to hold it to so that two charts side by side compare directly.
  function levelChartHtml(rows, compact, references, holdRange, opts = {}) {
    return sparklineHtml(rows, "levelMsl", "updatedAt", "ระดับผิวน้ำ", opts.unit || "ม.รทก.", 2, 0.1, windowH, true, compact, {
      references, referenceProximity: REFERENCE_PROXIMITY_M, scaleSteps: LEVEL_SCALE_STEPS_M, holdRange, referenceNote: opts.referenceNote,
    });
  }

  // The scale a gauge's level chart would take on its own (the reference lines it draws included), in
  // metres; 0 without data. Used to hold the awareness panel's two charts to the larger of the two.
  function levelScaleSpan(rows, references) {
    if (axisEndT == null) return 0;
    const m = chartModel(seriesOf(rows, "levelMsl", "updatedAt"), {
      startT: axisEndT - windowH * 3600000, endT: axisEndT, minRange: 0.1, scaleSteps: LEVEL_SCALE_STEPS_M,
      references: references || [], referenceProximity: REFERENCE_PROXIMITY_M,
    });
    return m ? m.max - m.min : 0;
  }

  // Small trend chart for a Window: x is real time, the vertical scale and any gap are drawn by the
  // shared renderer (chart.js). Caption prints the real span and first -> last so it can't overstate.
  // `references` ([{ v, level, name }]) draws a dashed line at each level the page marks (see STATIONS).
  function sparklineHtml(rows, valueKey, timeKey, label, unit, digits, minRange, windowHours = 24, hourlyAxis = false, compact = false, extra = {}) {
    const all = seriesOf(rows, valueKey, timeKey);
    const shared = hourlyAxis && axisEndT != null;
    const latestT = all.length ? all[all.length - 1].t : 0;
    const endT = shared ? axisEndT : latestT;
    const startT = endT - windowHours * 3600000;
    const pts = all.filter((p) => p.t >= startT && p.t <= endT);
    if (pts.length < (shared ? 1 : 2)) {
      // Readings exist but none in this Window (the gauge went quiet): the empty time axis, shaded, and
      // say so, never "waiting for data".
      if (shared && all.length) {
        const empty = renderEmptyChart({ startT, endT, windowH: windowHours, ariaLabel: label });
        return `<div class="spark">${compact ? "" : `<div class="spark-label">${label}</div>`}${empty}</div>`;
      }
      return `<div class="spark"><div class="spark-label">${label}</div><div class="spark-empty">รอข้อมูลสะสมเพื่อแสดงกราฟ</div></div>`;
    }
    const chart = renderChart({
      points: all, startT, endT, windowH: windowHours, digits, unit, ariaLabel: label, referenceNote: extra.referenceNote ?? REFERENCE_NOTE,
      minRange: Math.max(minRange, extra.holdRange || 0), // holdRange keeps charts side by side on one scale
      references: extra.references || [], referenceProximity: extra.referenceProximity ?? null, scaleSteps: extra.scaleSteps || null,
    });
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

  // RID's distance (and printed travel time, where there is one) to the next station on the chain,
  // named, because other nodes (the watched area) can sit between the two.
  function linkHtml(code) {
    const l = riverlineLink(code);
    if (!l) return "";
    return `<div class="flow-link">↓ ถึง ${l.toName}${l.toCode === "GULF" ? "" : ` ${l.toCode}`} อีก ${l.km.toLocaleString("en-US")} กม.${l.hours != null ? ` · กรมชลประทานระบุเดินทางราว ${l.hours} ชม.` : ""}</div>`;
  }
  const riverCodeOf = (node) => {
    const file = (node.station && node.station.file) || (node.barrage && node.barrage.file) || (node.g && node.g.file);
    const stop = RIVERLINE.stops.find((x) => (file && x.file === file) || (node.stop && x === node.stop));
    return stop && stop.code;
  };

  function flowNodeHtml(node, d, roleOverride, holdRange) {
    const html = flowNodeBody(node, d, roleOverride, holdRange);
    // Not in the watched-area panel (it passes roleOverride / holdRange): only in the river diagram.
    if (roleOverride !== undefined || holdRange !== undefined) return html;
    const link = linkHtml(riverCodeOf(node));
    return link ? html.replace(/<\/li>\s*$/, `${link}</li>`) : html;
  }

  function flowNodeBody(node, d, roleOverride, holdRange) {
    if (node.kind === "untracked") {
      return `<li class="flow-node flow-untracked"><div class="flow-type" data-type="gauge">จุดวัดระดับน้ำในแม่น้ำ</div><div class="flow-name">${node.stop.name} <span class="flow-role">${node.stop.code} · อ.โพธาราม</span></div><div class="flow-meta">ไม่ได้ติดตาม (ไม่มีข้อมูลอัตโนมัติในระบบนี้)</div></li>`;
    }
    if (node.kind === "lower") return lowerNodeHtml(node.g, d ? d.raw : []);
    if (node.kind === "mouth") return mouthNodeHtml(d ? d.raw : null);
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
        ${d.trend ? "" : `<div class="flow-remark">${noTrendText(d)}</div>`}</div></div></li>`;
    }
    // "No data yet" messages are remarks in small grey text, apart from the measurements.
    const remarks = [];
    if (node.kind === "barrage") {
      // A level only: never presented as a release (the release is announced by hand by RID Office 13).
      remarks.push("ไม่มีข้อมูลอัตโนมัติของอัตราระบายและการเปิดบานของเขื่อน ประกาศโดยสำนักงานชลประทานที่ 13");
    }
    if (!d.trend) remarks.push(noTrendText(d));
    if (d.suspect) remarks.unshift(suspectText(d.suspect));
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
      ${node.kind === "gauge" && node.station.references ? `<div class="flow-group">${referenceHtml(d.latest.levelMsl, node.station.references, "flow-meta")}</div>` : ""}
      ${d.trend ? `<div class="flow-group"><div class="flow-meta">${trendHtml(d.trend, "gauge")}</div></div>` : ""}
      <div class="flow-group">${freshnessHtml(d)}</div>
      ${remarks.length ? `<div class="flow-remark">${remarks.join("<br>")}</div>` : ""}</div>
      <div class="flow-sparks">${levelChartHtml(d.rows, true, node.station && node.station.references, holdRange)}</div></div></li>`;
  }

  async function nodeData(node) {
    if (node.kind === "untracked") return {};
    // Below โพธาราม: the node renderers take the raw history (K.2B, K.57) or the daily summary (MKG006).
    if (node.kind === "lower" || node.kind === "mouth") return { raw: await getHistory(node.g.file).catch(() => (node.kind === "mouth" ? null : [])) };
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
        // A stale source gets no trend: a change measured back from an old reading reads as current.
        trend: mins <= STALE_MINUTES ? trendOf(rows, "releaseM3s", "reportedAt", windowH, steadyTolerance("release", windowH)) : null,
        capacity,
        mins,
        stale: !(mins <= STALE_MINUTES),
        asOf: latest.reportedAt ? formatShortTime(latest.reportedAt) : null,
      };
    }
    const { rows, suspect } = trusted(await getHistory(node.kind === "barrage" ? node.barrage.file : node.station.file).catch(() => []));
    const latest = rows[rows.length - 1];
    if (!latest || typeof latest.levelMsl !== "number") return null;
    const mins = ageMinutes(latest.updatedAt);
    const latestQ = [...rows].reverse().find((r) => typeof r.dischargeM3s === "number") || null;
    return {
      latest,
      rows,
      suspect,
      latestQ,
      qStale: !latestQ || !(ageMinutes(latestQ.updatedAt) <= STALE_MINUTES),
      // Stale readings get no trend (see the dam branch above).
      dischargeTrend: latestQ && ageMinutes(latestQ.updatedAt) <= STALE_MINUTES ? trendOf(rows, "dischargeM3s", "updatedAt", windowH, steadyTolerance("discharge", windowH)) : null,
      trend: mins <= STALE_MINUTES ? trendOf(rows, "levelMsl", "updatedAt", windowH, steadyTolerance("gauge", windowH)) : null,
      headlineTrend: mins <= STALE_MINUTES ? trendOf(rows, "levelMsl", "updatedAt", HEADLINE_WINDOW_H, steadyTolerance("gauge", HEADLINE_WINDOW_H)) : null,
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
      // The two charts side by side in this panel are the ones people compare (is the water upstream
      // rising, and will Photharam follow?), so they share one scale: the larger of the two.
      const pd = datas.get(phNode), bd2 = datas.get(bpNode);
      const pairScale = pd && bd2 ? Math.max(levelScaleSpan(pd.rows, phNode.station.references), levelScaleSpan(bd2.rows, bpNode.station.references)) : 0;
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
        <ul class="here-grid">${flowNodeHtml(phNode, datas.get(phNode), "ในพื้นที่ / ท้ายน้ำ", pairScale)}${flowNodeHtml(bpNode, datas.get(bpNode), "เหนือน้ำใกล้สุด", pairScale)}</ul>
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

  // ---- Below โพธาราม: K.2B, K.57 and the tidal mouth MKG006, as nodes of the main diagram ----
  // The headline, situation card and sticky pill stay about โพธาราม; these are context further down the river.
  // No status colour, no alert and no threshold: the bank height is a source-published fact, drawn as
  // a plain labelled line and stated in words. Distances and travel times are the Riverline block in parse.js.
  const BANK_NOTE = "ความสูงตลิ่งตามแหล่งข้อมูล ไม่ใช่เกณฑ์เตือน";
  const TIDE_INFLUENCE_NOTE = "ที่ระดับน้ำต่ำ จุดนี้ขึ้น–ลงตามน้ำทะเลหนุน การแกว่งช่วงน้ำน้อยจึงไม่ใช่สัญญาณน้ำท่วม";
  const DATUM_UNIT = "ม. ตามเกจ์";
  const datumNote = (d) => `ค่านี้เป็นระดับตามสเกลเกจ์ท้องถิ่น เทียบกับจุดวัดอื่นไม่ได้ (${d.source}ระบุศูนย์เกจ์ ${String(d.zero).replace("-", "−")} ม.)`;

  const clockTh = (iso) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) + " น.";
  const dayTh = (date) => new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00Z`));
  const cmTh = (m) => `${m > 0 ? "+" : m < 0 ? "−" : "±"}${Math.abs(Math.round(m * 100))} ซม.`;

  // The level against the bank, as a fact in words (no pill, no colour, no bar).
  function bankFactHtml(level, bank, unit, onChart = true) {
    const c = bankComparison(level, bank);
    if (!c) return `<div class="flow-meta">ไม่มีข้อมูลความสูงตลิ่ง</div>`;
    const where = c.direction === "at" ? "เท่ากับตลิ่ง" : `${c.direction === "above" ? "สูงกว่า" : "ต่ำกว่า"}ตลิ่ง ${c.diffM.toFixed(2)} ม.`;
    return `<div class="flow-meta">${where} <span class="unit">(ตลิ่ง ${bank.toFixed(2)} ${unit} · ${BANK_NOTE}${onChart ? ` · เส้นตลิ่งจะแสดงบนกราฟเมื่อระดับน้ำห่างไม่เกิน ${REFERENCE_PROXIMITY_M.toFixed(2)} ม.` : ""})</span></div>`;
  }

  function lowerNodeHtml(g, rawRows) {
    const { rows, suspect } = trusted(rawRows);
    const type = `<div class="flow-type" data-type="gauge">จุดวัดระดับน้ำในแม่น้ำ</div>`;
    const title = `${g.name} <span class="flow-role">${g.code} · ${g.role}</span>`;
    const latest = rows[rows.length - 1];
    if (!latest || typeof latest.levelMsl !== "number") {
      return `<li class="flow-node">${type}<div class="flow-name">${title}</div><div class="flow-meta">${latest ? "ไม่มีข้อมูลระดับน้ำในรอบล่าสุด" : "ไม่มีข้อมูล"}</div></li>`;
    }
    const mins = ageMinutes(latest.updatedAt);
    const stale = !(mins <= STALE_MINUTES);
    const trend = stale ? null : trendOf(rows, "levelMsl", "updatedAt", windowH, steadyTolerance("gauge", windowH));
    const unit = g.datum ? DATUM_UNIT : "ม.รทก.";
    const bank = typeof latest.bankMsl === "number" ? latest.bankMsl : null;
    const refs = bank == null ? [] : [{ v: bank, name: "ตลิ่ง" }];
    const remarks = [TIDE_INFLUENCE_NOTE];
    if (g.datum) remarks.unshift(datumNote(g.datum));
    if (suspect) remarks.unshift(suspectText(suspect));
    if (!trend) remarks.push(noTrendText({ stale }));
    return `<li class="flow-node${stale ? " flow-stale" : ""}">${type}<div class="flow-name">${title}</div>
      <div class="flow-body"><div class="flow-text">
      <div class="flow-value"><span class="flow-label">ระดับผิวน้ำ</span> ${latest.levelMsl.toFixed(2)} <span class="unit">${g.datum ? DATUM_UNIT + " (ไม่ใช่ ม.รทก.)" : "ม. เหนือระดับทะเล"}</span></div>
      <div class="flow-group">${bankFactHtml(latest.levelMsl, bank, unit)}</div>
      ${trend ? `<div class="flow-group"><div class="flow-meta">${trendHtml(trend, "gauge")}</div></div>` : ""}
      <div class="flow-group">${freshnessHtml({ asOf: formatShortTime(latest.updatedAt), mins, stale })}</div>
      <div class="flow-remark">${remarks.join("<br>")}</div></div>
      <div class="flow-sparks">${levelChartHtml(rows, true, refs, 0, { unit, referenceNote: BANK_NOTE })}</div></div></li>`;
  }

  // The tidal mouth: each Bangkok day's high and low (today marked partial), never a rising/falling
  // arrow, and not following the Window (like the dams' daily boxes).
  function mouthNodeHtml(summary) {
    const type = `<div class="flow-type" data-type="gauge">จุดวัดระดับน้ำปากแม่น้ำ (ขึ้น–ลงตามน้ำทะเล)</div>`;
    const title = `${MOUTH.name} <span class="flow-role">${MOUTH.code} · ${MOUTH.role}</span>`;
    const latest = summary && summary.latest;
    if (!latest || typeof latest.levelMsl !== "number") {
      return `<li class="flow-node">${type}<div class="flow-name">${title}</div><div class="flow-meta">${latest ? "ไม่มีข้อมูลระดับน้ำในรอบล่าสุด" : "ไม่มีข้อมูล"}</div></li>`;
    }
    const mins = ageMinutes(latest.updatedAt);
    const stale = !(mins <= STALE_MINUTES);
    const days = summary.days || [];
    const t = tideTrend(days);
    const range = t
      ? `<div class="flow-meta">วันที่ ${dayTh(t.date)} ช่วงน้ำขึ้น–ลง ${t.rangeM.toFixed(2)} ม.${
          t.highDeltaM == null ? " · ยังเทียบกับวันก่อนหน้าไม่ได้" : ` · เทียบวันก่อน: สูงสุด <b>${cmTh(t.highDeltaM)}</b> ต่ำสุด <b>${cmTh(t.lowDeltaM)}</b>`
        }</div>` : "";
    const lines = days.slice(-2).reverse()
      .map((d) => `<div class="flow-meta">${dayTh(d.date)}${d.partial ? " (ยังไม่ครบวัน)" : ""}: สูงสุด <b>${d.high.toFixed(2)}</b> ${clockTh(d.highAt)} · ต่ำสุด <b>${d.low.toFixed(2)}</b> ${clockTh(d.lowAt)}</div>`)
      .join("");
    const bank = typeof latest.bankMsl === "number" ? latest.bankMsl : null;
    return `<li class="flow-node${stale ? " flow-stale" : ""}">${type}<div class="flow-name">${title}</div>
      <div class="flow-body"><div class="flow-text">
      <div class="flow-value"><span class="flow-label">ระดับผิวน้ำล่าสุด</span> ${latest.levelMsl.toFixed(2)} <span class="unit">ม. เหนือระดับทะเล</span></div>
      <div class="flow-group">${bankFactHtml(latest.levelMsl, bank, "ม.รทก.", false)}</div>
      <div class="flow-group">${range}${lines || `<div class="flow-meta">รอข้อมูลสะสมเพื่อแสดงสูงสุด–ต่ำสุดรายวัน</div>`}</div>
      <div class="flow-group">${freshnessHtml({ asOf: formatShortTime(latest.updatedAt), mins, stale })}</div>
      <div class="flow-remark">ระดับขึ้น–ลงวันละสองครั้ง จึงไม่แสดงลูกศรสูงขึ้น/ลดลง แต่แสดงสูงสุด–ต่ำสุดของแต่ละวัน (ไม่เปลี่ยนตามช่วงเวลาด้านบน)</div></div></div></li>`;
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
    lowerReach: "ระดับน้ำท้ายน้ำ K.2B และ K.57 (ThaiWater)",
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

  // Fills a container with one card per item. On a redraw (a Window change) the old cards stay until the
  // new ones are all ready and are then swapped in at once: emptying the container first shrinks the page
  // while the new content loads, and the browser moves the reader up the page to fit (worst on a phone,
  // where loading takes a moment). The very first draw has nothing to keep, so cards appear one by one.
  async function renderInto(rootId, items, load, nameHtml) {
    const myRender = renderId;
    const root = document.getElementById(rootId);
    const progressive = !root.firstChild;
    const cards = [];
    for (const item of items) {
      if (myRender !== renderId) return;
      let card;
      try {
        card = await load(item);
      } catch (err) {
        console.error(err);
        card = document.createElement("div");
        card.className = "station-card";
        card.innerHTML = `<div class="station-header">${nameHtml(item)}</div>
          <div class="chart-empty">โหลดข้อมูลไม่สำเร็จ</div>`;
      }
      if (myRender !== renderId) return;
      if (progressive) root.appendChild(card);
      else cards.push(card);
    }
    if (!progressive) root.replaceChildren(...cards);
  }

  // Draws everything that follows the Window. Cheap to repeat: history files are cached.
  function renderAll() {
    renderId++; // the old content stays on screen until each part has its replacement
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
