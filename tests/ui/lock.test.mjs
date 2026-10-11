import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../data/precomputed.js';
import { defaults } from '../../ui/anim.js';
import { currentState, snapshotUi } from '../../ui/dom.js';
import * as send from '../../ui/sendbit.js';
import * as leader from '../../ui/leader.js';
import { render as render2 } from '../../ui/act2.js';

function fakeLoop() {
  let t = 0, q = [];
  return { raf: (fn) => { q.push(fn); }, now: () => t, tick(ms) { t += ms; const f = q; q = []; f.forEach((fn) => fn()); } };
}
const ctrl = (act, disabled = false) => ({ dataset: { act }, disabled, focused: 0, focus() { this.focused++; }, setAttribute() {}, value: '0110' });
const slotEl = () => ({ set innerHTML(v) { this.html = v; }, set textContent(v) { this.text = v; } });

function withLoop(fn) {
  const loop = fakeLoop();
  Object.assign(defaults, { raf: loop.raf, now: loop.now, reduced: false });
  try { return fn(loop); } finally { for (const k of Object.keys(defaults)) delete defaults[k]; }
}

test('MAJOR: source change mid-Send-batch re-enables every control and disables Skip again', () => withLoop((loop) => {
  const c = { msg: ctrl('msg'), random: ctrl('random'), send: ctrl('send'), skip: ctrl('skip', true), reset: ctrl('reset'), invert: ctrl('invert') };
  const slots = {};
  const root = {
    querySelectorAll: (sel) => (sel === '[data-act]' ? Object.values(c) : []),
    querySelector: (sel) => {
      const act = sel.match(/^\[data-act="(\w+)"\]$/)?.[1];
      if (act) return c[act];
      const name = sel.match(/^\[data-slot="([\w-]+)"\]$/)[1];
      return slots[name] ??= slotEl();
    },
  };
  send.sync(root, data, 'precomputed');
  send.act(root, c.send);
  assert.equal(c.send.disabled, true); assert.equal(c.msg.disabled, true); assert.equal(c.skip.disabled, false);
  loop.tick(0); loop.tick(30);                                     // mid-batch: 2 of 4 bits
  assert.ok(currentState(root).n > 0 && currentState(root).n < 4);

  send.sync(root, data, 'live-list');                              // the live render lands
  for (const k of ['msg', 'random', 'send', 'reset', 'invert']) assert.equal(c[k].disabled, false, `${k} re-enabled`);
  assert.equal(c.skip.disabled, true, 'skip disabled again');
  assert.equal(currentState(root).n, 0, 'tally reset with the new source');
  assert.ok(c.send.focused >= 1, 'focus goes back to the trigger');
  loop.tick(500);                                                  // stale frames must not touch anything
  assert.equal(currentState(root).n, 0);
}));

test('error inside a Send batch also unlocks the controls', () => withLoop((loop) => {
  const c = { msg: ctrl('msg'), send: ctrl('send'), skip: ctrl('skip', true), invert: ctrl('invert') };
  const slots = {};
  const root = {
    querySelectorAll: () => Object.values(c),
    querySelector: (sel) => c[sel.match(/^\[data-act="(\w+)"\]$/)?.[1]] ?? (slots[sel] ??= slotEl()),
  };
  const empty = { nosignal: { Z: { raw: {} }, X: { raw: {} } } };
  send.sync(root, empty, 'precomputed');
  send.act(root, c.send);                                          // first step: no data -> abort
  loop.tick(0); loop.tick(30);
  assert.equal(c.send.disabled, false); assert.equal(c.msg.disabled, false); assert.equal(c.skip.disabled, true);
}));

test('act2: source change mid-"Elect 100 times" unlocks and resets the panel', () => withLoop((loop) => {
  const handlers = {};   // handlers.leader.click etc.
  const btns = { elect100: ctrl('elect100'), skip: ctrl('skip', true), elect: ctrl('elect'), reset: ctrl('reset') };
  const mk = (name, extra = {}) => ({
    addEventListener: (t, fn) => { (handlers[name] ??= {})[t] = fn; },
    querySelectorAll: () => [], querySelector: () => slotEl(), contains: () => false, ...extra,
  });
  const els = { leader: mk('leader', { querySelectorAll: (s) => (s === '[data-act]' ? Object.values(btns) : []) }), consensus: mk('consensus'), chsh: mk('chsh') };
  render2(els, data, { source: 'precomputed' });
  handlers.leader.click({ target: { closest: () => btns.elect100 } });
  assert.equal(btns.elect100.disabled, true);
  loop.tick(0); loop.tick(50);
  assert.ok(currentState(els.leader).n > 0);
  render2(els, data, { source: 'live-list' });
  assert.equal(btns.elect100.disabled, false); assert.equal(btns.skip.disabled, true);
  assert.equal(currentState(els.leader).n, 0);
}));

test('snapshotUi: restores focus (by id, else data-act) and open <details> after a rebuild', () => {
  const active = { id: '', dataset: { act: 'play100' } };
  const d1 = { open: true }, d2 = { open: false };
  const fresh = { focused: 0, focus() { this.focused++; } };
  let rebuilt = false;
  const el = {
    contains: (x) => x === active,
    querySelectorAll: (sel) => (sel === 'details' ? (rebuilt ? [{ open: false }, { open: false }] : [d1, d2]) : []),
    querySelector: (sel) => (rebuilt && sel === '[data-act="play100"]' ? fresh : null),
  };
  const prev = globalThis.document;
  globalThis.document = { activeElement: active };
  try {
    const restore = snapshotUi(el);
    rebuilt = true;
    const newDetails = el.querySelectorAll('details');
    el.querySelectorAll = (sel) => (sel === 'details' ? newDetails : []);
    restore();
    assert.equal(newDetails[0].open, true); assert.equal(newDetails[1].open, false);
    assert.equal(fresh.focused, 1);
  } finally { globalThis.document = prev; }
});

test('snapshotUi: harmless without a document (node) or when focus is elsewhere', () => {
  const prev = globalThis.document;
  delete globalThis.document;
  try { snapshotUi({ contains: () => false, querySelectorAll: () => [] })(); } finally { globalThis.document = prev; }
});
