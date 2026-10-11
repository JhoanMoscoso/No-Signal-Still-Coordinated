import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/precomputed.js';
import { interp, readout, formatReadout, FORTE_RUNS } from '../../ui/noise.js';

const N = data.noise;

test('interp: exact at all 101 grid nodes', () => {
  assert.equal(N.v.length, 101);
  for (const k of ['chsh_win', 'w_exactly_one', 'w_split_brain', 'w_no_leader', 'ghz_agreement']) {
    N.v.forEach((x, i) => assert.equal(interp(N.v, N[k], x), N[k][i], `${k}[${i}]`));
  }
});

test('interp: linear between nodes, clamped outside [0,1]', () => {
  assert.equal(interp([0, 1], [0, 10], 0.25), 2.5);
  const mid = interp(N.v, N.chsh_win, 0.805);
  assert.ok(Math.abs(mid - (N.chsh_win[80] + N.chsh_win[81]) / 2) < 1e-12);
  assert.equal(interp(N.v, N.chsh_win, -0.3), N.chsh_win[0]);
  assert.equal(interp(N.v, N.chsh_win, 1.7), N.chsh_win[100]);
});

test('interp: chsh_win crosses the classical bound at V = 1/sqrt(2)', () => {
  assert.ok(Math.abs(interp(N.v, N.chsh_win, 0.7071) - 0.75) < 0.001);
});

test('readout at V=1: 85.4 / 100 / 0 / 0 / 100', () => {
  const r = readout(N, 1);
  assert.equal(r.v, 1);
  assert.ok(Math.abs(r.chsh - 0.8536) < 1e-3);
  assert.equal(r.classical, 0.75);
  assert.equal(r.exactlyOne, 1); assert.equal(r.splitBrain, 0); assert.equal(r.noLeader, 0); assert.equal(r.ghz, 1);
});

test('readout at V=0: 50 / 37.5 / 50 / 12.5 / 25', () => {
  const r = readout(N, 0);
  assert.equal(r.chsh, 0.5); assert.equal(r.exactlyOne, 0.375);
  assert.equal(r.splitBrain, 0.5); assert.equal(r.noLeader, 0.125); assert.equal(r.ghz, 0.25);
});

test('formatReadout at V=0.80 is the exact line', () => {
  assert.equal(
    formatReadout(readout(N, 0.8)),
    'At V = 0.80 — CHSH: quantum 78.3 %, envelopes 75 % · Leader election: exactly one 87.5 %, ' +
    'split-brain 10.0 %, no leader 2.5 % · Consensus: 85.0 %',
  );
});

test('readout clamps V and never recomputes the formulas (follows the data)', () => {
  assert.equal(readout(N, 5).v, 1);
  const fake = { v: [0, 1], chsh_win: [0.1, 0.2], w_exactly_one: [0.3, 0.4], w_split_brain: [0.5, 0.6], w_no_leader: [0.7, 0.8], ghz_agreement: [0.9, 1] };
  assert.equal(readout(fake, 0.5).exactlyOne, 0.35);
});

test('FORTE_RUNS: three of our runs, consistent with the formulas within 0.005', () => {
  assert.deepEqual(FORTE_RUNS.map((r) => r.id), ['F0', 'F1', 'F2']);
  for (const r of FORTE_RUNS) {
    assert.ok(Math.abs(r.vW - (r.exactlyOne - 0.375) / 0.625) < 0.005, `${r.id} vW`);
    assert.ok(Math.abs(r.vGhz - (r.ghz - 0.25) / 0.75) < 0.005, `${r.id} vGhz`);
    assert.ok(Math.abs(r.vChsh - Math.min(1, (r.chsh - 0.5) * 4 / Math.SQRT2)) < 0.005, `${r.id} vChsh`);
    assert.ok(Math.abs(r.exactlyOne + r.split + r.noLeader - 1) < 0.002, `${r.id} probabilities sum to 1`);
  }
  assert.deepEqual(FORTE_RUNS[1], { id: 'F1', chsh: 0.846, vChsh: 0.979, exactlyOne: 0.960, split: 0.027, noLeader: 0.013, vW: 0.936, ghz: 0.977, vGhz: 0.969 });
  assert.deepEqual(FORTE_RUNS[2], { id: 'F2', chsh: 0.8365, vChsh: 0.952, exactlyOne: 0.970, split: 0.025, noLeader: 0.005, vW: 0.952, ghz: 0.970, vGhz: 0.960 });
  assert.deepEqual(FORTE_RUNS[0], { id: 'F0', chsh: 0.854, vChsh: 1.0, exactlyOne: 0.968, split: 0.027, noLeader: 0.005, vW: 0.949, ghz: 0.984, vGhz: 0.979 });
});
