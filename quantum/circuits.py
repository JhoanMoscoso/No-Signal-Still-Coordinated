"""Shared state preparations and the angle-measurement primitive.

Conventions (keep these in sync with the project page):
- Qubit 0 = Alice / node A, qubit 1 = Bob / node B, qubit 2 = node C.
- Classical bit i holds the measurement of qubit i. Qiskit prints count keys
  little-endian, so key[-1] is qubit 0, key[-2] is qubit 1, key[-3] is qubit 2.
- "Measure at angle theta" means: measure the observable
  cos(2θ)·Z + sin(2θ)·X, i.e. polarisation-style angles. For |Φ+⟩ this gives
  P(a = b) = cos²(θ_A − θ_B). Implemented as RY(−2θ) followed by a Z
  measurement.
"""
from math import asin, pi, sqrt

from qiskit import QuantumCircuit


def bell_pair() -> QuantumCircuit:
    """|Φ+⟩ = (|00⟩ + |11⟩)/√2 on qubits 0 (Alice) and 1 (Bob)."""
    qc = QuantumCircuit(2, 2)
    qc.h(0)
    qc.cx(0, 1)
    return qc


def ghz3() -> QuantumCircuit:
    """|GHZ⟩ = (|000⟩ + |111⟩)/√2."""
    qc = QuantumCircuit(3, 3)
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(1, 2)
    return qc


def w3() -> QuantumCircuit:
    """|W⟩ = (|100⟩ + |010⟩ + |001⟩)/√3, exact deterministic preparation.

    Standard construction: put amplitude 1/√3 on qubit 0, then split the
    remaining 2/3 equally between qubits 1 and 2 with a controlled rotation,
    and shift the excitation with CNOTs.
    """
    qc = QuantumCircuit(3, 3)
    # 1) qubit 0 carries the excitation with probability 1/3
    qc.ry(2 * asin(sqrt(1 / 3)), 0)
    # 2) in the branch where qubit 0 is 0, split the excitation 50/50 onto qubit 1
    qc.x(0)
    qc.cry(pi / 2, 0, 1)
    qc.x(0)
    # 3) qubit 2 = NOT (q0 XOR q1): gets the excitation only when neither has it
    qc.cx(1, 2)
    qc.cx(0, 2)
    qc.x(2)
    # Net effect: (|100> + |010> + |001>)/sqrt3  (verified in tests)
    return qc


def measure_at_angle(qc: QuantumCircuit, qubit: int, cbit: int, theta: float) -> None:
    """Measure `qubit` along the direction at angle theta in the X–Z plane."""
    if theta != 0.0:
        qc.ry(-2 * theta, qubit)
    qc.measure(qubit, cbit)


def bit(key: str, qubit: int) -> int:
    """Read qubit `qubit` from a Qiskit count key (little-endian)."""
    return int(key[-1 - qubit])
