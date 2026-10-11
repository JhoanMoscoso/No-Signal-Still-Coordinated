"""Run with:  python -m pytest tests -q   (from the project root)

Local dev: pip install qiskit qiskit-aer pytest
Uses AerSimulator (fast at 20 qubits). Falls back to the pure-Python
BasicSimulator, which is correct but takes ~1 min per wide-circuit run.
"""
from math import cos, pi, sqrt

import pytest
from qiskit.quantum_info import Statevector

from quantum import chsh, consensus, leader, mermin, noise, nosignal, runner
from quantum.circuits import bell_pair, ghz3, w3

try:
    from qiskit_aer import AerSimulator
    backend = AerSimulator(seed_simulator=7)
except ImportError:  # pragma: no cover
    from qiskit.providers.basic_provider import BasicSimulator
    backend = BasicSimulator()

SHOTS = 4000


def _counts(qc, shots=SHOTS):
    return backend.run(qc, shots=shots, seed_simulator=7).result().get_counts()


# ---------------------------------------------------------------- states ---

def test_w3_is_exact_w_state():
    sv = Statevector(w3())
    probs = sv.probabilities_dict()
    assert set(probs) == {"001", "010", "100"}
    for p in probs.values():
        assert abs(p - 1 / 3) < 1e-9


def test_ghz3_state():
    probs = Statevector(ghz3()).probabilities_dict()
    assert set(probs) == {"000", "111"}


def test_angle_convention_gives_cos2():
    """P(a=b) = cos²(θ_A − θ_B) for |Φ+⟩ under RY(−2θ) + Z measurement."""
    from quantum.circuits import measure_at_angle
    for ta, tb in [(0, pi / 8), (pi / 4, -pi / 8), (0.3, 1.1)]:
        qc = bell_pair()
        qc.remove_final_measurements()
        qc = bell_pair()
        measure_at_angle(qc, 0, 0, ta)
        measure_at_angle(qc, 1, 1, tb)
        c = _counts(qc, 20000)
        same = (c.get("00", 0) + c.get("11", 0)) / 20000
        assert abs(same - cos(ta - tb) ** 2) < 0.02


# ------------------------------------------------------------- no-signal ---

@pytest.mark.parametrize("choice", nosignal.ALICE_CHOICES)
def test_bob_marginal_is_fifty_fifty(choice):
    m = nosignal.bob_marginal(_counts(nosignal.nosignal_circuit(choice)))
    assert abs(m["p1"] - 0.5) < 0.03


def test_reduced_state_is_identity_over_two():
    rho = nosignal.reduced_bob_state_real()
    assert rho == [[0.5, 0.0], [0.0, 0.5]]


def test_correlation_visible_only_after_compare():
    c = _counts(nosignal.nosignal_circuit("Z"))
    assert nosignal.correlation_when_compared(c) > 0.99


# ------------------------------------------------------------------ CHSH ---

def test_classical_best_is_three_quarters():
    assert chsh.classical_best() == 0.75
    assert all(s["win_rate"] <= 0.75 for s in chsh.classical_strategies())
    assert len(chsh.classical_strategies()) == 16


def test_quantum_chsh_near_tsirelson():
    res = chsh.win_rate([_counts(qc) for qc in chsh.chsh_circuits()])
    assert abs(res["overall"] - chsh.TSIRELSON_BOUND) < 0.015
    for r in res["per_pair"].values():
        assert abs(r - chsh.TSIRELSON_BOUND) < 0.03
    assert res["overall"] > 0.8  # clearly beats the envelopes


# ---------------------------------------------------------- leader / GHZ ---

def test_leader_exactly_one():
    s = leader.leader_stats(_counts(leader.leader_circuit()))
    assert s["exactly_one"] == 1.0
    assert s["split_brain"] == 0.0 and s["no_leader"] == 0.0
    for p in s["per_node_leader"]:
        assert abs(p - 1 / 3) < 0.03  # fair election


def test_consensus_agreement():
    s = consensus.consensus_stats(_counts(consensus.consensus_circuit()))
    assert s["agreement"] == 1.0
    assert abs(s["p_all_zero"] - 0.5) < 0.03


def test_mermin_perfect():
    res = mermin.win_rate([_counts(qc) for qc in mermin.mermin_circuits()])
    assert res["overall"] == 1.0


# ----------------------------------------------------------------- noise ---

def test_noise_curves_endpoints():
    assert abs(noise.chsh_win(1.0) - chsh.TSIRELSON_BOUND) < 1e-12
    assert noise.chsh_win(0.0) == 0.5
    assert abs(noise.chsh_win(noise.CHSH_THRESHOLD) - 0.75) < 1e-12
    assert noise.w_exactly_one(1.0) == 1.0 and noise.w_exactly_one(0.0) == 3 / 8
    assert noise.ghz_agreement(0.0) == 0.25
    assert abs(noise.infer_visibility("chsh", 0.75) - 1 / sqrt(2)) < 1e-9


# ---------------------------------------------------------- single job ----

def test_list_job_end_to_end():
    data = runner.run_all(backend, shots=1000, wide=False)
    assert set(data) >= {"nosignal", "chsh", "leader", "consensus", "noise"}
    assert data["leader"]["exactly_one"] == 1.0
    assert data["chsh"]["overall"] > 0.8
    assert data["inferred_visibility"]["w"] == 1.0


def test_wide_circuit_shape():
    wide = runner.build_wide()
    assert wide.num_qubits == 20 and wide.num_clbits == 20
    assert wide.num_qubits <= 24  # built-in simulator limit (IonQ Aria 25, Forte 29)


def test_wide_split_matches_blocks():
    """Splitting the wide key recovers each block's own distribution."""
    data = runner.run_all(backend, shots=2000, wide=True)
    assert data["leader"]["exactly_one"] == 1.0
    assert data["consensus"]["agreement"] == 1.0
    assert abs(data["chsh"]["overall"] - chsh.TSIRELSON_BOUND) < 0.02
    for c in nosignal.ALICE_CHOICES:
        assert abs(data["nosignal"][c]["bob"]["p1"] - 0.5) < 0.03
    assert data["nosignal"]["Z"]["p_same_after_compare"] > 0.99
    # every block saw every shot
    assert data["leader"]["shots"] == 2000 and data["chsh"]["shots"] == 4 * 2000


def test_mermin_wide():
    counts = backend.run(runner.mermin_wide(), shots=500, seed_simulator=3).result().get_counts()
    res = runner.parse_mermin_wide(counts)
    assert res["overall"] == 1.0 and res["inferred_visibility"] == 1.0
