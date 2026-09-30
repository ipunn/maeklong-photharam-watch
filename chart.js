// The one small time-series chart both pages draw. The numbers come from chartModel (parse.js,
// tested); this only turns them into markup. Needs parse.js first.
//
// What it shows, so nothing has to be guessed:
//   - the vertical scale: the highest and lowest value of the scale in the left margin (and the
//     unit under them), plus a dashed line and its own label for a reference level, if there is one;
//   - the time scale: hour ticks shared by every box, a date label where the day changes;
//   - gaps: hours with no reading are shaded and named, and the line breaks there.
(function () {
  const W = 300;
  const H = 56;
  const PAD_X = 6; // horizontal padding inside the svg, in viewBox units
  const MIN_GAP_LABEL = 0.3; // a gap this wide (fraction of the axis) is big enough to carry its own label

  // A tick on the left edge keeps its gridline but not its label: the label would sit on the unit in the margin.
  const EDGE_FRAC = 0.04;
  const MIN_LABEL_GAP_Y = 0.2; // labels closer than this (of the plot height, about 11 px) would overlap

  // Moves labels apart so their text does not overlap (display only; the value stays true and the
  // gridline stays where the value is). Top to bottom, keeping inside the plot.
  function spaceLabels(labels) {
    const ys = labels.map((l) => l.y);
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + MIN_LABEL_GAP_Y);
    for (let i = ys.length - 1; i >= 0; i--) {
      ys[i] = Math.min(ys[i], 1 - 0.05 - (ys.length - 1 - i) * MIN_LABEL_GAP_Y);
      if (i < ys.length - 1) ys[i] = Math.min(ys[i], ys[i + 1] - MIN_LABEL_GAP_Y);
    }
    return labels.map((l, i) => ({ ...l, shownY: ys[i] }));
  }

  const px = (frac) => PAD_X + frac * (W - PAD_X * 2); // viewBox x
  const pct = (frac) => ((px(frac) / W) * 100).toFixed(2); // the same position as a CSS percentage
  const dayLabel = (ms) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }).format(ms);

  // opts: { points: [{t, v}], startT, endT, windowH, minRange, digits, unit, ariaLabel,
  //         reference: { v, note } | null, maxStepMs }
  // Returns "" when nothing falls inside the Window, so the caller can show its own empty message.
  function renderChart(opts) {
    const m = chartModel(opts.points, {
      startT: opts.startT,
      endT: opts.endT,
      minRange: opts.minRange,
      reference: opts.reference,
      maxStepMs: opts.maxStepMs,
    });
    if (!m) return "";
    const digits = opts.digits ?? 2;
    const num = (v) => v.toFixed(digits);

    const ticks = axisTicks(opts.startT, opts.endT, opts.windowH).map((k) => ({ ...k, frac: (k.t - opts.startT) / (opts.endT - opts.startT) }));
    const vGrid = ticks
      .map((k) => `<line class="spark-grid"${k.midnight ? " data-midnight" : ""} x1="${px(k.frac).toFixed(1)}" y1="0" x2="${px(k.frac).toFixed(1)}" y2="${H}" />`)
      .join("");
    // the reference has its own dashed line, so it gets no plain gridline underneath
    const hGrid = m.yLabels.filter((l) => l !== m.reference).map((l) => `<line class="spark-hgrid" x1="0" y1="${(l.y * H).toFixed(1)}" x2="${W}" y2="${(l.y * H).toFixed(1)}" />`).join("");
    const refLine = m.reference ? `<line class="spark-ref" x1="0" y1="${(m.reference.y * H).toFixed(1)}" x2="${W}" y2="${(m.reference.y * H).toFixed(1)}" />` : "";
    const gapRects = m.gaps.map((g) => `<rect class="spark-gap" x="${px(g.x0).toFixed(1)}" y="0" width="${(px(g.x1) - px(g.x0)).toFixed(1)}" height="${H}" />`).join("");
    const lines = m.segments
      .map((seg) =>
        seg.length > 1
          ? `<polyline class="spark-line" points="${seg.map((p) => `${px(p.x).toFixed(1)},${(p.y * H).toFixed(1)}`).join(" ")}" />`
          : seg[0].x === m.last.x && seg[0].y === m.last.y
            ? "" // the newest reading is drawn as the end dot below
            : `<path class="spark-dot spark-dot-small" d="M${px(seg[0].x).toFixed(1)} ${(seg[0].y * H).toFixed(1)}h0" />`,
      )
      .join("");
    const lastDot = `<path class="spark-dot" d="M${px(m.last.x).toFixed(1)} ${(m.last.y * H).toFixed(1)}h0" />`;

    const yLabels = spaceLabels(m.yLabels)
      .map((l) => `<span class="spark-ylab${m.reference && l.v === m.reference.v ? " ref" : ""}" style="top:${(l.shownY * 100).toFixed(1)}%">${num(l.v)}</span>`)
      .join("");
    const gapLabels = m.gaps
      .filter((g) => g.x1 - g.x0 >= MIN_GAP_LABEL)
      .map((g) => `<span class="spark-gaplab" style="left:${pct(g.x0)}%;width:${(pct(g.x1) - pct(g.x0)).toFixed(2)}%">ไม่มีข้อมูล ${Math.round(g.hours)} ชม.</span>`)
      .join("");
    const tickLabels = ticks
      .map((k) => `<span class="tick${k.frac < EDGE_FRAC ? " edge" : ""}"${k.midnight ? " data-midnight" : ""} style="left:${pct(k.frac)}%">${k.midnight ? dayLabel(k.t) : `${String(k.hour).padStart(2, "0")}:00`}</span>`)
      .join("");
    // A long unit does not fit the margin; those charts carry it in their caption instead.
    const unitLabel = opts.unit && opts.unit.length <= 7 ? `<div class="spark-yunit">${opts.unit}</div>` : "";

    const cover = m.missingHours >= 1 ? `<div class="spark-cover">ไม่มีข้อมูลในช่วงนี้ ${Math.round(m.missingHours)} ชม.</div>` : "";
    const legend = m.reference && opts.reference.note
      ? `<div class="spark-legend"><span class="spark-legend-line"></span>${num(m.reference.v)}${opts.unit ? ` ${opts.unit}` : ""} · ${opts.reference.note}</div>`
      : "";

    return `<div class="spark-plot">
        <div class="spark-canvas">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${opts.ariaLabel || ""}">${gapRects}${hGrid}${vGrid}${refLine}${lines}${lastDot}</svg>
          ${yLabels}${gapLabels}
        </div>
        <div class="spark-axis${ticks.length > 6 ? " dense" : ""}">${unitLabel}${tickLabels}</div>
      </div>${cover}${legend}`;
  }

  window.renderChart = renderChart;
})();
