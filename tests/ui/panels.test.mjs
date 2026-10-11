import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/precomputed.js';
import * as leader from '../../ui/leader.js';
import * as consensus from '../../ui/consensus.js';
import * as chsh from '../../ui/chsh.js';

function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const raw = (r) => ({ leader: { raw: r, per_node_leader: [0.3, 0.3, 0.4] } });

test('leader: before any election nodes show "—" and the share', () => {
  const v = leader.view(leader.newState(), data);
  assert.ok(v.nodes.includes('32.9 %'));
  assert.ok(v.nodes.includes('—'));
  assert.equal(v.counts, 'Elections: 0 · Exactly one leader: 0');
  assert.ok(v.tally.includes('A led 0 of 0 elections'));
});

test('leader: one election lights exactly one node, tally and counter update', () => {
  const L = leader.newState();
  leader.electOnce(L, raw({ '010': 1 }));
  assert.deepEqual(L.led, [0, 1, 0]);
  const v = leader.view(L, data);
  assert.equal((v.nodes.match(/class="node is-on"/g) || []).length, 1);
  assert.ok(v.nodes.includes('LEADER') && v.nodes.includes('idle'));
  assert.equal(v.status, 'Exactly one leader: B');
  assert.equal(v.counts, 'Elections: 1 · Exactly one leader: 1');
  assert.ok(v.tally.includes('B led 1 of 1 elections'));
});

test('leader: noisy outcomes are shown honestly (split-brain, no leader)', () => {
  const L = leader.newState();
  leader.electOnce(L, raw({ '101': 1 }));
  let v = leader.view(L, data);
  assert.equal(v.status, 'Split-brain: A and C both lead');
  assert.equal((v.nodes.match(/class="node is-on"/g) || []).length, 2);
  assert.equal(v.counts, 'Elections: 1 · Exactly one leader: 0');
  leader.electOnce(L, raw({ '000': 1 }));
  v = leader.view(L, data);
  assert.equal(v.status, 'No leader: nobody claims the role');
  assert.equal((v.nodes.match(/class="node is-on"/g) || []).length, 0);
});

test('leader: 100 elections from precomputed data stay fair', () => {
  const L = leader.newState(), rng = seeded(9);
  for (let i = 0; i < 100; i++) leader.electOnce(L, data, rng);
  assert.equal(L.n, 100);
  assert.equal(L.one, 100);                               // ideal data: always exactly one
  assert.equal(L.led.reduce((a, b) => a + b, 0), 100);
  assert.ok(L.led.every((c) => c > 15 && c < 55));
});

test('consensus: flip puts the same bit on all three nodes', () => {
  const C = consensus.newState();
  let v = consensus.view(C, data);
  assert.ok(v.nodes.includes('reads b'));
  consensus.flipOnce(C, { consensus: { raw: { '111': 1 } } });
  v = consensus.view(C, data);
  assert.equal((v.nodes.match(/class="node is-on"/g) || []).length, 3);
  assert.equal(v.status, 'All three read 1');
  assert.equal(v.counts, 'Flips: 1 · All agree: 1 · Zeros: 0 · Ones: 1');
  consensus.flipOnce(C, { consensus: { raw: { '011': 1 } } });
  v = consensus.view(C, data);
  assert.equal(v.status, 'No consensus: A=1, B=1, C=0');
  assert.equal(v.counts, 'Flips: 2 · All agree: 1 · Zeros: 0 · Ones: 1');
});

test('chsh race: default strategy is a best table; both sides play the same rounds', () => {
  const R = chsh.newState(data);
  assert.equal(data.chsh.classical_strategies[R.strategy].win_rate, 0.75);
  const rng = seeded(4);
  for (let i = 0; i < 100; i++) chsh.playOnce(R, data, rng);
  assert.equal(R.q.n, 100); assert.equal(R.c.n, 100);
  assert.ok(R.q.w >= 0 && R.q.w <= 100);
  const v = chsh.view(R, data);
  assert.ok(v.bars.includes('Envelopes (best table)') && v.bars.includes('Entangled pair'));
  assert.ok(v.counts.includes(`${R.q.w} of 100 rounds won`));
  assert.ok(v.counts.includes(`${R.c.w} of 100 rounds won`));
});

test('chsh race: a chosen weak table is labelled so; choosing resets the counters', () => {
  const R = chsh.newState(data);
  chsh.playOnce(R, data, seeded(1));
  const weak = data.chsh.classical_strategies.findIndex((s) => s.win_rate === 0.25);
  chsh.choose(R, weak);
  assert.equal(R.strategy, weak);
  assert.equal(R.q.n, 0); assert.equal(R.c.n, 0);
  const v = chsh.view(R, data);
  assert.ok(v.bars.includes('Envelopes (chosen table)'));
  assert.ok(v.bars.includes('—'), 'no rounds yet: no percentage shown');
});

test('chsh race: over 10 000 rounds no table beats 0.77 and the quantum side beats 0.80', () => {
  const rng = seeded(77);
  for (let k = 0; k < 16; k++) {
    const R = chsh.newState(data); chsh.choose(R, k);
    for (let i = 0; i < 10000; i++) chsh.playOnce(R, data, rng);
    assert.ok(R.c.w / 10000 <= 0.77, `strategy ${k}`);
    assert.ok(R.q.w / 10000 > 0.80);
  }
});

// ---- Send a bit ----
import * as send from '../../ui/sendbit.js';

test('sendbit: sanitize keeps only 0/1 and at most 32 chars', () => {
  assert.equal(send.sanitize('01a1 0x2'), '0110');   // drops a, space, x, 2
  assert.equal(send.sanitize('1'.repeat(40)).length, 32);
  assert.equal(send.sanitize(''), '');
});

test('sendbit: randomMessage is 32 bits of 0/1', () => {
  const m = send.randomMessage(32, seeded(5));
  assert.match(m, /^[01]{32}$/);
});

test('sendbit: tally accumulates across messages until reset', () => {
  const S = send.newState(), rng = seeded(21);
  send.startMessage(S, [0, 1, 1, 0]);
  for (const b of S.bits) send.playBit(S, b, data, rng);
  assert.equal(S.n, 4);
  send.startMessage(S, [1, 0]);
  for (const b of S.bits) send.playBit(S, b, data, rng);
  assert.equal(S.n, 6, 'tally persists between messages');
  const v = send.view(S);
  assert.ok(v.count.includes('Bits sent: 6'));
  send.resetTally(S);
  assert.equal(S.n, 0); assert.equal(send.view(S).count, 'Bits sent: 0 · Bob guessed right: 0');
});

test('sendbit: converges to ~50 % over many messages, both decoders', () => {
  for (const inverse of [false, true]) {
    const S = send.newState(), rng = seeded(inverse ? 31 : 30);
    S.inverse = inverse;
    for (let k = 0; k < 300; k++) {
      send.startMessage(S, [...send.randomMessage(32, rng)].map(Number));
      for (const b of S.bits) send.playBit(S, b, data, rng);
    }
    assert.equal(S.n, 9600);
    assert.ok(Math.abs(S.correct / S.n - 0.5) < 0.03);
  }
});

test('sendbit: decoder text and per-message summary', () => {
  const S = send.newState();
  assert.equal(send.decoderText(false), 'Bob guesses 0 when he reads 0, and 1 when he reads 1.');
  assert.equal(send.decoderText(true), 'Bob guesses 1 when he reads 0, and 0 when he reads 1.');
  // anti-correlated Z (key "01": Alice 1, Bob 0), always-Z message: honest decoder 4/4, inverse 0/4
  const anti = { nosignal: { Z: { raw: { '01': 1000 } }, X: { raw: { '10': 1000 } } } };
  send.startMessage(S, [0, 0, 0, 0]);
  for (const b of S.bits) send.playBit(S, b, anti, seeded(1));
  assert.equal(send.summary(S), "Bob's guesses: 4/4 — a coin would do the same.");
  S.inverse = true; send.startMessage(S, [0, 0, 0, 0]);
  for (const b of S.bits) send.playBit(S, b, anti, seeded(1));
  assert.equal(send.summary(S), "Bob's guesses: 0/4 — a coin would do the same.");
});

test('sendbit UI path: playBit never lets Alice\'s bit decide the score (anti-correlated Z)', () => {
  const anti = { nosignal: { Z: { raw: { '01': 1000 } }, X: { raw: { '10': 1000 } } } };
  const honest = send.newState(), inv = send.newState(); inv.inverse = true;
  for (const S of [honest, inv]) {
    send.startMessage(S, Array.from({ length: 100 }, () => 0));
    for (const b of S.bits) send.playBit(S, b, anti, seeded(7));
  }
  assert.equal(honest.correct, 100);   // a decoder peeking at Alice (always 1) would get 0 here
  assert.equal(inv.correct, 0);
});

test('sendbit: playBit with no data returns null and changes nothing', () => {
  const S = send.newState();
  send.startMessage(S, [0]);
  assert.equal(send.playBit(S, 0, { nosignal: { Z: { raw: {} }, X: { raw: {} } } }), null);
  assert.equal(S.n, 0); assert.equal(S.rows.length, 0);
});

test('sendbit: insertClean strips non-bits and respects maxlength 32', () => {
  assert.deepEqual(send.insertClean('', 0, 0, '1x0y1'), { value: '101', caret: 3 });
  assert.deepEqual(send.insertClean('1111', 1, 3, 'ab0'), { value: '101', caret: 2 });    // replaces the selection
  const long = send.insertClean('1'.repeat(30), 30, 30, 'z0101z0101');
  assert.equal(long.value.length, 32);
  assert.equal(long.value, '1'.repeat(30) + '01');
  assert.deepEqual(send.insertClean('01', 2, 2, 'zzz'), { value: '01', caret: 2 });
});

test('sendbit: message view pads unseen bits and never shows Alice outcomes', () => {
  const S = send.newState();
  send.startMessage(S, [1, 0, 1, 1]);
  send.playBit(S, 1, data, seeded(2));
  const v = send.view(S);
  assert.ok(v.msg.includes('1011'));
  assert.ok(v.msg.includes('·'), 'bits not yet read are padded');
  assert.ok(!/Alice (measured|read|outcome)/i.test(v.msg));
});

test('sendbit: html has the 32-bit input, random button, decoder toggle and reset', () => {
  const h = send.html();
  assert.ok(h.includes('maxlength="32"'));
  for (const a of ['random', 'send', 'skip', 'reset', 'invert']) assert.ok(h.includes(`data-act="${a}"`), a);
  assert.ok(h.includes('Random message') && h.includes('Bob guesses 0 when he reads 0'));
  assert.match(h, /data-act="invert"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*data-act="invert"/);
  assert.match(h, /<label for="send-msg">/);
});

test('no data: electOnce / flipOnce / playOnce return null and leave state untouched', () => {
  const empty = { leader: { raw: {} }, consensus: { raw: {} }, chsh: { ...data.chsh, raw: { '00': {}, '01': {}, '10': {}, '11': {} } } };
  const L = leader.newState(); assert.equal(leader.electOnce(L, empty), null); assert.equal(L.n, 0);
  const C = consensus.newState(); assert.equal(consensus.flipOnce(C, empty), null); assert.equal(C.n, 0);
  const R = chsh.newState(data); assert.equal(chsh.playOnce(R, empty), null); assert.equal(R.q.n, 0);
});

test('consensus: before the first flip the note says "ideally the same b"', () => {
  const v = consensus.view(consensus.newState());
  assert.ok(v.nodes.includes('ideally the same b'));
  assert.ok(!v.nodes.includes('same b everywhere'));
});
