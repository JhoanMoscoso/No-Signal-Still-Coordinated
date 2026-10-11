// Act 1: Alice cannot signal Bob. Selected choice lives at module level so it
// survives the second render() (precomputed -> live).
import { histogram2, pct } from './charts.js';

export const CHOICES = [
  { key: 'none', label: 'Alice does nothing' },
  { key: 'Z', label: 'Alice measures Z' },
  { key: 'X', label: 'Alice measures X' },
];

const TEXT = 'Alice and Bob share a Bell pair. Whatever Alice does — nothing, measure in Z, ' +
  'measure in X — Bob\'s statistics stay 50/50 and his local state is ρ_B = I/2. The correlation ' +
  'is real, but it only becomes <em>visible</em> once Alice\'s results reach Bob over an ordinary ' +
  'channel (≥ 45 ms Bogotá → Frankfurt). Entanglement gives correlation, not communication. ' +
  'This is the no-signalling theorem.';
const LATENCY = '≥ 45 ms Bogotá → Frankfurt over fibre before any correlation becomes visible.';

let choice = 'none';
const state = new WeakMap();   // root -> latest data (one listener per root, never duplicated)
const shown = new WeakMap();   // root -> last rendered view, to skip no-op DOM writes

const f2 = (x) => (Math.abs(x) < 5e-3 ? 0 : x).toFixed(2);
export function fmtRho(m) {
  const body = `[${m.map((row) => `[${row.map(f2).join(', ')}]`).join(', ')}]`;
  const mixed = Math.abs(m[0][0] - 0.5) < 5e-3 && Math.abs(m[1][1] - 0.5) < 5e-3 &&
    Math.abs(m[0][1]) < 5e-3 && Math.abs(m[1][0]) < 5e-3;
  return `ρ_B = ${body}${mixed ? ' = I/2' : ''}`;
}

// Pure: everything the DOM needs for one choice.
export function view(key, data) {
  const ns = data.nosignal, c = ns[key], bob = c.bob;
  const who = CHOICES.find((x) => x.key === key).label;
  return {
    hist: histogram2({ p0: bob.p0, p1: bob.p1, label: `Bob's bit — ${who}` }),
    summary: `${who}: Bob reads 0 in ${pct(bob.p0)} and 1 in ${pct(bob.p1)} of ${bob.shots} shots.`,
    compare: c.p_same_after_compare != null
      ? `Only after Alice's results arrive over an ordinary channel do the two sides agree: ${pct(c.p_same_after_compare)} of shots match.`
      : '',
    rho: fmtRho(ns.rho_bob),
  };
}

function build(root) {
  root.classList.add('act1');
  root.innerHTML =
    `<div class="act1__left"><p class="act__text">${TEXT}</p>` +
    `<div class="choices" role="group" aria-label="What does Alice do?">` +
    CHOICES.map((c) => `<button type="button" class="choice" data-choice="${c.key}" aria-pressed="false">${c.label}</button>`).join('') +
    `</div></div>` +
    `<div class="act1__right"><div class="act1__out"><div data-slot="hist"></div>` +
    `<p class="act1__summary" data-slot="summary" aria-live="polite"></p><p class="act1__compare" data-slot="compare"></p></div>` +
    `<div class="rho"><span class="rho__label">Bob's local state, whatever Alice does</span>` +
    `<code class="rho__box" data-slot="rho"></code></div>` +
    `<p class="latency">${LATENCY}</p></div>`;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest?.('button[data-choice]');
    if (!btn) return;
    choice = btn.dataset.choice;
    update(root);                       // in place: the focused button is never rebuilt
  });
}

function update(root) {
  const data = state.get(root);
  const v = view(choice, data);
  for (const b of root.querySelectorAll('button[data-choice]')) {
    b.setAttribute('aria-pressed', String(b.dataset.choice === choice));
  }
  const prev = shown.get(root) || {};
  shown.set(root, v);
  // Only touch slots whose content changed: keeps the live region quiet on identical re-renders.
  if (v.hist !== prev.hist) root.querySelector('[data-slot="hist"]').innerHTML = v.hist;
  for (const k of ['summary', 'compare', 'rho']) {
    if (v[k] !== prev[k]) root.querySelector(`[data-slot="${k}"]`).textContent = v[k];
  }
}

export function render(root, data) {
  if (!state.has(root)) { state.set(root, data); build(root); }
  state.set(root, data);
  update(root);
}
