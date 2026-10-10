"""No Signal, Still Coordinated — quantum engine.

Pure Qiskit 2.x, no Aer, no numpy-heavy tricks: runs unchanged in Qollab's
Pyodide runtime. Nothing in here creates a backend; `backend` is injected by
Qollab and passed in from main.js.

Public entry points (see runner.py):
    build_all()            -> list[QuantumCircuit]  (fixed order, ONE job)
    parse_counts(counts)   -> dict with every metric the UI needs
    run_all(backend, shots)-> same dict (Python-only path)
"""
from .runner import build_all, parse_counts, run_all, CIRCUIT_ORDER  # noqa: F401
