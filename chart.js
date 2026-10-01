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
  //         references: [{ v, level, name }], referenceProximity, scaleSteps, referenceNote, maxStepMs }
  // `scaleSteps`: round the scale up to one of these heights (metres) and print it under the chart.
  // `referenceProximity`: draw a reference only while the readings are within that distance of it.
  // `level` picks the line's colour (CSS: data-level); `name` is its colour in words, so the meaning
  // never rests on colour alone.
  // Returns "" when nothing falls inside the Window, so the caller can show its own empty message.
  function renderChart(opts) {
    const m = chartModel(opts.points, {
      startT: opts.startT,
      endT: opts.endT,
      minRange: opts.minRange,
      references: opts.references || [],
      referenceProximity: opts.referenceProximity ?? null,
      scaleSteps: opts.scaleSteps || null,
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
    const hGrid = m.yLabels.filter((l) => !m.references.includes(l)).map((l) => `<line class="spark-hgrid" x1="0" y1="${(l.y * H).toFixed(1)}" x2="${W}" y2="${(l.y * H).toFixed(1)}" />`).join("");
    const refLines = m.references.map((r) => `<line class="spark-ref" data-level="${r.level || ""}" x1="0" y1="${(r.y * H).toFixed(1)}" x2="${W}" y2="${(r.y * H).toFixed(1)}" />`).join("");
    const gapRects = m.gaps.map((g) => `<rect class="spark-gap" x="${px(g.x0).toFixed(1)}" y="0" width="${(px(g.x1) - px(g.x0)).toFixed(1)}" height="${H}" />`).join("");
    const lines = m.segments
      .filter((seg) => seg.length > 1)
      .map((seg) => `<polyline class="spark-line" points="${seg.map((p) => `${px(p.x).toFixed(1)},${(p.y * H).toFixed(1)}`).join(" ")}" />`)
      .join("");
    // Dots are HTML circles, not zero-length SVG strokes: the svg is stretched (preserveAspectRatio none)
    // and some browsers (iOS Safari) draw such a stroke as an oval. A lone reading gets a small dot; the newest, a larger one.
    const dot = (pt, cls) => `<span class="spark-dot${cls}" aria-hidden="true" style="left:${pct(pt.x)}%;top:${(pt.y * 100).toFixed(2)}%"></span>`;
    const dots = m.segments
      .filter((seg) => seg.length === 1 && !(seg[0].x === m.last.x && seg[0].y === m.last.y))
      .map((seg) => dot(seg[0], " spark-dot-small"))
      .join("");
    const lastDot = dot(m.last, "");

    const yLabels = spaceLabels(m.yLabels)
      .map((l) => `<span class="spark-ylab${m.references.some((r) => r.v === l.v) ? " ref" : ""}" data-level="${(m.references.find((r) => r.v === l.v) || {}).level || ""}" style="top:${(l.shownY * 100).toFixed(1)}%">${num(l.v)}</span>`)
      .join("");
    const gapLabels = m.gaps
      .filter((g) => !g.trailing && g.x1 - g.x0 >= MIN_GAP_LABEL) // a gap running to the right edge is already said by the caption and stale badge
      .map((g) => `<span class="spark-gaplab" style="left:${pct(g.x0)}%;width:${(pct(g.x1) - pct(g.x0)).toFixed(2)}%">ไม่มีข้อมูล ${Math.round(g.hours)} ชม.</span>`)
      .join("");
    const tickLabels = ticks
      .map((k) => `<span class="tick${k.frac < EDGE_FRAC ? " edge" : ""}"${k.midnight ? " data-midnight" : ""} style="left:${pct(k.frac)}%">${k.midnight ? dayLabel(k.t) : `${String(k.hour).padStart(2, "0")}:00`}</span>`)
      .join("");
    // A long unit does not fit the margin; those charts carry it in their caption instead.
    const unitLabel = opts.unit && opts.unit.length <= 7 ? `<div class="spark-yunit">${opts.unit}</div>` : "";

    // With stepped scales the height the chart stands for is printed, so steepness is never guessed.
    const scale = opts.scaleSteps ? `<div class="spark-scale">สเกลกราฟ ${(m.max - m.min).toFixed(2)} ม. (ระหว่างตัวเลขบนสุดและล่างสุด)</div>` : "";
    const cover = m.missingHours >= 1 ? `<div class="spark-cover">ไม่มีข้อมูลในช่วงนี้ ${Math.round(m.missingHours)} ชม.</div>` : "";
    const legend = m.references.length
      ? `<div class="spark-legend">${[...m.references].reverse().map((r) => `<span class="spark-legend-item"><span class="spark-legend-line" data-level="${r.level || ""}"></span>${num(r.v)}${r.name ? ` ${r.name}` : ""}</span>`).join(" ")}${opts.unit ? ` ${opts.unit}` : ""}${opts.referenceNote ? ` · ${opts.referenceNote}` : ""}</div>`
      : "";

    return `<div class="spark-plot"${m.references.length ? " data-tall" : ""}>
        <div class="spark-canvas">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${opts.ariaLabel || ""}">${gapRects}${hGrid}${vGrid}${refLines}${lines}</svg>
          ${dots}${lastDot}${yLabels}${gapLabels}
        </div>
        <div class="spark-axis${ticks.length > 6 ? " dense" : ""}">${unitLabel}${tickLabels}</div>
      </div>${cover}${scale}${legend}`;
  }

  // A gauge that has readings, but none inside the Window (it went quiet): the same time axis with the
  // whole span shaded, and no line or vertical scale, since there is nothing to scale. The caption
  // says it in words. Same opts as renderChart (uses startT, endT, windowH).
  function renderEmptyChart(opts) {
    const ticks = axisTicks(opts.startT, opts.endT, opts.windowH).map((k) => ({ ...k, frac: (k.t - opts.startT) / (opts.endT - opts.startT) }));
    const vGrid = ticks
      .map((k) => `<line class="spark-grid"${k.midnight ? " data-midnight" : ""} x1="${px(k.frac).toFixed(1)}" y1="0" x2="${px(k.frac).toFixed(1)}" y2="${H}" />`)
      .join("");
    const tickLabels = ticks
      .map((k) => `<span class="tick${k.frac < EDGE_FRAC ? " edge" : ""}"${k.midnight ? " data-midnight" : ""} style="left:${pct(k.frac)}%">${k.midnight ? dayLabel(k.t) : `${String(k.hour).padStart(2, "0")}:00`}</span>`)
      .join("");
    return `<div class="spark-plot">
        <div class="spark-canvas">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${opts.ariaLabel || ""}"><rect class="spark-gap" x="${px(0)}" y="0" width="${px(1) - px(0)}" height="${H}" />${vGrid}</svg>
        </div>
        <div class="spark-axis${ticks.length > 6 ? " dense" : ""}">${tickLabels}</div>
      </div><div class="spark-cover">ไม่มีข้อมูลใน ${opts.windowH} ชม. ล่าสุด</div>`;
  }

  window.renderChart = renderChart;
  window.renderEmptyChart = renderEmptyChart;
})();
