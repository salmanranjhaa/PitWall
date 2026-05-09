"""
Qualifying Session Endpoints

Provides REST endpoints for the Q1/Q2/Q3 knockout qualifying simulation.
"""

import logging
import sys
import os
from typing import Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from simulation.qualifying import QualifyingEngine
    from simulation.tracks import get_track
except ImportError:
    logging.warning("Qualifying modules not found.")

    def get_track(name):
        class FakeTrack:
            reference_lap_times = {"SOFT": 90.0}
        return FakeTrack()

    class QualifyingEngine:
        def __init__(self, *a, **kw): pass
        def get_state(self): return {}
        def advance_time(self): return {}
        def player_flying_lap(self, compound="SOFT"): return {}
        def advance_segment(self): return {}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/qualify", tags=["qualifying"])

_qualifying_sessions: Dict[str, object] = {}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class StartQualifyingRequest(BaseModel):
    track_name: str = Field(..., description="Circuit identifier (e.g. 'Spa', 'Monaco')")
    player_team: str = Field(..., description="Player's team name")
    player_driver: Optional[int] = Field(default=None, description="Driver number")


class PlayerLapRequest(BaseModel):
    session_id: str
    compound: str = Field(default="SOFT", description="SOFT | MEDIUM | HARD")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/start")
def start_qualifying(req: StartQualifyingRequest):
    """Start a new qualifying session for the given track and team."""
    try:
        track = get_track(req.track_name)
    except Exception as exc:
        logger.error("Failed to load track %s: %s", req.track_name, exc)
        return {"error": f"Unknown track: {req.track_name}"}

    ref_time = track.reference_lap_times.get("SOFT", 90.0)
    engine = QualifyingEngine(
        track_name=req.track_name,
        reference_soft_time=ref_time,
        player_team=req.player_team,
        player_driver_number=req.player_driver,
    )

    session_id = f"qualify_{len(_qualifying_sessions)}"
    _qualifying_sessions[session_id] = engine

    logger.info("Qualifying started: session=%s track=%s", session_id, req.track_name)
    return {"session_id": session_id, "state": engine.get_state()}


@router.post("/advance")
def advance_time(session_id: str):
    """Advance the session by one time tick (~2 min). AI cars may set lap times."""
    engine = _qualifying_sessions.get(session_id)
    if not engine:
        return {"error": "Qualifying session not found"}
    return {"state": engine.advance_time()}


@router.post("/lap")
def player_lap(req: PlayerLapRequest):
    """Execute a player flying lap on the chosen compound."""
    engine = _qualifying_sessions.get(req.session_id)
    if not engine:
        return {"error": "Qualifying session not found"}
    return engine.player_flying_lap(req.compound)


@router.post("/next-segment")
def next_segment(session_id: str):
    """Eliminate slowest cars and advance to the next segment (Q1→Q2→Q3)."""
    engine = _qualifying_sessions.get(session_id)
    if not engine:
        return {"error": "Qualifying session not found"}
    return {"state": engine.advance_segment()}


@router.get("/state")
def get_state(session_id: str):
    """Retrieve the current qualifying state."""
    engine = _qualifying_sessions.get(session_id)
    if not engine:
        return {"error": "Qualifying session not found"}
    return {"state": engine.get_state()}
