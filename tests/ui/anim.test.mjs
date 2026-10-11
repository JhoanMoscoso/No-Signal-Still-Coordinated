import { test } from 'node:test';
import assert from 'node:assert/strict';
import { animate, prefersReducedMotion } from '../../ui/anim.js';

// Fake frame loop: raf queues callbacks; tick(ms) advances the clock and runs one frame.
function fakeLoop() {
  let t = 0, q = [];
  return {
    raf: (fn) => { q.push(fn); },
    now: () => t,
    tick(ms) { t += ms; const f = q; q = []; f.forEach((fn) => fn()); },
    pending: () => q.length,
  };
}

test('reduced motion: all steps run synchronously, done once', () => {
  const seen = []; let done = 0;
  animate({ steps: 5, step: (i) => seen.push(i), done: () => done++, reduced: true });
  assert.deepEqual(seen, [0, 1, 2, 3, 4]);
  assert.equal(done, 1);
});

test('no requestAnimationFrame (node): also synchronous', () => {
  let n = 0, done = 0;
  animate({ steps: 3, step: () => n++, done: () => done++, reduced: false, raf: undefined });
  assert.equal(n, 3); assert.equal(done, 1);
});

test('paced: ~15 ms per step, done after the last step', () => {
  const loop = fakeLoop(); const seen = []; let done = 0;
  animate({ steps: 10, step: (i) => seen.push(i), done: () => done++, reduced: false, raf: loop.raf, now: loop.now });
  loop.tick(0); assert.equal(seen.length, 0);
  loop.tick(30); assert.equal(seen.length, 2);
  loop.tick(15); assert.equal(seen.length, 3);
  assert.equal(done, 0);
  for (let i = 0; i < 20; i++) loop.tick(15);
  assert.equal(seen.length, 10);
  assert.equal(done, 1);
  assert.equal(loop.pending(), 0);
});

test('long batches are capped to maxMs total (several steps per frame)', () => {
  const loop = fakeLoop(); let n = 0;
  animate({ steps: 1000, step: () => n++, reduced: false, raf: loop.raf, now: loop.now, maxMs: 4000 });
  loop.tick(0); loop.tick(4001);
  assert.equal(n, 1000);
});

test('skip finishes remaining steps immediately and calls done once', () => {
  const loop = fakeLoop(); let n = 0, done = 0, frames = 0;
  const ctl = animate({ steps: 100, step: () => n++, frame: () => frames++, done: () => done++, reduced: false, raf: loop.raf, now: loop.now });
  loop.tick(0); loop.tick(45);
  assert.equal(n, 3);
  ctl.skip();
  assert.equal(n, 100); assert.equal(done, 1); assert.ok(frames >= 1);
  loop.tick(1000);                         // stale frame must not run anything
  assert.equal(n, 100); assert.equal(done, 1);
  ctl.skip(); assert.equal(done, 1);
});

test('cancel stops without calling done', () => {
  const loop = fakeLoop(); let n = 0, done = 0;
  const ctl = animate({ steps: 50, step: () => n++, done: () => done++, reduced: false, raf: loop.raf, now: loop.now });
  loop.tick(0); loop.tick(30); ctl.cancel(); loop.tick(500);
  assert.equal(n, 2); assert.equal(done, 0); assert.equal(ctl.running, false);
});

test('prefersReducedMotion: guarded when matchMedia is absent or throws', () => {
  assert.equal(prefersReducedMotion(undefined), false);
  assert.equal(prefersReducedMotion(() => { throw new Error('x'); }), false);
  assert.equal(prefersReducedMotion(() => ({ matches: true })), true);
  assert.equal(prefersReducedMotion(() => ({ matches: false })), false);
});

test('a throwing step aborts: onError + onCancel run, done does not', () => {
  const calls = [];
  animate({
    steps: 5, reduced: true,
    step: (i) => { if (i === 2) throw new Error('boom'); },
    onError: (e) => calls.push(['error', e.message]),
    onCancel: () => calls.push(['cancel']),
    done: () => calls.push(['done']),
  });
  assert.deepEqual(calls, [['error', 'boom'], ['cancel']]);
});

test('default onError logs to console.error', () => {
  const orig = console.error; let logged = 0;
  console.error = () => { logged++; };
  try { animate({ steps: 1, reduced: true, step: () => { throw new Error('x'); } }); } finally { console.error = orig; }
  assert.equal(logged, 1);
});

test('a step returning false means "no data": aborts like an error', () => {
  const calls = []; let ran = 0;
  animate({ steps: 5, reduced: true, step: () => { ran++; return false; },
    onError: (e) => calls.push(e.message), onCancel: () => calls.push('cancel'), done: () => calls.push('done') });
  assert.equal(ran, 1);
  assert.deepEqual(calls, ['no data', 'cancel']);
});

test('paced: error in a later frame also aborts and stops the loop', () => {
  const loop = fakeLoop(); const calls = [];
  animate({ steps: 10, reduced: false, raf: loop.raf, now: loop.now,
    step: (i) => { if (i === 3) throw new Error('late'); },
    onError: () => calls.push('error'), onCancel: () => calls.push('cancel'), done: () => calls.push('done') });
  loop.tick(0); loop.tick(100); loop.tick(100);
  assert.deepEqual(calls, ['error', 'cancel']);
  assert.equal(loop.pending(), 0);
});

test('cancel() runs onCancel exactly once; skip() and normal completion do not', () => {
  const loop = fakeLoop(); let c = 0;
  const ctl = animate({ steps: 50, step() {}, reduced: false, raf: loop.raf, now: loop.now, onCancel: () => c++ });
  ctl.cancel(); ctl.cancel(); assert.equal(c, 1);
  let c2 = 0; const ctl2 = animate({ steps: 50, step() {}, reduced: false, raf: loop.raf, now: loop.now, onCancel: () => c2++ });
  ctl2.skip(); ctl2.cancel(); assert.equal(c2, 0);
  let c3 = 0; animate({ steps: 3, step() {}, reduced: true, onCancel: () => c3++ });
  assert.equal(c3, 0);
});

test('defaults: shared test hook for the driver', async () => {
  const { defaults } = await import('../../ui/anim.js');
  const loop = fakeLoop(); let n = 0;
  Object.assign(defaults, { raf: loop.raf, now: loop.now, reduced: false });
  try {
    animate({ steps: 10, step: () => n++ });
    assert.equal(n, 0); loop.tick(0); loop.tick(45);
    assert.equal(n, 3);
  } finally { for (const k of Object.keys(defaults)) delete defaults[k]; }
});
