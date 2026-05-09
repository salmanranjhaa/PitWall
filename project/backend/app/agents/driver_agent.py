"""
BDI Driver Agent — autonomous agent for one AI-controlled F1 driver.

Each lap:
  1. perceive()    — update BeliefBase from race_state
  2. deliberate()  — rank desires given beliefs + personality
  3. select_plan() — choose/continue a Plan from the library
  4. execute()     — return the current plan step as an AgentAction
"""

from dataclasses import dataclass
from typing import Optional, Any
import random

from .base import BDIAgent
from .beliefs import BeliefBase, SelfBelief, TireBelief, RaceContextBelief
from .desires import Desire, DesireSet
from .plans import Plan, PlanName, PlanStep, PlanLibrary
from .personality import Personality, PlanSelector, get_personality
from ..simulation.ai_opponents import Driver


@dataclass
class AgentAction:
    """The action returned by an agent's execute() step."""
    driver_number: int
    action_type: str          # "PIT", "PUSH", "MANAGE", "ATTACK", "DEFEND", "NONE"
    compound: Optional[str] = None  # set if action_type == "PIT"
    intensity: float = 1.0          # pace multiplier for physics engine
    reason: str = ""
    top_desire: Optional[str] = None   # for logging / BDI state export
    current_plan: Optional[str] = None # for logging / BDI state export


class DriverAgent(BDIAgent):
    """
    Autonomous BDI agent for one AI-controlled F1 driver.
    """

    def __init__(self, driver: Driver, rng: random.Random):
        self.driver = driver
        self.personality = get_personality(driver.number)
        self.rng = rng

        # Initial dummy beliefs — replaced on first perceive()
        self.beliefs = BeliefBase(
            self_belief=SelfBelief(
                position=1,
                team=driver.team,
                gap_to_leader=0.0,
                gap_ahead=None,
                gap_behind=None,
                tire=TireBelief(
                    compound="MEDIUM",
                    age=0,
                    wear=0.0,
                    predicted_life=30,
                    deg_rate=0.0,
                    expected_deg_rate=0.04,
                    degrading_faster=False,
                ),
                fuel=100.0,
                ers_battery=100.0,
                pits_done=0,
                compound_obligation_met=False,
                track_limit_warnings=0,
            ),
            race_context=RaceContextBelief(
                current_lap=0,
                total_laps=0,
                laps_remaining=0,
                flag="GREEN",
                is_safety_car=False,
                rain_probability=0.0,
                track_dampness=0.0,
                track_temperature=25.0,
                pit_loss_time=20.0,
                undercut_value=12.0,
            ),
        )
        self.desires: list[Desire] = []
        self.current_plan: Optional[Plan] = None
        self._desire_set = DesireSet()

    # ── BDI cycle ────────────────────────────────────────────────────

    def perceive(self, race_state: Any) -> None:
        """Step 1: Update belief base from race state."""
        self.beliefs.update_from_state(self.driver.number, race_state, race_state.track)

    def deliberate(self) -> None:
        """Step 2: Rank desires given current beliefs."""
        self.desires = self._desire_set.deliberate(self.beliefs, self.personality)

    def select_plan(self) -> None:
        """Step 3: Choose or continue a plan (intention selection)."""
        plan_name = PlanSelector.select(
            self.desires, self.beliefs, self.personality, self.current_plan
        )
        if plan_name is not None:
            # New plan selected — commit to it
            self.current_plan = PlanLibrary.build(plan_name, self.beliefs, self.personality)

    def execute(self) -> AgentAction:
        """Step 4: Return the next action from the current plan."""
        if self.current_plan is None:
            return AgentAction(
                driver_number=self.driver.number,
                action_type="NONE",
                reason="no active plan",
            )

        step: PlanStep = self.current_plan.next_step()

        if self.current_plan.is_complete():
            self.current_plan = None

        top_desire_name = self.desires[0].goal.name if self.desires else "NONE"

        return AgentAction(
            driver_number=self.driver.number,
            action_type=step.action,
            compound=step.compound,
            intensity=step.intensity,
            reason=self.desires[0].reason if self.desires else "",
            top_desire=top_desire_name,
            current_plan=self.current_plan.name.name if self.current_plan else None,
        )

    # ── BDI state export (for API + Dashboard) ───────────────────────

    def bdi_state(self) -> dict:
        """Serialise the agent's current BDI state for the API."""
        return {
            "driver_number": self.driver.number,
            "top_desire": self.desires[0].goal.name if self.desires else None,
            "top_desire_reason": self.desires[0].reason if self.desires else "",
            "current_plan": self.current_plan.name.name if self.current_plan else None,
            "plan_step": self.current_plan.current_step if self.current_plan else 0,
            "tire_degrading_faster": self.beliefs.self_belief.tire.degrading_faster,
            "gap_ahead_trend": round(self.beliefs.gap_ahead_trend, 3),
        }
