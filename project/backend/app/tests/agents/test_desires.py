"""Tests for BDI DesireSet deliberation."""

import pytest

from agents.beliefs import BeliefBase, SelfBelief, TireBelief, RaceContextBelief
from agents.desires import DesireSet, GoalType
from agents.personality import get_personality


def make_beliefs(
    tire_wear: float = 0.2,
    tire_age: int = 5,
    compound: str = "MEDIUM",
    laps_remaining: int = 30,
    is_safety_car: bool = False,
    rain_probability: float = 0.0,
    gap_ahead: float = 2.0,
    gap_behind: float = 3.0,
    compound_obligation_met: bool = True,
) -> BeliefBase:
    return BeliefBase(
        self_belief=SelfBelief(
            position=3,
            team="Red Bull Racing",
            gap_to_leader=5.0,
            gap_ahead=gap_ahead,
            gap_behind=gap_behind,
            tire=TireBelief(
                compound=compound,
                age=tire_age,
                wear=tire_wear,
                predicted_life=20,
                deg_rate=0.04,
                expected_deg_rate=0.04,
                degrading_faster=False,
            ),
            fuel=50.0,
            ers_battery=80.0,
            pits_done=0,
            compound_obligation_met=compound_obligation_met,
            track_limit_warnings=0,
        ),
        race_context=RaceContextBelief(
            current_lap=10,
            total_laps=44,
            laps_remaining=laps_remaining,
            flag="SAFETY_CAR" if is_safety_car else "GREEN",
            is_safety_car=is_safety_car,
            rain_probability=rain_probability,
            track_dampness=0.0 if rain_probability < 0.3 else 0.4,
            track_temperature=30.0,
            pit_loss_time=20.0,
            undercut_value=12.0,
        ),
    )


class TestDesireSet:
    def test_tire_critical_triggers_pit_now(self):
        b = make_beliefs(tire_wear=0.95, tire_age=20, compound="SOFT")
        ds = DesireSet()
        desires = ds.deliberate(b, get_personality(1))
        assert desires[0].goal == GoalType.PIT_NOW
        assert desires[0].priority >= 0.9

    def test_safety_car_triggers_react(self):
        b = make_beliefs(is_safety_car=True)
        ds = DesireSet()
        desires = ds.deliberate(b, get_personality(1))
        assert any(d.goal == GoalType.REACT_TO_SAFETY_CAR for d in desires)

    def test_rain_triggers_react(self):
        b = make_beliefs(rain_probability=0.8)
        ds = DesireSet()
        desires = ds.deliberate(b, get_personality(1))
        assert any(d.goal == GoalType.REACT_TO_RAIN for d in desires)

    def test_compound_obligation_triggers_nail_rule(self):
        b = make_beliefs(laps_remaining=8, compound_obligation_met=False)
        ds = DesireSet()
        desires = ds.deliberate(b, get_personality(1))
        assert any(d.goal == GoalType.NAIL_COMPOUND_RULE for d in desires)

    def test_close_gap_ahead_triggers_gain_position(self):
        b = make_beliefs(gap_ahead=0.4)
        ds = DesireSet()
        desires = ds.deliberate(b, get_personality(1))
        assert any(d.goal == GoalType.GAIN_POSITION for d in desires)

    def test_close_gap_behind_triggers_protect(self):
        b = make_beliefs(gap_behind=0.8)
        ds = DesireSet()
        desires = ds.deliberate(b, get_personality(1))
        assert any(d.goal == GoalType.PROTECT_POSITION for d in desires)

    def test_different_personalities_produce_different_priorities(self):
        b = make_beliefs(gap_ahead=0.4)
        ds = DesireSet()
        ver_desires = ds.deliberate(b, get_personality(1))
        ham_desires = ds.deliberate(b, get_personality(44))
        # VER is more aggressive — GAIN_POSITION should have higher priority
        ver_gain = next((d for d in ver_desires if d.goal == GoalType.GAIN_POSITION), None)
        ham_gain = next((d for d in ham_desires if d.goal == GoalType.GAIN_POSITION), None)
        assert ver_gain is not None
        assert ham_gain is not None
        assert ver_gain.priority > ham_gain.priority
