import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pct, pctMin, esc, hbar, histogram2, nodes } from '../../ui/charts.js';

const attr = (svg, cls, name) => {
  const m = svg.match(new RegExp(`class="${cls}"[^>]*?\\s${name}="([-\\d.]+)"`));
  return m ? Number(m[1]) : null;
};

test('pct: one format everywhere', () => {
  assert.equal(pct(0.854), '85.4 %');
  assert.equal(pct(0.75), '75.0 %');
  assert.equal(pct(1, 0), '100 %');
  assert.equal(pct(0.8536, 2), '85.36 %');
  assert.equal(pct(0), '0.0 %');
});

test('pctMin: minimal digits for marks', () => {
  assert.equal(pctMin(0.75), '75 %');
  assert.equal(pctMin(0.8536), '85.4 %');
  assert.equal(pctMin(0.7071), '70.7 %');
});

test('esc: escapes markup characters', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('hbar: accessible svg with value text, sigma and marks', () => {
  const html = hbar({
    value: 0.844, sigma: 0.0057, label: 'Quantum win rate',
    marks: [{ at: 0.75, label: 'classical limit' }, { at: 0.8536, label: 'Tsirelson bound' }],
  });
  assert.match(html, /<svg[^>]*role="img"/);
  assert.match(html, /aria-label="[^"]*Quantum win rate[^"]*84\.4 %/);
  assert.match(html, /<title>/);
  assert.ok(html.includes('84.4 % ± 0.6 %'), 'value with sigma as text');
  assert.ok(html.includes('classical limit'));
  assert.ok(html.includes('Tsirelson bound'));
  // marks drop a trailing ".0": 75 %, 85.4 %
  assert.ok(html.includes('classical limit 75 %') && html.includes('Tsirelson bound 85.4 %'));
  assert.ok(!html.includes('75.0 %'));
});

test('hbar: no sigma, no plus-minus sign', () => {
  const html = hbar({ value: 1, label: 'x' });
  assert.ok(!html.includes('±'));
  assert.ok(html.includes('100.0 %'));
});

test('hbar: value is clamped to 0..1', () => {
  const full = attr(hbar({ value: 1, label: 'x' }), 'c-fill', 'width');
  assert.equal(attr(hbar({ value: 1.7, label: 'x' }), 'c-fill', 'width'), full);
  assert.equal(attr(hbar({ value: -0.4, label: 'x' }), 'c-fill', 'width'), 0);
  assert.ok(full > 0);
});

test('hbar: close marks are staggered (different label rows)', () => {
  const html = hbar({
    value: 0.8, label: 'x',
    marks: [{ at: 0.75, label: 'classical limit' }, { at: 0.854, label: 'Tsirelson' }],
  });
  const ys = [...html.matchAll(/class="c-mark-label"[^>]*?\sy="([-\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(ys.length, 2);
  assert.notEqual(ys[0], ys[1]);
});

test('hbar: escapes labels', () => {
  const html = hbar({ value: 0.5, label: '<script>x</script>', marks: [{ at: 0.5, label: '<b>m</b>' }] });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;'));
});

test('histogram2: shows both percentages as text', () => {
  const html = histogram2({ p0: 0.485, p1: 0.515, label: "Bob's bit" });
  assert.match(html, /role="img"/);
  assert.ok(html.includes('48.5 %'));
  assert.ok(html.includes('51.5 %'));
  assert.match(html, /aria-label="[^"]*Bob(&#39;|')s bit[^"]*48\.5 %[^"]*51\.5 %/);
  assert.ok(html.includes('>0<') && html.includes('>1<'));
});

test('histogram2: bar widths follow probabilities', () => {
  const html = histogram2({ p0: 0.25, p1: 0.75, label: 'x' });
  const widths = [...html.matchAll(/class="c-fill"[^>]*?\swidth="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(widths.length, 2);
  assert.ok(Math.abs(widths[1] / widths[0] - 3) < 0.01);
});

test('nodes: on is filled + state text, off is outline', () => {
  const html = nodes([
    { name: 'A', state: 'LEADER', on: true },
    { name: 'B', state: 'idle', on: false },
  ]);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="[^"]*A: LEADER[^"]*B: idle/);
  assert.equal((html.match(/class="node is-on"/g) || []).length, 1);
  assert.equal((html.match(/class="node is-off"/g) || []).length, 1);
  assert.ok(html.includes('LEADER') && html.includes('idle'));
});

test('nodes: escapes name, state and note', () => {
  const html = nodes([{ name: '<i>', state: '"&"', on: false, note: '<u>' }]);
  assert.ok(!html.includes('<i>') && !html.includes('<u>'));
  assert.ok(html.includes('&lt;i&gt;') && html.includes('&quot;&amp;&quot;'));
});

test('hbar: text override replaces the value (e.g. no rounds played yet)', () => {
  const html = hbar({ value: 0, text: '—', label: 'Envelopes' });
  assert.ok(html.includes('<strong class="chart__value">—</strong>'));
  assert.ok(!html.includes('0.0 %'));
});

test('hbar: marks are drawn above the error bar, which sits below the bar centre', () => {
  const html = hbar({ value: 0.844, sigma: 0.006, label: 'x', marks: [{ at: 0.8536, label: 'T' }] });
  assert.ok(html.indexOf('class="c-mark"') > html.indexOf('class="c-err"'), 'z-order: marks on top');
  const y = Number(html.match(/class="c-err"><line [^>]*?y1="([\d.]+)"/)[1]);
  assert.ok(y > 38 + 26 / 2, `error bar y=${y} must be below the centre`);
});

test('nodes: optional aria override per node', () => {
  const html = nodes([{ name: 'A', state: '—', note: '31.4 %', aria: 'leader share 31.4 %', on: false }]);
  assert.match(html, /aria-label="A: — leader share 31\.4 %"/);
  assert.ok(html.includes('>31.4 %<'));
});

// ---- curvePlot ----
import { curvePlot, xToPx, yToPx } from '../../ui/charts.js';
import precomputed from '../../data/precomputed.js';

const NZ = precomputed.noise;
const leaderPlot = (extra = {}) => curvePlot({
  xs: NZ.v,
  series: [
    { ys: NZ.w_exactly_one, label: 'exactly one', dash: '' },
    { ys: NZ.w_split_brain, label: 'split-brain', dash: 'dash' },
    { ys: NZ.w_no_leader, label: 'no leader', dash: 'dot' },
  ],
  hlines: [{ y: 0.75, label: 'envelopes' }],
  vlines: [{ x: 0.7071, label: 'quantum stops helping' }],
  points: [
    { x: 0.949, y: 0.968, label: 'F0', shape: 'diamond' },
    { x: 0.936, y: 0.96, label: 'F1', shape: 'diamond' },
    { x: 0.952, y: 0.97, label: 'F2', shape: 'diamond' },
    { x: 1, y: 1, label: 'This run', shape: 'circle' },
  ],
  markerId: 'noise-marker-test', markerV: 0.5, label: 'Leader election vs V', ...extra,
});

test('curvePlot: accessible svg whose aria-label carries the key values', () => {
  const html = leaderPlot();
  assert.match(html, /<svg[^>]*role="img"/);
  assert.match(html, /<title>/);
  const aria = html.match(/aria-label="([^"]*)"/)[1];
  assert.ok(aria.includes('0.75') && aria.includes('0.707'), aria);
});

test('curvePlot: series, line and point labels are present', () => {
  const html = leaderPlot();
  for (const t of ['exactly one', 'split-brain', 'no leader', 'envelopes', 'quantum stops helping', 'F0', 'F1', 'F2', 'This run']) {
    assert.ok(html.includes(`>${t}<`), t);
  }
});

test('curvePlot: series differ by stroke pattern, not colour', () => {
  const html = leaderPlot();
  const paths = [...html.matchAll(/<path class="c-series"([^>]*)>/g)].map((m) => m[1]);
  assert.equal(paths.length, 3);
  const dashes = paths.map((p) => (p.match(/stroke-dasharray="([^"]*)"/) || [, 'solid'])[1]);
  assert.equal(new Set(dashes).size, 3, dashes.join(' | '));
});

test('curvePlot: end labels of curves that end together are pushed apart', () => {
  const html = leaderPlot();
  const ys = Object.fromEntries([...html.matchAll(/class="c-end-label"[^>]*?\sy="([-\d.]+)"[^>]*>([^<]*)</g)].map((m) => [m[2], Number(m[1])]));
  assert.ok(Math.abs(ys['split-brain'] - ys['no leader']) >= 12, JSON.stringify(ys));
});

// helpers: read labels and shape centres back out of the SVG string
const textsOf = (html, cls) => [...html.matchAll(new RegExp(`<text class="${cls}"[^>]*?\\sx="([-\\d.]+)"[^>]*?\\sy="([-\\d.]+)"[^>]*?text-anchor="(\\w+)"[^>]*>([^<]*)<`, 'g'))]
  .map((m) => ({ x: +m[1], y: +m[2], anchor: m[3], t: m[4] }));
const box = (l, w = 7.4) => {
  const wd = Math.max(14, l.t.length * w), x0 = l.anchor === 'middle' ? l.x - wd / 2 : l.anchor === 'end' ? l.x - wd : l.x;
  return { x0, x1: x0 + wd, y0: l.y - 11, y1: l.y + 3 };
};
const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const diamonds = (html) => [...html.matchAll(/class="pt pt-diamond" d="M([-\d.]+) ([-\d.]+)L/g)].map((m) => ({ x: +m[1], y: +m[2] + 6 }));
const rings = (html) => [...html.matchAll(/class="pt pt-circle" cx="([-\d.]+)" cy="([-\d.]+)"/g)].map((m) => ({ x: +m[1], y: +m[2] }));

test('curvePlot: ring for "this run" plus three diamonds, each label beside its own point', () => {
  const html = leaderPlot();
  assert.equal(diamonds(html).length, 3);
  assert.equal(rings(html).length, 1);
  const pts = { F0: [0.949, 0.968], F1: [0.936, 0.96], F2: [0.952, 0.97], 'This run': [1, 1] };
  const labels = textsOf(html, 'pt-label');
  assert.equal(labels.length, 4);
  for (const l of labels) {
    const [vx, vy] = pts[l.t];
    const d = Math.hypot(l.x - xToPx(vx), l.y - yToPx(vy));
    assert.ok(d <= (l.t === 'This run' ? 40 : 28), `${l.t} is ${d.toFixed(1)} px from its point`);
  }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    assert.ok(!hit(box(labels[i]), box(labels[j])), `${labels[i].t} overlaps ${labels[j].t}`);
  }
});

test('curvePlot: point labels never sit on reference-line text, reference lines or the marker strip', () => {
  const html = curvePlot({
    xs: NZ.v, series: [{ ys: NZ.chsh_win, label: 'quantum', dash: '' }], y: [0.45, 0.9], markerId: 'm', markerV: 1, label: 'x',
    hlines: [{ y: 0.75, label: 'envelopes' }], vlines: [{ x: 0.7071, label: 'quantum stops helping' }],
    points: [{ x: 1, y: 0.854, label: 'F0', shape: 'diamond' }, { x: 0.979, y: 0.846, label: 'F1', shape: 'diamond' },
      { x: 0.952, y: 0.8365, label: 'F2', shape: 'diamond' }, { x: 0.979, y: 0.846, label: 'This run', shape: 'circle' }],
  });
  const refs = textsOf(html, 'c-ref-label').map((l) => box(l, 7.6));
  const hy = yToPx(0.75, [0.45, 0.9]);
  for (const l of textsOf(html, 'pt-label')) {
    const b = box(l);
    for (const r of refs) assert.ok(!hit(b, r), `${l.t} hits a reference label`);
    assert.ok(!(b.y0 < hy + 2 && b.y1 > hy - 2), `${l.t} sits on the 75 % line`);
    assert.ok(b.y0 >= 20, `${l.t} intrudes into the V tag strip`);
    assert.ok(b.x1 <= xToPx(1) + 14 || b.x0 > 0, 'inside the svg');
  }
});

test('curvePlot: "This run" at exactly the same coordinates as a diamond renders both markers', () => {
  const html = curvePlot({ xs: NZ.v, series: [{ ys: NZ.chsh_win, label: 'q', dash: '' }], y: [0.45, 0.9], markerId: 'm', markerV: 0.5, label: 'x',
    points: [{ x: 0.979, y: 0.846, label: 'F1', shape: 'diamond' }, { x: 0.979, y: 0.846, label: 'This run', shape: 'circle' }] });
  assert.deepEqual(diamonds(html)[0], rings(html)[0]);
  assert.ok(html.indexOf('pt-circle') < html.indexOf('pt-diamond'), 'ring is drawn under the diamond');
  assert.match(html, /class="pt pt-circle"[^>]*r="9"/);       // ring is larger than the diamond (half-diagonal 6)
  assert.match(html, /class="pt-dot"/);
});

test('curvePlot: point pixels follow the y range (known points)', () => {
  const html = curvePlot({ xs: NZ.v, series: [{ ys: NZ.chsh_win, label: 'q', dash: '' }], y: [0.45, 0.9], markerId: 'm', markerV: 1, label: 'x',
    points: [{ x: 0, y: 0.45, label: 'lo', shape: 'diamond' }, { x: 1, y: 0.9, label: 'hi', shape: 'diamond' }, { x: 0.5, y: 0.675, label: 'mid', shape: 'diamond' }] });
  const [a, b, c] = diamonds(html);
  assert.deepEqual([a.x, a.y], [xToPx(0), 246]);
  assert.deepEqual([b.x, b.y], [xToPx(1), 22]);
  assert.ok(Math.abs(c.y - 134) < 0.01 && c.x === xToPx(0.5));
  assert.ok(html.includes('50 %') && html.includes('90 %'));
  assert.equal(yToPx(0.675, [0.45, 0.9]), 134);
});

test('curvePlot: non-finite points are not drawn; clamped values keep the true value in the title', () => {
  const html = curvePlot({ xs: NZ.v, series: [{ ys: NZ.chsh_win, label: 'q', dash: '' }], y: [0.45, 0.9], markerId: 'm', markerV: 1, label: 'x',
    points: [{ x: NaN, y: 0.8, label: 'bad1', shape: 'circle' }, { x: 0.5, y: undefined, label: 'bad2', shape: 'diamond' },
      { x: 1.2, y: 0.95, label: 'over', shape: 'diamond' }] });
  assert.ok(!html.includes('bad1') && !html.includes('bad2') && !/NaN|undefined/.test(html));
  assert.equal(diamonds(html).length, 1);
  assert.equal(diamonds(html)[0].x, xToPx(1));                // clamped to the edge
  assert.match(html, /<title>over — V = 1\.20 \(shown at edge\), value 95\.0 % \(shown at edge\)<\/title>/);
});

test('curvePlot: the slider marker has a "V = ..." tag at the top, with a known id', () => {
  const html = leaderPlot();
  const m = html.match(/<text id="noise-marker-test-label" class="c-marker-label" x="([-\d.]+)" y="(\d+)" text-anchor="middle">V = 0\.50<\/text>/);
  assert.ok(m, 'marker tag');
  assert.ok(Math.abs(Number(m[1]) - xToPx(0.5)) < 0.01);
});

test('curvePlot: end labels start clear of the frame (F at V = 1 cannot touch the sample line)', () => {
  const html = leaderPlot();
  const x1 = Number(html.match(/class="c-series-sample" x1="([\d.]+)"/)[1]);
  assert.ok(x1 >= xToPx(1) + 10, `${x1} vs ${xToPx(1)}`);
});

test('curvePlot: slider marker is a vertical line with a known id at xToPx(markerV)', () => {
  const html = leaderPlot();
  const m = html.match(/<line id="noise-marker-test" class="c-slider-marker" data-slot="marker" x1="([-\d.]+)" y1="[-\d.]+" x2="([-\d.]+)"/);
  assert.ok(m, 'marker line');
  assert.equal(Number(m[1]), Number(m[2]));
  assert.ok(Math.abs(Number(m[1]) - xToPx(0.5)) < 0.01);
  assert.ok(xToPx(0) < xToPx(0.5) && xToPx(0.5) < xToPx(1));
  assert.equal(xToPx(-1), xToPx(0)); assert.equal(xToPx(2), xToPx(1));
});

test('curvePlot: escapes labels', () => {
  const html = leaderPlot({ label: '<script>x</script>', hlines: [{ y: 0.5, label: '<b>h</b>' }] });
  assert.ok(!html.includes('<script>') && !html.includes('<b>'));
});


test('curvePlot: crowded points get leader lines that end at their own label; isolated points need none', () => {
  const dense = leaderPlot();
  const leaders = [...dense.matchAll(/class="pt-leader" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map((m) => m.slice(1).map(Number));
  assert.equal(leaders.length, 4);
  for (const [x1, y1, x2, y2] of leaders) assert.ok(Math.hypot(x2 - x1, y2 - y1) <= 40);
  const sparse = curvePlot({ xs: NZ.v, series: [{ ys: NZ.chsh_win, label: 'q', dash: '' }], y: [0.45, 0.9], markerId: 'm', markerV: 1, label: 'x',
    points: [{ x: 0.2, y: 0.5, label: 'A', shape: 'diamond' }, { x: 0.8, y: 0.8, label: 'B', shape: 'diamond' }] });
  assert.ok(!sparse.includes('pt-leader'));
  assert.ok(dense.indexOf('pt-leader') < dense.indexOf('pt-diamond'), 'leaders are drawn under the shapes');
});
