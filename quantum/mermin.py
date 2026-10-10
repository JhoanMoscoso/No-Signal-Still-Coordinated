"""Optional (P2) — Mermin-GHZ game: three players, quantum wins 100 %.

Inputs r, s, t ∈ {0,1} with r ⊕ s ⊕ t = 0 (promise), so four cases:
000, 011, 101, 110. Outputs a, b, c. Win iff a ⊕ b ⊕ c = r ∨ s ∨ t.
Classical max 3/4. Quantum with |GHZ⟩: measure X on input 0, Y on input 1
→ win every time. Reuses the same GHZ state as the consensus demo.
"""
from qiskit import QuantumCircuit

from .circuits import bit, ghz3

INPUTS = [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 0)]
CLASSICAL_BOUND = 0.75
QUANTUM_BOUND = 1.0


def wins(r, s, t, a, b, c) -> bool:
    return (a ^ b ^ c) == (r | s | t)


def mermin_circuit(r: int, s: int, t: int) -> QuantumCircuit:
    qc = ghz3()
    qc.name = f"mermin_{r}{s}{t}"
    for q, inp in enumerate((r, s, t)):
        if inp == 1:
            qc.sdg(q)  # Y basis = Sdg then H
        qc.h(q)       # X basis = H
        qc.measure(q, q)
    return qc


def mermin_circuits() -> list[QuantumCircuit]:
    return [mermin_circuit(*inp) for inp in INPUTS]


def win_rate(counts_by_input: list[dict]) -> dict:
    per = {}
    won_total = shots_total = 0
    for (r, s, t), counts in zip(INPUTS, counts_by_input):
        total = sum(counts.values())
        won = sum(n for k, n in counts.items()
                  if wins(r, s, t, bit(k, 0), bit(k, 1), bit(k, 2)))
        per[f"{r}{s}{t}"] = won / total
        won_total += won
        shots_total += total
    return {"per_input": per, "overall": won_total / shots_total,
            "shots": shots_total, "classical_bound": CLASSICAL_BOUND,
            "quantum_bound": QUANTUM_BOUND}
