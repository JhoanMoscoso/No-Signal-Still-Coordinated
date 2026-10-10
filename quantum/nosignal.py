"""Act 1 — the myth: Alice cannot signal Bob through a Bell pair.

Three circuits, one per thing Alice might do:
  "none": Alice does nothing (only Bob measures in Z)
  "Z":    Alice measures in Z, Bob in Z
  "X":    Alice measures in X, Bob in Z
Bob's marginal is 50/50 in all three. The reduced state ρ_B = I/2 is computed
analytically with qiskit.quantum_info (works in Pyodide; no backend needed).
"""
from qiskit import QuantumCircuit
from qiskit.quantum_info import DensityMatrix, Statevector, partial_trace

from .circuits import bell_pair, bit

ALICE_CHOICES = ["none", "Z", "X"]


def nosignal_circuit(choice: str) -> QuantumCircuit:
    qc = bell_pair()
    qc.name = f"nosignal_alice_{choice}"
    if choice == "Z":
        qc.measure(0, 0)
    elif choice == "X":
        qc.h(0)
        qc.measure(0, 0)
    # Bob always measures in Z, after Alice (ordering is irrelevant; it looks
    # causal in the UI and that is the point).
    qc.measure(1, 1)
    return qc


def nosignal_circuits() -> list[QuantumCircuit]:
    return [nosignal_circuit(c) for c in ALICE_CHOICES]


def bob_marginal(counts: dict) -> dict:
    """P(b=0), P(b=1) from Bob's bit, ignoring Alice's."""
    total = sum(counts.values())
    ones = sum(n for k, n in counts.items() if bit(k, 1) == 1)
    return {"p0": (total - ones) / total, "p1": ones / total, "shots": total}


def correlation_when_compared(counts: dict) -> float:
    """P(a == b) once the two result sheets are compared over a classical
    channel. For the 'Z' circuit this is 1.0 — the correlation was always
    there; it is only *visible* after classical communication."""
    total = sum(counts.values())
    same = sum(n for k, n in counts.items() if bit(k, 0) == bit(k, 1))
    return same / total


def reduced_bob_state() -> list[list[complex]]:
    """ρ_B for |Φ+⟩ as a plain 2x2 nested list (JSON-friendly). Equals I/2."""
    psi = Statevector(bell_pair().remove_final_measurements(inplace=False))
    rho_b = partial_trace(DensityMatrix(psi), [0])  # trace out Alice (qubit 0)
    return [[complex(v) for v in row] for row in rho_b.data]


def reduced_bob_state_real() -> list[list[float]]:
    return [[round(v.real, 6) for v in row] for row in reduced_bob_state()]
