import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sample, bit } from '../../ui/sample.js';

// Deterministic PRNG (mulberry32) so proportion tests never flake.
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withRandom(fn, body) {
  const orig = Math.random;
  Math.random = fn;
  try { return body(); } finally { Math.random = orig; }
}

test('bit: qubit 0 is the rightmost character', () => {
  assert.equal(bit('01', 0), 1);
  assert.equal(bit('01', 1), 0);
  assert.equal(bit('100', 2), 1);
  assert.equal(bit('100', 0), 0);
  assert.equal(bit('110', 1), 1);
});

test('sample: boundaries map to the right key', () => {
  // Keys with leading zeros: JS keeps insertion order for them (keys like "10" are sorted first).
  const raw = { '001': 503, '010': 497 };
  assert.equal(withRandom(() => 0, () => sample(raw)), '001');
  assert.equal(withRandom(() => 0.5029, () => sample(raw)), '001');
  assert.equal(withRandom(() => 0.5031, () => sample(raw)), '010');
  assert.equal(withRandom(() => 0.999999, () => sample(raw)), '010');
});

test('sample: proportions match counts over many draws', () => {
  const raw = { '000': 200, '011': 500, '111': 300 };
  const n = 30000;
  const seen = { '000': 0, '011': 0, '111': 0 };
  withRandom(seeded(42), () => { for (let i = 0; i < n; i++) seen[sample(raw)]++; });
  for (const [k, c] of Object.entries(raw)) {
    assert.ok(Math.abs(seen[k] / n - c / 1000) < 0.015, `${k}: ${seen[k] / n}`);
  }
});

test('sample: single-outcome raw always returns it', () => {
  withRandom(seeded(7), () => {
    for (let i = 0; i < 100; i++) assert.equal(sample({ '11': 1000 }), '11');
  });
});

test('sample: empty, missing or all-zero raw returns null (no data), never undefined or a throw', () => {
  assert.equal(sample({}), null);
  assert.equal(sample({ '00': 0, '11': 0 }), null);
  assert.equal(sample(undefined), null);
  assert.equal(sample(null), null);
});

test('sample: skips zero-count keys', () => {
  for (const r of [0, 0.3, 0.999]) assert.equal(sample({ '00': 0, '01': 5 }, () => r), '01');
});
