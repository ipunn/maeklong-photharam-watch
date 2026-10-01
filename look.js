// Dresses both pages: the sticky pill (the two Sites + the Window toggle in one bar), the live dot,
// and a count-up on the big numerals. Pure decoration over what app.js / bangkruai.js render.
(function () {
  const sw = document.querySelector(".site-switch");
  const toggle = document.getElementById("window-toggle");
  if (!sw || !toggle) return;

  const onBangkruai = /bangkruai/.test(location.pathname);
  const pill = document.createElement("nav");
  pill.className = "pill";
  pill.setAttribute("aria-label", "เลือกพื้นที่");
  pill.innerHTML = `<div class="pill-sites">
    <a href="index.html"${onBangkruai ? "" : ' class="on" aria-current="page"'}>โพธาราม</a>
    <a href="bangkruai.html"${onBangkruai ? ' class="on" aria-current="page"' : ""}>บางกรวย</a></div>`;
  sw.replaceWith(pill);
  // The Window toggle lives in the pill so only ONE sticky bar takes screen on a phone.
  pill.appendChild(toggle);

  document.querySelector("h1").insertAdjacentHTML("afterbegin", `<span class="live-dot" aria-hidden="true"></span>`);

  // The first number in each big value counts up from 0 when it appears.
  const numRe = /^(\s*[≈]?\s*)(-?[\d,]*\.?\d+)/;
  function countUp(span) {
    const txt = span.textContent;
    const target = parseFloat(txt.replace(/,/g, ""));
    if (Number.isNaN(target)) return;
    const dec = (txt.split(".")[1] || "").length;
    const fmt = (v) => v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: txt.includes(",") });
    const t0 = performance.now() + 150;
    const D = 1100;
    span.textContent = fmt(0);
    (function tick(t) {
      const p = Math.min(1, Math.max(0, (t - t0) / D));
      span.textContent = fmt(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    })(performance.now());
  }
  function dress() {
    // window-toggle.js puts its note right after the toggle, i.e. inside the pill; move it below.
    const note = pill.querySelector(".wt-note");
    if (note) pill.after(note);
    document.querySelectorAll(".here .flow-value, .station-level").forEach((el) => {
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
  new MutationObserver(dress).observe(document.body, { childList: true, subtree: true });
  dress();
})();
