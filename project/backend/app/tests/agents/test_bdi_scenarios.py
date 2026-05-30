"""Additional BDI scenario tests."""

import random

import pytest

from simulation.ai_opponents import DRIVER_DATABASE
from simulation.engine import CarState, RaceState, TireState
from simulation.events import FlagState
from simulation.tracks import get_track
from simulation.weather import WeatherState
from agents.desires import GoalType
from agents.driver_agent import DriverAgent


def make_two_car_state(gap_behind: float = 1.2, flag: FlagState = FlagState.GREEN) -> RaceState:
    track = get_track("Spa")
    leader = CarState(
        driver=DRIVER_DATABASE["VER"],
        position=1,
        tire=TireState("MEDIUM", 8, 0.25),
        fuel=60.0,
        lap_time=95.0,
        total_time=1000.0,
        gap_to_leader=0.0,
        gap_to_next=None,
    )
    behind = CarState(
        driver=DRIVER_DATABASE["HAM"],
        position=2,
        tire=TireState("MEDIUM", 7, 0.22),
        fuel=60.0,
        lap_time=95.1,
        total_time=1000.0 + gap_behind,
        gap_to_leader=gap_behind,
        gap_to_next=gap_behind,
    )
    state = RaceState(
        lap=20,
        total_laps=44,
        status="RUNNING",
        leaderboard=[leader, behind],
        player=leader,
        weather=WeatherState(condition="DRY", air_temp=21.0, track_temp=32.0),
        flag=flag,
    )
    state.track = track
    return state


def test_bdi_gap_behind_is_positive_and_triggers_defence():
    agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(3))
    state = make_two_car_state(gap_behind=1.1)

    agent.perceive(state, state.track)
    agent.deliberate()

    assert agent.beliefs.self_belief.gap_behind == pytest.approx(1.1)
    assert any(d.goal == GoalType.PROTECT_POSITION for d in agent.desires)


def test_bdi_forecast_rain_triggers_rain_reaction():
    agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(3))
    state = make_two_car_state(gap_behind=4.0)
    state.weather_forecast = [
        {"lap": 21, "rain_probability": 0.92, "track_dampness": 0.45, "condition": "LIGHT_RAIN"}
    ]

    agent.perceive(state, state.track)
    agent.deliberate()

    assert any(d.goal == GoalType.REACT_TO_RAIN for d in agent.desires)


def test_bdi_red_flag_suppresses_driver_desires():
    agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(3))
    state = make_two_car_state(gap_behind=0.4, flag=FlagState.RED)

    agent.perceive(state, state.track)
    agent.deliberate()

    assert agent.desires == []
