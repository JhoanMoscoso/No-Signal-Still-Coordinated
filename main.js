// No Signal, Still Coordinated — orchestration.
// Contract with Qollab: `backend` is pre-created by the runtime. ONE backend.run.
// Everything the UI draws comes from `data` (same shape locally and on Qollab).

import * as runner from 'quantum.runner';          // quantum/runner.py
import precomputed from './data/precomputed.js';    // fallback + instant first paint

const SHOTS = 1000;   // per circuit; 13 circuits -> 13k shots. Keep modest for IonQ remote sims.

const status = document.getElementById('run-status');
const say = (msg) => { status.textContent = msg; };

// 1) Paint immediately from precomputed results so the page is never empty.
render(precomputed, { live: false });

// 2) Run the single job on whatever QPU the user picked, then re-render live.
try {
  say('Building 13 circuits…');
  const circuits = await runner.build_all.callPromising();

  say(`Submitting one job (${SHOTS} shots × ${circuits.length} circuits)…`);
  const job = await backend.run(circuits, { shots: SHOTS });
  const result = await job.result();

  say('Parsing…');
  const counts = result.get_counts();                       // Python list proxy, pass straight back
  const dataProxy = await runner.parse_counts.callPromising(counts);
  const data = dataProxy.toJs({ dict_converter: Object.fromEntries });
  dataProxy.destroy?.();

  render(data, { live: true });
  say(`Live results from ${backend.name ?? 'the selected backend'}.`);
} catch (err) {
  console.error(err);
  say(`Run failed (${err?.message ?? err}). Showing precomputed results.`);
}

function render(data, { live }) {
  document.body.dataset.source = live ? 'live' : 'precomputed';
  // TODO Phase 1: replace with ui/act1.js, ui/act2.js, ui/act3.js
  document.getElementById('debug').textContent = JSON.stringify({
    bob_p1: ['none', 'Z', 'X'].map((c) => data.nosignal[c].bob.p1),
    chsh: data.chsh.overall,
    leader_exactly_one: data.leader.exactly_one,
    ghz_agreement: data.consensus.agreement,
    mermin: data.mermin?.overall,
    inferred_visibility: data.inferred_visibility,
  }, null, 2);
}
