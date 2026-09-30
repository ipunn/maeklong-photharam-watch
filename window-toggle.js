// The Window toggle: one 6 / 12 / 24 h choice for every hourly chart and trend on a page.
// The choice is remembered (localStorage, shared by both pages) and mirrored into the URL
// (`?window=12`) so a link carries the view. Both are best-effort: blocked storage or a
// missing history API just means the page starts at the default. Needs parse.js first.
(function () {
  const KEY = "windowH";

  function stored() {
    try { return localStorage.getItem(KEY); } catch (err) { return null; }
  }

  let current = resolveWindow(location.search, stored());

  function remember(h) {
    try { localStorage.setItem(KEY, String(h)); } catch (err) { /* private mode: fine */ }
    try {
      const url = new URL(location.href);
      url.searchParams.set("window", String(h));
      history.replaceState(null, "", url);
    } catch (err) { /* no history API: fine */ }
  }

  // Draws the buttons into `el` and calls `onChange(hours)` after each change. `note` is one
  // line under the bar saying what does NOT follow the Window on this page.
  function mount(el, note, onChange) {
    if (!el) return;
    el.innerHTML = `<div class="wt-row"><span class="wt-label">ช่วงเวลา</span>
      <div class="wt-buttons" role="group" aria-label="ช่วงเวลาของกราฟและแนวโน้ม">${WINDOWS_H.map(
        (h) => `<button type="button" class="wt-btn" data-h="${h}" aria-pressed="${h === current}">${h} ชม.</button>`,
      ).join("")}</div></div>`;
    // The note sits below the bar, outside the sticky part: on a phone it wraps to two lines,
    // and a tall sticky bar would eat the screen.
    el.insertAdjacentHTML("afterend", `<div class="wt-note">${note}</div>`);
    el.addEventListener("click", (e) => {
      const btn = e.target.closest(".wt-btn");
      if (!btn) return;
      const h = Number(btn.dataset.h);
      if (h === current) return;
      current = h;
      remember(h);
      el.querySelectorAll(".wt-btn").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.h) === h)));
      onChange(h);
    });
  }

  window.WindowToggle = { mount, current: () => current };
})();
