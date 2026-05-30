# BDI Driver Agents — Full Implementation Specification

**Branch:** `feature/bdi-agents`  
**Base:** `main` @ initial commit  
**Goal:** Replace the monolithic `AIOpponentController` with 20 autonomous BDI driver agents, each reasoning about the race independently. Add a `RaceEngineerAgent` that surfaces structured recommendations to the player.

---

## 1. What Is BDI and Why Does It Fit F1?

BDI (Belief-Desire-Intention) is an agent architecture where each agent:

- **Believes** something about the world (its belief base, updated each lap)
- **Desires** certain outcomes (a ranked goal set)
- **Intends** a specific plan it has committed to (an intention stack)

F1 is a perfect fit because every real driver:
- Has a *mental model* of the race (gap to rivals, tire condition, fuel load, track evolution) — **Beliefs**
- Has *competing goals* (win the race, protect the car, beat team-mate, manage championship) — **Desires**
- *Commits to a plan* that spans multiple laps (undercut window, safety car gamble, push to the end) — **Intentions**

The current `AIOpponentController` is a **stateless reactive system**: every lap it queries raw numbers and returns an action. There is no memory, no goal tracking, no multi-lap commitment. This causes:
- Oscillating pit decisions (evaluated fresh each lap)
- No personality differences in racing style (VER and OCO use identical logic)
- No rival modelling (driver doesn't know rival is about to undercut)
- No adaptation (driver doesn't notice their tires are degrading faster than predicted)

---

## 2. Current State — What Needs to Change

### Files that implement AI today

| File | What it does | Problem |
|------|-------------|---------|
| `simulation/ai_opponents.py` | `AIOpponentController` — single class for all 20 drivers | Stateless, no per-driver memory, no goal stack |
| `simulation/engine.py` | `_process_ai_pit_decisions()`, `_process_overtakes()` | Calls controller in a loop, no BDI cycle |
| `simulation/qualifying.py` | `DRIVER_ROSTER` with tier/wet_skill — separate from race AI | Disconnected from race driver attributes |

### What `AIOpponentController` currently does well (keep it)

- Look-ahead stint time estimate (`_stint_time_estimate`) — this is good physics, reuse it
- Weather-forced compound switching with hysteresis — correct, reuse it
- Overtake probability model — correct structure, enhance with beliefs
- Compound selection (`_choose_compound`) — reuse with personality weighting

### What it does wrong (replace with BDI)

- No per-driver state across laps (no memory of "I tried to overtake Norris 3 times")
- No goal commitment (driver re-evaluates from scratch every lap)
- No inter-driver reasoning ("Verstappen is on old softs, he'll pit soon")
- No personality-driven plan selection ("Hamilton calculates; Tsunoda attacks")
- Pit decisions are independent of what rivals are doing

---

## 3. BDI Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │                RaceEngine                    │
                    │  advance_lap():                              │
                    │    for each DriverAgent:                     │
                    │      agent.perceive(race_state)              │
                    │      agent.deliberate()                      │
                    │      action = agent.execute()                │
                    │      apply action to CarState                │
                    └─────────────────────────────────────────────┘
                                          │
                         ┌────────────────┴─────────────────┐
                         │                                  │
                ┌────────▼────────┐             ┌──────────▼──────────┐
                │  DriverAgent    │ × 19        │  RaceEngineerAgent  │
                │  (AI cars)      │             │  (player-facing)    │
                └────────┬────────┘             └──────────┬──────────┘
                         │                                  │
              ┌──────────┼──────────┐                       │ returns
              │          │          │                  Recommendation
         BeliefBase  DesireSet  IntentionStack               │
              │          │          │                  surfaced in
          (per-lap    (priority   (committed           Dashboard UI
          updated)     ranked)    multi-lap
                                   plan)
```

---

## 4. Module Structure — New Files to Create

```
project/backend/app/
├── simulation/
│   ├── ai_opponents.py          ← KEEP (Driver dataclass, DRIVER_DATABASE, look-ahead math)
│   ├── engine.py                ← MODIFY (_process_ai_pit_decisions replaced by agent cycle)
│   └── ...
│
└── agents/                      ← NEW PACKAGE
    ├── __init__.py
    ├── base.py                  ← BDIAgent abstract base class
    ├── beliefs.py               ← BeliefBase dataclass + per-driver belief state
    ├── desires.py               ← Goal / Desire definitions + priority logic
    ├── plans.py                 ← Plan library (named plans with trigger + body)
    ├── driver_agent.py          ← DriverAgent (the 19 AI drivers)
    ├── engineer_agent.py        ← RaceEngineerAgent (player-facing, read-only)
    └── personality.py           ← Personality profiles mapped to Driver attributes
```

---

## 5. Belief Base — `agents/beliefs.py`

The belief base is everything a driver **thinks is true** about the current race situation. It is updated at the start of each lap from `CarState` and `RaceState`.

```python
from dataclasses import dataclass, field
from typing import Optional, Dict, List


@dataclass
class RivalBelief:
    """What this driver believes about one rival car."""
    driver_number: int
    name: str
    team: str
    position: int
    gap_to_self: float           # + = rival ahead, - = rival behind
    tire_compound: str
    tire_age: int
    estimated_tire_life: int     # predicted laps remaining on their current tire
    likely_pit_window: Optional[int]  # lap they're expected to pit (None = unknown)
    is_on_undercut: bool         # rival pitted recently and is on fresher rubber
    laps_down: int               # 0 = same lap, 1+ = lapped


@dataclass
class TireBelief:
    """Driver's model of their own tire state."""
    compound: str
    age: int
    wear: float                  # 0.0 – 1.0
    predicted_life: int          # laps left before cliff (from physics model)
    deg_rate: float              # actual degradation rate observed this stint
    expected_deg_rate: float     # predicted rate at race start (baseline)
    degrading_faster: bool       # True if deg_rate > expected by >15%


@dataclass
class RaceContextBelief:
    """High-level race situation beliefs."""
    current_lap: int
    total_laps: int
    laps_remaining: int
    flag: str                    # "GREEN", "SAFETY_CAR", "VSC", "RED", "YELLOW"
    is_safety_car: bool
    rain_probability: float      # 0.0 – 1.0 forecast for next 10 laps
    track_dampness: float        # 0.0 dry – 1.0 flooded
    track_temperature: float
    pit_loss_time: float         # seconds lost in a pit stop at this circuit
    undercut_value: float        # estimated time gain from undercut at current circuit


@dataclass
class SelfBelief:
    """Driver's model of their own current state."""
    position: int
    gap_to_leader: float
    gap_ahead: Optional[float]   # gap to car in front (None if P1)
    gap_behind: Optional[float]  # gap to car behind (None if last)
    tire: TireBelief
    fuel: float
    ers_battery: float
    pits_done: int
    compound_obligation_met: bool  # has used ≥2 dry compounds
    track_limit_warnings: int


@dataclass
class BeliefBase:
    """
    Complete belief state for one driver agent.
    Updated every lap via perceive().
    """
    self_belief: SelfBelief
    race_context: RaceContextBelief
    rivals: Dict[int, RivalBelief] = field(default_factory=dict)

    # Trend tracking — compares current lap to N laps ago
    gap_ahead_trend: float = 0.0     # positive = gap to car ahead is closing
    gap_behind_trend: float = 0.0    # positive = car behind is closing on us

    # Stint tracking
    stint_start_lap: int = 0
    stints_completed: List[str] = field(default_factory=list)  # ["SOFT", "MEDIUM"]

    # Plan memory — what was tried and failed
    failed_overtake_count: Dict[int, int] = field(default_factory=dict)  # target_number → attempts
    last_overtake_attempt_lap: Dict[int, int] = field(default_factory=dict)

    def update_from_state(self, driver_number: int, race_state, track) -> None:
        """
        Re-derive all beliefs from the current race_state.
        Called at the start of each lap (perceive step).
        """
        # Implementation: iterate race_state.leaderboard, compute gaps,
        # update rival beliefs, compare tire deg to baseline, etc.
        pass
```

### Key belief computations

| Belief | How computed |
|--------|-------------|
| `tire.predicted_life` | `stint_limit - tire_age` from `AIOpponentController._STINT_LIMITS` |
| `tire.degrading_faster` | Compare actual lap time delta vs baseline physics model |
| `rival.likely_pit_window` | `rival.tire_age / rival_predicted_life * total_laps` |
| `rival.is_on_undercut` | `rival.pits > prev_rival_pits` (just pitted) AND `rival.position > self.position - 2` |
| `undercut_value` | `pit_loss - (fresh_tire_delta * laps_ahead_of_rival)` |
| `gap_ahead_trend` | `gap_ahead[lap-1] - gap_ahead[lap]` (positive = closing) |

---

## 6. Desires — `agents/desires.py`

A desire is a **goal** the agent wants to achieve. Multiple desires can be active simultaneously. The deliberation step ranks them by priority given current beliefs.

```python
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

    def deliberate(self, beliefs: 'BeliefBase', personality: 'Personality') -> list[Desire]:
        """
        Given current beliefs and driver personality, return a priority-ranked
        list of active desires. This is the core of BDI deliberation.

        Rules (examples):
        - Safety car is active → REACT_TO_SAFETY_CAR gets priority 0.9
        - Tire wear > 80%      → PIT_NOW gets priority 0.85
        - Rival pitted 2 laps ago and is closing → DEFEND_FROM_UNDERCUT priority 0.80
        - Gap ahead < 0.5s    → GAIN_POSITION gets priority 0.7 * aggression
        - Compound rule unmet with < 15 laps left → NAIL_COMPOUND_RULE priority 0.95
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
            if rival.team == b.self_belief.tire.compound:  # placeholder: check same team
                if rival.position < s.position:
                    desires.append(Desire(GoalType.BEAT_TEAM_MATE, 0.30, target_driver=num))

        return sorted(desires, key=lambda d: d.priority, reverse=True)
```

---

## 7. Plan Library — `agents/plans.py`

Each plan has:
- **Name** — identifier
- **Applicable?** — precondition (given beliefs + top desire, is this plan relevant?)
- **Body** — sequence of per-lap actions the agent commits to
- **Completion** — condition that ends the plan
- **Failure** — condition that aborts the plan

```python
from dataclasses import dataclass, field
from typing import Callable, Optional, Any
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
        beliefs: 'BeliefBase',
        personality: 'Personality',
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

        # Default: do nothing special for 1 lap
        return Plan(PlanName.FOLLOW_AND_WAIT, [PlanStep("NONE")], max_laps=1)

    @staticmethod
    def _choose_compound(beliefs: 'BeliefBase', personality: 'Personality') -> str:
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
```

---

## 8. Personality System — `agents/personality.py`

Personality transforms `Driver` attributes (skill, aggression, consistency) into plan-selection weights. Different personalities = genuinely different racing styles.

```python
from dataclasses import dataclass
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
        desires: list[Desire],
        beliefs: BeliefBase,
        personality: Personality,
        current_plan: 'Plan | None',
    ) -> PlanName | None:
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
            GoalType.GAIN_POSITION:         PlanName._pick_attack_plan(beliefs, personality),
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
```

---

## 9. Driver Agent — `agents/driver_agent.py`

```python
from dataclasses import dataclass, field
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

    Each lap:
      1. perceive()    — update BeliefBase from race_state
      2. deliberate()  — rank desires given beliefs + personality
      3. select_plan() — choose/continue a Plan from the library
      4. execute()     — return the current plan step as an AgentAction
    """

    def __init__(self, driver: Driver, rng: random.Random):
        self.driver = driver
        self.personality = get_personality(driver.number)
        self.rng = rng

        self.beliefs = BeliefBase(
            self_belief=SelfBelief(...),     # initialised in perceive()
            race_context=RaceContextBelief(...),
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
```

---

## 10. Race Engineer Agent — `agents/engineer_agent.py`

The race engineer agent does **not** control a car. It watches the player's car and the full race state, then produces structured recommendations (beliefs/desires surfaced in the Dashboard UI).

```python
from dataclasses import dataclass
from typing import Optional, Any

from .beliefs import BeliefBase
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
    pit_window: Optional[tuple[int, int]]  # (earliest_lap, latest_lap) or None


class RaceEngineerAgent:
    """
    BDI agent that watches the player's car and emits recommendations.
    
    Beliefs: same BeliefBase as DriverAgent but for the player car.
    Desires: ranked goals for the player (win position, meet compound rule, etc.)
    Intentions: produce a recommendation (does NOT autonomously act).
    
    In v2 this replaces the inline scRecommendation useMemo in Dashboard.tsx.
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
        self.beliefs = BeliefBase(...)
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
        This is what replaces the inline scRecommendation in Dashboard.tsx.
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
            compound = "HARD" if "HARD" not in s.compound_obligation_met else "MEDIUM"
            return EngineerRecommendation(
                priority="URGENT", action="PIT_NOW", compound=compound,
                headline=f"Compound rule — must use {compound}",
                rationale=f"Only {b.race_context.laps_remaining} laps left. Must pit to fulfil obligation.",
                confidence=0.99,
                pit_window=(b.race_context.current_lap, b.race_context.current_lap + 3),
            )

        # Default info recommendation
        return EngineerRecommendation(
            priority="INFO", action="MONITOR", compound=None,
            headline=f"Monitor — {top.goal.name.replace('_', ' ').lower()}",
            rationale=top.reason,
            confidence=0.70, pit_window=None,
        )
```

---

## 11. Engine Integration — Changes to `engine.py`

### Replace `_process_ai_pit_decisions` and `_process_overtakes`

```python
# engine.py — new imports
from ..agents.driver_agent import DriverAgent, AgentAction
from ..agents.engineer_agent import RaceEngineerAgent

class RaceEngine:
    def __init__(self, ...):
        # ... existing init ...

        # Create one DriverAgent per AI car
        self._driver_agents: Dict[int, DriverAgent] = {}
        for car in self._cars:
            if car.driver.number != self._player_car.driver.number:
                self._driver_agents[car.driver.number] = DriverAgent(
                    driver=car.driver,
                    rng=self._rng,
                )

        # Race engineer agent for player recommendations
        self._engineer_agent = RaceEngineerAgent()

        # Store last BDI state for API serialisation
        self._bdi_states: Dict[int, dict] = {}
        self._engineer_recommendation: dict = {}

    def advance_lap(self, actions=None) -> RaceState:
        # ... existing lap logic ...

        # ── BDI agent cycle (replaces _process_ai_pit_decisions + _process_overtakes) ──
        self._run_agent_cycle()

        # ── Race engineer recommendation for player ──
        self._run_engineer_cycle()

        # ... rest of advance_lap ...

    def _run_agent_cycle(self) -> None:
        """Run one BDI tick for all AI driver agents."""
        race_state = self.get_state()

        for driver_number, agent in self._driver_agents.items():
            car = self._get_car(driver_number)
            if car is None or not car.alive or car.finished:
                continue

            # BDI cycle
            agent.perceive(race_state)
            agent.deliberate()
            agent.select_plan()
            action: AgentAction = agent.execute()

            # Store BDI state for API
            self._bdi_states[driver_number] = agent.bdi_state()

            # Apply action to simulation
            self._apply_agent_action(car, action)

    def _apply_agent_action(self, car: CarState, action: AgentAction) -> None:
        """
        Translate an AgentAction into simulation effects.
        This is the bridge between BDI output and physics engine.
        """
        if action.action_type == "PIT":
            # Queue a pit stop (same path as player pit but for AI)
            self._execute_ai_pit(car, action.compound)

        elif action.action_type == "PUSH":
            # Increase lap pace — intensity > 1.0 adds time risk
            # (tire wear increases, incident probability increases)
            car._pace_multiplier = action.intensity  # consumed by physics engine

        elif action.action_type == "MANAGE":
            # Reduce pace — intensity < 1.0 slows down, saves tires
            car._pace_multiplier = action.intensity

        elif action.action_type == "ATTACK":
            # Attempt overtake (calls existing overtake logic)
            self._attempt_agent_overtake(car, action)

        elif action.action_type == "DEFEND":
            # Defensive driving — block inside line (increases overtake difficulty)
            car._defending = True

        # NONE: no special action this lap

    def _run_engineer_cycle(self) -> None:
        """Update the race engineer agent and store its recommendation."""
        self._engineer_agent.perceive(self._player_car.driver.number, self.get_state())
        self._engineer_agent.deliberate()
        rec = self._engineer_agent.recommend()
        self._engineer_recommendation = {
            "priority": rec.priority,
            "action": rec.action,
            "compound": rec.compound,
            "headline": rec.headline,
            "rationale": rec.rationale,
            "confidence": rec.confidence,
            "pit_window": list(rec.pit_window) if rec.pit_window else None,
        }
```

### Changes to `RaceState.to_dict()`

Add two new top-level fields:

```python
def to_dict(self) -> dict:
    return {
        # ... existing fields ...
        "bdi_states": self._bdi_states,           # per-driver BDI state
        "engineer_recommendation": self._engineer_recommendation,  # player engineer
    }
```

---

## 12. Frontend Integration

### New API types — `api.ts`

```typescript
export interface BDIState {
  driver_number: number;
  top_desire: string | null;          // e.g. "GAIN_POSITION"
  top_desire_reason: string;          // e.g. "car ahead within 0.45s"
  current_plan: string | null;        // e.g. "ATTACK_DRS_ZONE"
  plan_step: number;
  tire_degrading_faster: boolean;
  gap_ahead_trend: number;            // positive = closing
}

export interface EngineerRecommendation {
  priority: "URGENT" | "OPPORTUNITY" | "INFO";
  action: "PIT_NOW" | "STAY_OUT" | "PUSH" | "MANAGE" | "MONITOR";
  compound: string | null;
  headline: string;
  rationale: string;
  confidence: number;
  pit_window: [number, number] | null;
}

// Extend RaceState
export interface RaceState {
  // ... existing fields ...
  bdi_states?: Record<number, BDIState>;
  engineer_recommendation?: EngineerRecommendation;
}
```

### Dashboard.tsx changes

Replace the inline `scRecommendation useMemo` with the `engineer_recommendation` from the race state:

```typescript
// Instead of:
const scRecommendation = useMemo(() => { /* inline calculation */ }, [...]);

// Use:
const engineerRec = raceState?.engineer_recommendation ?? null;

// Pass to SCNotification:
<SCNotification
  recommendation={{
    compound: engineerRec?.compound ?? "MEDIUM",
    reason:   engineerRec?.rationale ?? "",
  }}
  ...
/>
```

Add a new **"BDI Debug" panel** in Strategy tab (dev-only toggle):

```typescript
// Shows: top desire + current plan for each car
// Useful for debugging agent behaviour during development
{isDev && (
  <BDIDebugPanel bdiStates={raceState?.bdi_states} leaderboard={leaderboard} />
)}
```

Show engineer recommendation in the Driver messages tab:

```typescript
{engineerRec && engineerRec.priority !== "INFO" && (
  <EngineerCard
    rec={engineerRec}
    onPitNow={() => handlePitNow(engineerRec.compound ?? selectedPitTire)}
  />
)}
```

---

## 13. Implementation Phases

### Phase 1 — Belief Base + Perceive (Week 1)
**Goal:** Each driver has a working `BeliefBase` updated every lap. Nothing changes in race behaviour yet.

- [ ] Create `agents/` package with `__init__.py`
- [ ] Implement `beliefs.py` — all dataclasses, `update_from_state()` method
- [ ] Implement `personality.py` — `Personality`, `DRIVER_PERSONALITIES`
- [ ] Wire `DriverAgent.perceive()` into `engine.py` (after existing `_update_gaps()`)
- [ ] Add `bdi_states` to `RaceState.to_dict()` output
- [ ] TypeScript: add `BDIState` type, log to console during dev
- **Test:** Run a race, verify `bdi_states` appears in API response with correct beliefs

### Phase 2 — Desires + Deliberation (Week 1-2)
**Goal:** Agents have ranked goal lists each lap. Still using old `AIOpponentController` for actions.

- [ ] Implement `desires.py` — `GoalType`, `Desire`, `DesireSet.deliberate()`
- [ ] Add `deliberate()` to `DriverAgent`, store `self.desires`
- [ ] Expose `top_desire` and `top_desire_reason` in `bdi_states` API output
- [ ] **Dashboard:** Show `top_desire` under each driver in leaderboard (small badge, dev mode)
- **Test:** Verify that Hamilton's desire set differs from Tsunoda's under identical race conditions

### Phase 3 — Plan Library + Intention Selection (Week 2)
**Goal:** Agents commit to multi-lap plans. `_process_ai_pit_decisions` is replaced.

- [ ] Implement `plans.py` — `Plan`, `PlanStep`, `PlanLibrary.build()`
- [ ] Implement `personality.py` — `PlanSelector.select()`
- [ ] Implement `DriverAgent.select_plan()` and `execute()`
- [ ] Implement `engine._apply_agent_action()` and `engine._run_agent_cycle()`
- [ ] Remove `engine._process_ai_pit_decisions()` (archived, not deleted)
- [ ] Add `_pace_multiplier` to `CarState`, consumed by `physics.py` lap time calc
- **Test:** Verify SC pit windows trigger `PIT_UNDER_SC` plan, not just raw pit decision

### Phase 4 — Overtake Plans (Week 2-3)
**Goal:** `ATTACK_DRS_ZONE` and `UNDERCUT_RIVAL` plans replace `_process_overtakes`.

- [ ] Implement `_attempt_agent_overtake()` in `engine.py`
- [ ] Wire `ATTACK` action to existing overtake probability model
- [ ] Add `UNDERCUT_RIVAL` plan logic — triggers pit before rival, pushes on fresh rubber
- [ ] Remove `engine._process_overtakes()` (archived)
- [ ] Test: Verify cooldown still works (plan `max_laps` limits how often plans repeat)

### Phase 5 — Race Engineer Agent (Week 3)
**Goal:** `RaceEngineerAgent` replaces the inline `scRecommendation` useMemo in Dashboard.

- [ ] Implement `engineer_agent.py` fully
- [ ] Wire into `engine._run_engineer_cycle()`
- [ ] Expose `engineer_recommendation` in `RaceState.to_dict()`
- [ ] TypeScript: `EngineerRecommendation` type
- [ ] Dashboard: replace `scRecommendation` useMemo with `raceState.engineer_recommendation`
- [ ] Dashboard: new `EngineerCard` component for non-SC recommendations
- **Test:** Race past a tire cliff, verify engineer recommends pit before tire failure

### Phase 6 — Season-Level Beliefs (Future)
- Agent belief base extended with `ChampionshipBelief`
- Agents know rival championship gap → affects risk tolerance
- `RaceEngineerAgent` gains `SeasonContextBelief` → informs recommendations
- Season endpoints: `/season/start`, `/season/next-race`

---

## 14. Testing Plan

### Unit tests — `tests/agents/`

```
test_beliefs.py       — BeliefBase.update_from_state() with fixture race states
test_desires.py       — DesireSet.deliberate() returns correct ranked goals
test_plans.py         — PlanLibrary.build() produces correct PlanSteps
test_driver_agent.py  — Full BDI cycle: perceive→deliberate→select→execute
test_engineer.py      — EngineerAgent.recommend() matches expected priority
```

### Integration tests

```
test_engine_bdi.py    — Run 20-lap race, verify:
                         - No agent requests pit in last 2 laps (existing guard preserved)
                         - SC event triggers PIT_UNDER_SC plan within 1 lap for >50% of cars
                         - HAM and TSU produce different plan sequences in identical conditions
                         - Compound obligation fulfilled before lap N-10 for all cars
```

### Regression tests

Run the existing race engine tests against the old hardcoded controller output to ensure:
- Average finishing position spread is similar (BDI shouldn't make all cars pit simultaneously)
- DNF rate unchanged
- Overtake count per race unchanged (within ±20%)

---

## 15. Files Summary

| File | Status | Action |
|------|--------|--------|
| `agents/__init__.py` | New | Create |
| `agents/base.py` | New | Create (abstract BDIAgent) |
| `agents/beliefs.py` | New | Create |
| `agents/desires.py` | New | Create |
| `agents/plans.py` | New | Create |
| `agents/driver_agent.py` | New | Create |
| `agents/engineer_agent.py` | New | Create |
| `agents/personality.py` | New | Create |
| `simulation/engine.py` | Existing | Modify (_run_agent_cycle, _run_engineer_cycle) |
| `simulation/ai_opponents.py` | Existing | Keep (Driver, DRIVER_DATABASE, look-ahead math reused) |
| `simulation/qualifying.py` | Existing | Minor: use `DRIVER_PERSONALITIES` for quali aggression |
| `services/api.ts` | Frontend | Add BDIState, EngineerRecommendation types |
| `pages/Dashboard.tsx` | Frontend | Replace scRecommendation, add EngineerCard |
| `components/TrackMap.tsx` | Frontend | Optional: show top_desire as tooltip on car dot |
| `tests/agents/` | New | All unit + integration tests |

---

## 16. Key Design Decisions

### Why keep `AIOpponentController` at all?
The look-ahead stint estimate (`_stint_time_estimate`) and `_estimate_deg()` are solid physics — they're reused inside `PlanLibrary._choose_compound()` and `BeliefBase.update_from_state()`. Only the decision loop is replaced.

### Why not use a full STRIPS planner?
A full symbolic planner (STRIPS/PDDL) is overkill for a time-pressured sim where the belief state changes every lap. A curated plan library with personality-weighted selection gives full control over racing realism without unpredictable planner outputs.

### Why commitment matters
Without commitment, an agent that decides "pit next lap" will re-evaluate before pitting and may change its mind (the current bug). With `IntentionStack`, once `PIT_THIS_LAP` is selected, the agent commits and executes regardless of small belief changes on the next lap.

### Why personality over skill alone
Two drivers with `skill=0.90` should race completely differently. VER at 0.90 attacks every gap. ALO at 0.90 waits for the perfect moment. `Personality` encodes this orthogonally to raw skill level.

### Autonomy boundary — player vs AI
The BDI agents are fully autonomous for AI cars. The `RaceEngineerAgent` is advisory-only for the player — it outputs recommendations, never actions. The player's car physics are identical to AI cars; only the decision loop differs (player via PIT NOW button, AI via `DriverAgent.execute()`).
