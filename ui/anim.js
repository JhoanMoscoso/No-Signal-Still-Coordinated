// Tiny paced-loop helper: run `steps` callbacks at ~15 ms each via requestAnimationFrame.
// Instant under prefers-reduced-motion or without rAF (node). Supports skip() and cancel().
// A step that throws, or returns false ("no data"), aborts the batch: onError(err) then
// onCancel() run, done() does not. cancel() also runs onCancel(), so callers can always
// release their UI lock there, whatever the reason the batch ended early.

export const defaults = {};   // test hook: override raf / now / reduced for every animate() call

export function prefersReducedMotion(mm = globalThis.matchMedia) {
  try { return !!mm?.call(globalThis, '(prefers-reduced-motion: reduce)')?.matches; } catch { return false; }
}

export function animate(opts) {
  const {
    steps, step, frame = () => {}, done = () => {}, onCancel = () => {}, onError = (e) => console.error(e),
    interval = 15, maxMs = 4000,                      // long batches run several steps per frame
    reduced = prefersReducedMotion(),
    raf = globalThis.requestAnimationFrame?.bind(globalThis),
    now = () => globalThis.performance?.now?.() ?? Date.now(),
  } = { ...defaults, ...opts };
  let i = 0, over = false;
  const fail = (err) => { if (over) return; over = true; onError(err); onCancel(); };
  const runTo = (n) => {
    while (i < n && i < steps && !over) {
      try { if (step(i++) === false) fail(new Error('no data')); } catch (err) { fail(err); }
    }
  };
  const finish = () => { if (over) return; over = true; frame(); done(); };
  const ctl = {
    skip() { if (!over) { runTo(steps); finish(); } },
    cancel() { if (over) return; over = true; onCancel(); },
    get running() { return !over; },
  };
  if (reduced || !raf || steps <= 0) { runTo(steps); finish(); return ctl; }
  const per = Math.min(interval, maxMs / steps), t0 = now();
  const tick = () => {
    if (over) return;
    runTo(Math.floor((now() - t0) / per));
    if (over) return;
    if (i >= steps) finish(); else { frame(); raf(tick); }
  };
  raf(tick);
  return ctl;
}
