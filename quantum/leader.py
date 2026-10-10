"""Act 2a — leader election in an anonymous network with a W state.

Three identical nodes share |W⟩ and each measures its qubit in Z. Exactly one
node reads 1 → it is the leader. No messages, no IDs, one step.

Honesty note for the page: with a pre-prepared W state this is reproducible
with shuffled envelopes (one "1", two "0"). The genuinely quantum content is
that anonymous nodes can *prepare* this symmetry-breaking state among
themselves with no dealer (Tani–Kobayashi–Matsumoto; D'Hondt–Panangaden), and
that under noise the failure modes map to split-brain / no-leader.
"""
from qiskit import QuantumCircuit

from .circuits import w3

IDEAL_EXACTLY_ONE = 1.0


def leader_circuit() -> QuantumCircuit:
    qc = w3()
    qc.name = "leader_w3"
    qc.measure([0, 1, 2], [0, 1, 2])
    return qc


def leader_stats(counts: dict) -> dict:
    """How often exactly one node became leader, and how the failures split."""
    total = sum(counts.values())
    by_ones = {0: 0, 1: 0, 2: 0, 3: 0}
    for k, n in counts.items():
        by_ones[k.count("1")] += n
    return {
        "exactly_one": by_ones[1] / total,
        "no_leader": by_ones[0] / total,
        "split_brain": (by_ones[2] + by_ones[3]) / total,
        "per_node_leader": [
            sum(n for k, n in counts.items() if k[-1 - q] == "1") / total
            for q in range(3)
        ],
        "shots": total,
    }
