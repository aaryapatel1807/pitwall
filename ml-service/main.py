"""
PitWall ML Service
FastAPI application providing race data and strategy simulation
powered by FastF1 and a deterministic lap-time simulator.
"""

import logging
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services import fastf1_service, simulator

# ── Bootstrap ─────────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(name)s │ %(message)s")
logger = logging.getLogger(__name__)

PORT = int(os.getenv("PORT", "8000"))

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PitWall ML Service",
    description="Race strategy simulation and FastF1 data proxy for PitWall",
    version="1.0.0",
)

# Allow all origins for local development (tighten for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class Stint(BaseModel):
    compound: str = Field(..., pattern="^(SOFT|MEDIUM|HARD|INTER|WET)$")
    lapStart: int = Field(..., ge=1)
    lapEnd:   int = Field(..., ge=1)


class SimulateRequest(BaseModel):
    year:     int    = Field(..., ge=1950, le=2030)
    round:    int    = Field(..., ge=1)
    driverId: str    = Field(..., min_length=1, max_length=50)
    stints:   list[Stint] = Field(..., min_length=1, max_length=10)


class LapPoint(BaseModel):
    lap:      int
    time:     float
    compound: str


class ActualStint(BaseModel):
    compound: str
    lapStart: int
    lapEnd:   int


class SimulateResponse(BaseModel):
    predictedPosition:  int
    totalRaceTime:      str
    timeDeltaVsActual:  str
    isPositive:         bool
    lapTimes:           list[LapPoint]
    degradationCurve:   list[LapPoint]
    actualStrategy:     list[ActualStint]
    actualPosition:     int
    usedMockData:       bool


class LapRow(BaseModel):
    lap_number:       int
    driver:           str
    team:             str
    lap_time_seconds: float
    compound:         str
    stint:            int


class RaceDataResponse(BaseModel):
    year:        int
    round:       int
    circuit:     str
    total_laps:  int
    laps:        list[LapRow]
    usedMockData: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _seconds_to_race_time(seconds: float) -> str:
    """Convert total seconds to H:MM:SS.mmm format."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:06.3f}"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check — always returns 200."""
    ff1_status = "ready" if fastf1_service._FF1_AVAILABLE else "mock-only"
    return {"status": "ok", "fastf1": ff1_status}


@app.get("/race-data", response_model=RaceDataResponse)
def race_data(
    year:  int = Query(..., ge=1950, le=2030, description="Season year"),
    round: int = Query(..., ge=1,    description="Race round number"),
) -> Any:
    """
    Return lap-by-lap race data for a given year and round.
    Uses FastF1 when available; returns realistic mock data otherwise.
    """
    try:
        result = fastf1_service.get_race_laps(year, round)
        return {
            "year":         year,
            "round":        round,
            "circuit":      result.get("circuit", "Unknown Circuit"),
            "total_laps":   result.get("total_laps", 57),
            "laps":         result.get("laps", []),
            "usedMockData": result.get("usedMockData", True),
        }
    except Exception as exc:
        logger.error(f"[/race-data] unexpected error: {exc}")
        mock = fastf1_service._build_mock_laps()
        return {
            "year":         year,
            "round":        round,
            "circuit":      "Mock Circuit",
            "total_laps":   mock["total_laps"],
            "laps":         mock["laps"],
            "usedMockData": True,
        }


@app.post("/simulate", response_model=SimulateResponse)
def simulate_strategy(body: SimulateRequest) -> Any:
    """
    Simulate a tyre strategy and compare it against the driver's actual race.

    Always returns a valid response — falls back to mock data on FastF1 errors.
    """
    used_mock = False

    try:
        stints_raw = [s.model_dump() for s in body.stints]

        # ── Simulate user strategy ──────────────────────────────────────────
        sim_result = simulator.simulate(stints_raw)
        user_total: float = sim_result["total_time"]

        # ── Fetch actual strategy + position ───────────────────────────────
        actual_strategy = fastf1_service.get_driver_actual_strategy(
            body.year, body.round, body.driverId
        )
        actual_position = fastf1_service.get_driver_actual_position(
            body.year, body.round, body.driverId
        )

        # ── Simulate the actual strategy to get a reference time ───────────
        actual_sim = simulator.simulate(actual_strategy)
        actual_total: float = actual_sim["total_time"]

        # Mark as mock if actual data came from mock fallbacks
        if not fastf1_service._FF1_AVAILABLE:
            used_mock = True

        # ── Estimate position delta ─────────────────────────────────────────
        predicted_position, delta_string, is_faster = simulator.estimate_position(
            user_total, actual_total, actual_position
        )

        return SimulateResponse(
            predictedPosition=predicted_position,
            totalRaceTime=_seconds_to_race_time(user_total),
            timeDeltaVsActual=delta_string,
            isPositive=is_faster,
            lapTimes=[LapPoint(**lp) for lp in sim_result["lap_times"]],
            degradationCurve=[LapPoint(**lp) for lp in sim_result["degradation_curve"]],
            actualStrategy=[ActualStint(**s) for s in actual_strategy],
            actualPosition=actual_position,
            usedMockData=used_mock,
        )

    except Exception as exc:
        # Last-resort fallback: deterministic mock simulation
        logger.error(f"[/simulate] unexpected error: {exc} – returning mock")
        used_mock = True

        mock_stints = [
            {"compound": "SOFT",   "lapStart": 1,  "lapEnd": 18},
            {"compound": "MEDIUM", "lapStart": 19, "lapEnd": 45},
            {"compound": "HARD",   "lapStart": 46, "lapEnd": 57},
        ]
        # Use the user-supplied stints if they're structurally valid
        try:
            stints_raw = [s.model_dump() for s in body.stints]
            sim_result = simulator.simulate(stints_raw)
        except Exception:
            sim_result = simulator.simulate(mock_stints)

        actual_sim = simulator.simulate(mock_stints)
        actual_total = actual_sim["total_time"]
        user_total = sim_result["total_time"]
        actual_position = fastf1_service._mock_position(body.driverId)

        predicted_position, delta_string, is_faster = simulator.estimate_position(
            user_total, actual_total, actual_position
        )

        return SimulateResponse(
            predictedPosition=predicted_position,
            totalRaceTime=_seconds_to_race_time(user_total),
            timeDeltaVsActual=delta_string,
            isPositive=is_faster,
            lapTimes=[LapPoint(**lp) for lp in sim_result["lap_times"]],
            degradationCurve=[LapPoint(**lp) for lp in sim_result["degradation_curve"]],
            actualStrategy=[ActualStint(**s) for s in mock_stints],
            actualPosition=actual_position,
            usedMockData=True,
        )


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    print("🏎  PitWall ML Service running on port", PORT)
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
