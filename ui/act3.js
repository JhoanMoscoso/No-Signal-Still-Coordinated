// Act 3: reality check. Two curve charts (CHSH, leader election) with a V slider, "This run"
// from live data and three fixed points from our own IonQ Forte 1 noise-model runs.
// Moving the slider only moves the two markers and the readout; curves are never redrawn.
import { curvePlot, pct, xToPx } from './charts.js';
import { FORTE_RUNS, formatReadout, readout } from './noise.js';

export const timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) };   // test hook

const TEXT = 'Real hardware is noisy. With visibility V, P_win = ½ + V·√2/4: the quantum strategy stops beating 75 % ' +
  'at V = 1/√2 ≈ 0.707. For leader election P(exactly one leader) = V + 3(1−V)/8; the failures are split-brain ' +
  '(two leaders) and no leader. Across three runs on IonQ\'s Forte 1 noise model we measured 96.0–97.0 % — roughly ' +
  'one election in 37 to 40 produces two leaders. Engineering requirements: entanglement must survive in memory for ' +
  'at least the decision window (tens of ms), and entanglement distribution rate must match decision rate. ' +
  'None of this exists at scale today.';
const NEEDS = [
  'Quantum memory that holds entanglement at least as long as the decision window (tens of ms).',
  'An entanglement distribution rate at least equal to the decision rate.',
  'Nodes that prepare the W state among themselves, with no dealer (Tani–Kobayashi–Matsumoto); otherwise it is “envelopes with a dealer”.',
];
const LEGEND = 'Diamonds F0–F2: our runs on IonQ Forte 1 noise model, Oct 10 2026, 1000 shots each ' +
  '(our measurements, not IonQ-published data).';
const MARKERS = ['noise-marker-chsh', 'noise-marker-leader'];
const DEBOUNCE_MS = 300;

const state = new WeakMap();   // root -> { v, data, timer }

const fin = Number.isFinite;
const f2 = (x) => (fin(x) ? x.toFixed(2) : 'not available');
const nameOf = (source) => (source === 'precomputed' ? 'Precomputed run' : 'This run');

const forte = (valueOf, vOf, what) => FORTE_RUNS.map((r) => ({
  x: vOf(r), y: valueOf(r), label: r.id, shape: 'diamond',
  title: `${r.id}: our IonQ Forte 1 noise-model run, V = ${f2(vOf(r))}, ${what} ${pct(valueOf(r))}`,
}));

function charts(data, v, source) {
  const nz = data.noise, iv = data.inferred_visibility ?? {};
  const full = source === 'precomputed' ? 'Precomputed run (BasicSimulator)' : 'This run';
  // A run point exists only with finite numbers; curvePlot would skip it anyway.
  const run = (x, y, what) => (fin(x) && fin(y)
    ? [{ x, y, label: nameOf(source), shape: 'circle', title: `${full}: V = ${f2(x)}, ${what} ${pct(y)}` }] : []);
  return {
    chsh: curvePlot({
      xs: nz.v, label: 'CHSH win rate vs visibility V', markerId: MARKERS[0], markerV: v, y: [0.45, 0.9],
      series: [{ ys: nz.chsh_win, label: 'quantum', dash: '' }],
      hlines: [{ y: nz.classical_bound ?? 0.75, label: 'envelopes' }],
      vlines: [{ x: nz.chsh_threshold ?? Math.SQRT1_2, label: 'quantum stops helping' }],
      points: [...forte((r) => r.chsh, (r) => r.vChsh, 'win rate'), ...run(iv.chsh, data.chsh?.overall, 'win rate')],
    }),
    leader: curvePlot({
      xs: nz.v, label: 'Leader election vs visibility V', markerId: MARKERS[1], markerV: v,
      series: [
        { ys: nz.w_exactly_one, label: 'exactly one', dash: '' },
        { ys: nz.w_split_brain, label: 'split-brain', dash: 'dash' },
        { ys: nz.w_no_leader, label: 'no leader', dash: 'dot' },
      ],
      hlines: [], vlines: [],
      points: [...forte((r) => r.exactlyOne, (r) => r.vW, 'exactly one leader'), ...run(iv.w, data.leader?.exactly_one, 'exactly one leader')],
    }),
  };
}

// "Ideal" needs W and GHZ at V = 1 AND CHSH within 3 sigma of the Tsirelson value, so a degraded
// CHSH can never be reported as noise-free. Missing fields never throw.
export function runNote(data, source) {
  const iv = data.inferred_visibility ?? {}, name = nameOf(source);
  const sigma = data.chsh?.sigma ?? 0.006, tsi = data.chsh?.tsirelson_bound ?? 0.8536;
  const chshOk = fin(data.chsh?.overall) && tsi - data.chsh.overall <= 3 * sigma;
  if (fin(iv.w) && iv.w >= 0.995 && (iv.ghz ?? 1) >= 0.995 && chshOk) {
    return `${name}: consistent with an ideal simulator (no noise detectable at 1000 shots).`;
  }
  const split = fin(data.leader?.split_brain) ? pct(data.leader.split_brain) : 'not available';
  return `${name}: inferred V = ${f2(iv.w)} (leader election), ${f2(iv.chsh)} (CHSH). Split-brain rate: ${split}.`;
}

export function legendText(source) {
  const circle = source === 'precomputed' ? 'Circle: Precomputed run (BasicSimulator), the results shipped with the page.' : 'Circle: this run.';
  return `${circle} Thick vertical line: the slider's V. Points use the visibility inferred from each metric, so they sit on its ` +
    'curve by construction; what varies between runs is how far left they fall.';
}

function build(root) {
  root.classList?.add('act3');
  root.innerHTML =
    `<p class="act__text">${TEXT}</p>` +
    `<div class="slider"><label for="noise-v">Visibility V (1.00 = perfect entanglement)</label>` +
    `<div class="slider__row"><input id="noise-v" type="range" min="0" max="1" step="0.01" value="1" aria-valuetext="V = 1.00">` +
    `<span class="slider__out" data-slot="vout">1.00</span></div></div>` +
    `<p class="readout" data-slot="readout"></p>` +
    `<p class="sr-only" data-slot="readout-live" aria-live="polite"></p>` +
    `<div class="charts"><div data-slot="chart-chsh"></div><div data-slot="chart-leader"></div></div>` +
    `<p class="legend" data-slot="runnote"></p><p class="legend">${LEGEND}</p><p class="legend" data-slot="legend"></p>` +
    `<h3>What hardware would need</h3><ul class="needs">${NEEDS.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  root.addEventListener('input', (e) => {
    if (e.target.id === 'noise-v') onSlide(root, e.target);
  });
}

function paintReadout(root, st) {
  root.querySelector('[data-slot="readout"]').textContent = formatReadout(readout(st.data.noise, st.v));
  root.querySelector('[data-slot="vout"]').textContent = st.v.toFixed(2);
  root.querySelector('#noise-v').setAttribute('aria-valuetext', `V = ${st.v.toFixed(2)}`);
}

function onSlide(root, slider) {
  const st = state.get(root);
  st.v = Math.min(1, Math.max(0, Number(slider.value)));
  for (const id of MARKERS) {                         // markers only: no chart is redrawn
    const m = root.querySelector(`#${id}`);
    m.setAttribute('x1', xToPx(st.v)); m.setAttribute('x2', xToPx(st.v));
    const tag = root.querySelector(`#${id}-label`);            // the "V = ..." tag travels with the line
    tag.setAttribute('x', xToPx(st.v)); tag.textContent = `V = ${st.v.toFixed(2)}`;
  }
  if (!st.data?.noise) return;
  paintReadout(root, st);
  timers.clear(st.timer);                             // announce once, after the slider rests
  st.timer = timers.set(() => {
    root.querySelector('[data-slot="readout-live"]').textContent = formatReadout(readout(st.data.noise, st.v));
  }, DEBOUNCE_MS);
}

function update(root) {
  const st = state.get(root);
  const slider = root.querySelector('#noise-v');
  if (slider.value !== String(st.v)) slider.value = String(st.v);   // slider value survives re-renders
  root.querySelector('[data-slot="legend"]').textContent = legendText(st.source);
  root.querySelector('[data-slot="runnote"]').textContent = runNote(st.data, st.source);
  const c = charts(st.data, st.v, st.source);
  root.querySelector('[data-slot="chart-chsh"]').innerHTML = c.chsh;
  root.querySelector('[data-slot="chart-leader"]').innerHTML = c.leader;
  paintReadout(root, st);
}

// opts.source: 'precomputed' | live key. The slider value is a UI preference and persists; only the
// run point, its label and the note follow the data. Act 3 never throws: main.js treats a throw
// as a failed run, which would also stop the debug update.
export function render(root, data, { source } = {}) {
  let st = state.get(root);
  if (!st) { st = { v: 1, data, source }; state.set(root, st); build(root); }
  st.data = data; st.source = source;
  try { update(root); } catch (err) { console.error('Act 3 could not draw its charts:', err); }
}
