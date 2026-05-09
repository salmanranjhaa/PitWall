"""
BDI Plan Library — named multi-lap plans the agent commits to.

Each plan has:
- Name — identifier
- Applicable? — precondition (given beliefs + top desire, is this plan relevant?)
- Body — sequence of per-lap actions the agent commits to
- Completion — condition that ends the plan
- Failure — condition that aborts the plan
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum, auto


class PlanName(Enum):
    # Pit plans
    PIT_THIS_LAP          = auto()  # request pit stop immediately
    PIT_WINDOW_OPPORTUNE  = auto()  # pit within the next 3 laps at best gap
    PIT_UNDER_SC          = auto()  # pit now under safety car
    EXTEND_STINT          = auto()  # push tires for N more laps

    # Overtake plans
    ATTACK_DRS_ZONE       = auto()  # follow close, attempt on straight
    ATTACK_BRAKING        = auto()  # late-braking move into corner
    UNDERCUT_RIVAL        = auto()  # pit before rival, emerge ahead

    # Defence plans
    DEFEND_INSIDE_LINE    = auto()  # hold inside, block DRS
    DEFEND_PUSH           = auto()  # push harder to open gap

    # Pace plans
    PUSH_MODE             = auto()  # maximum pace, burn tires
    MANAGE_MODE           = auto()  # conserve tires, fuel
    FOLLOW_AND_WAIT       = auto()  # sit behind, conserve, attack later

    # Reaction plans
    SC_EVALUATE           = auto()  # evaluate pit vs stay during SC laps
    RAIN_TRANSITION       = auto()  # manage compound transition in wet
    COMPOUND_OBLIGATION   = auto()  # stop to fulfil 2-compound rule


@dataclass
class PlanStep:
    """One lap's worth of action within a plan."""
    action: str           # "PIT", "PUSH", "MANAGE", "ATTACK", "DEFEND", "NONE"
    compound: Optional[str] = None   # for PIT actions
    intensity: float = 1.0           # 1.0 = normal, >1 = push, <1 = manage


@dataclass
class Plan:
    """A named multi-lap plan the agent commits to."""
    name: PlanName
    steps: list[PlanStep]            # steps to execute in order
    current_step: int = 0
    max_laps: int = 5                # abandon if not complete by this many laps
    laps_active: int = 0

    def is_complete(self) -> bool:
        return self.current_step >= len(self.steps)

    def is_expired(self) -> bool:
        return self.laps_active >= self.max_laps

    def next_step(self) -> PlanStep:
        if self.is_complete():
            return PlanStep("NONE")
        step = self.steps[self.current_step]
        self.current_step += 1
        self.laps_active += 1
        return step


class PlanLibrary:
    """
    Factory for creating named plans given current beliefs.
    The agent calls select_plan(beliefs, top_desire, personality)
    to get a Plan object it then commits to.
    """

    @staticmethod
    def build(
        plan_name: PlanName,
        beliefs: "BeliefBase",
        personality: "Personality",
    ) -> Plan:
        """Construct a specific plan tailored to current beliefs."""

        if plan_name == PlanName.PIT_THIS_LAP:
            compound = PlanLibrary._choose_compound(beliefs, personality)
            return Plan(
                name=PlanName.PIT_THIS_LAP,
                steps=[PlanStep("PIT", compound=compound)],
                max_laps=1,
            )

        if plan_name == PlanName.EXTEND_STINT:
            # Manage tires for up to 5 laps hoping for safety car / rival pit
            return Plan(
                name=PlanName.EXTEND_STINT,
                steps=[PlanStep("MANAGE", intensity=0.80)] * 5,
                max_laps=5,
            )

        if plan_name == PlanName.PUSH_MODE:
            # Push hard for 3 laps (open gap, defend undercut)
            return Plan(
                name=PlanName.PUSH_MODE,
                steps=[PlanStep("PUSH", intensity=1.12 + personality.aggression * 0.1)] * 3,
                max_laps=3,
            )

        if plan_name == PlanName.ATTACK_DRS_ZONE:
            # Close the gap over 2 laps then attempt overtake
            return Plan(
                name=PlanName.ATTACK_DRS_ZONE,
                steps=[
                    PlanStep("MANAGE", intensity=1.05),   # lap 1: get into DRS window
                    PlanStep("ATTACK", intensity=1.15),   # lap 2: attempt the move
                    PlanStep("PUSH",   intensity=1.10),   # lap 3: consolidate
                ],
                max_laps=4,
            )

        if plan_name == PlanName.UNDERCUT_RIVAL:
            compound = PlanLibrary._choose_compound(beliefs, personality)
            return Plan(
                name=PlanName.UNDERCUT_RIVAL,
                steps=[
                    PlanStep("PIT", compound=compound),   # pit now
                    PlanStep("PUSH", intensity=1.15),     # push on fresh rubber
                    PlanStep("PUSH", intensity=1.12),
                    PlanStep("PUSH", intensity=1.05),
                ],
                max_laps=5,
            )

        if plan_name == PlanName.PIT_UNDER_SC:
            compound = PlanLibrary._choose_compound(beliefs, personality)
            return Plan(
                name=PlanName.PIT_UNDER_SC,
                steps=[PlanStep("PIT", compound=compound)],
                max_laps=1,
            )

        if plan_name == PlanName.DEFEND_PUSH:
            return Plan(
                name=PlanName.DEFEND_PUSH,
                steps=[PlanStep("PUSH", intensity=1.10)] * 3,
                max_laps=3,
            )

        if plan_name == PlanName.MANAGE_MODE:
            return Plan(
                name=PlanName.MANAGE_MODE,
                steps=[PlanStep("MANAGE", intensity=0.85)] * 6,
                max_laps=6,
            )

        if plan_name == PlanName.DEFEND_INSIDE_LINE:
            return Plan(
                name=PlanName.DEFEND_INSIDE_LINE,
                steps=[PlanStep("DEFEND", intensity=1.0)] * 3,
                max_laps=3,
            )

        if plan_name == PlanName.RAIN_TRANSITION:
            compound = PlanLibrary._choose_compound(beliefs, personality)
            return Plan(
                name=PlanName.RAIN_TRANSITION,
                steps=[
                    PlanStep("PIT", compound=compound),
                    PlanStep("MANAGE", intensity=0.90),
                    PlanStep("PUSH", intensity=1.05),
                ],
                max_laps=4,
            )

        if plan_name == PlanName.COMPOUND_OBLIGATION:
            compound = PlanLibrary._choose_compound(beliefs, personality)
            return Plan(
                name=PlanName.COMPOUND_OBLIGATION,
                steps=[PlanStep("PIT", compound=compound)],
                max_laps=1,
            )

        # Default: do nothing special for 1 lap
        return Plan(PlanName.FOLLOW_AND_WAIT, [PlanStep("NONE")], max_laps=1)

    @staticmethod
    def _choose_compound(beliefs: "BeliefBase", personality: "Personality") -> str:
        """
        Compound selection now accounts for personality:
        - Aggressive drivers pick SOFT more readily
        - Consistent drivers balance MEDIUM/HARD for long stints
        """
        laps_remaining = beliefs.race_context.laps_remaining
        stint_limits = {"SOFT": 22, "MEDIUM": 32, "HARD": 45}

        if beliefs.race_context.rain_probability > 0.65:
            return "WET"
        if beliefs.race_context.rain_probability > 0.30:
            return "INTERMEDIATE"

        # Aggressive personality bias toward softer compounds
        soft_bias = personality.aggression * 5  # up to 5 extra laps of SOFT tolerance

        if laps_remaining <= 8 + soft_bias:
            return "SOFT"
        if laps_remaining <= 20 + soft_bias:
            return "MEDIUM"
        return "HARD"
