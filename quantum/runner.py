"""ONE job, ONE circuit, for everything.

IonQ backends on Qollab accept one job per run AND reject multi-circuit jobs
("Only job type ionq.circuit.v1 is supported"). So every experiment lives in
its own block of qubits inside a single 20-qubit circuit. Blocks never
interact, so each shot of the wide circuit is an independent shot of every
experiment at once. The counts are split per block and parsed as if the
experiments had run separately.

  JS (what main.js does — works on every backend):
      import * as q from 'quantum.runner';
      const circuit = await q.build_wide.callPromising();
      const job     = await backend.run(circuit, { shots: SHOTS });
      const counts  = (await job.result()).get_counts();          // dict proxy
      const data    = (await q.parse_wide_counts.callPromising(counts))
                        .toJs({ dict_converter: Object.fromEntries });

  Python-only (local tests, Python/Qiskit project on Qollab):
      data = run_all(backend, shots=1000)            # wide circuit
      data = run_all(backend, shots=1000, wide=False) # list of circuits, local sims only

Mermin-GHZ (optional, 12 more qubits) is NOT in the wide circuit: 32 qubits
would exceed the IonQ simulators. See `mermin_wide()` for a local-only extra.
"""
from qiskit import QuantumCircuit

from . import chsh, consensus, leader, mermin, noise, nosignal

INCLUDE_MERMIN = False  # kept False: the wide circuit must stay ≤ 24 qubits

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


# --- single wide circuit -----------------------------------------------------

def _blocks() -> list[tuple[QuantumCircuit, int]]:
    """(sub-circuit, qubit offset) for each experiment, in CIRCUIT_ORDER."""
    out, offset = [], 0
    for sub in build_all():
        out.append((sub, offset))
        offset += sub.num_qubits
    return out


def wide_width() -> int:
    return sum(sub.num_qubits for sub in build_all())


def build_wide() -> QuantumCircuit:
    """All experiments side by side on disjoint qubits, one classical register."""
    n = wide_width()
    wide = QuantumCircuit(n, n, name="nssc_all")
    for sub, off in _blocks():
        w = sub.num_qubits
        wide.compose(sub, qubits=range(off, off + w), clbits=range(off, off + w), inplace=True)
    return wide


def split_wide_counts(counts) -> list[dict]:
    """Split one wide count dict into per-block dicts (CIRCUIT_ORDER order).

    Qiskit keys are little-endian: key[-1-q] is clbit q. Block with offset o
    and width w is key[len-o-w : len-o]. Any spaces (multiple cregs) are
    stripped first.
    """
    counts = _normalize(counts)
    blocks = [(sub.num_qubits, off) for sub, off in _blocks()]
    per_block = [dict() for _ in blocks]
    for key, n in counts.items():
        key = key.replace(" ", "")
        L = len(key)
        for i, (w, off) in enumerate(blocks):
            sub_key = key[L - off - w : L - off]
            per_block[i][sub_key] = per_block[i].get(sub_key, 0) + n
    return per_block


def parse_wide_counts(counts) -> dict:
    return parse_counts(split_wide_counts(counts))


def is_ionq(backend) -> bool:
    """True for IonQ remote simulators and QPUs (qiskit_ionq backend classes)."""
    mod = type(backend).__module__ or ""
    name = str(getattr(backend, "name", "")).lower()
    return mod.startswith("qiskit_ionq") or "ionq" in name


def run_mode(backend) -> str:
    """'wide'  -> IonQ: one job, one 20-qubit circuit (multi-circuit jobs rejected).
       'list'  -> local simulators: 9 small circuits in one call (fast; a 20-qubit
                  circuit freezes the single-threaded browser simulator)."""
    return "wide" if is_ionq(backend) else "list"


def build_for(mode: str):
    return build_wide() if mode == "wide" else build_all()


def parse_any(mode: str, counts) -> dict:
    """counts: the raw `result.get_counts()` of the job (dict for wide, list for list)."""
    if mode == "wide":
        return parse_wide_counts(counts)
    if hasattr(counts, "to_py"):
        counts = counts.to_py()
    if isinstance(counts, dict):  # a single-circuit result slipped through
        counts = [counts]
    return parse_counts(counts)


def run_all(backend, shots: int = 1000, wide: bool | None = None) -> dict:
    """Python-only path. wide=None picks the right format for the backend."""
    mode = ("wide" if wide else "list") if wide is not None else run_mode(backend)
    job = backend.run(build_for(mode), shots=shots)
    result = job.result()
    counts = result.get_counts() if mode == "wide" else counts_from_result(result)
    return parse_any(mode, counts)


# --- optional Mermin-GHZ extra (local simulators only: it is a 2nd job) -----

def mermin_wide() -> QuantumCircuit:
    """The 4 Mermin inputs side by side (12 qubits)."""
    wide = QuantumCircuit(12, 12, name="mermin_all")
    for i, sub in enumerate(mermin.mermin_circuits()):
        wide.compose(sub, qubits=range(3 * i, 3 * i + 3), clbits=range(3 * i, 3 * i + 3), inplace=True)
    return wide


def parse_mermin_wide(counts) -> dict:
    counts = _normalize(counts)
    per = [dict() for _ in range(4)]
    for key, n in counts.items():
        key = key.replace(" ", "")
        L = len(key)
        for i in range(4):
            sub = key[L - 3 * i - 3 : L - 3 * i]
            per[i][sub] = per[i].get(sub, 0) + n
    res = mermin.win_rate(per)
    res["inferred_visibility"] = noise.infer_visibility("mermin", res["overall"])
    return res