// Pure helpers for Act 3: interpolate the precomputed noise curves (never recompute the
// formulas here) and hold our own IonQ Forte 1 reference runs.
import { pct, pctMin } from './charts.js';

// Linear interpolation on a sorted grid; exact at the nodes, v clamped to the grid range.
export function interp(xs, ys, v) {
  const last = xs.length - 1;
  if (!(v > xs[0])) return ys[0];
  if (v >= xs[last]) return ys[last];
  let lo = 0, hi = last;                       // invariant: xs[lo] <= v < xs[hi]
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= v) lo = mid; else hi = mid; }
  if (xs[lo] === v) return ys[lo];
  return ys[lo] + ((ys[hi] - ys[lo]) * (v - xs[lo])) / (xs[hi] - xs[lo]);
}

export function readout(noise, v) {
  const x = Math.min(1, Math.max(0, v)), at = (k) => interp(noise.v, noise[k], x);
  return {
    v: x, chsh: at('chsh_win'), classical: noise.classical_bound ?? 0.75,
    exactlyOne: at('w_exactly_one'), splitBrain: at('w_split_brain'), noLeader: at('w_no_leader'), ghz: at('ghz_agreement'),
  };
}

export const formatReadout = (r) =>
  `At V = ${r.v.toFixed(2)} — CHSH: quantum ${pct(r.chsh)}, envelopes ${pctMin(r.classical)} · ` +
  `Leader election: exactly one ${pct(r.exactlyOne)}, split-brain ${pct(r.splitBrain)}, no leader ${pct(r.noLeader)} · ` +
  `Consensus: ${pct(r.ghz)}`;

// OUR measurements (Oct 10 2026, 1000 shots each) on IonQ's Forte 1 noise model. Not IonQ-published data.
export const FORTE_RUNS = [
  { id: 'F0', chsh: 0.854, vChsh: 1.0, exactlyOne: 0.968, split: 0.027, noLeader: 0.005, vW: 0.949, ghz: 0.984, vGhz: 0.979 },
  { id: 'F1', chsh: 0.846, vChsh: 0.979, exactlyOne: 0.960, split: 0.027, noLeader: 0.013, vW: 0.936, ghz: 0.977, vGhz: 0.969 },
  { id: 'F2', chsh: 0.8365, vChsh: 0.952, exactlyOne: 0.970, split: 0.025, noLeader: 0.005, vW: 0.952, ghz: 0.970, vGhz: 0.960 },
];
