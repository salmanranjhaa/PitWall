"""Tests for BDI DriverAgent full cycle."""

import random
import pytest

from simulation.engine import CarState, TireState, RaceState
from simulation.weather import WeatherState
from simulation.tracks import get_track
from simulation.ai_opponents import DRIVER_DATABASE
from simulation.events import FlagState
from agents.driver_agent import DriverAgent


def make_race_state(lap: int = 10) -> RaceState:
    track = get_track("Spa")
    weather = WeatherState(
        condition="DRY",
        air_temp=22.0,
        track_temp=35.0,
        humidity=45.0,
        rain_intensity=0.0,
        track_dampness=0.0,
        wind_speed=2.0,
    )
    driver1 = DRIVER_DATABASE["VER"]
    driver2 = DRIVER_DATABASE["HAM"]
    car1 = CarState(
        driver=driver1,
        position=1,
        tire=TireState(compound="SOFT", age=12, wear=0.55),
        fuel=50.0,
        lap_time=95.5,
        total_time=950.0,
        pits=0,
        gap_to_leader=0.0,
        gap_to_next=None,
        drs_available=False,
        ers_battery=70.0,
    )
    car2 = CarState(
        driver=driver2,
        position=2,
        tire=TireState(compound="MEDIUM", age=8, wear=0.30),
        fuel=48.0,
        lap_time=96.0,
        total_time=952.0,
        pits=0,
        gap_to_leader=2.0,
        gap_to_next=2.0,
        drs_available=True,
        ers_battery=75.0,
    )
    state = RaceState(
        lap=lap,
        total_laps=44,
        status="RUNNING",
        leaderboard=[car1, car2],
        player=car1,
        weather=weather,
        messages=[],
        flag=FlagState.GREEN,
        incidents=[],
        events_log=[],
    )
    state.track = track
    return state


class TestDriverAgent:
    def test_perceive_updates_beliefs(self):
        agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(42))
        state = make_race_state()
        agent.perceive(state, getattr(state, "track", None))
        assert agent.beliefs.self_belief.tire.compound == "SOFT"
        assert agent.beliefs.self_belief.tire.age == 12
        assert len(agent.beliefs.rivals) == 1

    def test_deliberate_produces_desires(self):
        agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(42))
        state = make_race_state()
        agent.perceive(state, getattr(state, "track", None))
        agent.deliberate()
        assert len(agent.desires) > 0

    def test_select_plan_commits(self):
        agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(42))
        state = make_race_state()
        agent.perceive(state, getattr(state, "track", None))
        agent.deliberate()
        agent.select_plan()
        assert agent.current_plan is not None

    def test_execute_returns_action(self):
        agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(42))
        state = make_race_state()
        agent.perceive(state, getattr(state, "track", None))
        agent.deliberate()
        agent.select_plan()
        action = agent.execute()
        assert action.driver_number == 1
        assert action.action_type is not None
        assert action.top_desire is not None

    def test_bdi_state_export(self):
        agent = DriverAgent(DRIVER_DATABASE["VER"], random.Random(42))
        state = make_race_state()
        agent.perceive(state, getattr(state, "track", None))
        agent.deliberate()
        agent.select_plan()
        agent.execute()
        export = agent.bdi_state()
        assert export["driver_number"] == 1
        assert "top_desire" in export
        assert "current_plan" in export

    def test_hamilton_and_tsunoda_differ(self):
        state = make_race_state()
        ham = DriverAgent(DRIVER_DATABASE["HAM"], random.Random(42))
        tsu = DriverAgent(DRIVER_DATABASE["TSU"], random.Random(42))

        ham.perceive(state)
        ham.deliberate()
        ham.select_plan()
        ham.execute()

        tsu.perceive(state)
        tsu.deliberate()
        tsu.select_plan()
        tsu.execute()

        # Different personalities should produce different desires or plans
        assert ham.bdi_state()["top_desire"] != tsu.bdi_state()["top_desire"] or \
               ham.bdi_state()["current_plan"] != tsu.bdi_state()["current_plan"]
