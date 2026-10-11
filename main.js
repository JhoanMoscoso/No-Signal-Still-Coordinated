// No Signal, Still Coordinated — orchestration.
// Contract with Qollab: `backend` is pre-created by the runtime.
// ONE job containing ONE 20-qubit circuit (IonQ rejects multi-circuit jobs and
// allows one job per run). Each experiment sits on its own block of qubits.

import * as runner from 'quantum.runner';          // quantum/runner.py
import precomputed from './data/precomputed.js';    // fallback + instant first paint

const SHOTS = 1000;   // one shot of the wide circuit = one shot of EVERY experiment

const status = document.getElementById('run-status');
const say = (msg) => { status.textContent = msg; };

// 1) Paint immediately from precomputed results so the page is never empty.
render(precomputed, { live: false });

// 2) Run ONE job on whatever QPU the user picked, then re-render live.
//    IonQ  -> 'wide': one 20-qubit circuit (IonQ rejects multi-circuit jobs).
//    local -> 'list': 9 small circuits in one call (a 20-qubit circuit freezes
//             the single-threaded browser simulator; the list runs instantly).
try {
  const mode = await runner.run_mode.callPromising(backend);
  say(mode === 'wide'
    ? 'Building one 20-qubit circuit (9 experiments side by side)…'
    : 'Building 9 small circuits…');
  const payload = await runner.build_for.callPromising(mode);

  say(`Submitting one job (${SHOTS} shots)…`);
  const job = await backend.run(payload, { shots: SHOTS });
  const result = await job.result();

  say('Parsing…');
  const counts = result.get_counts();                       // Python proxy (dict or list); pass straight back
  const dataProxy = await runner.parse_any.callPromising(mode, counts);
  const data = dataProxy.toJs({ dict_converter: Object.fromEntries });
  dataProxy.destroy?.();

  data.mermin = precomputed.mermin;                         // optional extra, see runMerminLocal()
  render(data, { live: true, mode });
  say(`Live results from ${backend.name ?? 'the selected backend'} (${mode} mode).`);
} catch (err) {
  console.error(err);
  say(`Run failed (${String(err?.message ?? err).slice(0, 160)}…). Showing precomputed results.`);
}

// Optional Mermin-GHZ panel. This is a SECOND job, so only offer it on local
// simulators (IonQ stops the run on a second job). Wire to a button in Phase 2.
export async function runMerminLocal() {
  const circuit = await runner.mermin_wide.callPromising();
  const job = await backend.run(circuit, { shots: SHOTS });
  const counts = (await job.result()).get_counts();
  const res = await runner.parse_mermin_wide.callPromising(counts);
  return res.toJs({ dict_converter: Object.fromEntries });
}

function render(data, { live, mode = null }) {
  document.body.dataset.source = live ? 'live' : 'precomputed';
  // TODO Phase 1: replace with ui/act1.js, ui/act2.js, ui/act3.js
  document.getElementById('debug').textContent = JSON.stringify({
    source: live ? `live (${mode})` : 'precomputed',
    bob_p1: ['none', 'Z', 'X'].map((c) => data.nosignal[c].bob.p1),
    chsh: data.chsh.overall,
    chsh_sigma: data.chsh.sigma,
    leader_exactly_one: data.leader.exactly_one,
    split_brain: data.leader.split_brain,
    ghz_agreement: data.consensus.agreement,
    mermin_precomputed: data.mermin?.overall,
    inferred_visibility: data.inferred_visibility,
  }, null, 2);
}