// Act 1 challenge: try to send a message through the Bell pair. Bob only ever sees his own
// bit (games.sendBit never returns Alice's), so both decoders sit at ~50 %.
import { hbar, pct } from './charts.js';
import { sendBit, decode } from './games.js';
import { animate } from './anim.js';
import { currentState, failHandler, lock, say, slot, stateFor } from './dom.js';

const LEN = 32;
const DEFAULT_MSG = '10110010011101001011000110101101';

export const newState = () => ({ n: 0, correct: 0, inverse: false, bits: [], rows: [] });
export const sanitize = (s) => String(s).replace(/[^01]/g, '').slice(0, LEN);
export const randomMessage = (len = LEN, rng = Math.random) =>
  Array.from({ length: len }, () => (rng() < 0.5 ? 0 : 1)).join('');
export const decoderText = (inverse) => (inverse
  ? 'Bob guesses 1 when he reads 0, and 0 when he reads 1.'
  : 'Bob guesses 0 when he reads 0, and 1 when he reads 1.');

export function startMessage(S, bits) { S.bits = bits; S.rows = []; }
export function playBit(S, m, data, rng = Math.random) {
  const read = sendBit(m, data.nosignal, rng);          // Bob's own bit: all the decoder gets
  if (read === null) return null;                        // no data: change nothing
  const guess = decode(read, S.inverse), ok = guess === m, row = { sent: m, read, guess, ok };
  S.rows.push(row);
  S.n++; if (ok) S.correct++;
  return row;
}
export function resetTally(S) { S.n = 0; S.correct = 0; S.bits = []; S.rows = []; }
export const summary = (S) =>
  `Bob's guesses: ${S.rows.filter((r) => r.ok).length}/${S.bits.length} — a coin would do the same.`;

export function view(S) {
  const pad = (f) => S.bits.map((_, i) => (S.rows[i] ? f(S.rows[i]) : '·')).join('');
  const row = (label, text) => `<p class="msg__row"><span class="msg__label">${label}</span><span class="mono">${text}</span></p>`;
  return {
    msg: S.bits.length
      ? row('Alice sent', S.bits.join('')) + row('Bob read', pad((r) => r.read)) +
        row('Bob guessed', pad((r) => r.guess)) + row('Right?', pad((r) => (r.ok ? '✓' : '✗')))
      : '',
    tally: hbar({
      label: "Bob's accuracy over all bits sent", value: S.n ? S.correct / S.n : 0,
      text: S.n ? undefined : '—', marks: [{ at: 0.5, label: 'coin flip' }],
    }),
    count: `Bits sent: ${S.n} · Bob guessed right: ${S.correct}${S.n ? ` (${pct(S.correct / S.n)})` : ''}`,
  };
}

export function html() {
  const S = newState(), v = view(S);
  return `<section class="game act1__send" aria-labelledby="send-title"><h3 id="send-title">Try to send a message</h3>` +
    `<p class="act__text">Alice encodes each bit of a message by what she measures: 0 means Z, 1 means X. ` +
    `Bob never sees her result. He reads his own qubit and guesses.</p>` +
    `<div class="game__controls"><label for="send-msg">Message (up to ${LEN} bits)</label>` +
    `<input id="send-msg" class="mono" type="text" inputmode="numeric" maxlength="${LEN}" size="${LEN + 2}" ` +
    `autocomplete="off" spellcheck="false" value="${DEFAULT_MSG}" data-act="msg">` +
    `<button type="button" class="btn" data-act="random">Random message</button>` +
    `<button type="button" class="btn" data-act="send">Send message</button>` +
    `<button type="button" class="btn" data-act="skip" disabled>Skip</button>` +
    `<button type="button" class="btn" data-act="reset">Reset tally</button></div>` +
    `<p class="decoder"><span data-slot="decoder">${decoderText(false)}</span> ` +
    `<button type="button" class="btn" data-act="invert" aria-pressed="false">Inverse decoder</button></p>` +
    `<div class="msg" data-slot="send-view">${v.msg}</div>` +
    `<div data-slot="send-tally">${v.tally}</div><p class="game__counts" data-slot="send-count">${v.count}</p>` +
    `<p class="game__status" data-slot="send-status" role="status" aria-live="polite"></p></section>`;
}

export function paint(root, S) {
  const v = view(S);
  slot(root, 'send-view').innerHTML = v.msg;
  slot(root, 'send-tally').innerHTML = v.tally;
  slot(root, 'send-count').textContent = v.count;
  slot(root, 'decoder').textContent = decoderText(S.inverse);
  root.querySelector('[data-act="invert"]').setAttribute('aria-pressed', String(S.inverse));
}

// Reset the game state when the data source changes (precomputed -> live).
export function sync(root, data, source) {
  const S = stateFor(root, source, newState);
  S.data = data;
  paint(root, S);
}

// Insert `data` at the caret keeping only 0/1 and never more than LEN characters.
export function insertClean(value, start, end, data) {
  const room = LEN - (value.length - (end - start));
  const ins = sanitize(data).slice(0, Math.max(0, room));
  return { value: value.slice(0, start) + ins + value.slice(end), caret: start + ins.length };
}

// Typed or pasted text is cleaned before it lands, so maxlength never counts junk characters.
export function onBeforeInput(e) {
  const t = e.target;
  if (t.dataset?.act !== 'msg' || !['insertText', 'insertFromPaste', 'insertFromDrop'].includes(e.inputType) || e.data == null) return;
  e.preventDefault();
  const r = insertClean(t.value, t.selectionStart, t.selectionEnd, e.data);
  t.value = r.value; t.setSelectionRange(r.caret, r.caret);
}

export function onInput(root, input) {
  const clean = sanitize(input.value);
  if (clean !== input.value) input.value = clean;
}

export function act(root, btn) {
  const S = currentState(root);
  if (!S) return;
  const status = slot(root, 'send-status'), input = root.querySelector('[data-act="msg"]');
  switch (btn.dataset.act) {
    case 'random': input.value = randomMessage(LEN); break;
    case 'reset': resetTally(S); paint(root, S); say(status, 'Tally reset.'); break;
    case 'invert':
      S.inverse = !S.inverse; resetTally(S); paint(root, S);
      say(status, `${decoderText(S.inverse)} Tally reset.`);
      break;
    case 'skip': S.anim?.skip(); break;
    case 'send': {
      const bits = [...sanitize(input.value)].map(Number);
      if (!bits.length) { say(status, 'Type at least one 0 or 1, or press Random message.'); break; }
      input.value = bits.join('');
      startMessage(S, bits);
      const unlock = lock(root, btn);
      S.anim = animate({
        steps: bits.length,
        step: (i) => playBit(S, bits[i], S.data) !== null,
        frame: () => paint(root, S),
        onCancel: unlock,
        onError: failHandler(status),
        done: () => { paint(root, S); unlock(); say(status, summary(S)); },
      });
      break;
    }
  }
}
