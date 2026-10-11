// Act 2: what entanglement can do. Three static panels (Phase 2 adds the buttons).
import { hbar, histogram2, nodes, pct } from './charts.js';

const W_TEXT = 'Three identical replicas share |W⟩ = (|100⟩+|010⟩+|001⟩)/√3 and each measures its own ' +
  'qubit. Exactly one reads 1: it is the leader. Fair (1/3 each), one step, no IDs, no messages. ' +
  'Honest caveat: with a <em>pre-prepared</em> W state you could get the same from shuffled envelopes ' +
  'and a dealer. The quantum result (Tani–Kobayashi–Matsumoto 2012; D\'Hondt–Panangaden 2006) is that ' +
  'anonymous nodes can prepare this symmetry-breaking state among themselves, with no dealer — which ' +
  'no classical algorithm can do exactly.';
const GHZ_TEXT = '|GHZ⟩ = (|000⟩+|111⟩)/√2: all three read the same random bit. Nobody chose it, so ' +
  'nothing was communicated. Everybody agrees on it, so consensus on a shared coin is free.';
const CHSH_TEXT = 'Two load balancers each get a local input (burst / no burst) and must answer now: ' +
  'backend 0 or 1. Rule: pick the same backend — unless both see a burst, then split. Any pre-agreed ' +
  'table (all 16 of them, or any random mixture) wins at most 75 %. Sharing |Φ+⟩ and measuring at ' +
  '0°/45° (Alice) and ±22.5° (Bob) wins cos²(π/8) ≈ 85.4 %, the Tsirelson bound. No table can produce ' +
  'these statistics. That is Bell\'s theorem, and it is the only part of this page that no envelope can imitate.';

const NAMES = ['A', 'B', 'C'];
const stat = (term, value) => `<div><dt>${term}</dt><dd>${value}</dd></div>`;

// Pure: HTML for each panel from the data contract.
export function panels(data) {
  const { leader, consensus, chsh } = data;

  const w = `<h3>Leader election with a W state</h3><div class="panel__body"><p class="act__text">${W_TEXT}</p><div class="panel__vis">` +
    nodes(NAMES.map((name, i) => ({
      name, state: `leader in ${pct(leader.per_node_leader[i])}`, note: 'of rounds', on: false,
    }))) +
    hbar({ value: leader.exactly_one, label: 'Rounds with exactly one leader' }) +
    `<dl class="stats">${stat('Split-brain (two or more leaders)', pct(leader.split_brain))}` +
    `${stat('No leader', pct(leader.no_leader))}</dl></div></div>`;

  const g = `<h3>Consensus on a shared coin with a GHZ state</h3><div class="panel__body"><p class="act__text">${GHZ_TEXT}</p><div class="panel__vis">` +
    nodes(NAMES.map((name) => ({ name, state: 'reads b', note: 'same b everywhere', on: false }))) +
    histogram2({ p0: consensus.p_all_zero, p1: consensus.p_all_one, label: 'Shared bit b read by all three nodes' }) +
    hbar({ value: consensus.agreement, label: 'Rounds where all three nodes agree' }) +
    `<dl class="stats">${stat('All zero', pct(consensus.p_all_zero))}${stat('All one', pct(consensus.p_all_one))}` +
    `${stat('Disagreement', pct(consensus.disagreement))}</dl></div></div>`;

  const pairs = ['00', '01', '10', '11'];
  const c = `<h3>Coordination without communication (CHSH)</h3><div class="panel__body"><p class="act__text">${CHSH_TEXT}</p><div class="panel__vis">` +
    hbar({
      value: chsh.overall, sigma: chsh.sigma, label: 'Quantum win rate',
      marks: [{ at: chsh.classical_best, label: 'classical limit' }, { at: chsh.tsirelson_bound, label: 'Tsirelson bound' }],
    }) +
    `<table class="pairs"><caption>Win rate by question pair (x, y)</caption><thead><tr><th scope="col">Questions</th>` +
    pairs.map((k) => `<th scope="col">${k}</th>`).join('') +
    `</tr></thead><tbody><tr><th scope="row">Win rate</th>` +
    pairs.map((k) => `<td>${pct(chsh.per_pair[k])}</td>`).join('') + `</tr></tbody></table></div></div>`;

  return { leader: w, consensus: g, chsh: c };
}

export function render(els, data) {
  const p = panels(data);
  els.leader.innerHTML = p.leader;
  els.consensus.innerHTML = p.consensus;
  els.chsh.innerHTML = p.chsh;
}
