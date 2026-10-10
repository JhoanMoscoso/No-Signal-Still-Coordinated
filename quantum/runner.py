"""ONE job for everything. IonQ backends accept a single backend.run per run,
so every circuit the app needs is built here in a fixed order, submitted once,
and the counts are parsed back into one dict the UI consumes.

Two integration paths:

  JS (recommended — Qollab docs make job.result() awaitable from JS):
      import * as q from 'quantum.runner';
      const circuits = await q.build_all.callPromising();
      const job      = await backend.run(circuits, { shots: SHOTS });
      const counts   = (await job.result()).get_counts();   // Python list proxy
      const data     = (await q.parse_counts.callPromising(counts)).toJs({dict_converter: Object.fromEntries});

  Python-only (local tests, Python/Qiskit project on Qollab):
      data = run_all(backend, shots=2000)
"""
from . import chsh, consensus, leader, mermin, noise, nosignal

INCLUDE_MERMIN = True  # set False to drop the optional 4 circuits (P2)

# (section, key) in the exact order circuits are submitted.
CIRCUIT_ORDER: list[tuple[str, str]] = (
    [("nosignal", c) for c in nosignal.ALICE_CHOICES]
    + [("chsh", f"{x}{y}") for x, y in chsh.INPUT_PAIRS]
    + [("leader", "w3"), ("consensus", "ghz3")]
    + ([("mermin", f"{r}{s}{t}") for r, s, t in mermin.INPUTS] if INCLUDE_MERMIN else [])
)


def build_all() -> list:
    circuits = nosignal.nosignal_circuits() + chsh.chsh_circuits()
    circuits += [leader.leader_circuit(), consensus.consensus_circuit()]
    if INCLUDE_MERMIN:
        circuits += mermin.mermin_circuits()
    assert len(circuits) == len(CIRCUIT_ORDER)
    return circuits


def _normalize(counts) -> dict:
    """Accept a dict, a JS Map/object proxy, or a Qiskit Counts object."""
    if hasattr(counts, "to_py"):
        counts = counts.to_py()
    return {str(k): int(v) for k, v in dict(counts).items()}


def parse_counts(counts_list) -> dict:
    """counts_list: list of per-circuit count dicts in CIRCUIT_ORDER."""
    if hasattr(counts_list, "to_py"):
        counts_list = counts_list.to_py()
    counts_list = [_normalize(c) for c in counts_list]
    if len(counts_list) != len(CIRCUIT_ORDER):
        raise ValueError(f"expected {len(CIRCUIT_ORDER)} count dicts, got {len(counts_list)}")

    by_key = {sec_key: c for sec_key, c in zip(CIRCUIT_ORDER, counts_list)}

    ns = {
        choice: {
            "bob": nosignal.bob_marginal(by_key[("nosignal", choice)]),
            "raw": by_key[("nosignal", choice)],
        }
        for choice in nosignal.ALICE_CHOICES
    }
    ns["Z"]["p_same_after_compare"] = nosignal.correlation_when_compared(by_key[("nosignal", "Z")])
    ns["rho_bob"] = nosignal.reduced_bob_state_real()

    chsh_counts = [by_key[("chsh", f"{x}{y}")] for x, y in chsh.INPUT_PAIRS]
    chsh_res = chsh.win_rate(chsh_counts)
    chsh_res["raw"] = dict(zip(["00", "01", "10", "11"], chsh_counts))
    chsh_res["classical_strategies"] = chsh.classical_strategies()
    chsh_res["classical_best"] = chsh.classical_best()

    lead = leader.leader_stats(by_key[("leader", "w3")])
    lead["raw"] = by_key[("leader", "w3")]
    cons = consensus.consensus_stats(by_key[("consensus", "ghz3")])
    cons["raw"] = by_key[("consensus", "ghz3")]

    out = {
        "nosignal": ns,
        "chsh": chsh_res,
        "leader": lead,
        "consensus": cons,
        "noise": noise.curves(),
        "inferred_visibility": {
            "chsh": noise.infer_visibility("chsh", chsh_res["overall"]),
            "w": noise.infer_visibility("w", lead["exactly_one"]),
            "ghz": noise.infer_visibility("ghz", cons["agreement"]),
        },
    }
    if INCLUDE_MERMIN:
        mcounts = [by_key[("mermin", f"{r}{s}{t}")] for r, s, t in mermin.INPUTS]
        out["mermin"] = mermin.win_rate(mcounts)
        out["inferred_visibility"]["mermin"] = noise.infer_visibility("mermin", out["mermin"]["overall"])
    return out


def counts_from_result(result) -> list[dict]:
    """Per-circuit counts from a Qiskit Result, index-safe for 1..N circuits."""
    n = len(CIRCUIT_ORDER)
    return [dict(result.get_counts(i)) for i in range(n)]


def run_all(backend, shots: int = 2000) -> dict:
    """Python-only path: ONE backend.run with every circuit."""
    job = backend.run(build_all(), shots=shots)
    return parse_counts(counts_from_result(job.result()))
