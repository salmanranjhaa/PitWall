"""
BDI Belief Base — everything a driver believes about the current race situation.

Updated at the start of each lap from CarState and RaceState.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from ..simulation.ai_opponents import AIOpponentController
from ..simulation.tracks import Track


# Reuse physics constants from the existing AI controller
_STINT_LIMITS = AIOpponentController._STINT_LIMITS
_DEG_RATES = AIOpponentController._DEG_RATES


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
    team: str
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
    stints_completed: List[str] = field(default_factory=list)

    # Plan memory — what was tried and failed
    failed_overtake_count: Dict[int, int] = field(default_factory=dict)
    last_overtake_attempt_lap: Dict[int, int] = field(default_factory=dict)

    # --- internal history for trend computation ---
    _prev_gap_ahead: Optional[float] = field(default=None, repr=False)
    _prev_gap_behind: Optional[float] = field(default=None, repr=False)
    _prev_self_pits: int = field(default=0, repr=False)
    _prev_rival_pits: Dict[int, int] = field(default_factory=dict, repr=False)
    _lap_time_history: List[float] = field(default_factory=list, repr=False)
    _history_max: int = field(default=5, repr=False)

    def update_from_state(
        self,
        driver_number: int,
        race_state: Any,
        track: Track,
    ) -> None:
        """
        Re-derive all beliefs from the current race_state.
        Called at the start of each lap (perceive step).
        """
        leaderboard = list(race_state.leaderboard)
        total_laps = race_state.total_laps
        current_lap = race_state.lap
        laps_remaining = total_laps - current_lap

        # Find self car
        self_car = None
        for car in leaderboard:
            if car.driver.number == driver_number:
                self_car = car
                break
        if self_car is None:
            return

        # --- Update race context ---
        weather = race_state.weather
        flag = race_state.flag
        flag_name = flag.name if hasattr(flag, "name") else str(flag)
        is_sc = flag_name in ("SAFETY_CAR", "VSC")

        # Rain probability = look at forecast or use current rain intensity as proxy
        rain_prob = 0.0
        if weather:
            rain_prob = getattr(weather, "rain_intensity", 0.0)
            # If rain is imminent, boost probability
            if weather.condition in ("DRIZZLE", "LIGHT_RAIN", "HEAVY_RAIN"):
                rain_prob = max(rain_prob, 0.5)

        track_temp = getattr(weather, "track_temp", 25.0) if weather else 25.0
        dampness = getattr(weather, "track_dampness", 0.0) if weather else 0.0

        # Undercut value = pit_loss - (fresh_tire_delta * laps_ahead_of_rival)
        # Simplified: just use pit_loss_time as base undercut value
        pit_loss = track.pit_loss_time
        undercut_val = pit_loss * 0.6  # simplified estimate

        self.race_context = RaceContextBelief(
            current_lap=current_lap,
            total_laps=total_laps,
            laps_remaining=laps_remaining,
            flag=flag_name,
            is_safety_car=is_sc,
            rain_probability=rain_prob,
            track_dampness=dampness,
            track_temperature=track_temp,
            pit_loss_time=pit_loss,
            undercut_value=undercut_val,
        )

        # --- Update self belief ---
        tire = self_car.tire
        compound = tire.compound if hasattr(tire, "compound") else tire.get("compound", "MEDIUM")
        age = tire.age if hasattr(tire, "age") else tire.get("age", 0)
        wear = tire.wear if hasattr(tire, "wear") else tire.get("wear", 0.0)

        stint_limit = _STINT_LIMITS.get(compound, 30)
        predicted_life = max(0, stint_limit - age)

        expected_deg = _DEG_RATES.get(compound, 0.040)

        # Actual degradation rate from lap time history
        actual_deg = self._compute_actual_deg_rate()
        degrading_faster = actual_deg > expected_deg * 1.15 and actual_deg > 0.001

        self_belief_tire = TireBelief(
            compound=compound,
            age=age,
            wear=wear,
            predicted_life=predicted_life,
            deg_rate=actual_deg,
            expected_deg_rate=expected_deg,
            degrading_faster=degrading_faster,
        )

        # Track lap time for degradation trend
        if self_car.lap_time > 0:
            self._lap_time_history.append(self_car.lap_time)
            if len(self._lap_time_history) > self._history_max:
                self._lap_time_history.pop(0)

        # Gap calculations
        gap_to_leader = self_car.gap_to_leader or 0.0
        gap_ahead = self_car.gap_to_next
        gap_behind = None

        # Find car behind to compute gap_behind
        sorted_by_pos = sorted(leaderboard, key=lambda c: c.position)
        self_idx = None
        for i, car in enumerate(sorted_by_pos):
            if car.driver.number == driver_number:
                self_idx = i
                break
        if self_idx is not None and self_idx + 1 < len(sorted_by_pos):
            behind_car = sorted_by_pos[self_idx + 1]
            # gap_behind = self.total_time - behind.total_time (positive = behind is closer)
            gap_behind = self_car.total_time - behind_car.total_time

        # Detect pit stop and update stints
        if self_car.pits > self._prev_self_pits:
            # Just pitted — record the previous compound as completed stint
            prev_compound = self.self_belief.tire.compound if hasattr(self, "self_belief") else compound
            if prev_compound not in self.stints_completed:
                self.stints_completed.append(prev_compound)
            self.stint_start_lap = current_lap
            self._lap_time_history.clear()

        self._prev_self_pits = self_car.pits

        # Compound obligation: ≥2 dry compounds used
        dry_compounds_used = {c for c in self.stints_completed if c in ("SOFT", "MEDIUM", "HARD")}
        if compound in ("SOFT", "MEDIUM", "HARD"):
            dry_compounds_used.add(compound)
        compound_obligation_met = len(dry_compounds_used) >= 2 or laps_remaining <= 2

        # Trend tracking
        if self._prev_gap_ahead is not None and gap_ahead is not None:
            self.gap_ahead_trend = self._prev_gap_ahead - gap_ahead  # positive = closing
        else:
            self.gap_ahead_trend = 0.0

        if self._prev_gap_behind is not None and gap_behind is not None:
            self.gap_behind_trend = gap_behind - self._prev_gap_behind  # positive = behind car closing
        else:
            self.gap_behind_trend = 0.0

        self._prev_gap_ahead = gap_ahead
        self._prev_gap_behind = gap_behind

        self.self_belief = SelfBelief(
            position=self_car.position,
            team=self_car.driver.team,
            gap_to_leader=gap_to_leader,
            gap_ahead=gap_ahead,
            gap_behind=gap_behind,
            tire=self_belief_tire,
            fuel=self_car.fuel,
            ers_battery=self_car.ers_battery,
            pits_done=self_car.pits,
            compound_obligation_met=compound_obligation_met,
            track_limit_warnings=self_car.track_limit_violations,
        )

        # --- Update rival beliefs ---
        new_rivals: Dict[int, RivalBelief] = {}
        for car in leaderboard:
            if car.driver.number == driver_number:
                continue
            if not car.alive:
                continue

            rival_tire = car.tire
            r_compound = rival_tire.compound if hasattr(rival_tire, "compound") else rival_tire.get("compound", "MEDIUM")
            r_age = rival_tire.age if hasattr(rival_tire, "age") else rival_tire.get("age", 0)

            r_stint_limit = _STINT_LIMITS.get(r_compound, 30)
            r_predicted_life = max(0, r_stint_limit - r_age)
            r_likely_pit = current_lap + r_predicted_life if r_predicted_life > 0 else None

            # Undercut detection: rival just pitted AND is close in position
            prev_pits = self._prev_rival_pits.get(car.driver.number, 0)
            just_pitted = car.pits > prev_pits
            position_diff = abs(car.position - self_car.position)
            is_undercut = just_pitted and position_diff <= 2

            # Gap to self
            gap_to_self = car.total_time - self_car.total_time

            # Laps down (rough estimate)
            ref_lap_time = track.reference_lap_times.get("MEDIUM", 90.0)
            laps_down = int(abs(gap_to_self) / ref_lap_time) if ref_lap_time > 0 else 0

            new_rivals[car.driver.number] = RivalBelief(
                driver_number=car.driver.number,
                name=car.driver.name,
                team=car.driver.team,
                position=car.position,
                gap_to_self=gap_to_self,
                tire_compound=r_compound,
                tire_age=r_age,
                estimated_tire_life=r_predicted_life,
                likely_pit_window=r_likely_pit,
                is_on_undercut=is_undercut,
                laps_down=laps_down,
            )

        self._prev_rival_pits = {car.driver.number: car.pits for car in leaderboard if car.alive}
        self.rivals = new_rivals

    def _compute_actual_deg_rate(self) -> float:
        """
        Compute actual lap time increase per lap from recent history.
        Returns 0.0 if insufficient data.
        """
        if len(self._lap_time_history) < 3:
            return 0.0
        # Simple linear regression on last N laps
        n = len(self._lap_time_history)
        x_mean = (n - 1) / 2.0
        y_mean = sum(self._lap_time_history) / n
        numerator = sum(
            (i - x_mean) * (self._lap_time_history[i] - y_mean)
            for i in range(n)
        )
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        if denominator == 0:
            return 0.0
        slope = numerator / denominator
        return max(0.0, slope)
