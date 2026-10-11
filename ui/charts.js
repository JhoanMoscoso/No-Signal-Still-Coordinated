// Pure chart builders: take numbers, return SVG/HTML strings. No DOM access.
// All colours live in main.css (classes c-*, node); geometry lives here.

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ENT[c]);

// One percentage format everywhere: "85.4 %".
export const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)} %`;
// Same format, trailing ".0" dropped (mark labels: "75 %", "85.4 %").
export const pctMin = (x) => pct(x).replace('.0 %', ' %');

const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const n = (x) => +x.toFixed(2);

// Horizontal 0-100 % bar with labelled vertical marks (alternating above/below).
export function hbar({ value, sigma, marks = [], label, text }) {
  const X0 = 20, W = 440, TOP = 38, H = 26;
  const v = clamp01(value);
  const valueText = text ?? (sigma != null ? `${pct(v)} ± ${pct(sigma)}` : pct(v));   // text: e.g. "—" before any data
  const sorted = [...marks].sort((a, b) => a.at - b.at);
  const aria = `${label}: ${valueText}.` +
    (sorted.length ? ` Marks: ${sorted.map((m) => `${m.label} ${pctMin(clamp01(m.at))}`).join(', ')}.` : '');

  // Error bar: thin segment in the lower part of the bar, so it never collides with the marks.
  let err = '';
  if (sigma != null && sigma > 0) {
    const a = X0 + clamp01(v - sigma) * W, b = X0 + clamp01(v + sigma) * W, y = TOP + H * 0.72;
    err = `<g class="c-err"><line x1="${n(a)}" y1="${n(y)}" x2="${n(b)}" y2="${n(y)}"/>` +
      `<line x1="${n(a)}" y1="${n(y - 4)}" x2="${n(a)}" y2="${n(y + 4)}"/>` +
      `<line x1="${n(b)}" y1="${n(y - 4)}" x2="${n(b)}" y2="${n(y + 4)}"/></g>`;
  }

  const markSvg = sorted.map((m, i) => {
    const at = clamp01(m.at), x = n(X0 + at * W), above = i % 2 === 0;
    const anchor = at < 0.2 ? 'start' : at > 0.8 ? 'end' : 'middle';
    const y = above ? 16 : 94;
    return `<line class="c-mark-halo" x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${TOP + H + 8}"/>` +
      `<line class="c-mark" x1="${x}" y1="${TOP - 8}" x2="${x}" y2="${TOP + H + 8}"/>` +
      `<text class="c-mark-label" x="${x}" y="${y}" text-anchor="${anchor}">${esc(m.label)} ${pctMin(at)}</text>`;
  }).join('');

  return `<div class="chart hbar"><div class="chart__head"><span class="chart__label">${esc(label)}</span>` +
    `<strong class="chart__value">${esc(valueText)}</strong></div>` +
    `<svg viewBox="0 0 480 104" role="img" aria-label="${esc(aria)}"><title>${esc(aria)}</title>` +
    `<rect class="c-track" x="${X0}" y="${TOP}" width="${W}" height="${H}" rx="4"/>` +
    `<rect class="c-fill" width="${n(v * W)}" x="${X0}" y="${TOP}" height="${H}" rx="4"/>` +
    err + markSvg +
    `<text class="c-axis" x="${X0}" y="${TOP + H + 22}" text-anchor="start">0 %</text>` +
    `<text class="c-axis" x="${X0 + W}" y="${TOP + H + 22}" text-anchor="end">100 %</text>` +
    `</svg></div>`;
}

// Two horizontal bars "0" and "1" with percentages as text and a 50 % reference.
export function histogram2({ p0, p1, label }) {
  const X0 = 36, W = 330, H = 28, rows = [['0', clamp01(p0), 14], ['1', clamp01(p1), 62]];
  const aria = `${label}: outcome 0 ${pct(p0)}, outcome 1 ${pct(p1)}.`;
  const bars = rows.map(([k, p, y]) =>
    `<text class="c-bin" x="14" y="${y + H / 2}" dy=".35em" text-anchor="middle">${k}</text>` +
    `<rect class="c-track" x="${X0}" y="${y}" width="${W}" height="${H}" rx="4"/>` +
    `<rect class="c-fill" width="${n(p * W)}" x="${X0}" y="${y}" height="${H}" rx="4"/>` +
    `<text class="c-pct" x="${X0 + W + 12}" y="${y + H / 2}" dy=".35em">${pct(p)}</text>`).join('');
  const half = n(X0 + W / 2);
  return `<div class="chart histogram"><div class="chart__head"><span class="chart__label">${esc(label)}</span></div>` +
    `<svg viewBox="0 0 480 120" role="img" aria-label="${esc(aria)}"><title>${esc(aria)}</title>${bars}` +
    `<line class="c-mark" x1="${half}" y1="6" x2="${half}" y2="98"/>` +
    `<text class="c-axis" x="${half}" y="114" text-anchor="middle">50 %</text></svg></div>`;
}

// Row of circles: on = filled + bold state text, off = outline. Optional second line `note`.
export function nodes(list) {
  const STEP = 150, R = 30;
  const aria = list.map((d) => `${d.name}: ${d.state}${d.note ? ` ${d.aria ?? d.note}` : ''}`).join('; ');
  const items = list.map((d, i) => {
    const cx = STEP / 2 + i * STEP, cls = d.on ? 'is-on' : 'is-off';
    return `<g class="node ${cls}">` +
      `<circle cx="${cx}" cy="44" r="${R}"/>` +
      `<text class="node__name" x="${cx}" y="44" dy=".35em" text-anchor="middle">${esc(d.name)}</text>` +
      `<text class="node__state" x="${cx}" y="104" text-anchor="middle">${esc(d.state)}</text>` +
      (d.note ? `<text class="node__note" x="${cx}" y="124" text-anchor="middle">${esc(d.note)}</text>` : '') +
      `</g>`;
  }).join('');
  return `<div class="chart nodes"><svg viewBox="0 0 ${list.length * STEP} 134" role="img" ` +
    `aria-label="${esc(aria)}"><title>${esc(aria)}</title>${items}</svg></div>`;
}

// ---- Curve plot (Act 3) ----
// Fixed geometry so act3 can move the slider marker with setAttribute (no redraw).
const CP = { W: 548, H: 300, X0: 46, X1: 404, TOP: 22, BOT: 246 };
export const xToPx = (v) => n(CP.X0 + clamp01(v) * (CP.X1 - CP.X0));
export const yToPx = (v, [lo, hi] = [0, 1]) => n(CP.BOT - Math.min(1, Math.max(0, (v - lo) / (hi - lo))) * (CP.BOT - CP.TOP));
export const markerLabelX = (v) => xToPx(v);   // the "V = ..." tag moves with the marker

const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const textBox = (x, y, text, anchor, size = 7.4) => {
  const w = Math.max(14, text.length * size);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { x0, x1: x0 + w, y0: y - 11, y1: y + 3 };
};

// Curves distinguished by stroke pattern (solid / dashed / dotted) plus an end-of-curve label.
// points: shape 'circle' = "this run" (ring + dot, so a diamond underneath stays visible),
// 'diamond' = hollow fixed reference. Non-finite points are skipped; out-of-frame values are
// clamped to the edge and say so in their <title>.
export function curvePlot({ xs, series, hlines = [], vlines = [], points = [], markerId, markerV = 1, label, ariaLabel = '', y = [0, 1] }) {
  const [lo, hi] = y, PH = CP.BOT - CP.TOP;
  const yPx = (v) => yToPx(v, y);
  const DASH = { dash: '7 4', dot: '1.5 4' };
  const pts0 = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  const aria = [label,
    ...hlines.map((h) => `${h.label} at ${h.y.toFixed(2)}`),
    ...vlines.map((v) => `${v.label} at V = ${v.x.toFixed(3)}`),
    `Curves: ${series.map((s) => s.label).join(', ')}`,
    pts0.length ? `Points: ${pts0.map((p) => p.title ?? p.label).join('; ')}` : '', ariaLabel,
  ].filter(Boolean).join('. ');

  const step = hi - lo <= 0.5 ? 0.1 : 0.25;
  let grid = '';
  for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) {
    grid += `<line class="c-grid" x1="${CP.X0}" y1="${yPx(t)}" x2="${CP.X1}" y2="${yPx(t)}"/>` +
      `<text class="c-axis" x="${CP.X0 - 6}" y="${yPx(t)}" dy=".35em" text-anchor="end">${Math.round(t * 100)} %</text>`;
  }
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    grid += `<line class="c-tick" x1="${xToPx(t)}" y1="${CP.BOT}" x2="${xToPx(t)}" y2="${CP.BOT + 5}"/>` +
      `<text class="c-axis" x="${xToPx(t)}" y="${CP.BOT + 20}" text-anchor="middle">${t}</text>`;
  }
  const axes = `<rect class="c-frame" x="${CP.X0}" y="${CP.TOP}" width="${CP.X1 - CP.X0}" height="${PH}"/>` +
    `<text class="c-axis" x="${n((CP.X0 + CP.X1) / 2)}" y="${CP.BOT + 40}" text-anchor="middle">visibility V</text>`;

  // Obstacles for point labels: marker-tag strip, reference lines and their labels, end labels.
  const boxes = [{ x0: 0, x1: CP.W, y0: 0, y1: 20 }];
  const refs = hlines.map((h) => {
    const ly = Number(yPx(h.y)) - 6;
    boxes.push({ x0: CP.X0, x1: CP.X1, y0: ly + 3, y1: ly + 11 }, textBox(CP.X0 + 6, ly, h.label, 'start', 7.6));
    return `<line class="c-ref" x1="${CP.X0}" y1="${yPx(h.y)}" x2="${CP.X1}" y2="${yPx(h.y)}"/>` +
      `<text class="c-ref-label" x="${CP.X0 + 6}" y="${n(ly)}" text-anchor="start">${esc(h.label)}</text>`;
  }).join('') + vlines.map((v) => {
    const x = Number(xToPx(v.x)), left = v.x > 0.5, anchor = left ? 'end' : 'start', lx = x + (left ? -6 : 6);
    boxes.push({ x0: x - 4, x1: x + 4, y0: CP.TOP, y1: CP.BOT }, textBox(lx, CP.TOP + 14, v.label, anchor, 7.6));
    return `<line class="c-ref" x1="${x}" y1="${CP.TOP}" x2="${x}" y2="${CP.BOT}"/>` +
      `<text class="c-ref-label" x="${n(lx)}" y="${CP.TOP + 14}" text-anchor="${anchor}">${esc(v.label)}</text>`;
  }).join('');

  const curves = series.map((s) => {
    const d = xs.map((x, i) => `${i ? 'L' : 'M'}${xToPx(x)} ${yPx(s.ys[i])}`).join('');
    const da = DASH[s.dash] ? ` stroke-dasharray="${DASH[s.dash]}"` : '';
    return `<path class="c-series" d="${d}" fill="none"${da}/>`;
  }).join('');
  // End labels: curves that finish together get pushed apart (lowest stays, others move up).
  // They start well right of the frame so a point at V = 1 never touches them.
  const ends = series.map((s) => ({ t: s.label, da: DASH[s.dash], y: Number(yPx(s.ys[s.ys.length - 1])) + 4 })).sort((a, b) => b.y - a.y);
  for (let k = 1; k < ends.length; k++) if (ends[k - 1].y - ends[k].y < 15) ends[k].y = ends[k - 1].y - 15;
  const endSvg = ends.map((e) => {
    boxes.push({ x0: CP.X1 + 10, x1: CP.W, y0: e.y - 14, y1: e.y + 4 });
    return `<line class="c-series-sample" x1="${CP.X1 + 14}" y1="${n(e.y - 4)}" x2="${CP.X1 + 36}" y2="${n(e.y - 4)}"${e.da ? ` stroke-dasharray="${e.da}"` : ''}/>` +
      `<text class="c-end-label" x="${CP.X1 + 42}" y="${n(e.y)}" text-anchor="start">${esc(e.t)}</text>`;
  }).join('');

  const mx = xToPx(markerV);
  const marker = `<line id="${esc(markerId)}" class="c-slider-marker" data-slot="marker" x1="${mx}" y1="${CP.TOP}" x2="${mx}" y2="${CP.BOT}"/>` +
    `<text id="${esc(markerId)}-label" class="c-marker-label" x="${markerLabelX(markerV)}" y="16" text-anchor="middle">V = ${clamp01(markerV).toFixed(2)}</text>`;

  // Points: shapes first (rings under diamonds), then each label placed beside its own point.
  const info = pts0.map((p) => {
    const ring = p.shape !== 'diamond', r = ring ? 9 : 6;
    const px = Number(xToPx(p.x)), py = Number(yPx(p.y));
    const edge = [];
    if (p.x < 0 || p.x > 1) edge.push(`V = ${p.x.toFixed(2)} (shown at edge)`);
    if (p.y < lo || p.y > hi) edge.push(`value ${pct(p.y)} (shown at edge)`);
    return { p, ring, r, px, py, title: `${p.title ?? p.label}${edge.length ? ` — ${edge.join(', ')}` : ''}` };
  });
  const shapes = info.map((q) => ({ x0: q.px - q.r - 1, x1: q.px + q.r + 1, y0: q.py - q.r - 1, y1: q.py + q.r + 1 }));
  const placed = [];
  const labelSvg = info.map((q, i) => {
    const r = q.r, text = q.p.label;
    const cands = [[0, r + 17, 'middle'], [-(r + 5), r + 16, 'end'], [r + 5, r + 16, 'start'], [0, -(r + 10), 'middle'],
      [-(r + 6), -(r + 8), 'end'], [r + 6, -(r + 8), 'start'], [-(r + 10), 4, 'end'], [r + 10, 4, 'start'],
      [0, r + 30, 'middle'], [-(r + 5), r + 29, 'end'], [r + 5, r + 29, 'start']];
    let best = null;
    for (const [dx, dy, anchor] of cands) {
      const lx = q.px + dx, ly = q.py + dy, b = textBox(lx, ly, text, anchor);
      const others = [...boxes, ...placed, ...shapes.filter((_, j) => j !== i)];
      const hits = others.filter((o) => overlap(b, o)).length + (overlap(b, shapes[i]) ? 3 : 0) +
        (b.x0 < 0 || b.x1 > CP.W || b.y1 > CP.H ? 5 : 0);
      if (!best || hits < best.hits) best = { hits, lx, ly, anchor, b };
      if (hits === 0) break;
    }
    placed.push(best.b);
    // Crowded cluster: a thin leader line runs from the point to the nearest edge of its label.
    const crowded = info.some((o, j) => j !== i && Math.hypot(o.px - q.px, o.py - q.py) < 34);
    const ex = Math.min(best.b.x1, Math.max(best.b.x0, q.px)), ey = Math.min(best.b.y1 - 3, Math.max(best.b.y0 + 3, q.py));
    return {
      leader: crowded ? `<line class="pt-leader" x1="${q.px}" y1="${q.py}" x2="${n(ex)}" y2="${n(ey)}"/>` : '',
      label: `<text class="pt-label" x="${n(best.lx)}" y="${n(best.ly)}" text-anchor="${best.anchor}">${esc(text)}</text>`,
    };
  });
  const shapeSvg = (list) => list.map((q) => `<g><title>${esc(q.title)}</title>` + (q.ring
    ? `<circle class="pt pt-circle" cx="${q.px}" cy="${q.py}" r="9"/><circle class="pt-dot" cx="${q.px}" cy="${q.py}" r="3"/>`
    : `<path class="pt pt-diamond" d="M${q.px} ${q.py - 6}L${q.px + 6} ${q.py}L${q.px} ${q.py + 6}L${q.px - 6} ${q.py}Z"/>`) + `</g>`).join('');
  const pts = labelSvg.map((l) => l.leader).join('') + shapeSvg(info.filter((q) => q.ring)) + shapeSvg(info.filter((q) => !q.ring)) +
    labelSvg.map((l) => l.label).join('');

  return `<div class="chart curve"><div class="chart__head"><span class="chart__label">${esc(label)}</span></div>` +
    `<svg viewBox="0 0 ${CP.W} ${CP.H}" role="img" aria-label="${esc(aria)}"><title>${esc(aria)}</title>` +
    `${grid}${axes}${refs}${curves}${endSvg}${marker}${pts}</svg></div>`;
}
