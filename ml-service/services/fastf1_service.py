"""
PitWall FastF1 Service
Loads real F1 session data via the fastf1 library.
Every public function falls back to deterministic mock data on any failure
so the API never returns a 500 error.
"""

import logging
import os
import random
from typing import Any

import numpy as np
import pandas as pd

# ── fastf1 setup ─────────────────────────────────────────────────────────────
try:
    import fastf1

    _CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")
    os.makedirs(_CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(_CACHE_DIR)
    _FF1_AVAILABLE = True
except Exception as _e:
    _FF1_AVAILABLE = False
    logging.warning(f"[fastf1] library unavailable – using mock data only: {_e}")

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

MOCK_BASE_TIME = 90.5

# Mock compound rotation across a 57-lap race
MOCK_STINTS = [
    {"compound": "SOFT",   "lap_start": 1,  "lap_end": 18},
    {"compound": "MEDIUM", "lap_start": 19, "lap_end": 45},
    {"compound": "HARD",   "lap_start": 46, "lap_end": 57},
]

MOCK_DRIVERS = [
    ("VER", "Red Bull Racing"),
    ("NOR", "McLaren"),
    ("LEC", "Ferrari"),
    ("HAM", "Mercedes"),
    ("SAI", "Ferrari"),
    ("RUS", "Mercedes"),
    ("PIA", "McLaren"),
    ("ALO", "Aston Martin"),
    ("GAS", "Alpine"),
    ("STR", "Aston Martin"),
    ("ALB", "Williams"),
    ("OCO", "Alpine"),
    ("TSU", "RB"),
    ("HUL", "Haas"),
    ("RIC", "RB"),
    ("BOT", "Kick Sauber"),
    ("MAG", "Haas"),
    ("ZHO", "Kick Sauber"),
    ("SAR", "Williams"),
    ("PER", "Red Bull Racing"),
]

# Degradation rates per compound (seconds per lap)
_DEG: dict[str, float] = {
    "SOFT": 0.08, "MEDIUM": 0.05, "HARD": 0.03, "INTER": 0.06, "WET": 0.04
}
# Base lap time per compound (seconds)
_BASE: dict[str, float] = {
    "SOFT": 89.8, "MEDIUM": 90.5, "HARD": 91.2, "INTER": 93.0, "WET": 96.0
}

# ── Helpers ───────────────────────────────────────────────────────────────────


def _mock_lap_time(compound: str, lap_in_stint: int, driver_offset: float = 0.0) -> float:
    """Return a realistic mock lap time for a given compound and lap."""
    base = _BASE.get(compound, MOCK_BASE_TIME)
    deg = _DEG.get(compound, 0.05)
    noise = random.uniform(-0.05, 0.05)
    return round(base + lap_in_stint * deg + driver_offset + noise, 3)


def _build_mock_laps(circuit: str = "Mock Circuit") -> dict[str, Any]:
    """Build a full mock race laps dataset for 20 drivers × 57 laps."""
    rows: list[dict[str, Any]] = []
    for driver_idx, (driver, team) in enumerate(MOCK_DRIVERS):
        # Slight per-driver pace offset so standings look realistic
        driver_offset = driver_idx * 0.08
        stint_num = 0
        for stint in MOCK_STINTS:
            stint_num += 1
            compound = stint["compound"]
            for lap in range(stint["lap_start"], stint["lap_end"] + 1):
                lap_in_stint = lap - stint["lap_start"]
                rows.append(
                    {
                        "lap_number": lap,
                        "driver": driver,
                        "team": team,
                        "lap_time_seconds": _mock_lap_time(
                            compound, lap_in_stint, driver_offset
                        ),
                        "compound": compound,
                        "stint": stint_num,
                    }
                )

    return {
        "circuit": circuit,
        "total_laps": 57,
        "laps": rows,
        "usedMockData": True,
    }


# ── Public API ────────────────────────────────────────────────────────────────


def get_race_laps(year: int, round_number: int) -> dict[str, Any]:
    """
    Load lap data for a race session.

    Tries fastf1 first; falls back to mock data on any exception.
    Returns a dict with keys: circuit, total_laps, laps, usedMockData.
    """
    if not _FF1_AVAILABLE:
        logger.info("[fastf1] library not available – returning mock laps")
        return _build_mock_laps()

    try:
        logger.info(f"[fastf1] loading session {year} R{round_number}")
        session = fastf1.get_session(year, round_number, "R")
        session.load(laps=True, telemetry=False, weather=False, messages=False)

        laps: pd.DataFrame = session.laps

        # Discard in/out laps and entries with no lap time
        laps = laps[laps["LapTime"].notna()].copy()
        laps = laps[laps["IsAccurate"] == True].copy()  # noqa: E712

        rows: list[dict[str, Any]] = []
        for _, row in laps.iterrows():
            try:
                lap_seconds = float(row["LapTime"].total_seconds())
                compound = str(row.get("Compound", "UNKNOWN")).upper()
                stint_num = int(row.get("Stint", 0))
                rows.append(
                    {
                        "lap_number": int(row["LapNumber"]),
                        "driver": str(row["Driver"]),
                        "team": str(row.get("Team", "")),
                        "lap_time_seconds": round(lap_seconds, 3),
                        "compound": compound,
                        "stint": stint_num,
                    }
                )
            except Exception as row_err:
                logger.debug(f"[fastf1] skipping malformed row: {row_err}")
                continue

        if not rows:
            raise ValueError("No valid lap rows after filtering")

        total_laps = int(laps["LapNumber"].max()) if not laps.empty else 57
        circuit = str(session.event.get("EventName", "Unknown Circuit"))

        logger.info(
            f"[fastf1] loaded {len(rows)} laps for {circuit} ({year} R{round_number})"
        )
        return {
            "circuit": circuit,
            "total_laps": total_laps,
            "laps": rows,
            "usedMockData": False,
        }

    except Exception as exc:
        logger.warning(
            f"[fastf1] failed to load {year} R{round_number}: {exc} – using mock"
        )
        return _build_mock_laps()


def get_driver_actual_strategy(
    year: int, round_number: int, driver: str
) -> list[dict[str, Any]]:
    """
    Return the list of actual stints a driver used in the race.
    Falls back to the canonical 3-stop mock strategy on any error.
    """
    if not _FF1_AVAILABLE:
        return _mock_strategy()

    try:
        session = fastf1.get_session(year, round_number, "R")
        session.load(laps=True, telemetry=False, weather=False, messages=False)

        driver_laps: pd.DataFrame = session.laps.pick_drivers(driver.upper())
        driver_laps = driver_laps[driver_laps["LapTime"].notna()].copy()

        if driver_laps.empty:
            raise ValueError(f"No laps found for driver {driver}")

        stints: list[dict[str, Any]] = []
        for stint_num in sorted(driver_laps["Stint"].dropna().unique()):
            stint_laps = driver_laps[driver_laps["Stint"] == stint_num]
            if stint_laps.empty:
                continue
            compound = str(
                stint_laps["Compound"].mode().iloc[0]
                if not stint_laps["Compound"].isna().all()
                else "UNKNOWN"
            ).upper()
            stints.append(
                {
                    "compound": compound,
                    "lapStart": int(stint_laps["LapNumber"].min()),
                    "lapEnd": int(stint_laps["LapNumber"].max()),
                }
            )

        return stints if stints else _mock_strategy()

    except Exception as exc:
        logger.warning(
            f"[fastf1] get_driver_actual_strategy failed ({driver}, {year} R{round_number}): {exc}"
        )
        return _mock_strategy()


def get_driver_actual_position(
    year: int, round_number: int, driver: str
) -> int:
    """
    Return the driver's actual finishing position in the race.
    Falls back to a deterministic pseudo-random position (1–10) on any error.
    """
    if not _FF1_AVAILABLE:
        return _mock_position(driver)

    try:
        session = fastf1.get_session(year, round_number, "R")
        session.load(laps=True, telemetry=False, weather=False, messages=False)

        results = session.results
        if results is None or results.empty:
            raise ValueError("No results available")

        driver_result = results[
            results["Abbreviation"].str.upper() == driver.upper()
        ]
        if driver_result.empty:
            raise ValueError(f"Driver {driver} not found in results")

        position = int(driver_result.iloc[0]["Position"])
        return position

    except Exception as exc:
        logger.warning(
            f"[fastf1] get_driver_actual_position failed ({driver}, {year} R{round_number}): {exc}"
        )
        return _mock_position(driver)


# ── Mock fallbacks ────────────────────────────────────────────────────────────


def _mock_strategy() -> list[dict[str, Any]]:
    """Canonical 3-stint mock strategy."""
    return [
        {"compound": "SOFT",   "lapStart": 1,  "lapEnd": 18},
        {"compound": "MEDIUM", "lapStart": 19, "lapEnd": 45},
        {"compound": "HARD",   "lapStart": 46, "lapEnd": 57},
    ]


def _mock_position(driver: str) -> int:
    """Deterministic position derived from the driver string so it stays stable."""
    seed = sum(ord(c) for c in driver.upper())
    rng = random.Random(seed)
    return rng.randint(1, 10)
