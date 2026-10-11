import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/precomputed.js';
import { fmtRho, view, CHOICES, render as render1 } from '../../ui/act1.js';
import { panels, render as render2 } from '../../ui/act2.js';

const clone = (o) => structuredClone(o);

test('fmtRho: maximally mixed state reads I/2', () => {
  assert.equal(fmtRho([[0.5, 0], [0, 0.5]]), 'ρ_B = [[0.50, 0.00], [0.00, 0.50]] = I/2');
  assert.equal(fmtRho([[0.5, -0.0001], [0, 0.5]]), 'ρ_B = [[0.50, 0.00], [0.00, 0.50]] = I/2');
  assert.ok(!fmtRho([[1, 0], [0, 0]]).includes('I/2'));
});

test('act1 view: each choice shows its own Bob histogram', () => {
  assert.deepEqual(CHOICES.map((c) => c.key), ['none', 'Z', 'X']);
  assert.deepEqual(CHOICES.map((c) => c.label),
    ['Alice does nothing', 'Alice measures Z', 'Alice measures X']);
  for (const { key } of CHOICES) {
    const v = view(key, data);
    const bob = data.nosignal[key].bob;
    assert.ok(v.hist.includes((bob.p0 * 100).toFixed(1) + ' %'));
    assert.ok(v.hist.includes((bob.p1 * 100).toFixed(1) + ' %'));
  }
  assert.match(view('Z', data).compare, /100\.0 %/);
  assert.equal(view('X', data).compare, '');
});

// --- act1.render against a hand-rolled stub root (no real DOM parsing) ---
// The stub mimics only what act1 uses: innerHTML, classList, addEventListener,
// querySelector(All) for the three buttons and the data-slot targets.
function stubRoot() {
  const slotWrites = {};
  const mkSlot = (name) => ({
    set innerHTML(v) { slotWrites[name] = (slotWrites[name] || 0) + 1; this.html = v; },
    set textContent(v) { slotWrites[name] = (slotWrites[name] || 0) + 1; this.text = v; },
  });
  const slots = { hist: mkSlot('hist'), summary: mkSlot('summary'), compare: mkSlot('compare'), rho: mkSlot('rho') };
  const buttons = CHOICES.map((c) => {
    const attrs = { 'aria-pressed': 'false' };
    return {
      dataset: { choice: c.key },
      setAttribute: (k, v) => { attrs[k] = v; },
      getAttribute: (k) => attrs[k],
    };
  });
  const root = {
    builds: 0, listeners: [], classes: new Set(), buttons, slots, slotWrites,
    classList: { add: (c) => root.classes.add(c) },
    set innerHTML(v) { root.builds++; root.html = v; },
    addEventListener: (t, fn) => root.listeners.push([t, fn]),
    querySelectorAll: () => buttons,
    querySelector: (sel) => slots[sel.match(/data-slot="(\w+)"/)[1]],
    click(key) {
      const btn = buttons.find((b) => b.dataset.choice === key);
      for (const [t, fn] of root.listeners) if (t === 'click') fn({ target: { closest: () => btn } });
    },
    pressed: () => buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.choice),
  };
  return root;
}

test('act1 render: idempotent, aria-pressed toggles, choice persists across data swaps', () => {
  const root = stubRoot();
  render1(root, data);
  render1(root, data);                                   // precomputed -> live swap, same data
  assert.equal(root.builds, 1, 'DOM built once');
  assert.equal(root.listeners.length, 1, 'one click listener');
  assert.deepEqual(root.pressed(), ['none']);

  root.click('Z');
  assert.deepEqual(root.pressed(), ['Z']);
  assert.match(root.slots.summary.text, /Alice measures Z/);

  const live = clone(data);
  live.nosignal.Z.bob = { p0: 0.4, p1: 0.6, shots: 1000 };
  render1(root, live);                                   // second render, different data
  assert.equal(root.builds, 1);
  assert.equal(root.listeners.length, 1);
  assert.deepEqual(root.pressed(), ['Z'], 'choice persists');
  assert.match(root.slots.summary.text, /60\.0 %/);
  assert.ok(root.slots.hist.html.includes('40.0 %'));

  root.click('X');
  assert.deepEqual(root.pressed(), ['X']);
  assert.equal(root.slots.compare.text, '');
});

test('act1 render: unchanged view does not rewrite the live-region slots', () => {
  const root = stubRoot();
  render1(root, data);
  const before = { ...root.slotWrites };
  render1(root, clone(data));                            // identical content
  assert.deepEqual(root.slotWrites, before);
});

// --- act2 ---
test('act2 panels: order content and key numbers', () => {
  const p = panels(data);
  assert.deepEqual(Object.keys(p), ['leader', 'consensus', 'chsh']);
  for (const html of Object.values(p)) assert.match(html, /<h3[ >]/);
  assert.ok(p.leader.includes('leader in 32.9 % of rounds'));
  assert.ok(p.leader.includes('Split-brain') && p.leader.includes('No leader'));
  assert.ok(p.consensus.includes('|GHZ⟩'));
  assert.ok(p.consensus.includes('48.9 %') && p.consensus.includes('51.1 %'));
  assert.ok(p.chsh.includes('classical limit 75 %') && p.chsh.includes('Tsirelson bound 85.4 %'));
  for (const k of ['00', '01', '10', '11']) assert.ok(p.chsh.includes(`>${k}<`));
  assert.ok(p.chsh.includes('84.4 %'));
});

test('act2 panels: noisy live-like data (split-brain 2.7 %, no leader 0.5 %)', () => {
  const d = clone(data);
  Object.assign(d.leader, { exactly_one: 0.968, split_brain: 0.027, no_leader: 0.005, per_node_leader: [0.31, 0.33, 0.328] });
  const p = panels(d);
  assert.ok(p.leader.includes('96.8 %'));
  assert.ok(p.leader.includes('2.7 %') && p.leader.includes('0.5 %'));
  assert.ok(p.leader.includes('leader in 31.0 % of rounds'));
});

test('act2 panels: missing sigma, exact 0 and exact 1 values', () => {
  const d = clone(data);
  delete d.chsh.sigma;
  d.chsh.overall = 1;
  d.consensus.p_all_zero = 0; d.consensus.p_all_one = 1; d.consensus.disagreement = 0;
  d.leader.exactly_one = 0; d.leader.no_leader = 1; d.leader.split_brain = 0;
  const p = panels(d);
  assert.ok(!/% ± /.test(p.chsh));  // the CHSH text itself contains ±22.5°
  assert.ok(p.chsh.includes('100.0 %'));
  assert.ok(p.consensus.includes('0.0 %') && p.consensus.includes('100.0 %'));
  assert.ok(p.leader.includes('0.0 %') && p.leader.includes('100.0 %'));
  assert.ok(!/NaN|undefined/.test(Object.values(p).join('')));
  d.chsh.sigma = null;                                  // null behaves like missing
  assert.ok(!/% ± /.test(panels(d).chsh));
});

test('act2 render: writes into the three elements', () => {
  const els = { leader: {}, consensus: {}, chsh: {} };
  render2(els, data);
  for (const e of Object.values(els)) assert.ok(e.innerHTML.length > 100);
});
