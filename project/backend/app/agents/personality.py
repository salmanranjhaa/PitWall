"""
Personality System — transforms Driver attributes into plan-selection weights.

Different personalities = genuinely different racing styles.
"""

from dataclasses import dataclass
from typing import List, Optional

from .beliefs import BeliefBase
from .desires import Desire, GoalType
from .plans import PlanName


@dataclass
class Personality:
    """
    Derived personality profile from Driver attributes.
    Used during deliberation and plan selection.
    """
    name: str               # driver name for logging
    aggression: float       # 0.0–1.0 — willingness to attack/risk
    patience: float         # 0.0–1.0 — willingness to wait for right moment
    defensiveness: float    # 0.0–1.0 — priority given to not losing positions
    risk_tolerance: float   # 0.0–1.0 — SC gambles, rain crossings, undercuts
    calculation: float      # 0.0–1.0 — uses look-ahead model vs gut feel
    team_player: float      # 0.0–1.0 — defers to team orders


# Pre-built personality profiles for each driver
# These are derived from Driver.aggression / consistency / skill

DRIVER_PERSONALITIES = {
    # VER: ultra-aggressive, low patience, high calculation
    1:  Personality("Verstappen",  aggression=0.92, patience=0.30, defensiveness=0.80,
                     risk_tolerance=0.85, calculation=0.90, team_player=0.40),
    # HAM: calculated, patient, defensive master, rain specialist
    44: Personality("Hamilton",    aggression=0.70, patience=0.88, defensiveness=0.90,
                     risk_tolerance=0.78, calculation=0.97, team_player=0.65),
    # LEC: fast but impulsive, high aggression, medium patience
    16: Personality("Leclerc",     aggression=0.85, patience=0.50, defensiveness=0.72,
                     risk_tolerance=0.80, calculation=0.75, team_player=0.55),
    # NOR: smooth, calculated, improving
    4:  Personality("Norris",      aggression=0.78, patience=0.70, defensiveness=0.75,
                     risk_tolerance=0.72, calculation=0.82, team_player=0.70),
    # PIA: cold, calculating, patient
    81: Personality("Piastri",     aggression=0.70, patience=0.80, defensiveness=0.70,
                     risk_tolerance=0.68, calculation=0.85, team_player=0.75),
    # ALO: chess player — extremely patient, calculated gambler
    14: Personality("Alonso",      aggression=0.78, patience=0.95, defensiveness=0.88,
                     risk_tolerance=0.90, calculation=0.97, team_player=0.30),
    # RUS: precise, slightly aggressive, low risk
    63: Personality("Russell",     aggression=0.78, patience=0.72, defensiveness=0.80,
                     risk_tolerance=0.68, calculation=0.88, team_player=0.72),
    # TSU: high aggression, low patience, medium calculation
    22: Personality("Tsunoda",     aggression=0.85, patience=0.35, defensiveness=0.65,
                     risk_tolerance=0.78, calculation=0.65, team_player=0.60),
    # SAI: consistent, calculated, well-rounded
    55: Personality("Sainz",       aggression=0.74, patience=0.78, defensiveness=0.80,
                     risk_tolerance=0.72, calculation=0.85, team_player=0.75),
    # ANT: rookie, aggressive, still learning patience
    12: Personality("Antonelli",   aggression=0.82, patience=0.45, defensiveness=0.68,
                     risk_tolerance=0.75, calculation=0.60, team_player=0.70),
    # STR: conservative, low aggression
    18: Personality("Stroll",      aggression=0.62, patience=0.70, defensiveness=0.72,
                     risk_tolerance=0.55, calculation=0.65, team_player=0.75),
    # GAS: aggressive, emotional, medium calculation
    10: Personality("Gasly",       aggression=0.80, patience=0.55, defensiveness=0.68,
                     risk_tolerance=0.72, calculation=0.70, team_player=0.60),
    # DOO: rookie, medium aggression, learning
    7:  Personality("Doohan",      aggression=0.72, patience=0.60, defensiveness=0.65,
                     risk_tolerance=0.65, calculation=0.60, team_player=0.70),
    # ALB: consistent, medium aggression, team player
    23: Personality("Albon",       aggression=0.72, patience=0.72, defensiveness=0.75,
                     risk_tolerance=0.65, calculation=0.75, team_player=0.80),
    # LAW: aggressive, risk-taker
    30: Personality("Lawson",      aggression=0.82, patience=0.50, defensiveness=0.68,
                     risk_tolerance=0.78, calculation=0.68, team_player=0.55),
    # HAD: rookie, medium stats across the board
    6:  Personality("Hadjar",      aggression=0.75, patience=0.60, defensiveness=0.68,
                     risk_tolerance=0.68, calculation=0.62, team_player=0.65),
    # HUL: experienced, calculated, conservative
    27: Personality("Hulkenberg",  aggression=0.68, patience=0.80, defensiveness=0.78,
                     risk_tolerance=0.60, calculation=0.85, team_player=0.70),
    # BOR: rookie, medium-low aggression
    5:  Personality("Bortoleto",   aggression=0.70, patience=0.65, defensiveness=0.68,
                     risk_tolerance=0.62, calculation=0.60, team_player=0.70),
    # BEA: rookie, aggressive when opportunity arises
    87: Personality("Bearman",     aggression=0.76, patience=0.58, defensiveness=0.70,
                     risk_tolerance=0.70, calculation=0.65, team_player=0.68),
    # OCO: calculated, medium aggression, team player
    31: Personality("Ocon",        aggression=0.72, patience=0.70, defensiveness=0.75,
                     risk_tolerance=0.65, calculation=0.78, team_player=0.72),
    # Default for remaining drivers (midfield template)
    0:  Personality("Default",     aggression=0.72, patience=0.62, defensiveness=0.70,
                     risk_tolerance=0.65, calculation=0.70, team_player=0.65),
}


def get_personality(driver_number: int) -> Personality:
    return DRIVER_PERSONALITIES.get(driver_number, DRIVER_PERSONALITIES[0])


class PlanSelector:
    """
    Maps (top_desire, beliefs, personality) → PlanName.
    This is the core of the BDI intention selection step.
    """

    @staticmethod
    def select(
        desires: List[Desire],
        beliefs: BeliefBase,
        personality: Personality,
        current_plan: Optional["Plan"],
    ) -> Optional[PlanName]:
        """
        Given ranked desires, current beliefs, and personality:
        1. If current plan is still valid → continue it (commitment)
        2. Otherwise, select the plan best matching the top desire

        Returns None if the agent should continue current plan unchanged.
        """
        # Commitment: don't drop a plan mid-execution unless overridden by urgent desire
        if current_plan and not current_plan.is_complete() and not current_plan.is_expired():
            top = desires[0] if desires else None
            # Only urgent desires (priority > 0.85) can interrupt a committed plan
            if top is None or top.priority < 0.85:
                return None  # continue current plan

        if not desires:
            return PlanName.MANAGE_MODE

        top_desire = desires[0]

        # Map desire → plan, weighted by personality
        mapping = {
            GoalType.PIT_NOW:               PlanName.PIT_THIS_LAP,
            GoalType.REACT_TO_SAFETY_CAR:   PlanName.PIT_UNDER_SC,
            GoalType.REACT_TO_RAIN:         PlanName.PIT_THIS_LAP,
            GoalType.NAIL_COMPOUND_RULE:    PlanName.PIT_THIS_LAP,
            GoalType.GAIN_POSITION:         PlanSelector._pick_attack_plan(beliefs, personality),
            GoalType.PROTECT_POSITION:      PlanName.DEFEND_PUSH,
            GoalType.DEFEND_FROM_UNDERCUT:  PlanName.PUSH_MODE,
            GoalType.EXTEND_STINT:          PlanName.EXTEND_STINT,
            GoalType.MANAGE_TIRES:          PlanName.MANAGE_MODE,
            GoalType.CLOSE_GAP:             PlanName.ATTACK_DRS_ZONE,
            GoalType.OPEN_GAP:              PlanName.PUSH_MODE,
            GoalType.WIN_RACE:              PlanName.PUSH_MODE,
            GoalType.SCORE_POINTS:          PlanName.MANAGE_MODE,
            GoalType.BEAT_TEAM_MATE:        PlanName.PUSH_MODE,
        }

        return mapping.get(top_desire.goal, PlanName.FOLLOW_AND_WAIT)

    @staticmethod
    def _pick_attack_plan(beliefs: BeliefBase, personality: Personality) -> PlanName:
        """Choose between DRS attack, braking attack, or undercut."""
        s = beliefs.self_belief
        # If gap is very small and we have DRS, try DRS zone attack
        if s.gap_ahead is not None and s.gap_ahead < 0.5:
            return PlanName.ATTACK_DRS_ZONE
        # If calculation is high, consider undercut
        if personality.calculation > 0.80 and s.gap_ahead is not None and s.gap_ahead < 3.0:
            return PlanName.UNDERCUT_RIVAL
        return PlanName.ATTACK_DRS_ZONE
