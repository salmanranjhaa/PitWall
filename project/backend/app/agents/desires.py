"""
BDI Desires — goals the agent wants to achieve.

Multiple desires can be active simultaneously. The deliberation step ranks
them by priority given current beliefs and personality.
"""

from enum import Enum, auto
from dataclasses import dataclass
from typing import Optional


class GoalType(Enum):
    # Race goals
    WIN_RACE              = auto()  # finish P1
    SCORE_POINTS          = auto()  # finish P1-P10
    BEAT_TEAM_MATE        = auto()  # finish ahead of team-mate
    PROTECT_POSITION      = auto()  # don't lose current position
    GAIN_POSITION         = auto()  # overtake the car ahead
    OPEN_GAP              = auto()  # build gap behind to pit safely
    CLOSE_GAP             = auto()  # catch the car ahead for overtake

    # Stint/tire goals
    EXTEND_STINT          = auto()  # push tires to delay pit
    PIT_NOW               = auto()  # enter pit lane this lap
    MANAGE_TIRES          = auto()  # slow down to preserve rubber
    NAIL_COMPOUND_RULE    = auto()  # ensure ≥2 dry compounds used

    # Situation-specific
    REACT_TO_SAFETY_CAR   = auto()  # evaluate pit opportunity
    REACT_TO_RAIN         = auto()  # switch to wet compound
    SURVIVE_TO_FINISH     = auto()  # car damage / reliability concern
    DEFEND_FROM_UNDERCUT  = auto()  # rival just pitted, push hard


@dataclass
class Desire:
    """A single active goal with its current priority."""
    goal: GoalType
    priority: float              # 0.0 – 1.0 (higher = more urgent)
    target_driver: Optional[int] = None  # for GAIN/PROTECT/BEAT_TEAM_MATE
    target_lap: Optional[int]   = None  # for PIT_NOW (specific lap)
    reason: str = ""             # human-readable rationale


class DesireSet:
    """
    Manages the active goals for one driver agent.
    Deliberation produces a ranked list every lap.
    """

    def deliberate(self, beliefs: "BeliefBase", personality: "Personality") -> list[Desire]:
        """
        Given current beliefs and driver personality, return a priority-ranked
        list of active desires. This is the core of BDI deliberation.
        """
        desires = []
        b = beliefs
        ctx = b.race_context
        s = b.self_belief

        # ── Survival goals (highest priority) ───────────────────────────
        if s.tire.wear > 0.90:
            desires.append(Desire(GoalType.PIT_NOW, 0.95, reason="tire critical"))

        if not s.compound_obligation_met and ctx.laps_remaining < 12:
            desires.append(Desire(GoalType.NAIL_COMPOUND_RULE, 0.95,
                                  reason=f"must use 2nd compound, {ctx.laps_remaining}L left"))

        # ── Safety car / weather ────────────────────────────────────────
        if ctx.is_safety_car:
            desires.append(Desire(GoalType.REACT_TO_SAFETY_CAR, 0.88,
                                  reason="SC window — evaluate cheap pit"))

        if ctx.rain_probability > 0.65 and s.tire.compound not in ("INTERMEDIATE", "WET"):
            desires.append(Desire(GoalType.REACT_TO_RAIN, 0.85,
                                  reason=f"rain {ctx.rain_probability:.0%} — switch compound"))

        # ── Undercut defence ────────────────────────────────────────────
        for num, rival in b.rivals.items():
            if rival.is_on_undercut and rival.gap_to_self < 8.0 and rival.position > s.position:
                desires.append(Desire(GoalType.DEFEND_FROM_UNDERCUT, 0.80,
                                      target_driver=num,
                                      reason=f"{rival.name} undercut — push hard"))

        # ── Strategic pit window ────────────────────────────────────────
        if s.tire.predicted_life <= 3 and ctx.laps_remaining > 3:
            p = 0.72 + (1.0 - personality.patience) * 0.15
            desires.append(Desire(GoalType.PIT_NOW, p, reason="entering tire cliff window"))

        # ── Racing goals ────────────────────────────────────────────────
        if s.gap_ahead is not None and s.gap_ahead < 1.0:
            p = 0.55 + personality.aggression * 0.30
            desires.append(Desire(GoalType.GAIN_POSITION, p,
                                  reason=f"car ahead within {s.gap_ahead:.2f}s"))

        if s.gap_behind is not None and s.gap_behind < 2.0:
            desires.append(Desire(GoalType.PROTECT_POSITION, 0.50 + personality.defensiveness * 0.30,
                                  reason="car behind closing"))

        # ── Long-horizon goals ──────────────────────────────────────────
        if s.position > 10:
            desires.append(Desire(GoalType.SCORE_POINTS, 0.40))
        elif s.position == 1:
            desires.append(Desire(GoalType.WIN_RACE, 0.35))

        # Always check team-mate (affects risk appetite)
        for num, rival in b.rivals.items():
            if rival.team == s.team:
                if rival.position < s.position:
                    desires.append(Desire(GoalType.BEAT_TEAM_MATE, 0.30, target_driver=num))

        return sorted(desires, key=lambda d: d.priority, reverse=True)
