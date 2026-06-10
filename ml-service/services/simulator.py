"""
PitWall Strategy Simulator
Calculates lap-by-lap race times for a given tyre stint plan and
compares the result against an actual (or mock) reference race.
"""

from typing import Any

# Tyre degradation per lap (seconds added per lap on that compound)
DEGRADATION_RATES: dict[str, float] = {
    "SOFT":   0.08,
    "MEDIUM": 0.05,
    "HARD":   0.03,
    "INTER":  0.06,
    "WET":    0.04,
}

# Time penalty for a pit stop (seconds)
PIT_STOP_COST: float = 22.0

# Ideal first-lap time for each compound (seconds)
BASE_TIMES: dict[str, float] = {
    "SOFT":   89.8,
    "MEDIUM": 90.5,
    "HARD":   91.2,
    "INTER":  93.0,
    "WET":    96.0,
}


# ─── Core simulation ─────────────────────────────────────────────────────────

def simulate(
    stints: list[dict[str, Any]],
    base_lap_time: float = 90.5,
) -> dict[str, Any]:
    """
    Simulate a full race from a list of stint definitions.

    Each stint must have:
        compound  – "SOFT" | "MEDIUM" | "HARD" | "INTER" | "WET"
        lapStart  – first lap of the stint (1-indexed)
        lapEnd    – last lap of the stint (inclusive)

    Returns:
        total_time       – float, total race time including pit stops
        lap_times        – list of { lap, time, compound }
        degradation_curve – same as lap_times (kept separate for future use)
    """
    lap_times: list[dict[str, Any]] = []
    total_time: float = 0.0

    for stint_idx, stint in enumerate(stints):
        compound = stint.get("compound", "MEDIUM").upper()
        lap_start = int(stint.get("lapStart", 1))
        lap_end = int(stint.get("lapEnd", lap_start))

        base = BASE_TIMES.get(compound, base_lap_time)
        deg = DEGRADATION_RATES.get(compound, 0.05)

        # Add pit stop cost before every stint except the first
        if stint_idx > 0:
            total_time += PIT_STOP_COST

        for lap in range(lap_start, lap_end + 1):
            lap_in_stint = lap - lap_start  # 0-indexed within the stint
            lap_time = round(base + lap_in_stint * deg, 3)
            total_time += lap_time
            lap_times.append({"lap": lap, "time": lap_time, "compound": compound})

    return {
        "total_time": round(total_time, 3),
        "lap_times": lap_times,
        "degradation_curve": lap_times,  # identical; kept for API symmetry
    }


# ─── Position estimator ───────────────────────────────────────────────────────

def estimate_position(
    user_total: float,
    actual_total: float,
    actual_position: int,
) -> tuple[int, str, bool]:
    """
    Compare the simulated race time against the actual result and estimate
    where the user's strategy would have finished.

    Returns:
        predicted_position – int, clamped 1–20
        delta_string       – formatted like "+12.3s" or "-8.4s"
        is_faster          – True if the user's strategy is faster
    """
    delta = round(user_total - actual_total, 3)

    if delta < -10:
        pos_offset = -2
    elif delta < 0:
        pos_offset = -1
    elif delta < 10:
        pos_offset = 0
    elif delta < 20:
        pos_offset = 1
    else:
        pos_offset = 2

    predicted_position = max(1, min(20, actual_position + pos_offset))

    sign = "+" if delta >= 0 else "-"
    delta_string = f"{sign}{abs(delta):.3f}s"
    is_faster = delta < 0

    return predicted_position, delta_string, is_faster
