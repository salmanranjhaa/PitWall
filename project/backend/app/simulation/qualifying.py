"""
F1 Qualifying Simulation Engine

Simulates the 2026 Q1 / Q2 / Q3 knockout format (22 cars):
  Q1: 18 min, 22 cars → P17-22 eliminated
  Q2: 15 min, 16 cars → P11-16 eliminated
  Q3: 12 min, top 10 → sets grid positions 1-10

Key rules modelled:
  - Track evolution: lap times improve as rubber is laid down (~1.5% gain over session)
  - Low fuel: qualifying times ~2.7% faster than race reference
  - Q3 compound obligation: qualifiers must START the race on the tires they set their Q2 time on
  - Driver spread: ~2.5% from fastest to slowest qualifier
  - Random per-lap variation: σ ≈ 0.25% (realistic micro-variation)
  - Tire set allocation: 8 SOFT / 4 MEDIUM / 2 HARD per driver per weekend
  - Used set penalty: +0.3% lap time when reusing a set
"""

import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Driver roster — derived from the sim's single source of truth
# (simulation.ai_opponents.DRIVER_DATABASE) so qualifying, the race engine,
# and the API can never disagree about who drives for whom.
# tier: Champion / Experienced / Midfield / Rookie (from overall skill)
# ---------------------------------------------------------------------------
from .ai_opponents import DRIVER_DATABASE, TEAM_BASE_PACE

# Field-average car pace — car deltas in qualifying are computed around this
_PACE_MID = sum(TEAM_BASE_PACE.values()) / len(TEAM_BASE_PACE)


def _tier_for_skill(skill: float) -> str:
    if skill >= 0.92:
        return "Champion"
    if skill >= 0.87:
        return "Experienced"
    if skill >= 0.84:
        return "Midfield"
    return "Rookie"


DRIVER_ROSTER: List[Dict[str, Any]] = [
    {
        "name": d.name,
        "number": d.number,
        "team": d.team,
        "skill": d.skill,
        "tier": _tier_for_skill(d.skill),
        "wet_skill": d.wet_skill,
    }
    for d in DRIVER_DATABASE.values()
]

# Lap time penalty relative to SOFT (fastest compound)
COMPOUND_DELTA: Dict[str, float] = {
    "SOFT":   0.000,
    "MEDIUM": 0.008,
    "HARD":   0.015,
}

# F1 2025 tire allocation per driver per weekend
TIRE_ALLOCATION: Dict[str, int] = {"SOFT": 8, "MEDIUM": 4, "HARD": 2}

# Segment config
# 2026 format: 22 cars, six eliminated in each of Q1 and Q2
SEGMENT_CONFIG: Dict[str, Dict[str, int]] = {
    "Q1": {"cars": 22, "eliminate": 6, "duration": 18 * 60, "ticks": 9},
    "Q2": {"cars": 16, "eliminate": 6, "duration": 15 * 60, "ticks": 8},
    "Q3": {"cars": 10, "eliminate": 0, "duration": 12 * 60, "ticks": 6},
}
SEGMENTS = ["Q1", "Q2", "Q3"]


# ---------------------------------------------------------------------------
# Driver state dataclass
# ---------------------------------------------------------------------------

@dataclass
class QDriver:
    name: str
    number: int
    team: str
    skill: float
    tier: str = "Midfield"
    wet_skill: float = 0.88
    is_player: bool = False
    best_time: Optional[float] = None
    last_time: Optional[float] = None
    compound: str = "SOFT"
    laps_done: int = 0
    is_eliminated: bool = False
    q2_compound: Optional[str] = None
    # Tire set allocation: carries over across Q1/Q2/Q3
    sets_new: Dict[str, int] = field(default_factory=lambda: dict(TIRE_ALLOCATION))
    sets_used: Dict[str, int] = field(default_factory=lambda: {"SOFT": 0, "MEDIUM": 0, "HARD": 0})

    def available_sets(self, compound: str) -> Tuple[int, int]:
        """Returns (new_sets_remaining, used_sets_available) for compound."""
        return self.sets_new.get(compound, 0), self.sets_used.get(compound, 0)

    def use_set(self, compound: str) -> str:
        """Consume one tire set. Returns 'new' or 'used'. Raises ValueError if none left."""
        n, u = self.available_sets(compound)
        if n > 0:
            self.sets_new[compound] -= 1
            self.sets_used[compound] = self.sets_used.get(compound, 0) + 1
            return "new"
        elif u > 0:
            self.sets_used[compound] -= 1
            return "used"
        raise ValueError(f"No {compound} sets remaining")

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "name": self.name,
            "number": self.number,
            "team": self.team,
            "tier": self.tier,
            "wet_skill": round(self.wet_skill, 3),
            "best_time": round(self.best_time, 3) if self.best_time is not None else None,
            "last_time": round(self.last_time, 3) if self.last_time is not None else None,
            "compound": self.compound,
            "laps_done": self.laps_done,
            "is_player": self.is_player,
            "is_eliminated": self.is_eliminated,
            "q2_compound": self.q2_compound,
        }
        if self.is_player:
            d["sets_new"] = dict(self.sets_new)
            d["sets_used"] = dict(self.sets_used)
        return d


# ---------------------------------------------------------------------------
# Qualifying engine
# ---------------------------------------------------------------------------

class QualifyingEngine:
    """
    Turn-based qualifying simulation.

    Each 'tick' represents ~2 minutes of track time.
    AI cars autonomously decide when to go, following realistic timing patterns.
    Player manually triggers flying laps via player_flying_lap().
    """

    def __init__(
        self,
        track_name: str,
        reference_soft_time: float,
        player_team: str,
        player_driver_number: Optional[int] = None,
        random_seed: Optional[int] = None,
    ) -> None:
        self._rng = random.Random(random_seed)
        self.track_name = track_name
        # Qualifying pace: ~2.7% faster than race reference (low fuel)
        self._base_time = reference_soft_time * 0.973
        self.player_team = player_team
        self.player_driver_number = player_driver_number

        self._segment_idx: int = 0
        self._current_tick: int = 0
        self._max_ticks: int = 0
        self._track_evolution: float = 0.0   # 0 → 1 (more rubber = faster)
        self._segment_finished: bool = False
        self._qualifying_complete: bool = False
        self._starting_grid: List[Dict[str, Any]] = []
        # One flying lap allowed per time tick (realistic: ~2 min per tick, ~1.5 min per lap)
        self._player_lapped_this_tick: bool = False

        self._drivers: List[QDriver] = self._build_drivers()
        self._init_segment()

    # ------------------------------------------------------------------
    # Initialisation helpers
    # ------------------------------------------------------------------

    def _build_drivers(self) -> List[QDriver]:
        drivers = []
        player_assigned = False
        for d in DRIVER_ROSTER:
            # Exactly one player: without an explicit number, the first roster
            # driver of the team is the player and the teammate stays AI.
            is_player = (
                not player_assigned
                and d["team"] == self.player_team
                and (
                    self.player_driver_number is None
                    or d["number"] == self.player_driver_number
                )
            )
            if is_player:
                player_assigned = True
            drivers.append(QDriver(
                name=d["name"],
                number=d["number"],
                team=d["team"],
                skill=d["skill"],
                tier=d.get("tier", "Midfield"),
                wet_skill=d.get("wet_skill", 0.88),
                is_player=is_player,
            ))
        return drivers

    def _init_segment(self) -> None:
        """Reset per-segment counters. Tire sets carry over across segments."""
        cfg = SEGMENT_CONFIG[self.segment]
        self._current_tick = 0
        self._max_ticks = cfg["ticks"]
        self._segment_finished = False
        self._player_lapped_this_tick = False   # fresh segment → player can lap immediately
        for d in self._active_drivers:
            d.best_time = None
            d.last_time = None
            d.laps_done = 0
            d.compound = "SOFT"
            # NOTE: sets_new / sets_used intentionally NOT reset here

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def segment(self) -> str:
        return SEGMENTS[self._segment_idx]

    @property
    def time_remaining_s(self) -> int:
        cfg = SEGMENT_CONFIG[self.segment]
        tick_size = cfg["duration"] // cfg["ticks"]
        return max(0, cfg["duration"] - self._current_tick * tick_size)

    @property
    def _active_drivers(self) -> List[QDriver]:
        return [d for d in self._drivers if not d.is_eliminated]

    @property
    def _player(self) -> Optional[QDriver]:
        return next((d for d in self._drivers if d.is_player), None)

    # ------------------------------------------------------------------
    # Lap simulation
    # ------------------------------------------------------------------

    def _simulate_lap(self, driver: QDriver) -> float:
        """
        Simulate one flying lap for `driver` and return the lap time.

        Time = base × (1 + compound_penalty - skill_bonus - track_evo_bonus + noise)
        """
        compound_penalty = COMPOUND_DELTA.get(driver.compound, 0.0)
        evo_bonus = self._track_evolution * 0.015          # max −1.5% when fully rubbered
        # Modern F1 qualifying: the car dominates (±~1.4% across the field),
        # the driver is worth a few tenths on top (±~0.6%).
        team_pace = TEAM_BASE_PACE.get(driver.team, _PACE_MID)
        car_delta = (team_pace - _PACE_MID) / _PACE_MID
        skill_bonus = (driver.skill - 0.895) * 0.07
        noise = self._rng.gauss(0.0, 0.0025)
        lap_time = self._base_time * (1.0 + compound_penalty + car_delta - evo_bonus - skill_bonus + noise)
        lap_time = max(lap_time, self._base_time * 0.94)   # hard floor

        driver.last_time = lap_time
        driver.laps_done += 1
        if driver.best_time is None or lap_time < driver.best_time:
            driver.best_time = lap_time

        # Each lap adds rubber to the track
        self._track_evolution = min(1.0, self._track_evolution + 0.035)
        return lap_time

    # ------------------------------------------------------------------
    # AI timing strategy
    # ------------------------------------------------------------------

    def _ai_tick(self) -> None:
        """Decide which AI cars go out this tick using a realistic probability curve."""
        tick_frac = self._current_tick / self._max_ticks

        if tick_frac < 0.15:
            base_prob = 0.10   # very early — installations only
        elif tick_frac < 0.40:
            base_prob = 0.30   # first runs
        elif tick_frac < 0.65:
            base_prob = 0.45   # main attack laps
        elif tick_frac < 0.85:
            base_prob = 0.60   # late improvements
        else:
            base_prob = 0.15   # last tick, traffic risk

        for driver in self._active_drivers:
            if driver.is_player:
                continue
            urgency = 0.15 if driver.best_time is None else 0.0
            if self._rng.random() < (base_prob + urgency):
                self._simulate_lap(driver)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def advance_time(self) -> Dict[str, Any]:
        """Advance simulation by one time tick; AI cars may set lap times."""
        if self._segment_finished or self._qualifying_complete:
            return self.get_state()
        self._ai_tick()
        self._current_tick += 1
        self._player_lapped_this_tick = False   # new tick → player can lap again
        if self._current_tick >= self._max_ticks:
            self._segment_finished = True
        return self.get_state()

    def player_flying_lap(self, compound: str = "SOFT") -> Dict[str, Any]:
        """
        Execute a player flying lap with tire set tracking.
        Returns the normal state dict plus player_lap_time, is_personal_best, set_type_used.
        Used sets incur a +0.3% lap time penalty.
        """
        p = self._player
        if p is None or self._segment_finished or self._qualifying_complete:
            return self.get_state()

        # One lap per tick limit
        if self._player_lapped_this_tick:
            state = self.get_state()
            state["error"] = "Advance time before doing another lap (1 lap per tick)"
            return state

        # Check set availability
        n_new, n_used = p.available_sets(compound)
        if n_new + n_used == 0:
            state = self.get_state()
            state["error"] = f"No {compound} sets remaining for this weekend"
            return state

        p.compound = compound
        set_type = p.use_set(compound)
        self._player_lapped_this_tick = True
        prev_best = p.best_time

        # Simulate base lap time (updates p.best_time internally)
        raw_time = self._simulate_lap(p)

        # Apply used-set penalty after simulation
        if set_type == "used":
            lap_time = raw_time * 1.003
            p.last_time = lap_time
            # Correct best_time with penalised value
            if prev_best is None or lap_time < prev_best:
                p.best_time = lap_time
            else:
                p.best_time = prev_best
        else:
            lap_time = raw_time

        is_pb = prev_best is None or lap_time < (prev_best if prev_best is not None else float("inf"))

        state = self.get_state()
        state["player_lap_time"] = round(lap_time, 3)
        state["is_personal_best"] = is_pb
        state["player_compound"] = compound
        state["set_type_used"] = set_type
        return state

    def advance_segment(self) -> Dict[str, Any]:
        """
        Eliminate the slowest cars from the current segment and move to the next.
        After Q3 (or if Q3 is skipped), builds the starting grid.
        """
        if not self._segment_finished:
            return self.get_state()

        cfg = SEGMENT_CONFIG[self.segment]
        active = self._active_drivers
        sorted_active = sorted(active, key=lambda d: d.best_time if d.best_time is not None else 9999.0)

        # Q2 → Q3: record the compound used by Q3 qualifiers (race-start obligation)
        if self.segment == "Q2" and cfg["eliminate"] > 0:
            survivors = sorted_active[: len(sorted_active) - cfg["eliminate"]]
            for d in survivors:
                d.q2_compound = d.compound

        # Eliminate slowest
        if cfg["eliminate"] > 0:
            eliminated = sorted_active[len(sorted_active) - cfg["eliminate"] :]
            for d in eliminated:
                d.is_eliminated = True

        # Check if qualifying is complete
        if self._segment_idx >= len(SEGMENTS) - 1:
            self._build_starting_grid()
            self._qualifying_complete = True
            return self.get_state()

        # Move to next segment
        self._segment_idx += 1
        self._init_segment()
        return self.get_state()

    def get_state(self) -> Dict[str, Any]:
        """Full qualifying state snapshot."""
        cfg = SEGMENT_CONFIG[self.segment]
        classification = self._classification()
        p = self._player
        player_pos = next((e["position"] for e in classification if e.get("is_player")), None)

        return {
            "segment": self.segment,
            "segment_index": self._segment_idx,
            "time_remaining": self.time_remaining_s,
            "total_time": cfg["duration"],
            "tick": self._current_tick,
            "max_ticks": self._max_ticks,
            "track_evolution": round(self._track_evolution, 3),
            "classification": classification,
            "player_best": round(p.best_time, 3) if p and p.best_time is not None else None,
            "player_last": round(p.last_time, 3) if p and p.last_time is not None else None,
            "player_position": player_pos,
            "player_compound": p.compound if p else "SOFT",
            "player_sets_new": dict(p.sets_new) if p else {},
            "player_sets_used": dict(p.sets_used) if p else {},
            "player_can_lap": not self._player_lapped_this_tick,
            "segment_finished": self._segment_finished,
            "qualifying_complete": self._qualifying_complete,
            "starting_grid": self._starting_grid,
            "elimination_count": cfg["eliminate"],
            "safe_count": cfg["cars"] - cfg["eliminate"],
            "track_name": self.track_name,
        }

    # ------------------------------------------------------------------
    # Classification helpers
    # ------------------------------------------------------------------

    def _classification(self) -> List[Dict[str, Any]]:
        active = self._active_drivers
        sorted_d = sorted(active, key=lambda d: d.best_time if d.best_time is not None else 9999.0)
        cfg = SEGMENT_CONFIG[self.segment]
        safe_count = cfg["cars"] - cfg["eliminate"]
        pole_time = sorted_d[0].best_time if sorted_d and sorted_d[0].best_time else None

        result = []
        for pos, d in enumerate(sorted_d, 1):
            gap: Optional[float] = None
            if d.best_time is not None and pole_time is not None and pos > 1:
                gap = round(d.best_time - pole_time, 3)
            result.append({
                **d.to_dict(),
                "position": pos,
                "gap": gap,
                "in_danger": pos > safe_count,
            })
        return result

    def _build_starting_grid(self) -> None:
        """Construct the race starting grid from final qualifying results."""
        all_sorted = sorted(
            self._drivers,
            key=lambda d: d.best_time if d.best_time is not None else 9999.0,
        )
        self._starting_grid = [
            {
                "position": pos,
                "name": d.name,
                "number": d.number,
                "team": d.team,
                "best_time": round(d.best_time, 3) if d.best_time is not None else None,
                "q2_compound": d.q2_compound,
                "is_player": d.is_player,
            }
            for pos, d in enumerate(all_sorted, 1)
        ]
