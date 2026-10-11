import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/precomputed.js';
import { bit, sample } from '../../ui/sample.js';
import {
  sendBit, decode, runMessage, chshWin, chshRound, classicalAnswer, playRound,
  exactWinRate, strategyLabel, electRound, describeElection, coinRound, describeCoin,
} from '../../ui/games.js';

function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PAIRS = ['00', '01', '10', '11'];

// ---- sample: injectable rng ----
test('sample: accepts an injected rng', () => {
  assert.equal(sample({ '001': 1, '010': 1 }, () => 0), '001');
  assert.equal(sample({ '001': 1, '010': 1 }, () => 0.99), '010');
});

// ---- Send a bit ----
test('sendBit: returns ONLY Bob\'s bit, bit(key, 1), never Alice\'s bit(key, 0)', () => {
  // key "01": Alice (rightmost) = 1, Bob = 0.  key "10": Alice = 0, Bob = 1.
  const ns = { Z: { raw: { '01': 1000 } }, X: { raw: { '10': 1000 } } };
  assert.equal(bit('01', 0), 1); assert.equal(bit('01', 1), 0);
  assert.equal(sendBit(0, ns, () => 0.3), 0);            // message 0 -> Z -> Bob reads 0 (Alice had 1)
  assert.equal(sendBit(1, ns, () => 0.3), 1);            // message 1 -> X -> Bob reads 1 (Alice had 0)
  assert.ok(['number'].includes(typeof sendBit(0, ns, () => 0.3)), 'a bare bit, no key leaks out');
});

test('sendBit: message 0 samples Z.raw, message 1 samples X.raw', () => {
  const ns = { Z: { raw: { '000': 1 } }, X: { raw: { '010': 1 } } };
  assert.equal(sendBit(0, ns, Math.random), 0);
  assert.equal(sendBit(1, ns, Math.random), 1);
});

test('decode: direct and inverse decoder', () => {
  assert.equal(decode(0, false), 0); assert.equal(decode(1, false), 1);
  assert.equal(decode(0, true), 1); assert.equal(decode(1, true), 0);
});

test('Send a bit: both decoders stay at 50 % +- 3 % over 10 000 sampled bits', () => {
  for (const inverse of [false, true]) {
    const rng = seeded(inverse ? 11 : 5);
    const msg = Array.from({ length: 10000 }, () => (rng() < 0.5 ? 0 : 1));
    const r = runMessage(msg, data.nosignal, { inverse, rng });
    assert.equal(r.total, 10000);
    const acc = r.correct / r.total;
    assert.ok(Math.abs(acc - 0.5) < 0.03, `inverse=${inverse}: ${acc}`);
  }
});

// The no-leak guarantee must bite. Anti-correlated Z: key "01" = Alice 1, Bob 0.
// Message all 0 (always Z): the honest decoder sees Bob's 0 and scores 100 %, the inverse 0 %.
// A leaky decoder reading Alice's bit (always 1) would score exactly the opposite.
test('Send a bit: no leak. Anti-correlated Z gives honest 100 % / inverse 0 % (a leak would flip them)', () => {
  const ns = { Z: { raw: { '01': 1000 } }, X: { raw: { '10': 1000 } } };
  assert.equal(bit('01', 0), 1); assert.equal(bit('01', 1), 0);
  const zeros = Array.from({ length: 200 }, () => 0);
  assert.equal(runMessage(zeros, ns, { inverse: false, rng: seeded(1) }).correct, 200);
  assert.equal(runMessage(zeros, ns, { inverse: true, rng: seeded(1) }).correct, 0);
  // X side: key "10" = Alice 0, Bob 1; message all 1 -> honest decoder 100 %
  const ones = Array.from({ length: 200 }, () => 1);
  assert.equal(runMessage(ones, ns, { inverse: false, rng: seeded(2) }).correct, 200);
  assert.equal(runMessage(ones, ns, { inverse: true, rng: seeded(2) }).correct, 0);
});

test('no data: sendBit / chshRound / electRound / coinRound / playRound return null instead of throwing', () => {
  for (const raw of [undefined, null, {}, { '00': 0 }]) {
    assert.equal(sendBit(0, { Z: { raw }, X: { raw } }), null);
    assert.equal(chshRound({ raw: { '00': raw, '01': raw, '10': raw, '11': raw } }, seeded(1)), null);
    assert.equal(electRound(raw), null);
    assert.equal(coinRound(raw), null);
    assert.equal(playRound({ raw: { '00': raw, '01': raw, '10': raw, '11': raw } }, { alice: '0', bob: '0' }, seeded(1)), null);
  }
  assert.equal(chshRound({ raw: {} }, seeded(1)), null, 'missing pair key');
});

// ---- CHSH ----
test('chshWin: win iff (a xor b) == (x and y)', () => {
  assert.equal(chshWin(0, 0, 0, 0), true);
  assert.equal(chshWin(0, 0, 1, 0), false);
  assert.equal(chshWin(1, 1, 1, 0), true);
  assert.equal(chshWin(1, 1, 1, 1), false);
  assert.equal(chshWin(1, 0, 1, 1), true);
});

test('chsh.raw convention: exact win fractions reproduce per_pair and overall', () => {
  let sum = 0;
  for (const xy of PAIRS) {
    const x = Number(xy[0]), y = Number(xy[1]);
    let wins = 0, total = 0;
    for (const [key, n] of Object.entries(data.chsh.raw[xy])) {
      total += n;
      if (chshWin(x, y, bit(key, 0), bit(key, 1))) wins += n;
    }
    assert.ok(Math.abs(wins / total - data.chsh.per_pair[xy]) < 1e-9, `${xy}: ${wins / total}`);
    sum += wins / total;
  }
  assert.ok(Math.abs(sum / 4 - data.chsh.overall) < 1e-9);
});

test('classicalAnswer: all rules', () => {
  const s = (alice, bob) => ({ alice, bob });
  assert.deepEqual(classicalAnswer(s('0', '1'), 1, 0), { a: 0, b: 1, win: false });
  assert.deepEqual(classicalAnswer(s('x', 'y'), 1, 1), { a: 1, b: 1, win: false });
  assert.deepEqual(classicalAnswer(s('¬x', 'y'), 1, 1), { a: 0, b: 1, win: true });
  assert.deepEqual(classicalAnswer(s('¬x', '¬y'), 0, 0), { a: 1, b: 1, win: true });
  assert.deepEqual(classicalAnswer(s('1', 'y'), 0, 1), { a: 1, b: 1, win: true });
});

test('16 strategies: exact win rate equals the data field, maximum is 0.75', () => {
  const list = data.chsh.classical_strategies;
  assert.equal(list.length, 16);
  for (const s of list) assert.ok(Math.abs(exactWinRate(s) - s.win_rate) < 1e-9, strategyLabel(s));
  assert.equal(Math.max(...list.map(exactWinRate)), 0.75);
});

test('strategyLabel is readable', () => {
  assert.equal(strategyLabel({ alice: '0', bob: 'y' }), 'Alice always 0 · Bob answers y');
  assert.equal(strategyLabel({ alice: '¬x', bob: '1' }), 'Alice answers not x · Bob always 1');
});

test('CHSH sampling: quantum = overall +- 0.02, "always 0" = 0.75 +- 0.02, no table above 0.77', () => {
  const rng = seeded(2026), N = 10000;
  const strategies = data.chsh.classical_strategies;
  const always0 = strategies.find((s) => s.alice === '0' && s.bob === '0');
  let q = 0; const c = strategies.map(() => 0);
  for (let i = 0; i < N; i++) {
    const r = chshRound(data.chsh, rng);
    if (r.win) q++;
    strategies.forEach((s, k) => { if (classicalAnswer(s, r.x, r.y).win) c[k]++; });
  }
  assert.ok(Math.abs(q / N - data.chsh.overall) < 0.02, String(q / N));
  assert.ok(Math.abs(c[strategies.indexOf(always0)] / N - 0.75) < 0.02);
  for (const w of c) assert.ok(w / N <= 0.77, String(w / N));
});

test('playRound: one (x, y) shared by both sides; quantum uses chsh.raw[xy]', () => {
  const r = playRound(data.chsh, { alice: '0', bob: '0' }, seeded(1));
  assert.ok([0, 1].includes(r.x) && [0, 1].includes(r.y));
  assert.equal(r.quantum.win, chshWin(r.x, r.y, r.quantum.a, r.quantum.b));
  assert.equal(r.classical.win, chshWin(r.x, r.y, r.classical.a, r.classical.b));
});

// ---- Leader / consensus ----
test('electRound: leaders are the qubits reading 1, node A = rightmost', () => {
  assert.deepEqual(electRound({ '001': 1 }).leaders, [0]);
  assert.deepEqual(electRound({ '010': 1 }).leaders, [1]);
  assert.deepEqual(electRound({ '100': 1 }).leaders, [2]);
  assert.deepEqual(electRound({ '101': 1 }).leaders, [0, 2]);
  assert.deepEqual(electRound({ '000': 1 }).leaders, []);
});

test('electRound: fairness over 10 000 sampled elections', () => {
  const rng = seeded(8), led = [0, 0, 0];
  for (let i = 0; i < 10000; i++) for (const l of electRound(data.leader.raw, rng).leaders) led[l]++;
  data.leader.per_node_leader.forEach((p, k) => assert.ok(Math.abs(led[k] / 10000 - p) < 0.02));
});

test('describeElection is honest about noisy outcomes', () => {
  assert.equal(describeElection([1]), 'Exactly one leader: B');
  assert.equal(describeElection([0, 2]), 'Split-brain: A and C both lead');
  assert.equal(describeElection([0, 1, 2]), 'Split-brain: A, B and C all lead');
  assert.equal(describeElection([]), 'No leader: nobody claims the role');
});

test('coinRound / describeCoin', () => {
  assert.deepEqual(coinRound({ '111': 1 }).bits, [1, 1, 1]);
  assert.equal(coinRound({ '111': 1 }).agree, true);
  assert.deepEqual(coinRound({ '110': 1 }).bits, [0, 1, 1]);          // A = rightmost
  assert.equal(coinRound({ '110': 1 }).agree, false);
  assert.equal(describeCoin(coinRound({ '000': 1 })), 'All three read 0');
  assert.equal(describeCoin(coinRound({ '110': 1 })), 'No consensus: A=0, B=1, C=1');
});
