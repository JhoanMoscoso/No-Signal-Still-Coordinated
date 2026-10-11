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
