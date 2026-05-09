"""
Race Engineer Agent — player-facing BDI agent that emits structured recommendations.

Does NOT control a car. Watches the player's car and the full race state,
then produces structured recommendations surfaced in the Dashboard UI.
"""

from dataclasses import dataclass
from typing import Optional, Any, Tuple

from .beliefs import BeliefBase, SelfBelief, TireBelief, RaceContextBelief
from .desires import Desire, GoalType, DesireSet
from .plans import PlanLibrary, PlanName
from .personality import Personality


@dataclass
class EngineerRecommendation:
    """
    Structured recommendation from the race engineer BDI agent.
    Surfaced in the Dashboard as the Strategy Engine panel.
    """
    priority: str              # "URGENT", "OPPORTUNITY", "INFO"
    action: str                # "PIT_NOW", "STAY_OUT", "PUSH", "MANAGE", "MONITOR"
    compound: Optional[str]    # recommended compound if PIT_NOW
    headline: str              # short message (≤ 60 chars) for Dashboard Driver tab
    rationale: str             # longer explanation (≤ 200 chars)
    confidence: float          # 0.0–1.0
    pit_window: Optional[Tuple[int, int]]  # (earliest_lap, latest_lap) or None


class RaceEngineerAgent:
    """
    BDI agent that watches the player's car and emits recommendations.

    Beliefs: same BeliefBase as DriverAgent but for the player car.
    Desires: ranked goals for the player (win position, meet compound rule, etc.)
    Intentions: produce a recommendation (does NOT autonomously act).
    """

    ENGINEER_PERSONALITY = Personality(
        name="Engineer",
        aggression=0.60,         # conservative — protects car
        patience=0.85,
        defensiveness=0.80,
        risk_tolerance=0.65,
        calculation=0.99,        # always uses full look-ahead
        team_player=0.95,
    )

    def __init__(self):
        self.beliefs = BeliefBase(
            self_belief=SelfBelief(
                position=1,
                team="Player",
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
        self._desire_set = DesireSet()

    def perceive(self, player_number: int, race_state: Any) -> None:
        self.beliefs.update_from_state(player_number, race_state, race_state.track)

    def deliberate(self) -> None:
        self.desires = self._desire_set.deliberate(
            self.beliefs, self.ENGINEER_PERSONALITY
        )

    def recommend(self) -> EngineerRecommendation:
        """
        Produce a structured recommendation based on current desires.
        """
        if not self.desires:
            return EngineerRecommendation(
                priority="INFO", action="MONITOR", compound=None,
                headline="All systems nominal",
                rationale="No immediate action required.",
                confidence=0.85, pit_window=None,
            )

        top = self.desires[0]
        b = self.beliefs
        s = b.self_belief

        if top.goal == GoalType.PIT_NOW:
            compound = PlanLibrary._choose_compound(b, self.ENGINEER_PERSONALITY)
            return EngineerRecommendation(
                priority="URGENT", action="PIT_NOW", compound=compound,
                headline=f"Box this lap — {compound}",
                rationale=top.reason,
                confidence=0.90,
                pit_window=(b.race_context.current_lap, b.race_context.current_lap + 1),
            )

        if top.goal == GoalType.REACT_TO_SAFETY_CAR:
            compound = PlanLibrary._choose_compound(b, self.ENGINEER_PERSONALITY)
            return EngineerRecommendation(
                priority="URGENT", action="PIT_NOW", compound=compound,
                headline=f"SC window — box now for {compound}",
                rationale="Safety car reduces effective pit loss. Free stop available.",
                confidence=0.88,
                pit_window=(b.race_context.current_lap, b.race_context.current_lap + 2),
            )

        if top.goal == GoalType.DEFEND_FROM_UNDERCUT:
            return EngineerRecommendation(
                priority="OPPORTUNITY", action="PUSH",
                compound=None,
                headline="Rival undercut — push hard for 3 laps",
                rationale=top.reason,
                confidence=0.82, pit_window=None,
            )

        if top.goal == GoalType.NAIL_COMPOUND_RULE:
            # Pick a dry compound the driver hasn't used yet
            dry_used = {c for c in b.stints_completed if c in ("SOFT", "MEDIUM", "HARD")}
            if s.tire.compound in ("SOFT", "MEDIUM", "HARD"):
                dry_used.add(s.tire.compound)
            available = [c for c in ("SOFT", "MEDIUM", "HARD") if c not in dry_used]
            compound = available[0] if available else "HARD"
            return EngineerRecommendation(
                priority="URGENT", action="PIT_NOW", compound=compound,
                headline=f"Compound rule — must use {compound}",
                rationale=f"Only {b.race_context.laps_remaining} laps left. Must pit to fulfil obligation.",
                confidence=0.99,
                pit_window=(b.race_context.current_lap, b.race_context.current_lap + 3),
            )

        if top.goal == GoalType.REACT_TO_RAIN:
            compound = PlanLibrary._choose_compound(b, self.ENGINEER_PERSONALITY)
            return EngineerRecommendation(
                priority="URGENT", action="PIT_NOW", compound=compound,
                headline=f"Rain incoming — switch to {compound}",
                rationale=top.reason,
                confidence=0.85,
                pit_window=(b.race_context.current_lap, b.race_context.current_lap + 2),
            )

        if top.goal == GoalType.GAIN_POSITION:
            return EngineerRecommendation(
                priority="OPPORTUNITY", action="PUSH", compound=None,
                headline="Push to gain position",
                rationale=top.reason,
                confidence=0.75, pit_window=None,
            )

        if top.goal == GoalType.MANAGE_TIRES or top.goal == GoalType.EXTEND_STINT:
            return EngineerRecommendation(
                priority="INFO", action="MANAGE", compound=None,
                headline="Manage tires — extend stint",
                rationale=top.reason,
                confidence=0.70, pit_window=None,
            )

        # Default info recommendation
        return EngineerRecommendation(
            priority="INFO", action="MONITOR", compound=None,
            headline=f"Monitor — {top.goal.name.replace('_', ' ').lower()}",
            rationale=top.reason,
            confidence=0.70, pit_window=None,
        )
