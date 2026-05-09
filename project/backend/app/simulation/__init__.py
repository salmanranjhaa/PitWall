"""
F1 Race Simulation Engine

A comprehensive physics-based Formula 1 race simulation engine featuring:
- 24 realistic F1 circuits with accurate track data
- Full car physics with three-phase tire degradation
- Dynamic weather system with Markov chain transitions
- AI opponent controller with 20 2024 F1 drivers
- Safety car and race event management
- Complete race engine with strategy messaging

Usage:
    from simulation import RaceEngine, get_track

    track = get_track("Silverstone")
    engine = RaceEngine(track, player_team="Red Bull Racing")
    state = engine.start_race()

    for lap in range(track.laps):
        state = engine.advance_lap(actions={"ers_mode": "BALANCED"})
        print(f"Lap {state.lap}: P{state.player.position}")
"""

# Track module
from .tracks import (
    Track,
    get_track,
    list_tracks,
    TRACK_DATABASE,
)

# Physics module
from .physics import (
    CarPhysics,
    TireCompound,
    TIRE_COMPOUNDS,
    ERSMode,
    ERS_MODES,
    SOFT,
    MEDIUM,
    HARD,
    INTERMEDIATE,
    WET,
)

# Weather module
from .weather import (
    WeatherState,
    WeatherSystem,
    WEATHER_CONDITIONS,
    TRANSITION_MATRIX,
)

# AI Opponents module
from .ai_opponents import (
    Driver,
    AIOpponentController,
    DRIVER_DATABASE,
    TEAM_BASE_PACE,
    get_all_drivers,
    get_driver_by_code,
)

# Events module
from .events import (
    RaceEventBus,
    RaceEvent,
    SafetyCarController,
    FlagState,
    Incident,
)

# Engine module
from .engine import (
    CarState,
    RaceState,
    RaceEngine,
    StrategyMessage,
    TireState,
)

__all__ = [
    # Tracks
    "Track",
    "get_track",
    "list_tracks",
    "TRACK_DATABASE",
    # Physics
    "CarPhysics",
    "TireCompound",
    "TIRE_COMPOUNDS",
    "ERSMode",
    "ERS_MODES",
    "SOFT",
    "MEDIUM",
    "HARD",
    "INTERMEDIATE",
    "WET",
    # Weather
    "WeatherState",
    "WeatherSystem",
    "WEATHER_CONDITIONS",
    "TRANSITION_MATRIX",
    # AI Opponents
    "Driver",
    "AIOpponentController",
    "DRIVER_DATABASE",
    "TEAM_BASE_PACE",
    "get_all_drivers",
    "get_driver_by_code",
    # Events
    "RaceEventBus",
    "RaceEvent",
    "SafetyCarController",
    "FlagState",
    "Incident",
    # Engine
    "CarState",
    "RaceState",
    "RaceEngine",
    "StrategyMessage",
    "TireState",
]
