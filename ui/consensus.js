// Act 2b: consensus on a shared coin with a GHZ state.
import { hbar, histogram2, nodes, pct } from './charts.js';
import { coinRound, describeCoin } from './games.js';
import { bindOnce, currentState, failText, say, slot } from './dom.js';

const NAMES = ['A', 'B', 'C'];
const TEXT = '<span class="math">|GHZ⟩ = (|000⟩+|111⟩)/√2</span>: all three read the same random bit. Nobody chose it, so ' +
  'nothing was communicated. Everybody agrees on it, so consensus on a shared coin is free.';

export const newState = () => ({ n: 0, agree: 0, zeros: 0, ones: 0, last: null });

export function flipOnce(C, data, rng = Math.random) {
  const r = coinRound(data.consensus.raw, rng);
  if (!r) return null;
  C.n++;
  if (r.agree) { C.agree++; if (r.bits[0] === 0) C.zeros++; else C.ones++; }
  C.last = r;
  return r;
}

export function view(C) {
  const list = NAMES.map((name, i) => C.last
    ? { name, state: `reads ${C.last.bits[i]}`, on: C.last.bits[i] === 1 }
    : { name, state: 'reads b', note: 'ideally the same b', on: false });
  return {
    nodes: nodes(list),
    status: C.last ? describeCoin(C.last) : '',
    counts: `Flips: ${C.n} · All agree: ${C.agree} · Zeros: ${C.zeros} · Ones: ${C.ones}`,
  };
}

export function html(data, C = newState()) {
  const v = view(C), g = data.consensus;
  return `<h3>Consensus on a shared coin with a GHZ state</h3><div class="panel__body"><p class="act__text">${TEXT}</p>` +
    `<div class="panel__vis"><div data-slot="nodes">${v.nodes}</div>` +
    `<div class="game__controls"><button type="button" class="btn" data-act="flip">Flip the shared coin</button>` +
    `<button type="button" class="btn" data-act="reset">Reset flips</button></div>` +
    `<p class="game__status" data-slot="status" role="status" aria-live="polite"></p>` +
    `<p class="game__counts" data-slot="counts">${v.counts}</p>` +
    histogram2({ p0: g.p_all_zero, p1: g.p_all_one, label: 'Shared bit b read by all three nodes (all data)' }) +
    hbar({ value: g.agreement, label: 'Rounds where all three nodes agree (all data)' }) +
    `<dl class="stats"><div><dt>All zero</dt><dd>${pct(g.p_all_zero)}</dd></div><div><dt>All one</dt><dd>${pct(g.p_all_one)}</dd></div>` +
    `<div><dt>Disagreement</dt><dd>${pct(g.disagreement)}</dd></div></dl></div></div>`;
}

export function paint(el, C) {
  const v = view(C);
  slot(el, 'nodes').innerHTML = v.nodes;
  slot(el, 'counts').textContent = v.counts;
}

export function wire(el) {
  bindOnce(el, 'click', (e) => {
    const btn = e.target.closest?.('button[data-act]');
    const C = currentState(el);
    if (!btn || !C) return;
    const status = slot(el, 'status');
    if (btn.dataset.act === 'flip') {
      if (!flipOnce(C, C.data)) return say(status, failText({ message: 'no data' }));
      paint(el, C); say(status, describeCoin(C.last));
    }
    if (btn.dataset.act === 'reset') { Object.assign(C, newState()); paint(el, C); say(status, 'Flips reset.'); }
  });
}
