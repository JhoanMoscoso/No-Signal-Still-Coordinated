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
