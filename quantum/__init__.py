"""No Signal, Still Coordinated — quantum engine.

Pure Qiskit 2.x, no Aer, no numpy-heavy tricks: runs unchanged in Qollab's
Pyodide runtime. Nothing in here creates a backend; `backend` is injected by
Qollab and passed in from main.js.

Public entry points (see runner.py):
    build_all()            -> list[QuantumCircuit]  (fixed order, ONE job)
    parse_counts(counts)   -> dict with every metric the UI needs
    run_all(backend, shots)-> same dict (Python-only path)
"""
from .runner import (  # noqa: F401
    CIRCUIT_ORDER, build_all, build_wide, parse_counts, parse_wide_counts,
    run_all, mermin_wide, parse_mermin_wide, is_ionq, run_mode, build_for, parse_any,
)