// Act 2c: CHSH. Static summary + a race: best envelope table vs the entangled pair.
import { hbar, pct, esc } from './charts.js';
import { playRound, strategyLabel } from './games.js';
import { animate } from './anim.js';
import { bindOnce, currentState, failHandler, lock, say, slot } from './dom.js';

const TEXT = 'Two load balancers each get a local input (burst / no burst) and must answer now: ' +
  'backend 0 or 1. Rule: pick the same backend — unless both see a burst, then split. Any pre-agreed ' +
  'table (all 16 of them, or any random mixture) wins at most 75 %. Sharing |Φ+⟩ and measuring at ' +
  '0°/45° (Alice) and ±22.5° (Bob) wins <span class="math">cos²(π/8)</span> ≈ 85.4 %, the Tsirelson bound. No table can produce ' +
  'these statistics. That is Bell\'s theorem, and it is the only part of this page that no envelope can imitate.';
const PAIRS = ['00', '01', '10', '11'];

const best = (data) => {
  const list = data.chsh.classical_strategies, top = Math.max(...list.map((s) => s.win_rate));
  return list.findIndex((s) => s.win_rate === top);
};
const zero = () => ({ n: 0, w: 0 });
export const newState = (data) => ({ strategy: best(data), q: zero(), c: zero() });
export const reset = (R) => { R.q = zero(); R.c = zero(); };
export function choose(R, i) { R.strategy = i; reset(R); }   // both sides restart: same rounds for a fair race

export function playOnce(R, data, rng = Math.random) {
  const r = playRound(data.chsh, data.chsh.classical_strategies[R.strategy], rng);
  if (!r) return null;
  R.q.n++; R.c.n++;
  if (r.quantum.win) R.q.w++;
  if (r.classical.win) R.c.w++;
  return r;
}

export function view(R, data) {
  const { classical_best: cb, tsirelson_bound: tb, classical_strategies: list } = data.chsh;
  const isBest = list[R.strategy].win_rate === Math.max(...list.map((s) => s.win_rate));
  const cLabel = `Envelopes (${isBest ? 'best' : 'chosen'} table)`, qLabel = 'Entangled pair';
  const bar = (label, side, marks) => hbar({
    label, marks, value: side.n ? side.w / side.n : 0, text: side.n ? undefined : '—',
  });
  const mark = { at: cb, label: 'classical limit' };
  return {
    bars: `<div class="race__bars">${bar(cLabel, R.c, [mark])}${bar(qLabel, R.q, [mark, { at: tb, label: 'Tsirelson bound' }])}</div>`,
    counts: `<p>${qLabel}: <strong>${R.q.w} of ${R.q.n} rounds won</strong> · ${cLabel}: <strong>${R.c.w} of ${R.c.n} rounds won</strong></p>`,
  };
}

function strategyTable(data, R) {
  const rows = data.chsh.classical_strategies.map((s, i) =>
    `<tr><td><input type="radio" name="strategy" id="strat-${i}" value="${i}" data-act="pick"${i === R.strategy ? ' checked' : ''}></td>` +
    `<th scope="row"><label for="strat-${i}">${esc(strategyLabel(s))}</label></th>` +
    `<td class="wins">${Math.round(s.win_rate * 4)} of 4</td><td class="rate">${pct(s.win_rate)}</td></tr>`).join('');
  return `<details class="strategies"><summary>Choose the envelope table to race (16 tables; none wins more than 75 %)</summary>` +
    `<fieldset><legend class="sr-only">Envelope table used by the classical side</legend>` +
    `<table class="pairs strategies__table"><caption>Each table fixes both answers in advance.</caption>` +
    `<thead><tr><th scope="col">Race it</th><th scope="col">Table</th><th scope="col" class="wins">Wins on</th><th scope="col" class="rate">Win rate</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></fieldset></details>`;
}

export function html(data, R = newState(data)) {
  const c = data.chsh, v = view(R, data);
  return `<h3>Coordination without communication (CHSH)</h3><div class="panel__body"><p class="act__text">${TEXT}</p>` +
    `<div class="panel__vis">` +
    hbar({
      value: c.overall, sigma: c.sigma, label: 'Quantum win rate (all data)',
      marks: [{ at: c.classical_best, label: 'classical limit' }, { at: c.tsirelson_bound, label: 'Tsirelson bound' }],
    }) +
    `<table class="pairs"><caption>Win rate by question pair (x, y)</caption><thead><tr><th scope="col">Questions</th>` +
    PAIRS.map((k) => `<th scope="col">${k}</th>`).join('') +
    `</tr></thead><tbody><tr><th scope="row">Win rate</th>` +
    PAIRS.map((k) => `<td>${pct(c.per_pair[k])}</td>`).join('') + `</tr></tbody></table></div></div>` +
    `<div class="race"><h4>Race: entangled pair vs envelopes</h4>` +
    `<p class="act__text">Each round draws the same random question pair (x, y) for both sides. The entangled pair is sampled from the measured data; the envelopes follow the table you pick.</p>` +
    `<div class="game__controls">` +
    `<button type="button" class="btn" data-act="play100">Play 100</button>` +
    `<button type="button" class="btn" data-act="play1000">Play 1000</button>` +
    `<button type="button" class="btn" data-act="skip" disabled>Skip</button>` +
    `<button type="button" class="btn" data-act="reset">Reset race</button></div>` +
    `<div data-slot="bars">${v.bars}</div><div class="race__counts" data-slot="counts">${v.counts}</div>` +
    `<p class="game__status" data-slot="status" role="status" aria-live="polite"></p>` +
    strategyTable(data, R) + `</div>`;
}

export function paint(el, R) {
  const v = view(R, R.data);
  slot(el, 'bars').innerHTML = v.bars;
  slot(el, 'counts').innerHTML = v.counts;
}

export function wire(el) {
  bindOnce(el, 'change', (e) => {
    const R = currentState(el);
    if (!R || e.target.dataset?.act !== 'pick') return;
    choose(R, Number(e.target.value)); paint(el, R);
  });
  bindOnce(el, 'click', (e) => {
    const btn = e.target.closest?.('button[data-act]');
    const R = currentState(el);
    if (!btn || !R) return;
    const act = btn.dataset.act, status = slot(el, 'status');
    if (act === 'reset') { reset(R); paint(el, R); say(status, 'Race reset.'); }
    else if (act === 'skip') R.anim?.skip();
    else if (act === 'play100' || act === 'play1000') {
      const steps = act === 'play100' ? 100 : 1000, b = { q: R.q.w, c: R.c.w }, unlock = lock(el, btn);
      R.anim = animate({
        steps,
        step: () => playOnce(R, R.data) !== null,
        frame: () => paint(el, R),
        onCancel: unlock,
        onError: failHandler(status),
        done: () => {
          paint(el, R); unlock();
          say(status, `${steps} rounds played: entangled pair won ${R.q.w - b.q}, envelopes won ${R.c.w - b.c}.`);
        },
      });
    }
  });
}
