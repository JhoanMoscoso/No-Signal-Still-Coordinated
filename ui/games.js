// Pure game logic for the interactive demos. No DOM; every function takes an injectable rng.
// Key convention in `raw`: key[-1] = Alice / node A (qubit 0), key[-2] = Bob / node B (qubit 1).
import { sample, bit } from './sample.js';

const NODES = ['A', 'B', 'C'];
const nodeList = (idx) => {
  const n = idx.map((i) => NODES[i]);
  return n.length < 3 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

// ---- Act 1: send a bit ----
// Message bit 0 = Alice measures Z, 1 = measures X. Returns ONLY Bob's bit: Alice's outcome
// (bit(key, 0)) is deliberately never exposed, so a decoder cannot peek at it.
export function sendBit(msgBit, nosignal, rng = Math.random) {
  const key = sample(nosignal[msgBit === 0 ? 'Z' : 'X'].raw, rng);
  return key == null ? null : bit(key, 1);               // null = no data
}
export const decode = (bobBit, inverse = false) => (inverse ? 1 - bobBit : bobBit);

export function runMessage(bits, nosignal, { inverse = false, rng = Math.random } = {}) {
  const rows = bits.map((m) => {
    const read = sendBit(m, nosignal, rng), guess = decode(read, inverse);   // read is null only without data
    return { sent: m, read, guess, ok: guess === m };
  });
  return { rows, total: rows.length, correct: rows.filter((r) => r.ok).length };
}

// ---- Act 2c: CHSH ----
export const chshWin = (x, y, a, b) => (a ^ b) === (x & y);

export function chshRound(chsh, rng = Math.random) {
  const x = rng() < 0.5 ? 0 : 1, y = rng() < 0.5 ? 0 : 1;
  const key = sample(chsh.raw[`${x}${y}`], rng);
  if (key == null) return null;
  const a = bit(key, 0), b = bit(key, 1);
  return { x, y, a, b, win: chshWin(x, y, a, b) };
}

const RULES = { '0': () => 0, '1': () => 1, x: (v) => v, y: (v) => v, '¬x': (v) => 1 - v, '¬y': (v) => 1 - v };
export function classicalAnswer(s, x, y) {
  const a = RULES[s.alice](x), b = RULES[s.bob](y);
  return { a, b, win: chshWin(x, y, a, b) };
}
export function exactWinRate(s) {
  let w = 0;
  for (const x of [0, 1]) for (const y of [0, 1]) if (classicalAnswer(s, x, y).win) w++;
  return w / 4;
}
const SAY = { '0': 'always 0', '1': 'always 1', x: 'answers x', y: 'answers y', '¬x': 'answers not x', '¬y': 'answers not y' };
export const strategyLabel = (s) => `Alice ${SAY[s.alice]} · Bob ${SAY[s.bob]}`;

// One race round: the same (x, y) goes to both sides.
export function playRound(chsh, strategy, rng = Math.random) {
  const q = chshRound(chsh, rng);
  if (!q) return null;
  return { x: q.x, y: q.y, quantum: { a: q.a, b: q.b, win: q.win }, classical: classicalAnswer(strategy, q.x, q.y) };
}

// ---- Act 2a / 2b ----
export function electRound(leaderRaw, rng = Math.random) {
  const key = sample(leaderRaw, rng);
  if (key == null) return null;
  return { key, leaders: NODES.map((_, i) => i).filter((i) => bit(key, i) === 1) };
}
export function describeElection(leaders) {
  if (leaders.length === 1) return `Exactly one leader: ${NODES[leaders[0]]}`;
  if (leaders.length === 0) return 'No leader: nobody claims the role';
  return `Split-brain: ${nodeList(leaders)} ${leaders.length === 2 ? 'both' : 'all'} lead`;
}

export function coinRound(consensusRaw, rng = Math.random) {
  const key = sample(consensusRaw, rng);
  if (key == null) return null;
  const bits = NODES.map((_, i) => bit(key, i));
  return { key, bits, agree: bits.every((b) => b === bits[0]) };
}
export const describeCoin = (r) => (r.agree
  ? `All three read ${r.bits[0]}`
  : `No consensus: ${NODES.map((n, i) => `${n}=${r.bits[i]}`).join(', ')}`);
