"""
Personality System — derives BDI behaviour weights from DriverProfile.

The Personality is now auto-computed from the 10 sub-attributes in
DriverProfile, so each driver has genuinely different thresholds,
not just different priority weights.
"""

from dataclasses import dataclass
from typing import List, Optional

from .beliefs import BeliefBase
from .desires import Desire, GoalType
from .plans import PlanName


@dataclass
class Personality:
    """
    Derived personality profile that controls BDI deliberation thresholds.

    All fields are 0.0–1.0.  They are computed from DriverProfile
    sub-attributes, but can still be hand-overridden if needed.

    New in this version:
      - attack_gap_threshold:  gap (s) at which driver attempts overtake
      - defence_gap_threshold: gap (s) at which driver starts defending
      - tire_pit_wear:         wear % at which driver requests pit
      - rain_switch_threshold: rain probability that triggers compound change
      - commitment_override:   desire priority needed to interrupt a plan
      - stint_extension:       extra laps a driver can nurse tires beyond predicted life
    """
    name: str

    # ── Strategic personality (existing) ─────────────────────────────
    aggression: float           # willingness to attack/risk
    patience: float             # willingness to wait for right moment
    defensiveness: float        # priority given to not losing positions
    risk_tolerance: float       # SC gambles, rain crossings, undercuts
    calculation: float          # uses look-ahead model vs gut feel
    team_player: float          # defers to team orders

    # ── Threshold modifiers (NEW — driver-specific) ──────────────────
    attack_gap_threshold: float = 1.0     # gap (s) to start wanting to attack
    defence_gap_threshold: float = 2.0    # gap (s) to start defending
    tire_pit_wear: float = 0.90           # wear fraction that triggers PIT_NOW
    rain_switch_threshold: float = 0.65   # rain probability for compound change
    commitment_override: float = 0.85     # desire priority to interrupt a plan
    stint_extension: float = 0.0          # extra laps nurse beyond predicted life
    overtake_intensity: float = 1.15      # ATTACK plan pace multiplier
    push_intensity: float = 1.12          # PUSH plan pace multiplier
    manage_intensity: float = 0.85        # MANAGE plan pace multiplier


def build_personality_from_profile(profile) -> Personality:
    """
    Auto-derive a Personality from a DriverProfile.

    This is where the sub-attributes translate into real thresholds:
    - High overtaking → lower attack gap (attacks from further back)
    - High defending → lower defence gap (reacts earlier to threats)
    - High tire_management → later pit trigger + longer stint extension
    - High adaptability → stays out longer in rain
    - High control → higher commitment threshold (won't panic-switch)
    - High experience → more patience, better calculation
    """
    p = profile

    # ── Core personality axes ────────────────────────────────────────
    aggression = min(1.0, (p.overtaking * 0.6 + (100 - p.control) * 0.4) / 100.0)
    patience = min(1.0, (p.experience * 0.5 + p.tire_management * 0.3 + p.accuracy * 0.2) / 100.0)
    defensiveness = min(1.0, (p.defending * 0.6 + p.accuracy * 0.4) / 100.0)
    risk_tolerance = min(1.0, (p.overtaking * 0.3 + p.adaptability * 0.3 + (100 - p.accuracy) * 0.2 + p.start_skill * 0.2) / 100.0)
    calculation = min(1.0, (p.experience * 0.4 + p.accuracy * 0.3 + p.control * 0.3) / 100.0)
    team_player = min(1.0, (p.control * 0.4 + p.accuracy * 0.3 + (100 - p.overtaking) * 0.3) / 100.0)

    # ── Threshold derivations (the key improvement) ──────────────────

    # Attack gap: base 1.0s, aggressive/high-overtaking drivers attempt from further back
    # VER (overtaking=95): 1.0 + 0.15*0.95 = 1.14s gap
    # DOO (overtaking=76): 1.0 + 0.15*0.76 = 1.11s gap   (subtle diff)
    # But then modulated by patience: impatient drivers add more range
    overtake_norm = p.overtaking / 100.0
    patience_factor = 1.0 - patience  # impatient = higher factor
    attack_gap = 0.80 + overtake_norm * 0.25 + patience_factor * 0.20

    # Defence gap: high defenders react to threats from further back
    # HAM (defending=94): 1.5 + 0.94*0.8 = 2.25s
    # ANT (defending=75): 1.5 + 0.75*0.8 = 2.10s
    defend_norm = p.defending / 100.0
    defence_gap = 1.50 + defend_norm * 0.80

    # Tire pit trigger: base 0.85 wear, good tire managers delay further
    # HAM (tire_management=93): 0.85 + 0.093 = 0.943
    # TSU (tire_management=77): 0.85 + 0.077 = 0.927
    tire_norm = p.tire_management / 100.0
    tire_pit = 0.85 + tire_norm * 0.10

    # Rain threshold: high adaptability = stays out in rain longer
    # HAM (adaptability=97): 0.75 + 0.97*0.15 = 0.895  (very late switch)
    # ANT (adaptability=81): 0.75 + 0.81*0.15 = 0.872
    adapt_norm = p.adaptability / 100.0
    rain_thresh = 0.55 + adapt_norm * 0.20

    # Commitment override: experienced+controlled drivers don't panic-switch plans
    # ALO (control=90, experience=99): 0.80 + 0.045 + 0.049 = 0.894
    # LAW (control=76, experience=72): 0.80 + 0.038 + 0.036 = 0.874
    control_norm = p.control / 100.0
    exp_norm = p.experience / 100.0
    commitment = 0.80 + control_norm * 0.05 + exp_norm * 0.05

    # Stint extension: good tire managers can nurse tires 2-4 laps beyond predicted life
    # HAM (tire_management=93): 2 + 0.93*2 = 3.86 laps
    # TSU (tire_management=77): 2 + 0.77*2 = 3.54 laps
    stint_ext = 2.0 + tire_norm * 2.0

    # Push/Attack intensity: aggressive drivers push harder but risk more
    push_int = 1.08 + aggression * 0.08    # 1.08–1.16
    attack_int = 1.10 + aggression * 0.10  # 1.10–1.20
    manage_int = 0.90 - patience * 0.10    # 0.80–0.90 (patient = slower manage)

    return Personality(
        name=p.name,
        aggression=round(aggression, 3),
        patience=round(patience, 3),
        defensiveness=round(defensiveness, 3),
        risk_tolerance=round(risk_tolerance, 3),
        calculation=round(calculation, 3),
        team_player=round(team_player, 3),
        attack_gap_threshold=round(attack_gap, 3),
        defence_gap_threshold=round(defence_gap, 3),
        tire_pit_wear=round(tire_pit, 3),
        rain_switch_threshold=round(rain_thresh, 3),
        commitment_override=round(commitment, 3),
        stint_extension=round(stint_ext, 2),
        overtake_intensity=round(attack_int, 3),
        push_intensity=round(push_int, 3),
        manage_intensity=round(manage_int, 3),
    )


# Pre-built personality cache — populated on first access
_PERSONALITY_CACHE: dict = {}


def get_personality(driver_number: int) -> Personality:
    """
    Get a personality for a driver, auto-building from DriverProfile.

    Falls back to a default midfield personality if no profile exists.
    """
    if driver_number in _PERSONALITY_CACHE:
        return _PERSONALITY_CACHE[driver_number]

    # Import here to avoid circular dependency
    from simulation.driver_profile import get_profile

    profile = get_profile(driver_number)
    personality = build_personality_from_profile(profile)
    _PERSONALITY_CACHE[driver_number] = personality
    return personality


# ── Legacy support: DRIVER_PERSONALITIES dict ────────────────────────
# Some code may still reference this dict directly.
# Lazily populated from profiles on first access.

class _LazyPersonalityDict(dict):
    """Dict that auto-populates from DriverProfile on key access."""

    def __missing__(self, key):
        p = get_personality(key)
        self[key] = p
        return p

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default if default is not None else get_personality(0)


DRIVER_PERSONALITIES = _LazyPersonalityDict()


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
        # Commitment: use personality-specific override threshold
        if current_plan and not current_plan.is_complete() and not current_plan.is_expired():
            top = desires[0] if desires else None
            if top is None or top.priority < personality.commitment_override:
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
            GoalType.PROTECT_POSITION:      PlanSelector._pick_defend_plan(beliefs, personality),
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
        # Calculated drivers consider undercut from further back
        if personality.calculation > 0.80 and s.gap_ahead is not None and s.gap_ahead < 3.0:
            return PlanName.UNDERCUT_RIVAL
        return PlanName.ATTACK_DRS_ZONE

    @staticmethod
    def _pick_defend_plan(beliefs: BeliefBase, personality: Personality) -> PlanName:
        """Choose between pushing to open gap vs positional defence."""
        s = beliefs.self_belief
        # If gap behind is very small, try positional defence (block inside line)
        if s.gap_behind is not None and s.gap_behind < 0.5 and personality.defensiveness > 0.80:
            return PlanName.DEFEND_INSIDE_LINE
        # Otherwise push to open gap
        return PlanName.DEFEND_PUSH
