// Small DOM helpers shared by the interactive panels. Everything is guarded so the
// modules that import this stay loadable in node (tests) where there is no document.

const stores = new WeakMap();   // element -> { source, state }
const bound = new WeakMap();    // element -> Set of event types already bound

// One state object per element, rebuilt when `source` changes (precomputed -> live).
export function stateFor(el, source, make) {
  let rec = stores.get(el);
  if (!rec || rec.source !== source) {
    rec?.state.anim?.cancel();
    rec = { source, state: make() };
    stores.set(el, rec);
  }
  return rec.state;
}
export const currentState = (el) => stores.get(el)?.state;

// Idempotent listener: render() runs twice and must never stack handlers.
export function bindOnce(el, type, fn) {
  if (!el.addEventListener) return;
  const set = bound.get(el) ?? bound.set(el, new Set()).get(el);
  if (set.has(type)) return;
  set.add(type);
  el.addEventListener(type, fn);
}

// Disable every control in `box` while a batch animates; only [data-act="skip"] stays live.
// Focus moves to Skip and comes back to the trigger when the batch ends.
export function lock(box, trigger) {
  const ctrls = [...box.querySelectorAll('[data-act]')];
  const skip = ctrls.find((c) => c.dataset.act === 'skip');
  for (const c of ctrls) c.disabled = c !== skip;
  skip?.focus?.();
  return () => {
    for (const c of ctrls) c.disabled = c === skip;
    trigger?.focus?.();
  };
}

// Announce through a polite live region. Clearing first makes a repeated message re-announce.
export function say(el, text) {
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 30);
}

export const slot = (el, name) => el.querySelector(`[data-slot="${name}"]`);

// Remember focus and open <details> before a panel is rebuilt; call the returned function afterwards.
export function snapshotUi(el) {
  const all = (sel) => (el.querySelectorAll ? [...el.querySelectorAll(sel)] : []);
  const a = globalThis.document?.activeElement;
  const focus = a && el.contains?.(a) ? { id: a.id, act: a.dataset?.act } : null;
  const open = all('details').map((d) => d.open);
  return () => {
    all('details').forEach((d, i) => { if (open[i]) d.open = true; });
    if (!focus) return;
    const t = (focus.id && el.querySelector(`[id="${focus.id}"]`)) || (focus.act && el.querySelector(`[data-act="${focus.act}"]`));
    t?.focus?.();
  };
}

// Status text for a batch that stopped early (no data, or a bug logged to the console).
export const failText = (err) => (err?.message === 'no data'
  ? 'No measurement data to sample from.'
  : 'Something went wrong. See the browser console.');
export const failHandler = (statusEl) => (err) => {
  if (err?.message !== 'no data') console.error(err);
  say(statusEl, failText(err));
};
