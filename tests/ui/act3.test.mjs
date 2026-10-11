import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/precomputed.js';
import { render, timers } from '../../ui/act3.js';
import { xToPx, yToPx } from '../../ui/charts.js';
import { FORTE_RUNS, formatReadout, readout } from '../../ui/noise.js';

const clone = (o) => structuredClone(o);

// Strict stub root: only the selectors act3 is allowed to use; anything else throws.
function stubRoot() {
  const SLOTS = new Set(['readout', 'readout-live', 'chart-chsh', 'chart-leader', 'runnote', 'vout', 'legend']);
  const IDS = new Set(['noise-v', 'noise-marker-chsh', 'noise-marker-leader', 'noise-marker-chsh-label', 'noise-marker-leader-label']);
  const els = new Map(), writes = {};
  const el = (key) => {
    if (!els.has(key)) {
      const e = {
        id: key.startsWith('#') ? key.slice(1) : '', attrs: {}, value: '1',
        setAttribute(k, v) { this.attrs[k] = v; (writes[`${key}@${k}`] ??= []).push(v); },
        getAttribute(k) { return this.attrs[k]; },
        set innerHTML(v) { this.html = v; writes[key] = (writes[key] || 0) + 1; },
        set textContent(v) { this.text = v; writes[key] = (writes[key] || 0) + 1; },
      };
      els.set(key, e);
    }
    return els.get(key);
  };
  const root = {
    builds: 0, listeners: [], writes, el,
    set innerHTML(v) { root.builds++; root.html = v; },
    addEventListener: (t, fn) => root.listeners.push([t, fn]),
    querySelector(sel) {
      const slot = sel.match(/^\[data-slot="([\w-]+)"\]$/)?.[1];
      if (slot && SLOTS.has(slot)) return el(slot);
      if (sel[0] === '#' && IDS.has(sel.slice(1))) return el(sel);
      throw new Error(`stub: unexpected selector ${sel}`);
    },
    slide(v) {
      const s = el('#noise-v'); s.value = String(v);
      for (const [t, fn] of root.listeners) if (t === 'input') fn({ target: s });
    },
  };
  return root;
}

function fakeTimers() {
  const pending = [], orig = { ...timers };
  timers.set = (fn) => { pending.push(fn); return pending.length; };
  timers.clear = (h) => { pending[h - 1] = null; };
  return { pending, fire() { const fns = pending.splice(0).filter(Boolean); fns.forEach((f) => f()); }, restore() { Object.assign(timers, orig); } };
}

test('act3: builds once, one slider, one input listener, label for the slider', () => {
  const root = stubRoot();
  render(root, data, { source: 'precomputed' });
  render(root, data, { source: 'live-list' });
  assert.equal(root.builds, 1);
  assert.equal(root.listeners.filter(([t]) => t === 'input').length, 1);
  assert.equal((root.html.match(/type="range"/g) || []).length, 1);
  assert.match(root.html, /<input id="noise-v" type="range" min="0" max="1" step="0.01"/);
  assert.match(root.html, /<label for="noise-v">/);
});

test('act3 text: Jhoan-approved sentence, hardware list with exactly 3 items, legend', () => {
  const root = stubRoot(); render(root, data, { source: 'p' });
  const h = root.html;
  assert.ok(h.includes('Real hardware is noisy. With visibility V, P_win = ½ + V·√2/4'));
  assert.ok(h.includes("Across three runs on IonQ's Forte 1 noise model we measured 96.0–97.0 % — roughly one election in 37 to 40 produces two leaders."));
  assert.ok(!h.includes('96.8') && !h.includes('one election in 37 produces'));
  assert.ok(h.includes('None of this exists at scale today.'));
  const list = h.match(/What hardware would need<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.equal((list.match(/<li>/g) || []).length, 3);
  assert.ok(list.includes('tens of ms') && list.includes('decision rate') && list.includes('Tani–Kobayashi–Matsumoto') && list.includes('envelopes with a dealer'));
  assert.ok(h.includes('our runs on IonQ Forte 1 noise model, Oct 10 2026, 1000 shots each'));
});

test('act3 charts: curve, This run circle and three labelled Forte diamonds in each chart', () => {
  const root = stubRoot(); render(root, data, { source: 'p' });
  for (const k of ['chart-chsh', 'chart-leader']) {
    const html = root.el(k).html;
    assert.equal((html.match(/pt-diamond/g) || []).length, 3, k);
    assert.equal((html.match(/pt-circle/g) || []).length, 1, k);
    for (const t of ['F0', 'F1', 'F2', 'This run']) assert.ok(html.includes(`>${t}<`), `${k} ${t}`);
  }
  const c = root.el('chart-chsh').html;
  assert.ok(c.includes('>envelopes<') && c.includes('>quantum stops helping<'));
  const l = root.el('chart-leader').html;
  for (const t of ['exactly one', 'split-brain', 'no leader']) assert.ok(l.includes(`>${t}<`), t);
});

test('act3: "This run" sits at (inferred V, measured value)', () => {
  const root = stubRoot(); const d = clone(data);
  d.inferred_visibility = { chsh: 0.9, w: 0.8, ghz: 0.9 };
  render(root, d, { source: 'live' });
  const cx = (k) => Number(root.el(k).html.match(/class="pt pt-circle" cx="([\d.]+)"/)[1]);
  assert.ok(Math.abs(cx('chart-chsh') - xToPx(0.9)) < 0.01);
  assert.ok(Math.abs(cx('chart-leader') - xToPx(0.8)) < 0.01);
});

test('act3: moving the slider moves both markers and the readout, redraws no chart', () => {
  const root = stubRoot(); render(root, data, { source: 'p' });
  const before = { c: root.writes['chart-chsh'], l: root.writes['chart-leader'] };
  root.slide(0.8);
  assert.equal(root.writes['chart-chsh'], before.c); assert.equal(root.writes['chart-leader'], before.l);
  for (const id of ['#noise-marker-chsh', '#noise-marker-leader']) {
    const m = root.el(id);
    assert.ok(Math.abs(Number(m.attrs.x1) - xToPx(0.8)) < 0.01, id);
    assert.equal(m.attrs.x1, m.attrs.x2);
  }
  assert.equal(root.el('readout').text, formatReadout(readout(data.noise, 0.8)));
  assert.equal(root.el('vout').text, '0.80');
});

test('act3: slider value persists across a source change (marker redrawn at the same V)', () => {
  const root = stubRoot(); render(root, data, { source: 'precomputed' });
  root.slide(0.8);
  root.el('#noise-v').value = '1';                       // simulate the DOM losing the value, so the test can fail
  render(root, clone(data), { source: 'live-list' });
  assert.equal(root.el('#noise-v').value, '0.8');
  const x1 = Number(root.el('chart-chsh').html.match(/id="noise-marker-chsh"[^>]*?x1="([\d.]+)"/)[1]);
  assert.ok(Math.abs(x1 - xToPx(0.8)) < 0.01);
  assert.equal(root.el('readout').text, formatReadout(readout(data.noise, 0.8)));
  assert.equal(root.builds, 1);
});

test('act3: aria-live node is debounced (one write after rapid input)', () => {
  const t = fakeTimers();
  try {
    const root = stubRoot(); render(root, data, { source: 'p' });
    const live0 = root.writes['readout-live'] || 0;
    for (const v of [0.9, 0.85, 0.8, 0.75, 0.7]) root.slide(v);
    assert.equal(root.writes['readout-live'] || 0, live0, 'nothing announced while sliding');
    assert.equal(root.el('readout').text, formatReadout(readout(data.noise, 0.7)), 'visual readout is instant');
    t.fire();
    assert.equal(root.writes['readout-live'], live0 + 1);
    assert.ok(root.el('readout-live').text.startsWith('At V = 0.70'));
  } finally { t.restore(); }
});

const IDEAL = 'This run: consistent with an ideal simulator (no noise detectable at 1000 shots).';

test('act3 note: precomputed ideal data shows the (softened) ideal note', () => {
  const root = stubRoot(); render(root, data, { source: 'live' });          // precomputed file: iv {.973, 1, 1}, chsh .844
  assert.equal(root.el('runnote').text, IDEAL);
});

test('act3 note: ideal W/GHZ but a badly degraded CHSH is NOT called ideal', () => {
  const root = stubRoot(); const d = clone(data);
  d.inferred_visibility = { chsh: 0.6, w: 1, ghz: 1 }; d.chsh.overall = 0.7;
  render(root, d, { source: 'live' });
  assert.ok(!root.el('runnote').text.includes('ideal simulator'), root.el('runnote').text);
  assert.ok(root.el('runnote').text.includes('0.60'));
  d.chsh.overall = 0.8536 - 0.0172 - 0.002;                                  // just beyond 3 sigma (sigma .0057)
  render(root, d, { source: 'live' });
  assert.ok(!root.el('runnote').text.includes('ideal simulator'));
  d.chsh.overall = 0.8536 - 0.0172 + 0.002;                                  // just inside 3 sigma
  render(root, d, { source: 'live' });
  assert.equal(root.el('runnote').text, IDEAL);
});

test('act3 note: sigma missing falls back to 0.006', () => {
  const root = stubRoot(); const d = clone(data); delete d.chsh.sigma;
  d.chsh.overall = 0.8536 - 0.004; render(root, d, { source: 'live' });
  assert.equal(root.el('runnote').text, IDEAL);
  d.chsh.overall = 0.8536 - 0.02; render(root, d, { source: 'live' });
  assert.ok(!root.el('runnote').text.includes('ideal simulator'));
});

test('act3 note: V = 0.95 data gives the measured text with the split-brain rate', () => {
  const noisy = stubRoot(); const d2 = clone(data);
  d2.inferred_visibility = { chsh: 0.95, w: 0.95, ghz: 0.96 }; d2.leader.split_brain = 0.027;
  render(noisy, d2, { source: 'live' });
  const txt = noisy.el('runnote').text;
  assert.ok(!txt.includes('ideal simulator'));
  assert.ok(txt.includes('0.95') && txt.includes('2.7 %'), txt);
});

test('act3: Forte diamonds sit at (vChsh, chsh) and (vW, exactlyOne) in the right charts', () => {
  const root = stubRoot(); render(root, data, { source: 'live' });
  const dia = (html) => [...html.matchAll(/class="pt pt-diamond" d="M([-\d.]+) ([-\d.]+)L/g)].map((m) => [+m[1], +m[2] + 6]);
  assert.deepEqual(dia(root.el('chart-chsh').html), FORTE_RUNS.map((r) => [xToPx(r.vChsh), yToPx(r.chsh, [0.45, 0.9])]));
  assert.deepEqual(dia(root.el('chart-leader').html), FORTE_RUNS.map((r) => [xToPx(r.vW), yToPx(r.exactlyOne)]));
});

test('act3: slider has aria-valuetext, and the marker tag follows V', () => {
  const root = stubRoot(); render(root, data, { source: 'p' });
  assert.equal(root.el('#noise-v').attrs['aria-valuetext'], 'V = 1.00');
  root.slide(0.8);
  assert.equal(root.el('#noise-v').attrs['aria-valuetext'], 'V = 0.80');
  for (const id of ['#noise-marker-chsh-label', '#noise-marker-leader-label']) {
    const t = root.el(id);
    assert.equal(t.text, 'V = 0.80', id);
    assert.ok(Math.abs(Number(t.attrs.x) - xToPx(0.8)) < 0.01, id);
  }
});

test('act3: point label and legend follow the data source (precomputed vs live)', () => {
  const live = stubRoot(); render(live, data, { source: 'live-list' });
  assert.ok(live.el('chart-chsh').html.includes('>This run<'));
  assert.ok(live.el('legend').text.includes('Circle: this run'));
  const pre = stubRoot(); render(pre, data, { source: 'precomputed' });
  assert.ok(pre.el('chart-chsh').html.includes('>Precomputed run<'));
  assert.ok(pre.el('chart-chsh').html.includes('Precomputed run (BasicSimulator)'));
  assert.ok(pre.el('legend').text.includes('Precomputed run (BasicSimulator)'));
  for (const r of [live, pre]) {
    assert.ok(r.el('legend').text.includes("Thick vertical line: the slider's V."));
    assert.ok(r.el('legend').text.includes('sit on its curve by construction; what varies between runs is how far left they fall.'));
  }
  render(pre, data, { source: 'live-list' });                  // source change swaps the label
  assert.ok(pre.el('chart-chsh').html.includes('>This run<'));
});

test('act3 never throws: missing inferred_visibility, classical_bound, NaN, values above 1', () => {
  for (const mutate of [
    (d) => { delete d.inferred_visibility; },
    (d) => { delete d.noise.classical_bound; delete d.noise.chsh_threshold; },
    (d) => { d.inferred_visibility = { chsh: NaN, w: NaN, ghz: NaN }; d.chsh.overall = NaN; },
    (d) => { d.inferred_visibility = { chsh: 1.2, w: 1.3, ghz: 1 }; d.leader.exactly_one = 1.1; },
    (d) => { delete d.chsh.sigma; delete d.leader.split_brain; },
    (d) => { d.inferred_visibility = null; },
  ]) {
    const d = clone(data); mutate(d);
    const root = stubRoot();
    assert.doesNotThrow(() => render(root, d, { source: 'live' }));
    assert.doesNotThrow(() => root.slide(0.4));
    const all = root.el('chart-chsh').html + root.el('chart-leader').html + root.el('runnote').text;
    assert.ok(!/NaN|undefined/.test(all), all.match(/.{20}(NaN|undefined).{20}/)?.[0]);
  }
  const d = clone(data); d.inferred_visibility = { chsh: NaN, w: NaN, ghz: NaN };
  const root = stubRoot(); render(root, d, { source: 'live' });
  assert.ok(root.el('runnote').text.includes('not available'));
  assert.equal((root.el('chart-chsh').html.match(/pt-circle/g) || []).length, 0, 'no ring for a NaN point');
});

test('act3: a missing noise block does not throw either (text and slider still built)', () => {
  const d = clone(data); delete d.noise;
  const root = stubRoot();
  assert.doesNotThrow(() => render(root, d, { source: 'live' }));
  assert.match(root.html, /type="range"/);
});
