"""Tests for BDI PlanLibrary."""

import pytest

from agents.beliefs import BeliefBase, SelfBelief, TireBelief, RaceContextBelief
from agents.plans import PlanLibrary, PlanName, PlanStep
from agents.personality import get_personality


def make_beliefs(laps_remaining: int = 20, rain_probability: float = 0.0) -> BeliefBase:
    return BeliefBase(
        self_belief=SelfBelief(
            position=3,
            team="Red Bull Racing",
            gap_to_leader=5.0,
            gap_ahead=1.0,
            gap_behind=2.0,
            tire=TireBelief(
                compound="MEDIUM",
                age=10,
                wear=0.3,
                predicted_life=15,
                deg_rate=0.04,
                expected_deg_rate=0.04,
                degrading_faster=False,
            ),
            fuel=50.0,
            ers_battery=80.0,
            pits_done=0,
            compound_obligation_met=True,
            track_limit_warnings=0,
        ),
        race_context=RaceContextBelief(
            current_lap=10,
            total_laps=30,
            laps_remaining=laps_remaining,
            flag="GREEN",
            is_safety_car=False,
            rain_probability=rain_probability,
            track_dampness=0.0,
            track_temperature=30.0,
            pit_loss_time=20.0,
            undercut_value=12.0,
        ),
    )


class TestPlanLibrary:
    def test_pit_this_lap_has_one_step(self):
        b = make_beliefs()
        plan = PlanLibrary.build(PlanName.PIT_THIS_LAP, b, get_personality(1))
        assert plan.name == PlanName.PIT_THIS_LAP
        assert len(plan.steps) == 1
        assert plan.steps[0].action == "PIT"
        assert plan.steps[0].compound is not None

    def test_push_mode_has_three_steps(self):
        b = make_beliefs()
        plan = PlanLibrary.build(PlanName.PUSH_MODE, b, get_personality(1))
        assert plan.name == PlanName.PUSH_MODE
        assert len(plan.steps) == 3
        assert all(s.action == "PUSH" for s in plan.steps)
        assert all(s.intensity > 1.0 for s in plan.steps)

    def test_manage_mode_has_six_steps(self):
        b = make_beliefs()
        plan = PlanLibrary.build(PlanName.MANAGE_MODE, b, get_personality(1))
        assert plan.name == PlanName.MANAGE_MODE
        assert len(plan.steps) == 6
        assert all(s.action == "MANAGE" for s in plan.steps)
        assert all(s.intensity < 1.0 for s in plan.steps)

    def test_attack_drs_zone_has_three_steps(self):
        b = make_beliefs()
        plan = PlanLibrary.build(PlanName.ATTACK_DRS_ZONE, b, get_personality(1))
        assert plan.name == PlanName.ATTACK_DRS_ZONE
        assert len(plan.steps) == 3
        assert plan.steps[0].action == "MANAGE"
        assert plan.steps[1].action == "ATTACK"
        assert plan.steps[2].action == "PUSH"

    def test_undercut_rival_has_four_steps(self):
        b = make_beliefs()
        plan = PlanLibrary.build(PlanName.UNDERCUT_RIVAL, b, get_personality(1))
        assert plan.name == PlanName.UNDERCUT_RIVAL
        assert len(plan.steps) == 4
        assert plan.steps[0].action == "PIT"
        assert all(s.action == "PUSH" for s in plan.steps[1:])

    def test_rain_selects_wet_compound(self):
        b = make_beliefs(rain_probability=0.8)
        plan = PlanLibrary.build(PlanName.PIT_THIS_LAP, b, get_personality(1))
        assert plan.steps[0].compound == "WET"

    def test_plan_completion(self):
        b = make_beliefs()
        plan = PlanLibrary.build(PlanName.PIT_THIS_LAP, b, get_personality(1))
        assert not plan.is_complete()
        plan.next_step()
        assert plan.is_complete()

    def test_plan_expiration(self):
        b = make_beliefs()
        plan = PlanLibrary.build(PlanName.PUSH_MODE, b, get_personality(1))
        plan.max_laps = 2
        plan.next_step()
        plan.laps_active = 2
        assert plan.is_expired()
