// Act 2a: leader election with a W state. Pure state/view + thin DOM wiring.
import { hbar, nodes, pct } from './charts.js';
import { electRound, describeElection } from './games.js';
import { animate } from './anim.js';
import { bindOnce, currentState, failHandler, failText, lock, say, slot } from './dom.js';

const NAMES = ['A', 'B', 'C'];
const TEXT = 'Three identical replicas share <span class="math">|W⟩ = (|100⟩+|010⟩+|001⟩)/√3</span> and each measures its own ' +
  'qubit. Exactly one reads 1: it is the leader. Fair (1/3 each), one step, no IDs, no messages. ' +
  'Honest caveat: with a <em>pre-prepared</em> W state you could get the same from shuffled envelopes ' +
  'and a dealer. The quantum result (Tani–Kobayashi–Matsumoto 2012; D\'Hondt–Panangaden 2006) is that ' +
  'anonymous nodes can prepare this symmetry-breaking state among themselves, with no dealer — which ' +
  'no classical algorithm can do exactly.';

export const newState = () => ({ n: 0, one: 0, led: [0, 0, 0], last: null });

export function electOnce(L, data, rng = Math.random) {
  const r = electRound(data.leader.raw, rng);
  if (!r) return null;                                   // no data: leave the tally alone
  L.n++;
  if (r.leaders.length === 1) L.one++;
  for (const i of r.leaders) L.led[i]++;
  L.last = r.leaders;
  return r;
}

export function view(L, data) {
  const share = data.leader.per_node_leader;
  const list = NAMES.map((name, i) => ({
    name,
    state: L.last ? (L.last.includes(i) ? 'LEADER' : 'idle') : '—',
    on: !!L.last && L.last.includes(i),
    note: pct(share[i]),
    aria: `leader share ${pct(share[i])}`,
  }));
  return {
    nodes: nodes(list),
    status: L.last ? describeElection(L.last) : '',
    counts: `Elections: ${L.n} · Exactly one leader: ${L.one}`,
    tally: NAMES.map((n, i) => `<li>${n} led ${L.led[i]} of ${L.n} elections</li>`).join(''),
  };
}

export function html(data, L = newState()) {
  const v = view(L, data), lead = data.leader;
  return `<h3>Leader election with a W state</h3><div class="panel__body"><p class="act__text">${TEXT}</p>` +
    `<div class="panel__vis"><div data-slot="nodes">${v.nodes}</div>` +
    `<p class="legend">Figure under each node: leader share, the fraction of rounds in which it leads.</p>` +
    `<div class="game__controls">` +
    `<button type="button" class="btn" data-act="elect">Elect again</button>` +
    `<button type="button" class="btn" data-act="elect100">Elect 100 times</button>` +
    `<button type="button" class="btn" data-act="skip" disabled>Skip</button>` +
    `<button type="button" class="btn" data-act="reset">Reset elections</button></div>` +
    `<p class="game__status" data-slot="status" role="status" aria-live="polite"></p>` +
    `<p class="game__counts" data-slot="counts">${v.counts}</p>` +
    `<ul class="tally" data-slot="tally">${v.tally}</ul>` +
    hbar({ value: lead.exactly_one, label: 'Rounds with exactly one leader (all data)' }) +
    `<dl class="stats"><div><dt>Split-brain (two or more leaders)</dt><dd>${pct(lead.split_brain)}</dd></div>` +
    `<div><dt>No leader</dt><dd>${pct(lead.no_leader)}</dd></div></dl></div></div>`;
}

// quick: only counters (never flash the nodes while a batch is running)
export function paint(el, L, { quick = false } = {}) {
  const v = view(L, L.data);
  if (!quick) { slot(el, 'nodes').innerHTML = v.nodes; }
  slot(el, 'counts').textContent = v.counts;
  slot(el, 'tally').innerHTML = v.tally;
}

export function wire(el) {
  bindOnce(el, 'click', (e) => {
    const btn = e.target.closest?.('button[data-act]');
    const L = currentState(el);
    if (!btn || !L) return;
    const act = btn.dataset.act, status = slot(el, 'status');
    if (act === 'elect') {
      if (!electOnce(L, L.data)) return say(status, failText({ message: 'no data' }));
      paint(el, L); say(status, describeElection(L.last));
    } else if (act === 'reset') {
      Object.assign(L, newState()); paint(el, L); say(status, 'Elections reset.');
    } else if (act === 'skip') {
      L.anim?.skip();
    } else if (act === 'elect100') {
      const before = { n: L.n, one: L.one }, unlock = lock(el, btn);
      L.anim = animate({
        steps: 100,
        step: () => electOnce(L, L.data) !== null,
        frame: () => paint(el, L, { quick: true }),
        onCancel: unlock,
        onError: failHandler(status),
        done: () => {
          paint(el, L); unlock();
          say(status, `${L.n - before.n} elections: exactly one leader in ${L.one - before.one}. Last: ${describeElection(L.last)}.`);
        },
      });
    }
  });
}
