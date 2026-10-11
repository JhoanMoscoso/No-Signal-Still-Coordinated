// Stand-in for quantum/runner.py: same callPromising() surface, returns precomputed data.
// parse_any returns a slightly perturbed copy after a delay so "live replaces precomputed" is visible.
import precomputed from '../../data/precomputed.js';

const wrap = (fn) => ({ callPromising: async (...args) => fn(...args) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const run_mode = wrap(() => new URLSearchParams(location.search).get('mode') === 'wide' ? 'wide' : 'list');
export const build_for = wrap((mode) => ({ shim: true, mode }));
export const parse_any = wrap(async () => {
  await sleep(Number(new URLSearchParams(location.search).get('delay') ?? 1500));   // ?delay=300 lands the live render mid-batch
  const live = structuredClone(precomputed);
  live.chsh.overall = 0.858;
  live.nosignal.none.bob = { p0: 0.51, p1: 0.49, shots: 1000 };
  live.leader.per_node_leader = [0.34, 0.33, 0.33];
  if (new URLSearchParams(location.search).get('mode') === 'wide') {   // noisy, Forte-like run
    Object.assign(live.leader, { exactly_one: 0.96, split_brain: 0.027, no_leader: 0.013 });
    live.inferred_visibility = { chsh: 0.979, w: 0.936, ghz: 0.969 };
    live.chsh.overall = 0.846;
  }
  return { toJs: () => live, destroy() {} };
});
export const mermin_wide = wrap(() => ({ shim: true }));
export const parse_mermin_wide = wrap(() => ({ toJs: () => ({ overall: 1 }) }));
