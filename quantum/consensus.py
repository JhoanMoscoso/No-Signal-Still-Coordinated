"""Act 2b — consensus / shared coin with a GHZ state.

Three nodes share |GHZ⟩ and each measures Z. All read the same random bit.
Nobody chose it (so it is not communication), but everybody agrees on it.
"""
from qiskit import QuantumCircuit

from .circuits import ghz3

IDEAL_AGREEMENT = 1.0


def consensus_circuit() -> QuantumCircuit:
    qc = ghz3()
    qc.name = "consensus_ghz3"
    qc.measure([0, 1, 2], [0, 1, 2])
    return qc


def consensus_stats(counts: dict) -> dict:
    total = sum(counts.values())
    all0 = counts.get("000", 0)
    all1 = counts.get("111", 0)
    return {
        "agreement": (all0 + all1) / total,
        "p_all_zero": all0 / total,
        "p_all_one": all1 / total,
        "disagreement": 1 - (all0 + all1) / total,
        "shots": total,
    }
