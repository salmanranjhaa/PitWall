"""
Strategy / ML Endpoints

Provides endpoints for AI strategy recommendations, optimal pit window
analysis, and win probability projections.
"""

import logging
import random
from typing import Dict, List, Optional

from fastapi import APIRouter

sys_path_hack = False
try:
    from ml.predict import predictor
except ImportError:
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from ml.predict import predictor
    sys_path_hack = True

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/strategy", tags=["strategy"])

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/recommendation")
def get_recommendation(session_id: str):
    """
    Get AI strategy recommendation with supporting messages.

    Uses the ML predictor's Monte Carlo simulation to evaluate PIT_NOW
    vs STAY_OUT and returns the optimal choice with confidence scores.
    """
    # Build a race state from the session (or use defaults)
    race_state = _build_race_state(session_id)

    try:
        rec = predictor.get_strategy_recommendation(race_state)
    except Exception as exc:
        logger.error("Strategy recommendation failed for %s: %s", session_id, exc)
        return _fallback_recommendation(session_id)

    # Ensure JSON-serializable
    return {
        "session_id": session_id,
        "recommendation": rec.get("recommendation", "STAY_OUT"),
        "recommended_compound": rec.get("recommended_compound", "MEDIUM"),
        "confidence": rec.get("confidence", 0.85),
        "reason": rec.get("reason", ""),
        "messages": [
            {
                "type": m.get("type", "INFO"),
                "text": m.get("text", ""),
                "confidence": m.get("confidence", 0.8),
            }
            for m in rec.get("messages", [])
        ],
        "expected_pit_score": rec.get("expected_pit_score", 0),
        "expected_stay_score": rec.get("expected_stay_score", 0),
    }


@router.get("/pit-window")
def get_pit_window(session_id: str):
    """
    Optimal pit window analysis.

    Returns the recommended lap range for the next pit stop plus
    contextual threat indicators (undercut, safety car probability).
    """
    race_state = _build_race_state(session_id)
    current_lap = race_state.get("current_lap", 10)
    total_laps = race_state.get("total_laps", 57)
    compound = str(race_state.get("compound", "MEDIUM")).upper()
    tire_age = race_state.get("tire_age", 10)

    # Compound-specific optimal windows
    compound_windows = {
        "SOFT": (10, 18),
        "MEDIUM": (18, 30),
        "HARD": (30, 45),
    }
    window_start, window_end = compound_windows.get(compound, (15, 25))

    # Adjust for current tire age
    window_start = max(window_start - tire_age, current_lap + 2)
    window_end = max(window_end - tire_age, window_start + 3)

    optimal_lap = (window_start + window_end) // 2

    # Undercut threat heuristic
    gap_behind = race_state.get("gap_to_behind", 5.0)
    undercut_threat = gap_behind < 3.0

    # Safety car probability
    sc_prob = min(0.05 + (current_lap / total_laps) * 0.1, 0.3)

    return {
        "session_id": session_id,
        "optimal_lap": optimal_lap,
        "window_start": window_start,
        "window_end": min(window_end, total_laps - 5),
        "undercut_threat_from_p2": undercut_threat,
        "sc_probability_next_5_laps": round(sc_prob, 2),
    }


@router.get("/win-probability")
def get_win_probability(session_id: str):
    """
    Win probability over remaining laps.

    Runs a Monte Carlo simulation from the current state and returns
    both the current probability and a projected trajectory.
    """
    race_state = _build_race_state(session_id)

    try:
        prob = predictor.get_win_probability(race_state)
    except Exception as exc:
        logger.error("Win probability failed for %s: %s", session_id, exc)
        prob = 0.5

    laps_remaining = max(
        race_state.get("laps_remaining", 1),
        race_state.get("total_laps", 57) - race_state.get("current_lap", 1),
    )

    # Build projected trajectory (linear-ish decay to realism)
    projected = []
    for i, lap_offset in enumerate(range(0, laps_remaining + 1, max(laps_remaining // 10, 1))):
        p = max(prob - 0.02 * lap_offset + random.uniform(-0.03, 0.03), 0.05)
        projected.append({"lap": race_state.get("current_lap", 1) + lap_offset, "probability": round(p, 4)})

    return {
        "session_id": session_id,
        "current_probability": round(prob, 4),
        "projected": projected,
    }


@router.get("/tire-life")
def get_tire_life_prediction(session_id: str):
    """
    Predict remaining tire life before the cliff.
    """
    race_state = _build_race_state(session_id)
    compound = str(race_state.get("compound", "MEDIUM")).upper()
    tire_age = int(race_state.get("tire_age", 0))

    # Estimate current wear from tire age
    rate = {"SOFT": 0.065, "MEDIUM": 0.040, "HARD": 0.025}.get(compound, 0.040)
    current_wear = rate * (tire_age ** 1.3)

    remaining = predictor.get_tire_life_prediction(current_wear, compound, pace="normal")

    return {
        "session_id": session_id,
        "compound": compound,
        "tire_age": tire_age,
        "estimated_wear_seconds": round(current_wear, 3),
        "remaining_laps": remaining,
        "cliff_lap": race_state.get("current_lap", 1) + remaining,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_race_state(session_id: str) -> Dict:
    """
    Build a race state dict from the session registry or use defaults.

    In production this would query the active RaceEngine from race.py.
    """
    # Try to look up the actual engine
    try:
        from routers.race import _race_engines
        engine = _race_engines.get(session_id)
        if engine:
            state = engine.get_state()
            return {
                "current_lap": state.get("current_lap", 1),
                "total_laps": state.get("total_laps", 57),
                "current_position": state.get("positions", {}).get("PLAYER", 1),
                "laps_remaining": state.get("total_laps", 57) - state.get("current_lap", 1),
                "tire_age": state.get("player_tire_age", 5),
                "compound": state.get("player_compound", "MEDIUM"),
                "gap_to_leader": state.get("gap_to_leader", 0.0),
                "gap_to_next": state.get("gap_to_next", 2.0),
                "gap_to_behind": state.get("gap_to_behind", 3.0),
                "fuel_remaining_kg": state.get("fuel_remaining_kg", 50.0),
                "track_name": state.get("track_name", "bahrain"),
                "weather": state.get("weather", {}),
            }
    except Exception:
        pass

    # Default fallback
    return {
        "current_lap": 10,
        "total_laps": 57,
        "current_position": 3,
        "laps_remaining": 47,
        "tire_age": 12,
        "compound": "MEDIUM",
        "gap_to_leader": 3.5,
        "gap_to_next": 1.8,
        "gap_to_behind": 2.2,
        "fuel_remaining_kg": 45.0,
        "track_name": "bahrain",
        "sc_probability": 0.05,
        "weather": {"is_raining": False, "rain_intensity": 0, "air_temp": 25, "track_temp": 100},
    }


def _fallback_recommendation(session_id: str) -> Dict:
    """Return a safe fallback when ML prediction fails."""
    return {
        "session_id": session_id,
        "recommendation": "STAY_OUT",
        "recommended_compound": "MEDIUM",
        "confidence": 0.5,
        "reason": "Using conservative fallback -- monitor conditions.",
        "messages": [
            {"type": "INFO", "text": "Strategy engine running in fallback mode", "confidence": 0.5}
        ],
    }
