// Renders the committed history files under data/ as station cards + trend
// charts. Static, client-side only — reads a local file the GitHub Action
// already scraped and committed; never fetches ThaiWater/EGAT directly from
// the browser.
(function () {
  // A reading older than the station's own reporting cadence (plus slack) is
  // flagged, not hidden. Cadence differs per gauge, so it is per-station.

  // Upstream first, so the two cards read top-to-bottom as the river flows.
  const STATIONS = [
    { file: "data/khai-luang.json", name: "สะพานค่ายหลวง (อ.บ้านโป่ง)", role: "ต้นน้ำ", staleMinutes: 90 },
    { file: "data/photharam.json", name: "โพธาราม (เจ็ดเสมียน, อ.โพธาราม)", role: "ปลายน้ำ", staleMinutes: 30 },
  ];

  function ageMinutes(iso) {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return Infinity;
    return (Date.now() - ms) / 60000;
  }

  function formatAge(mins) {
    if (!Number.isFinite(mins)) return "ไม่ทราบเวลาที่อัปเดต";
    if (mins < 60) return `อัปเดตเมื่อ ${Math.round(mins)} นาทีที่แล้ว`;
    const hours = mins / 60;
    if (hours < 24) return `อัปเดตเมื่อ ${hours.toFixed(1)} ชั่วโมงที่แล้ว`;
    return `อัปเดตเมื่อ ${(hours / 24).toFixed(1)} วันที่แล้ว`;
  }

  const STATUS_LABEL = {
    red: "วิกฤต",
    yellow: "เฝ้าระวัง",
    green: "ปกติ",
  };

  // Upstream context, not a river reading: rendered in its own section.
  // Rows carry no source timestamp, so freshness is judged from scrapedAt.
  const RESERVOIRS = [
    { file: "data/reservoir-vajiralongkorn.json", name: "เขื่อนวชิราลงกรณ", staleMinutes: 45 },
    { file: "data/reservoir-srinakarin.json", name: "เขื่อนศรีนครินทร์", staleMinutes: 45 },
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
    const res = await fetch(file, { cache: "no-store" });
    if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`);
    const history = await res.json();
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

  async function loadReservoir({ file, name, staleMinutes }) {
    const res = await fetch(file, { cache: "no-store" });
    if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`);
    const history = await res.json();
    const latest = history[history.length - 1];

    const card = document.createElement("div");
    card.className = "station-card";

    if (!latest) {
      card.innerHTML = `<div class="station-header"><span class="station-name">${name}</span></div>
        <div class="chart-empty">ยังไม่มีข้อมูล</div>`;
      return card;
    }

    const mins = ageMinutes(latest.scrapedAt);
    const stale = mins > staleMinutes;
    const fmt = (v, digits) => (typeof v === "number" ? v.toFixed(digits) : "–");

    card.innerHTML = `
      <div class="station-header"><span class="station-name">${name}</span></div>
      <div class="station-level">${fmt(latest.storagePercent, 2)} <span class="unit">% ของความจุ</span></div>
      <div class="reservoir-stats">
        <div><span class="stat-label">ระดับน้ำ</span> ${fmt(latest.levelMsl, 2)} <span class="unit">ม.รทก.</span></div>
        <div><span class="stat-label">อัตราระบาย</span> ${fmt(latest.releaseRateM3s, 2)} <span class="unit">ลบ.ม./วินาที</span></div>
      </div>
      <div class="station-meta" data-stale="${stale}">${formatAge(mins)}${stale ? " — ข้อมูลอาจไม่ล่าสุด" : ""}</div>
      ${renderChart(history, "storagePercent")}
    `;
    return card;
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
    renderInto("stations", STATIONS, loadStation, (s) => stationNameHtml(s.name, s.role));
    renderInto("reservoirs", RESERVOIRS, loadReservoir, (r) => `<span class="station-name">${r.name}</span>`);
  }

  main();
})();
