// Sample a measurement outcome from raw counts: statistically identical to one new shot.
// `rng` is injectable so tests can be deterministic. Returns null when there is no data
// (missing, empty or all-zero counts) so callers can say so instead of throwing.
export function sample(raw, rng = Math.random) {   // raw: {"01": 503, "10": 497}
  const entries = Object.entries(raw ?? {}).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (!(total > 0)) return null;
  let r = rng() * total;
  for (const [key, n] of entries) { r -= n; if (r < 0) return key; }
  return entries[entries.length - 1][0];            // float rounding guard
}
export const bit = (key, qubit) => Number(key[key.length - 1 - qubit]);   // qubit 0 = Alice/node A
