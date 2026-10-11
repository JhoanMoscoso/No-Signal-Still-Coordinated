// Sample a measurement outcome from raw counts: statistically identical to one new shot.
export function sample(raw) {            // raw: {"01": 503, "10": 497}
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [key, n] of Object.entries(raw)) { r -= n; if (r < 0) return key; }
}
export const bit = (key, qubit) => Number(key[key.length - 1 - qubit]);   // qubit 0 = Alice/node A
