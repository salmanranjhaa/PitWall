"""
Desire generation — personality-driven thresholds.

Each driver now has different trigger points for desires based on their
DriverProfile sub-attributes (via Personality thresholds).
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .beliefs import BeliefBase
    from .personality import Personality


class GoalType(Enum):
    PIT_NOW = "PIT_NOW"
    REACT_TO_SAFETY_CAR = "REACT_TO_SAFETY_CAR"
    REACT_TO_RAIN = "REACT_TO_RAIN"
    NAIL_COMPOUND_RULE = "NAIL_COMPOUND_RULE"
    DEFEND_FROM_UNDERCUT = "DEFEND_FROM_UNDERCUT"
    GAIN_POSITION = "GAIN_POSITION"
    PROTECT_POSITION = "PROTECT_POSITION"
    EXTEND_STINT = "EXTEND_STINT"
    MANAGE_TIRES = "MANAGE_TIRES"
    CLOSE_GAP = "CLOSE_GAP"
    OPEN_GAP = "OPEN_GAP"
    WIN_RACE = "WIN_RACE"
    SCORE_POINTS = "SCORE_POINTS"
    BEAT_TEAM_MATE = "BEAT_TEAM_MATE"


@dataclass
class Desire:
    goal: GoalType
    priority: float  # 0.0 – 1.0
    reason: str = ""
    target_driver: Optional[int] = None


class DesireSet:
    """
    Generates desires each lap using PERSONALITY-DRIVEN thresholds.

    Key difference from v1: every threshold (tire wear trigger, attack gap,
    defence gap, rain switch, undercut range) is pulled from the Personality
    object, which in turn is auto-derived from each driver's DriverProfile
    sub-attributes.
    """

    def deliberate(self, beliefs: "BeliefBase", personality: "Personality") -> List[Desire]:
        """
        Given current beliefs and driver personality, return a priority-ranked
        list of active desires. This is the core of BDI deliberation.

        Personality-driven thresholds used:
          - personality.tire_pit_wear       → tire critical pit trigger
          - personality.attack_gap_threshold → gap (s) to start wanting to attack
          - personality.defence_gap_threshold → gap (s) to start defending
          - personality.rain_switch_threshold → rain probability for compound change
          - personality.stint_extension       → extra laps beyond predicted life
        """
        desires: List[Desire] = []
        b = beliefs
        ctx = b.race_context
        s = b.self_belief

        if ctx.flag == "RED":
            return []

        # ── Survival goals (highest priority) ────────────────────────
        # Tire critical: each driver has a different threshold
        # VER (tire_pit_wear=0.932): only pits when truly worn
        # TSU (tire_pit_wear=0.927): slightly earlier
        if s.tire.wear > personality.tire_pit_wear:
            desires.append(Desire(GoalType.PIT_NOW, 0.95, reason="tire critical"))

        # Compound obligation: experienced drivers plan ahead further
        # HAM (experience=98): triggers at 14 laps remaining
        # ANT (experience=69): triggers at 11 laps remaining
        compound_horizon = 10 + round(personality.calculation * 5)
        if not s.compound_obligation_met and ctx.laps_remaining < compound_horizon:
            desires.append(Desire(GoalType.NAIL_COMPOUND_RULE, 0.95,
                                  reason=f"must use 2nd compound, {ctx.laps_remaining}L left"))

        # ── Safety car / weather ─────────────────────────────────────
        if ctx.is_safety_car:
            # Risk-tolerant drivers value SC pit more highly
            sc_priority = 0.85 + personality.risk_tolerance * 0.05
            desires.append(Desire(GoalType.REACT_TO_SAFETY_CAR, sc_priority,
                                  reason="SC window — evaluate cheap pit"))

        # Rain reaction: each driver has a different rain threshold
        # HAM (rain_switch=0.895): stays out much longer on drys
        # ANT (rain_switch=0.872): switches sooner
        if ctx.rain_probability > personality.rain_switch_threshold and \
           s.tire.compound not in ("INTERMEDIATE", "WET"):
            desires.append(Desire(GoalType.REACT_TO_RAIN, 0.85,
                                  reason=f"rain {ctx.rain_probability:.0%} — switch compound"))

        # ── Undercut defence ─────────────────────────────────────────
        # Experienced defenders detect undercuts from further back
        undercut_range = 6.0 + personality.defensiveness * 4.0  # 6–10s
        for num, rival in b.rivals.items():
            if rival.is_on_undercut and rival.gap_to_self < undercut_range and \
               rival.position > s.position:
                desires.append(Desire(GoalType.DEFEND_FROM_UNDERCUT, 0.80,
                                      target_driver=num,
                                      reason=f"{rival.name} undercut — push hard"))

        # ── Strategic pit window ─────────────────────────────────────
        # Each driver's "cliff" sensitivity is different
        # Good tire managers can extend stint_extension laps beyond predicted life
        cliff_threshold = max(0, 3 - round(personality.stint_extension * 0.5))
        if s.tire.predicted_life <= cliff_threshold and ctx.laps_remaining > 3:
            p = 0.72 + (1.0 - personality.patience) * 0.15
            desires.append(Desire(GoalType.PIT_NOW, p, reason="entering tire cliff window"))

        # ── Racing goals ─────────────────────────────────────────────
        # Attack: each driver has a different gap threshold
        # VER (attack_gap=1.14): attempts from further back
        # PIA (attack_gap=1.08): waits until closer
        if s.gap_ahead is not None and s.gap_ahead < personality.attack_gap_threshold:
            p = 0.55 + personality.aggression * 0.30
            desires.append(Desire(GoalType.GAIN_POSITION, p,
                                  reason=f"car ahead within {s.gap_ahead:.2f}s"))

        # Defence: each driver has a different defence gap threshold
        # HAM (defence_gap=2.25): starts defending from 2.25s behind
        # ANT (defence_gap=2.10): only defends from closer
        if s.gap_behind is not None and s.gap_behind < personality.defence_gap_threshold:
            p = 0.50 + personality.defensiveness * 0.30
            desires.append(Desire(GoalType.PROTECT_POSITION, p,
                                  reason="car behind closing"))

        # ── Long-horizon goals ───────────────────────────────────────
        if s.position > 10:
            desires.append(Desire(GoalType.SCORE_POINTS, 0.40))
        elif s.position == 1:
            desires.append(Desire(GoalType.WIN_RACE, 0.35))

        # Team-mate rivalry: less team-oriented drivers care more
        for num, rival in b.rivals.items():
            if rival.team == s.team:
                if rival.position < s.position:
                    team_priority = 0.25 + (1.0 - personality.team_player) * 0.15
                    desires.append(Desire(GoalType.BEAT_TEAM_MATE, team_priority,
                                          target_driver=num))

        return sorted(desires, key=lambda d: d.priority, reverse=True)
