"""Act 3 — analytic noise curves for the visibility slider.

Model: white noise ("Werner-like") with visibility V ∈ [0, 1]:
    ρ(V) = V · ρ_ideal + (1 − V) · I / 2^n
Every curve below is linear in V because the fully mixed state gives the
uniform distribution over outcomes. The UI draws these curves and places the
empirically measured point (from a noisy Qollab simulator) on top of them by
inferring V from the observed metric (see `infer_visibility`).
"""
from math import sqrt

from .chsh import CLASSICAL_BOUND, TSIRELSON_BOUND

SQRT2 = sqrt(2)

# Visibility below which the quantum CHSH strategy stops beating 3/4.
CHSH_THRESHOLD = 1 / SQRT2  # 0.7071...


def chsh_win(v: float) -> float:
    """P_win(V) = 1/2 + V·√2/4  (= V·cos²(π/8) + (1−V)/2)."""
    return 0.5 + v * SQRT2 / 4


def w_exactly_one(v: float) -> float:
    """P(exactly one '1' | W with visibility V). Uniform on 8 outcomes gives
    3/8 for 'exactly one'."""
    return v * 1.0 + (1 - v) * 3 / 8


def w_split_brain(v: float) -> float:
    """P(two or three leaders). Uniform: 4/8."""
    return (1 - v) * 4 / 8


def w_no_leader(v: float) -> float:
    """P(no leader at all). Uniform: 1/8."""
    return (1 - v) * 1 / 8


def ghz_agreement(v: float) -> float:
    """P(all same | GHZ with visibility V). Uniform: 2/8."""
    return v * 1.0 + (1 - v) * 2 / 8


def mermin_win(v: float) -> float:
    """Mermin-GHZ game under white noise: uniform outcomes win 1/2."""
    return v * 1.0 + (1 - v) * 0.5


def infer_visibility(metric: str, observed: float) -> float:
    """Invert the linear curve to place a measured point on the slider."""
    lo_hi = {
        "chsh": (0.5, TSIRELSON_BOUND),
        "w": (3 / 8, 1.0),
        "ghz": (2 / 8, 1.0),
        "mermin": (0.5, 1.0),
    }[metric]
    lo, hi = lo_hi
    v = (observed - lo) / (hi - lo)
    return max(0.0, min(1.0, v))


def curves(steps: int = 101) -> dict:
    """Precomputed curves for the slider so JS does not need the math."""
    vs = [i / (steps - 1) for i in range(steps)]
    return {
        "v": vs,
        "chsh_win": [chsh_win(v) for v in vs],
        "w_exactly_one": [w_exactly_one(v) for v in vs],
        "w_split_brain": [w_split_brain(v) for v in vs],
        "w_no_leader": [w_no_leader(v) for v in vs],
        "ghz_agreement": [ghz_agreement(v) for v in vs],
        "chsh_threshold": CHSH_THRESHOLD,
        "classical_bound": CLASSICAL_BOUND,
        "tsirelson_bound": TSIRELSON_BOUND,
    }
