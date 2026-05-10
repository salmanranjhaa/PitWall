"""Tests for BDI BeliefBase."""

import random
import pytest

from simulation.engine import CarState, TireState, RaceState
from simulation.weather import WeatherState
from simulation.tracks import get_track
from simulation.ai_opponents import DRIVER_DATABASE
from agents.beliefs import BeliefBase, SelfBelief, TireBelief, RaceContextBelief


def make_race_state(lap: int = 5, total_laps: int = 44) -> RaceState:
    """Build a minimal RaceState with two cars for belief testing."""
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
        tire=TireState(compound="SOFT", age=8, wear=0.35),
        fuel=60.0,
        lap_time=95.5,
        total_time=480.0,
        pits=0,
        gap_to_leader=0.0,
        gap_to_next=None,
        drs_available=False,
        ers_battery=80.0,
    )
    car2 = CarState(
        driver=driver2,
        position=2,
        tire=TireState(compound="MEDIUM", age=6, wear=0.20),
        fuel=58.0,
        lap_time=96.1,
        total_time=481.5,
        pits=0,
        gap_to_leader=1.5,
        gap_to_next=1.5,
        drs_available=True,
        ers_battery=85.0,
    )

    state = RaceState(
        lap=lap,
        total_laps=total_laps,
        status="RUNNING",
        leaderboard=[car1, car2],
        player=car1,
        weather=weather,
        messages=[],
        flag=__import__("simulation.events", fromlist=["FlagState"]).FlagState.GREEN,
        incidents=[],
        events_log=[],
    )
    state.track = track
    return state


class TestBeliefBase:
    def test_self_belief_populated(self):
        state = make_race_state()
        bb = BeliefBase(
            self_belief=SelfBelief(
                position=1, team="Red Bull Racing", gap_to_leader=0.0,
                gap_ahead=None, gap_behind=None,
                tire=TireBelief("MEDIUM", 0, 0.0, 30, 0.0, 0.04, False),
                fuel=100.0, ers_battery=100.0, pits_done=0,
                compound_obligation_met=False, track_limit_warnings=0,
            ),
            race_context=RaceContextBelief(
                current_lap=0, total_laps=44, laps_remaining=44,
                flag="GREEN", is_safety_car=False, rain_probability=0.0,
                track_dampness=0.0, track_temperature=25.0,
                pit_loss_time=20.0, undercut_value=12.0,
            ),
        )
        bb.update_from_state(1, state, getattr(state, "track", None))

        assert bb.self_belief.position == 1
        assert bb.self_belief.tire.compound == "SOFT"
        assert bb.self_belief.tire.age == 8
        assert bb.self_belief.pits_done == 0
        assert bb.self_belief.fuel == 60.0

    def test_rival_beliefs_populated(self):
        state = make_race_state()
        bb = BeliefBase(
            self_belief=SelfBelief(
                position=1, team="Red Bull Racing", gap_to_leader=0.0,
                gap_ahead=None, gap_behind=None,
                tire=TireBelief("MEDIUM", 0, 0.0, 30, 0.0, 0.04, False),
                fuel=100.0, ers_battery=100.0, pits_done=0,
                compound_obligation_met=False, track_limit_warnings=0,
            ),
            race_context=RaceContextBelief(
                current_lap=0, total_laps=44, laps_remaining=44,
                flag="GREEN", is_safety_car=False, rain_probability=0.0,
                track_dampness=0.0, track_temperature=25.0,
                pit_loss_time=20.0, undercut_value=12.0,
            ),
        )
        bb.update_from_state(1, state, getattr(state, "track", None))

        assert len(bb.rivals) == 1
        rival = bb.rivals[44]
        assert rival.name == "Lewis Hamilton"
        assert rival.tire_compound == "MEDIUM"
        assert rival.gap_to_self > 0

    def test_race_context_populated(self):
        state = make_race_state(lap=10, total_laps=50)
        bb = BeliefBase(
            self_belief=SelfBelief(
                position=1, team="Red Bull Racing", gap_to_leader=0.0,
                gap_ahead=None, gap_behind=None,
                tire=TireBelief("MEDIUM", 0, 0.0, 30, 0.0, 0.04, False),
                fuel=100.0, ers_battery=100.0, pits_done=0,
                compound_obligation_met=False, track_limit_warnings=0,
            ),
            race_context=RaceContextBelief(
                current_lap=0, total_laps=44, laps_remaining=44,
                flag="GREEN", is_safety_car=False, rain_probability=0.0,
                track_dampness=0.0, track_temperature=25.0,
                pit_loss_time=20.0, undercut_value=12.0,
            ),
        )
        bb.update_from_state(1, state, getattr(state, "track", None))

        assert bb.race_context.current_lap == 10
        assert bb.race_context.total_laps == 50
        assert bb.race_context.laps_remaining == 40
        assert bb.race_context.flag == "GREEN"

    def test_compound_obligation_tracks_stints(self):
        state = make_race_state()
        bb = BeliefBase(
            self_belief=SelfBelief(
                position=1, team="Red Bull Racing", gap_to_leader=0.0,
                gap_ahead=None, gap_behind=None,
                tire=TireBelief("SOFT", 0, 0.0, 30, 0.0, 0.04, False),
                fuel=100.0, ers_battery=100.0, pits_done=0,
                compound_obligation_met=False, track_limit_warnings=0,
            ),
            race_context=RaceContextBelief(
                current_lap=0, total_laps=44, laps_remaining=44,
                flag="GREEN", is_safety_car=False, rain_probability=0.0,
                track_dampness=0.0, track_temperature=25.0,
                pit_loss_time=20.0, undercut_value=12.0,
            ),
        )
        bb.update_from_state(1, state, getattr(state, "track", None))
        # Only SOFT used so far, obligation not met with many laps remaining
        assert bb.self_belief.compound_obligation_met is False
