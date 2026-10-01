// PROTOTYPE ONLY. Loads the chosen variant's CSS, dresses the DOM (site pill, number count-up),
// and draws the floating A/B/C bar. Nothing here is meant to ship.
(function () {
  const NAMES = { A: "ปัจจุบัน (baseline)", B: "สงบ (entrance + 1 ambient)", C: "เต็มสไตล์ flood.pop" };
  const params = new URLSearchParams(location.search);
  const variant = ["A", "B", "C"].includes(params.get("variant")) ? params.get("variant") : "B";
  document.documentElement.dataset.variant = variant;

  if (variant !== "A") {
    for (const f of ["base", variant === "B" ? "variant-b" : "variant-c"]) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = `prototype/${f}.css?v=${Date.now()}`;
      document.head.appendChild(l);
    }
    document.addEventListener("DOMContentLoaded", dress);
  }

  // ---- switcher bar ----
  const keys = ["A", "B", "C"];
  const go = (k) => { const u = new URL(location.href); u.searchParams.set("variant", k); location.href = u; };
  const step = (d) => go(keys[(keys.indexOf(variant) + d + keys.length) % keys.length]);
  document.addEventListener("DOMContentLoaded", () => {
  const bar = document.createElement("div");
  bar.className = "proto-bar";
  bar.innerHTML = `<button aria-label="ก่อนหน้า">‹</button><span><b>${variant}</b> ${NAMES[variant]}</span><button aria-label="ถัดไป">›</button>`;
  bar.firstChild.onclick = () => step(-1);
  bar.lastChild.onclick = () => step(1);
  document.body.appendChild(bar);
  });
  const st = document.createElement("style");
  st.textContent = `.proto-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:999;display:flex;align-items:center;gap:6px;background:#111827;color:#fff;border-radius:999px;padding:4px 6px;box-shadow:0 6px 24px rgba(0,0,0,.35);font:600 13px system-ui;max-width:calc(100vw - 16px);white-space:nowrap}
  .proto-bar button{all:unset;cursor:pointer;width:44px;height:44px;display:grid;place-items:center;font-size:22px;border-radius:50%}
  .proto-bar button:active{background:#374151}.proto-bar span{padding:0 4px;overflow:hidden;text-overflow:ellipsis}`;
  document.head.appendChild(st);
  document.addEventListener("keydown", (e) => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  function dress() {
    // Sticky pill: the two Sites, plus the Window toggle moved inside so only ONE sticky bar eats the screen.
    const sw = document.querySelector(".site-switch");
    const pill = document.createElement("nav");
    pill.className = "pill";
    pill.innerHTML = `<div class="pill-sites"><a class="on" href="index.html">โพธาราม</a><a href="bangkruai.html">บางกรวย</a></div>`;
    sw.replaceWith(pill);
    pill.appendChild(document.getElementById("window-toggle"));
    // Live-dot in the header line
    const h1 = document.querySelector("h1");
    h1.insertAdjacentHTML("afterbegin", `<span class="live-dot" aria-hidden="true"></span>`);

    // Count-up: wrap the first number in each big value, animate 0 → value when it appears.
    const numRe = /^(\s*[≈]?\s*)(-?[\d,]*\.?\d+)/;
    function wrapNums(root) {
      root.querySelectorAll(".here .flow-value, .station-level").forEach((el) => {
        if (el.dataset.numDone) return;
        for (const n of el.childNodes) {
          if (n.nodeType !== 3) continue;
          const m = n.textContent.match(numRe);
          if (!m) continue;
          el.dataset.numDone = "1";
          const span = document.createElement("span");
          span.className = "num";
          span.textContent = m[2];
          n.textContent = n.textContent.slice(m[0].length);
          n.before(m[1].replace(/\s+/g, " "), span);
          countUp(span);
          break;
        }
      });
    }
    function countUp(span) {
      const txt = span.textContent;
      const target = parseFloat(txt.replace(/,/g, ""));
      if (Number.isNaN(target)) return;
      const dec = (txt.split(".")[1] || "").length;
      const fmt = (v) => (txt.includes(",") ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec));
      const t0 = performance.now() + 150, D = 1100;
      span.textContent = fmt(0);
      (function tick(t) {
        const p = Math.min(1, Math.max(0, (t - t0) / D));
        span.textContent = fmt(target * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      })(performance.now());
    }
    new MutationObserver(() => {
      const note = pill.querySelector(".wt-note");
      if (note) pill.after(note);
      wrapNums(document);
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
