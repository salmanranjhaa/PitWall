"""Scenario tests for red flags and sector simulation."""

from types import SimpleNamespace

from simulation.engine import RaceEngine
from simulation.events import FlagState, SafetyCarController
from simulation.tracks import get_track


def test_safety_controller_escalates_explicit_red_flag():
    controller = SafetyCarController(random_seed=1)
    incident = {
        "severity": "critical",
        "requires_sc": True,
        "requires_red": True,
        "processed": False,
    }
    state = SimpleNamespace(incidents=[incident])

    triggered = controller.check_incident(state)

    assert triggered is incident
    assert incident["processed"] is True
    assert controller.get_flag_state() == FlagState.RED
    assert controller.red_laps_remaining >= 1


def test_race_engine_outputs_sector_times():
    engine = RaceEngine(
        track=get_track("Bahrain"),
        player_team="Ferrari",
        starting_compound="MEDIUM",
        random_seed=4,
        player_driver=16,
    )
    engine.start_race()
    state = engine.advance_lap()

    assert state.leaderboard
    assert all(len(car.sector_times) == 3 for car in state.leaderboard if car.alive)
    assert all(sum(car.sector_times) > 0 for car in state.leaderboard if car.alive)
    assert state.sector_flags.keys() == {1, 2, 3}


def test_red_flag_tick_does_not_advance_lap():
    engine = RaceEngine(
        track=get_track("Bahrain"),
        player_team="Ferrari",
        starting_compound="MEDIUM",
        random_seed=5,
        player_driver=16,
    )
    engine.start_race()
    engine._state.incidents.append({
        "severity": "critical",
        "requires_sc": True,
        "requires_red": True,
        "processed": False,
    })
    engine._sc_controller.check_incident(engine._state)
    engine._state.flag = engine._sc_controller.get_flag_state()
    lap_before = engine.get_state().lap

    state = engine.advance_lap()

    assert state.lap == lap_before
    assert any(event["event_type"].startswith("red_flag") for event in state.events_log)
