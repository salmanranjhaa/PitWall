"""
Race Simulation Endpoints

Provides REST endpoints for starting races, advancing laps, pit stops,
and querying the current race state.
"""

import asyncio
import json
import logging
import sys
import os
from typing import AsyncGenerator, Dict, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Ensure imports work when running directly or as a package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from simulation.engine import RaceEngine, RaceState
    from simulation.tracks import get_track
    from simulation.weather import WeatherState
except ImportError:
    # Graceful fallback when simulation modules are not yet implemented
    logging.warning("Simulation modules not found; using mock implementations.")

    class MockTrack:
        def __init__(self, name):
            self.name = name
            self.total_laps = 57
            self.length_km = 5.0

    def get_track(name: str):
        return MockTrack(name)

    class MockRaceEngine:
        def __init__(self, track, player_team, starting_compound, air_temp):
            self.track = track
            self.player_team = player_team
            self.compound = starting_compound
            self.air_temp = air_temp
            self.current_lap = 0
            self.total_laps = track.total_laps
            self.positions = {f"{player_team}_DRIVER": 1}

        def start_race(self):
            self.current_lap = 0
            return self.get_state()

        def advance_lap(self, actions=None):
            self.current_lap = min(self.current_lap + 1, self.total_laps)
            return self.get_state()

        def player_pit(self, compound):
            self.compound = compound
            return self.get_state()

        def get_state(self):
            return {
                "current_lap": self.current_lap,
                "total_laps": self.total_laps,
                "player_compound": self.compound,
                "positions": self.positions,
                "status": "RUNNING" if self.current_lap < self.total_laps else "FINISHED",
            }

    RaceEngine = MockRaceEngine

from ml.predict import predictor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/race", tags=["race"])

# ---------------------------------------------------------------------------
# In-memory session storage
# ---------------------------------------------------------------------------
_race_engines: Dict[str, object] = {}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class StartRaceRequest(BaseModel):
    """Payload to start a new race session."""
    track_name: str = Field(..., description="Circuit identifier (e.g. 'Spa', 'Monaco')")
    player_team: str = Field(..., description="Player's team name")
    starting_compound: str = Field(default="SOFT", description="Starting tire compound")
    air_temperature: float = Field(default=25.0, description="Ambient air temperature (°C)")
    player_driver: Optional[int] = Field(default=None, description="Driver number (None = team lead driver)")


class PitRequest(BaseModel):
    """Payload for a pit stop request."""
    session_id: str = Field(..., description="Active race session ID")
    compound: str = Field(..., description="Tire compound to switch to")


class ERSRequest(BaseModel):
    """Payload for an ERS mode change."""
    session_id: str = Field(..., description="Active race session ID")
    mode: str = Field(..., description="ERS mode: CHARGE | BALANCED | ATTACK | DEFEND")


class AdvanceRequest(BaseModel):
    """Payload for advancing a lap (optional actions)."""
    actions: Optional[Dict] = Field(default=None, description="Per-driver action overrides")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/start")
def start_race(req: StartRaceRequest):
    """
    Start a new race session.

    Creates a RaceEngine instance for the requested track and stores it
    in the in-memory session registry.
    """
    try:
        track = get_track(req.track_name)
    except Exception as exc:
        logger.error("Failed to load track %s: %s", req.track_name, exc)
        return {"error": f"Unknown track: {req.track_name}"}

    engine = RaceEngine(
        track=track,
        player_team=req.player_team,
        starting_compound=req.starting_compound,
        air_temp=req.air_temperature,
        player_driver=req.player_driver,
    )
    state = engine.start_race()
    session_id = f"race_{len(_race_engines)}"
    _race_engines[session_id] = engine

    logger.info("Race started: session_id=%s track=%s", session_id, req.track_name)
    return {"session_id": session_id, "state": _serialize(state)}


def _serialize(state) -> dict:
    """Convert RaceState (or any object with to_dict) to a plain dict."""
    if hasattr(state, "to_dict"):
        return state.to_dict()
    return state if isinstance(state, dict) else {}


@router.post("/advance")
def advance_lap(session_id: str, actions: Optional[Dict] = None):
    """
    Advance the race by one lap.

    Accepts optional action overrides for driver behaviour.
    """
    engine = _race_engines.get(session_id)
    if not engine:
        return {"error": "Race session not found"}

    try:
        state = engine.advance_lap(actions or {})
    except Exception as exc:
        logger.error("Error advancing lap for %s: %s", session_id, exc)
        return {"error": str(exc)}

    return {"state": _serialize(state)}


@router.post("/pit")
def player_pit(req: PitRequest):
    """
    Execute a pit stop for the player.

    Changes the player's tire compound and applies pit stop time loss.
    """
    engine = _race_engines.get(req.session_id)
    if not engine:
        return {"error": "Race session not found"}

    try:
        state = engine.player_pit(req.compound)
    except Exception as exc:
        logger.error("Pit stop error for %s: %s", req.session_id, exc)
        return {"error": str(exc)}

    return {"state": _serialize(state)}


@router.get("/state")
def get_state(session_id: str):
    """
    Retrieve the current race state for a session.
    """
    engine = _race_engines.get(session_id)
    if not engine:
        return {"error": "Race session not found"}

    return {"state": _serialize(engine.get_state())}


@router.post("/ers")
def set_ers_mode(req: ERSRequest):
    """
    Change the player's ERS deployment mode.
    """
    engine = _race_engines.get(req.session_id)
    if not engine:
        return {"error": "Race session not found"}

    # ERS mode is stored on the engine if supported; otherwise no-op
    if hasattr(engine, "set_ers_mode"):
        try:
            state = engine.set_ers_mode(req.mode)
            return {"state": _serialize(state)}
        except Exception as exc:
            return {"error": str(exc)}

    return {"message": f"ERS mode set to {req.mode}", "state": engine.get_state()}


# ---------------------------------------------------------------------------
# SSE auto-run stream
# ---------------------------------------------------------------------------

def _sse(data: dict) -> str:
    """Format a dict as a Server-Sent Event."""
    return f"data: {json.dumps(data)}\n\n"


# Seconds between laps per speed setting. 1x is deliberately slow — the player
# needs time to read gaps, tire wear, and weather before making a call.
_SPEED_TO_SLEEP: Dict[int, float] = {1: 10.0, 2: 6.0, 5: 3.5, 10: 1.5, 20: 0.5}


async def _race_stream_generator(session_id: str, lap_interval: float = 0.4) -> AsyncGenerator[str, None]:
    """
    Async generator that emits SSE events for the full race lifecycle.

    Skips the formation/lights sequence when reconnecting mid-race
    (detected by current_lap > 0 on the engine state).
    """
    engine = _race_engines.get(session_id)
    if not engine:
        yield _sse({"error": "Race session not found"})
        return

    # Check if race already underway (reconnect after speed change)
    current_state = _serialize(engine.get_state())
    already_started = current_state.get("current_lap", 0) > 0

    if not already_started:
        # --- Formation lap ---
        yield _sse({"phase": "FORMATION", "message": "Cars leaving the pit lane for the formation lap…", "lap": 0})
        await asyncio.sleep(2.0)

        # --- Lights out countdown ---
        for light_count in range(1, 6):
            yield _sse({"phase": "LIGHTS_OUT", "lights": light_count, "message": f"Light {light_count} on"})
            await asyncio.sleep(0.8)

        await asyncio.sleep(0.5)
        yield _sse({"phase": "LIGHTS_OUT", "lights": 0, "message": "LIGHTS OUT — GO GO GO!"})
        await asyncio.sleep(0.3)

    # --- Race laps ---
    try:
        while True:
            state = engine.advance_lap()

            if hasattr(state, "to_dict"):
                state_dict = state.to_dict()
                finished = state_dict.get("status") == "FINISHED"
            else:
                state_dict = state if isinstance(state, dict) else {}
                finished = state_dict.get("status") == "FINISHED"

            payload = {
                "phase": "FINISHED" if finished else "RACING",
                "state": state_dict,
                "finished": finished,
            }
            yield _sse(payload)

            if finished:
                break

            await asyncio.sleep(lap_interval)

    except Exception as exc:
        logger.error("Stream error for %s: %s", session_id, exc)
        yield _sse({"error": str(exc)})


@router.get("/stream")
async def stream_race(session_id: str, speed: int = 5):
    """
    Server-Sent Events endpoint for automatic race playback.

    speed param: 1=10s/lap (strategy pace), 2=6s/lap, 5=3.5s/lap, 10=1.5s/lap, 20=0.5s/lap

    Connect with EventSource:
        const es = new EventSource('/api/race/stream?session_id=race_0&speed=5');
        es.onmessage = e => updateUI(JSON.parse(e.data));
    """
    engine = _race_engines.get(session_id)
    if not engine:
        return {"error": "Race session not found"}

    lap_interval = _SPEED_TO_SLEEP.get(speed, 0.4)

    return StreamingResponse(
        _race_stream_generator(session_id, lap_interval),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
