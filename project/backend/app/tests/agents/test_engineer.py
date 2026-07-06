"""Tests for BDI RaceEngineerAgent."""

import pytest

from simulation.engine import CarState, TireState, RaceState
from simulation.weather import WeatherState
from simulation.tracks import get_track
from simulation.ai_opponents import DRIVER_DATABASE
from simulation.events import FlagState
from agents.engineer_agent import RaceEngineerAgent


def make_race_state(
    lap: int = 10,
    tire_compound: str = "SOFT",
    tire_age: int = 12,
    tire_wear: float = 0.55,
    is_safety_car: bool = False,
    rain_probability: float = 0.0,
) -> RaceState:
    track = get_track("Spa")
    weather = WeatherState(
        condition="DRY" if rain_probability < 0.3 else "LIGHT_RAIN",
        air_temp=22.0,
        track_temp=35.0,
        humidity=45.0,
        rain_intensity=rain_probability,
        track_dampness=0.0 if rain_probability < 0.3 else 0.4,
        wind_speed=2.0,
    )
    driver = DRIVER_DATABASE["VER"]
    car = CarState(
        driver=driver,
        position=1,
        tire=TireState(compound=tire_compound, age=tire_age, wear=tire_wear),
        fuel=50.0,
        lap_time=95.5,
        total_time=950.0,
        pits=0,
        gap_to_leader=0.0,
        gap_to_next=None,
        drs_available=False,
        ers_battery=70.0,
    )
    state = RaceState(
        lap=lap,
        total_laps=44,
        status="RUNNING",
        leaderboard=[car],
        player=car,
        weather=weather,
        messages=[],
        flag=FlagState.SAFETY_CAR if is_safety_car else FlagState.GREEN,
        incidents=[],
        events_log=[],
    )
    state.track = track
    return state


class TestRaceEngineerAgent:
    def test_default_recommendation_is_info(self):
        agent = RaceEngineerAgent()
        state = make_race_state(lap=5, tire_age=3, tire_wear=0.1)
        agent.perceive(DRIVER_DATABASE["VER"].number, state, getattr(state, "track", None))
        agent.deliberate()
        rec = agent.recommend()
        assert rec.priority == "INFO"
        assert rec.action == "MONITOR"

    def test_tire_critical_recommends_pit(self):
        agent = RaceEngineerAgent()
        state = make_race_state(tire_wear=0.95, tire_age=20)
        agent.perceive(DRIVER_DATABASE["VER"].number, state, getattr(state, "track", None))
        agent.deliberate()
        rec = agent.recommend()
        assert rec.priority == "URGENT"
        assert rec.action == "PIT_NOW"
        assert rec.compound is not None

    def test_safety_car_recommends_pit(self):
        agent = RaceEngineerAgent()
        state = make_race_state(is_safety_car=True)
        agent.perceive(DRIVER_DATABASE["VER"].number, state, getattr(state, "track", None))
        agent.deliberate()
        rec = agent.recommend()
        assert rec.priority == "URGENT"
        assert rec.action == "PIT_NOW"
        assert "SC" in rec.headline or "Safety" in rec.headline

    def test_rain_recommends_wet_tires(self):
        agent = RaceEngineerAgent()
        state = make_race_state(rain_probability=0.8)
        agent.perceive(DRIVER_DATABASE["VER"].number, state, getattr(state, "track", None))
        agent.deliberate()
        rec = agent.recommend()
        assert rec.priority == "URGENT"
        assert rec.action == "PIT_NOW"
        assert rec.compound in ("WET", "INTERMEDIATE")

    def test_compound_obligation_recommends_different_compound(self):
        agent = RaceEngineerAgent()
        state = make_race_state(lap=38, tire_compound="SOFT", tire_age=15, tire_wear=0.6)
        # Create beliefs with unmet obligation by forcing stints_completed empty
        agent.perceive(DRIVER_DATABASE["VER"].number, state, getattr(state, "track", None))
        agent.deliberate()
        # Manually override to simulate unmet obligation
        agent.beliefs.stints_completed = []
        agent.beliefs.self_belief.compound_obligation_met = False
        agent.beliefs.race_context.laps_remaining = 6
        rec = agent.recommend()
        assert rec.priority == "URGENT"
        assert rec.action == "PIT_NOW"
        assert rec.compound is not None
