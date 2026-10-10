"""Act 2c — CHSH game: coordination without communication.

Game: referee gives x to Alice and y to Bob (uniform, independent). They answer
a and b. Win iff a XOR b == x AND y. Three of four input pairs demand equal
answers, one demands different answers.

Classical (any pre-agreed table / shared randomness): max 3/4.
Quantum (shared |Φ+⟩, angles below): cos²(π/8) ≈ 0.8536 (Tsirelson bound).

Distributed-systems framing used in the UI: two load balancers, x/y = "I see a
local burst". No burst on both → same backend (cache affinity). Burst on both →
different backends (spread load).
"""
from itertools import product
from math import cos, pi

from qiskit import QuantumCircuit

from .circuits import bell_pair, bit, measure_at_angle

# Alice's angle by her input x; Bob's angle by his input y.
ALICE_ANGLES = {0: 0.0, 1: pi / 4}
BOB_ANGLES = {0: pi / 8, 1: -pi / 8}

INPUT_PAIRS = [(0, 0), (0, 1), (1, 0), (1, 1)]

CLASSICAL_BOUND = 0.75
TSIRELSON_BOUND = cos(pi / 8) ** 2  # 0.853553...


def wins(x: int, y: int, a: int, b: int) -> bool:
    return (a ^ b) == (x & y)


def chsh_circuit(x: int, y: int) -> QuantumCircuit:
    qc = bell_pair()
    qc.name = f"chsh_x{x}_y{y}"
    measure_at_angle(qc, 0, 0, ALICE_ANGLES[x])
    measure_at_angle(qc, 1, 1, BOB_ANGLES[y])
    return qc


def chsh_circuits() -> list[QuantumCircuit]:
    """The four (x, y) circuits, in INPUT_PAIRS order."""
    return [chsh_circuit(x, y) for x, y in INPUT_PAIRS]


def win_rate_for_pair(counts: dict, x: int, y: int) -> float:
    total = sum(counts.values())
    won = sum(n for k, n in counts.items() if wins(x, y, bit(k, 0), bit(k, 1)))
    return won / total if total else 0.0


def win_rate(counts_by_pair: list[dict]) -> dict:
    """counts_by_pair: list of 4 count dicts in INPUT_PAIRS order.

    Returns per-pair rates, overall rate, shots and a 1-sigma binomial error.
    """
    per_pair = {}
    total_won = 0
    total_shots = 0
    for (x, y), counts in zip(INPUT_PAIRS, counts_by_pair):
        rate = win_rate_for_pair(counts, x, y)
        shots = sum(counts.values())
        per_pair[f"{x}{y}"] = rate
        total_won += rate * shots
        total_shots += shots
    p = total_won / total_shots if total_shots else 0.0
    sigma = (p * (1 - p) / total_shots) ** 0.5 if total_shots else 0.0
    return {
        "per_pair": per_pair,
        "overall": p,
        "sigma": sigma,
        "shots": total_shots,
        "classical_bound": CLASSICAL_BOUND,
        "tsirelson_bound": TSIRELSON_BOUND,
    }


# --- classical baseline: the 16 "envelope" strategies ---------------------

_FUNCS = {
    "0": lambda v: 0,
    "1": lambda v: 1,
    "x": lambda v: v,
    "¬x": lambda v: 1 - v,
}


def classical_strategies() -> list[dict]:
    """Every deterministic strategy a = f(x), b = g(y) and its win rate.

    Shared randomness is a convex mixture of these, so it cannot exceed the
    best of them. The best is 3/4; no strategy reaches 4/4.
    """
    out = []
    for fa, fb in product(_FUNCS, repeat=2):
        f, g = _FUNCS[fa], _FUNCS[fb]
        score = sum(wins(x, y, f(x), g(y)) for x, y in INPUT_PAIRS) / 4
        out.append({"alice": fa, "bob": fb.replace("x", "y"), "win_rate": score})
    return out


def classical_best() -> float:
    return max(s["win_rate"] for s in classical_strategies())
