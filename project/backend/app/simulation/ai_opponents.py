"""
F1 AI Opponent Module

Manages AI-controlled drivers including their attributes, pit stop decision-making,
overtaking attempts, and race incidents. All 20 Formula 1 2024 drivers are included
in the database with realistic skill ratings.
"""

import math
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from .tracks import Track


# =============================================================================
# DRIVER DATACLASS
# =============================================================================

@dataclass
class Driver:
    """
    Represents a Formula 1 driver with attributes affecting race performance.

    Attributes:
        name: Full name of the driver.
        team: Constructor name.
        number: Racing number.
        skill: Overall driving skill rating (0.0 to 1.0, higher is better).
        aggression: Aggression level affecting overtaking and risk (0.0 to 1.0).
        consistency: Ability to deliver consistent lap times (0.0 to 1.0).
        wet_skill: Skill level in wet weather conditions (0.0 to 1.0).
        base_pace: Base lap time capability in seconds (lower = faster).
    """
    name: str
    team: str
    number: int
    skill: float
    aggression: float
    consistency: float
    wet_skill: float = 0.5
    base_pace: float = 90.0

    def get_effective_skill(self, wet_conditions: bool = False) -> float:
        """
        Calculate effective skill accounting for weather.

        Args:
            wet_conditions: Whether the track is wet.

        Returns:
            Effective skill rating.
        """
        if wet_conditions:
            return (self.skill * 0.6 + self.wet_skill * 0.4)
        return self.skill


# =============================================================================
# 2026 F1 DRIVER DATABASE — single source of truth for the whole sim
# (qualifying roster and /api/data/teams are derived from this table)
# =============================================================================
# 2026 grid: 11 teams / 22 cars. Cadillac joins; Sauber becomes Audi.
# Norris carries #1 as reigning champion; Verstappen reverts to #33.

DRIVER_DATABASE: Dict[str, Driver] = {
    # McLaren — reigning champions
    "NOR": Driver("Lando Norris", "McLaren", 1,
                  skill=0.95, aggression=0.77, consistency=0.92, wet_skill=0.92, base_pace=87.7),
    "PIA": Driver("Oscar Piastri", "McLaren", 81,
                  skill=0.94, aggression=0.72, consistency=0.93, wet_skill=0.88, base_pace=87.7),

    # Red Bull Racing — Verstappen + Hadjar (promoted from Racing Bulls)
    "VER": Driver("Max Verstappen", "Red Bull Racing", 33,
                  skill=0.99, aggression=0.78, consistency=0.98, wet_skill=0.99, base_pace=88.0),
    "HAD": Driver("Isack Hadjar", "Red Bull Racing", 6,
                  skill=0.86, aggression=0.78, consistency=0.82, wet_skill=0.83, base_pace=88.6),

    # Ferrari — Leclerc + Hamilton
    "LEC": Driver("Charles Leclerc", "Ferrari", 16,
                  skill=0.95, aggression=0.83, consistency=0.87, wet_skill=0.90, base_pace=87.9),
    "HAM": Driver("Lewis Hamilton", "Ferrari", 44,
                  skill=0.94, aggression=0.74, consistency=0.95, wet_skill=0.98, base_pace=87.9),

    # Mercedes — Russell + Antonelli
    "RUS": Driver("George Russell", "Mercedes", 63,
                  skill=0.93, aggression=0.76, consistency=0.93, wet_skill=0.90, base_pace=87.9),
    "ANT": Driver("Kimi Antonelli", "Mercedes", 12,
                  skill=0.88, aggression=0.77, consistency=0.84, wet_skill=0.87, base_pace=88.3),

    # Aston Martin — Honda works power + Newey design bump for 2026
    "ALO": Driver("Fernando Alonso", "Aston Martin", 14,
                  skill=0.92, aggression=0.80, consistency=0.92, wet_skill=0.97, base_pace=88.4),
    "STR": Driver("Lance Stroll", "Aston Martin", 18,
                  skill=0.81, aggression=0.68, consistency=0.79, wet_skill=0.84, base_pace=89.1),

    # Williams — Sainz + Albon
    "SAI": Driver("Carlos Sainz", "Williams", 55,
                  skill=0.91, aggression=0.75, consistency=0.92, wet_skill=0.89, base_pace=88.8),
    "ALB": Driver("Alexander Albon", "Williams", 23,
                  skill=0.88, aggression=0.73, consistency=0.87, wet_skill=0.85, base_pace=88.9),

    # Racing Bulls — Lawson + Lindblad
    "LAW": Driver("Liam Lawson", "Racing Bulls", 30,
                  skill=0.85, aggression=0.81, consistency=0.80, wet_skill=0.84, base_pace=89.3),
    "LIN": Driver("Arvid Lindblad", "Racing Bulls", 41,
                  skill=0.81, aggression=0.79, consistency=0.75, wet_skill=0.79, base_pace=89.7),

    # Alpine — Gasly + Colapinto
    "GAS": Driver("Pierre Gasly", "Alpine", 10,
                  skill=0.87, aggression=0.78, consistency=0.84, wet_skill=0.89, base_pace=89.5),
    "COL": Driver("Franco Colapinto", "Alpine", 43,
                  skill=0.82, aggression=0.80, consistency=0.77, wet_skill=0.80, base_pace=89.9),

    # Haas — Ocon + Bearman
    "OCO": Driver("Esteban Ocon", "Haas", 31,
                  skill=0.85, aggression=0.76, consistency=0.85, wet_skill=0.87, base_pace=89.6),
    "BEA": Driver("Oliver Bearman", "Haas", 87,
                  skill=0.85, aggression=0.78, consistency=0.81, wet_skill=0.82, base_pace=89.7),

    # Audi — works team debut (formerly Sauber)
    "HUL": Driver("Nico Hulkenberg", "Audi", 27,
                  skill=0.86, aggression=0.71, consistency=0.86, wet_skill=0.90, base_pace=89.9),
    "BOR": Driver("Gabriel Bortoleto", "Audi", 5,
                  skill=0.85, aggression=0.75, consistency=0.83, wet_skill=0.83, base_pace=90.0),

    # Cadillac — new entry for 2026, veteran pairing
    "PER": Driver("Sergio Perez", "Cadillac", 11,
                  skill=0.86, aggression=0.72, consistency=0.85, wet_skill=0.84, base_pace=90.3),
    "BOT": Driver("Valtteri Bottas", "Cadillac", 77,
                  skill=0.85, aggression=0.68, consistency=0.87, wet_skill=0.86, base_pace=90.4),
}

# Team base pace — plausible 2026 pecking order under the new regulations
# (lower = faster). New entries Audi and Cadillac start at the back.
TEAM_BASE_PACE: Dict[str, float] = {
    "McLaren": 87.7,          # Reigning champions
    "Ferrari": 87.9,
    "Mercedes": 87.9,         # Strong 2026 power unit
    "Red Bull Racing": 87.9,  # First year of in-house RBPT-Ford engine
    "Aston Martin": 88.4,     # Newey car + Honda works deal
    "Williams": 88.8,
    "Racing Bulls": 89.3,
    "Alpine": 89.5,           # Customer Mercedes power
    "Haas": 89.6,
    "Audi": 89.9,             # Works team debut
    "Cadillac": 90.3,         # Brand-new entry
}

# Team metadata shared with the API layer (colors, short codes, 2026 identity)
TEAM_INFO: Dict[str, Dict[str, str]] = {
    "McLaren":         {"color": "#FF8700", "team_id": "MCL"},
    "Ferrari":         {"color": "#FF1E00", "team_id": "FER"},
    "Mercedes":        {"color": "#00D2BE", "team_id": "MER"},
    "Red Bull Racing": {"color": "#1E41FF", "team_id": "RBR"},
    "Aston Martin":    {"color": "#006F62", "team_id": "AMR"},
    "Williams":        {"color": "#00A0DE", "team_id": "WIL"},
    "Racing Bulls":    {"color": "#6692FF", "team_id": "VRB"},
    "Alpine":          {"color": "#0090FF", "team_id": "ALP"},
    "Haas":            {"color": "#B6BABD", "team_id": "HAA"},
    "Audi":            {"color": "#BB0A30", "team_id": "AUD"},
    "Cadillac":        {"color": "#D4AF37", "team_id": "CAD"},
}


# =============================================================================
# AI OPPONENT CONTROLLER
# =============================================================================

class AIOpponentController:
    """
    Controls AI driver behavior including pit strategy decisions, overtaking
    attempts, and incident generation.

    Pit decisions use a look-ahead model: the estimated remaining race time
    for "stay out" is compared to "pit now + fresh compound" to decide
    whether a stop is beneficial, rather than a simple scoring heuristic.
    """

    # Degradation rates and stint limits used in look-ahead estimates
    _DEG_RATES = {"SOFT": 0.065, "MEDIUM": 0.040, "HARD": 0.025,
                  "INTERMEDIATE": 0.020, "WET": 0.015}
    _STINT_LIMITS = {"SOFT": 22, "MEDIUM": 32, "HARD": 45,
                     "INTERMEDIATE": 25, "WET": 35}
    _FUEL_PER_LAP = 1.8  # average kg/lap for look-ahead

    def __init__(
        self,
        drivers: List[Driver],
        track: Track,
        random_seed: Optional[int] = None,
    ) -> None:
        self.drivers = drivers
        self.track = track
        self._rng = random.Random(random_seed)
        self._pit_history: Dict[int, List[Dict[str, Any]]] = {
            d.number: [] for d in drivers
        }
        self._last_pit_lap: Dict[int, int] = {d.number: 0 for d in drivers}
        # Track last weather-forced compound change to prevent rapid oscillation
        self._last_weather_pit_lap: Dict[int, int] = {d.number: -20 for d in drivers}

    # ------------------------------------------------------------------
    # Pit decision — look-ahead model
    # ------------------------------------------------------------------

    def decide_pit(
        self,
        driver: Driver,
        race_state: Any,
    ) -> Optional[Dict[str, Any]]:
        """
        Decide whether an AI driver should pit on the current lap.

        Uses a deterministic look-ahead: compares estimated remaining race
        time on current tires vs. pit_loss + estimated time on a fresh
        optimal compound. A pit is triggered when the fresh-compound path
        saves at least 0.3 s over the stay-out path.

        Forced overrides (in priority order):
          1. Tire past stint limit                 → always pit
          2. Wrong tire for current conditions      → always pit
          3. Final 2 laps                          → never pit
        """
        if race_state is None:
            return None

        car_state = next(
            (c for c in race_state.leaderboard if c.driver.number == driver.number),
            None,
        )
        if car_state is None:
            return None

        lap = race_state.lap
        total_laps = race_state.total_laps
        laps_remaining = total_laps - lap

        # Extract tire info — handles TireState dataclass and plain dict
        tire = car_state.tire
        if hasattr(tire, 'compound'):
            tire_age = tire.age
            compound = tire.compound
        elif isinstance(tire, dict):
            tire_age = tire.get("age", 0)
            compound = tire.get("compound", "MEDIUM")
        else:
            tire_age = 0
            compound = "MEDIUM"

        # Minimum interval between stops (6 laps prevents oscillation)
        last_pit = self._last_pit_lap.get(driver.number, 0)
        if lap - last_pit < 6:
            return None

        # ── Tire life evaluation: no hard cutoff ───────────────────────
        # Real F1 has no absolute limit — escalating degradation past the
        # predicted life is handled by the physics cliff model and tire
        # failure probability in the engine.  We only strongly recommend
        # a pit when significantly past predicted life (engine adds failure
        # risk at earlier ages anyway).
        stint_limit = self._STINT_LIMITS.get(compound, 30)
        age_ratio   = tire_age / max(stint_limit, 1)

        if age_ratio > 1.4 and laps_remaining > 3:
            return {
                "compound": self._choose_compound(race_state, compound, tire_age, laps_remaining),
                "reason": "tire significantly past predicted life",
                "driver_number": driver.number,
            }

        # ── Priority 2: weather-forced compound change ──────────────────
        # Hysteresis: don't weather-switch if we already made one in the last 8 laps
        # (prevents rapid wet/dry oscillation when conditions are marginal)
        last_w_pit = self._last_weather_pit_lap.get(driver.number, -20)
        weather_pit_allowed = (lap - last_w_pit >= 8)

        weather = race_state.weather
        dampness = getattr(weather, "track_dampness", 0.0) if weather else 0.0
        condition = getattr(weather, "condition", "DRY") if weather else "DRY"

        if weather_pit_allowed:
            # Driver-specific dampness threshold (aggressive drivers react earlier)
            # aggression 0.85 → threshold 0.265; conservative 0.62 → threshold 0.310
            wet_threshold = 0.30 + (0.72 - driver.aggression) * 0.10

            if compound in ("SOFT", "MEDIUM", "HARD"):
                if dampness > wet_threshold or condition == "HEAVY_RAIN":
                    new_c = "WET" if dampness > 0.65 else "INTERMEDIATE"
                    self._last_weather_pit_lap[driver.number] = lap
                    return {"compound": new_c, "reason": "rain — need wet tires", "driver_number": driver.number}
            elif compound == "INTERMEDIATE" and dampness < 0.03 and condition == "DRY":
                # Only switch back to slicks when track is genuinely dry again
                slick = "SOFT" if laps_remaining <= 15 else "MEDIUM"
                self._last_weather_pit_lap[driver.number] = lap
                return {"compound": slick, "reason": "track dry — switch to slicks", "driver_number": driver.number}
            elif compound == "WET" and dampness < 0.35:
                self._last_weather_pit_lap[driver.number] = lap
                return {"compound": "INTERMEDIATE", "reason": "track drying — switch to inters", "driver_number": driver.number}

        # ── Priority 3: never pit in final 2 laps ──────────────────────
        if laps_remaining <= 2:
            return None

        # ── Look-ahead comparison ───────────────────────────────────────
        laps_left_in_stint = max(0, stint_limit - tire_age)

        # If current tire can reach the finish → no strategic pit needed
        if laps_left_in_stint >= laps_remaining:
            return None

        # Evaluate look-ahead once > 45% through the stint (slightly earlier
        # than before so the AI catches the window before cliff degradation)
        if age_ratio < 0.45:
            return None

        fuel = getattr(car_state, "fuel", 30.0)
        base_pace = driver.base_pace
        new_compound = self._choose_compound(race_state, compound, tire_age, laps_remaining)
        pit_loss = self.track.pit_loss_time

        flag = getattr(race_state, "flag", None)
        flag_name = flag.name if hasattr(flag, "name") else str(flag)
        if flag_name in ("SAFETY_CAR", "VSC"):
            pit_loss *= 0.60

        # Option A — pit NOW: pit_loss + all remaining laps on fresh compound
        pit_now_time = pit_loss + self._stint_time_estimate(
            new_compound, 0, laps_remaining - 1, fuel, base_pace
        )

        # Option B — run out the current stint, THEN pit, THEN finish
        # natural_extension: how many more laps we can run on the current tire
        natural_extension = min(laps_left_in_stint, laps_remaining - 2)
        if natural_extension < 1:
            # Tire can't survive even 1 more lap → must pit now
            return {"compound": new_compound, "reason": "reaching tire limit", "driver_number": driver.number}

        stay_then_pit_time = (
            self._stint_time_estimate(compound, tire_age, natural_extension, fuel, base_pace)
            + pit_loss
            + self._stint_time_estimate(
                new_compound, 0, max(0, laps_remaining - natural_extension - 1), fuel, base_pace
            )
        )

        # Require at least 2.0 s advantage to justify a pit stop that isn't
        # under a safety car (safety car reduces effective pit loss so 0.5 s is fine)
        advantage_threshold = 0.5 if flag_name in ("SAFETY_CAR", "VSC") else 2.0
        if pit_now_time < stay_then_pit_time - advantage_threshold:
            reason = "sc opportunity" if flag_name in ("SAFETY_CAR", "VSC") else "look-ahead strategy"
            return {"compound": new_compound, "reason": reason, "driver_number": driver.number}

        # Defensive undercut: rival behind has fresher tires and is within 1.5 s
        gap_to_next = car_state.gap_to_next
        if gap_to_next is not None and gap_to_next < 1.5 and age_ratio > 0.55:
            pos = car_state.position
            cars_behind = [c for c in race_state.leaderboard if c.position == pos + 1 and c.alive]
            if cars_behind:
                behind_age = self._get_tire_age(cars_behind[0].tire)
                if behind_age < tire_age - 4:
                    return {
                        "compound": new_compound,
                        "reason": "defensive undercut",
                        "driver_number": driver.number,
                    }

        return None

    def _stint_time_estimate(
        self,
        compound: str,
        start_age: int,
        n_laps: int,
        fuel: float,
        base_pace: float,
    ) -> float:
        """Estimate total race time for n_laps laps from the current tire/fuel state."""
        total = 0.0
        age = start_age
        fuel_load = fuel
        for _ in range(min(n_laps, 35)):
            deg = self._estimate_deg(compound, age)
            fuel_penalty = fuel_load * 0.03
            total += base_pace + deg + fuel_penalty
            age += 1
            fuel_load = max(0.0, fuel_load - self._FUEL_PER_LAP)
        return total

    def _estimate_deg(self, compound: str, tire_age: int) -> float:
        """Three-phase degradation estimate (mirrors CarPhysics without temperature effects)."""
        rate = self._DEG_RATES.get(compound, 0.040)
        limit = self._STINT_LIMITS.get(compound, 30)
        if tire_age <= 0:
            return 0.0
        phase2_end = int(limit * 0.6)
        if tire_age <= 3:
            return rate * 0.3 * tire_age
        if tire_age <= phase2_end:
            return rate * 0.3 * 3 + rate * (tire_age - 3) ** 1.3
        p1 = rate * 0.3 * 3
        p2 = rate * (phase2_end - 3) ** 1.3
        p3_age = tire_age - phase2_end
        cliff = 1.0 + (p3_age / max(limit - phase2_end, 1)) * 2.0
        return p1 + p2 + rate * (p3_age ** 1.3) * (cliff ** 2.5)

    @staticmethod
    def _get_tire_age(tire_state: Any) -> int:
        """Safely extract tire age from either a TireState dataclass or a dict."""
        if hasattr(tire_state, "age"):
            return int(tire_state.age)
        if isinstance(tire_state, dict):
            return int(tire_state.get("age", 0))
        return 0

    def _choose_compound(
        self,
        race_state: Any,
        current_compound: str,
        current_age: int,
        laps_remaining: int,
    ) -> str:
        """
        Select the optimal tire compound for the next stint.

        Selection is track-severity aware: high-abrasion circuits push AI
        toward MEDIUM/HARD to avoid early cliff; low-severity circuits allow
        aggressive SOFT choices. Wet/intermediate selection is unchanged.
        """
        weather = race_state.weather
        dampness = getattr(weather, "track_dampness", 0.0) if weather else 0.0
        condition = getattr(weather, "condition", "DRY") if weather else "DRY"

        if dampness > 0.65 or condition == "HEAVY_RAIN":
            return "WET"
        if dampness > 0.20 or condition in ("DRIZZLE", "LIGHT_RAIN"):
            return "INTERMEDIATE"

        severity = getattr(self.track, "tire_severity", 5)

        if laps_remaining <= 8:
            return "SOFT"

        if severity >= 7:
            # High abrasion — conserve rubber
            if laps_remaining <= 18:
                return "MEDIUM"
            return "HARD"
        elif severity >= 4:
            if laps_remaining <= 15:
                return "SOFT"
            if laps_remaining <= 28:
                return "MEDIUM"
            # Long stint: alternate from current
            return "HARD" if current_compound in ("SOFT", "MEDIUM") else "MEDIUM"
        else:
            # Low severity — aggressive compound viable
            if laps_remaining <= 18:
                return "SOFT"
            if current_compound == "SOFT":
                return "MEDIUM"
            return "SOFT" if laps_remaining <= 35 else "MEDIUM"

    # ------------------------------------------------------------------
    # Overtaking
    # ------------------------------------------------------------------

    def attempt_overtake(
        self,
        driver: Driver,
        target: Driver,
        race_state: Any,
    ) -> bool:
        """
        Determine if an AI driver successfully overtakes a target car.

        Probability accounts for: skill delta, aggression, track difficulty,
        DRS zones, and tire freshness. DRS bonus scales with the number of
        DRS zones on the track (more zones = more passing opportunities per lap).
        """
        if race_state is None:
            return False

        attacker_state = None
        defender_state = None
        for car in race_state.leaderboard:
            if car.driver.number == driver.number:
                attacker_state = car
            elif car.driver.number == target.number:
                defender_state = car

        if attacker_state is None or defender_state is None:
            return False

        gap = attacker_state.gap_to_next
        if gap is None or gap > 1.2:
            return False

        # Base probability
        prob = 0.18

        # Skill and aggression
        prob += (driver.skill - target.skill) * 0.55
        prob += driver.aggression * 0.08

        # Track difficulty (Monaco=10 → massive penalty; Austria=3 → mild)
        difficulty = getattr(self.track, "overtaking_difficulty", 5)
        track_factor = 1.0 - (difficulty / 10.0) * 0.55
        prob *= track_factor

        # DRS: scales with number of DRS zones on the track
        drs_zones = getattr(self.track, "drs_zones", 0)
        if attacker_state.drs_available and drs_zones > 0:
            drs_bonus = 0.12 + drs_zones * 0.07  # 1 zone=0.19, 2 zones=0.26, 3 zones=0.33
            prob += min(drs_bonus, 0.35)

        # Tire freshness advantage
        attacker_age = self._get_tire_age(attacker_state.tire)
        defender_age = self._get_tire_age(defender_state.tire)
        tire_diff = (defender_age - attacker_age) / 10.0
        prob += tire_diff * 0.08

        prob = max(0.02, min(0.85, prob))
        return self._rng.random() < prob

    def generate_incident(self, race_state: Any) -> Optional[Dict[str, Any]]:
        """
        Probabilistically generate a race incident (crash, mechanical failure, etc.).

        Incident probability is influenced by:
        - Track safety car probability (historical incident rate)
        - Weather conditions (wet = more incidents)
        - Driver aggression levels
        - Race lap (first lap = higher risk)

        Args:
            race_state: Current RaceState.

        Returns:
            Incident dict if an incident occurs, None otherwise.
        """
        if race_state is None or race_state.lap <= 0:
            return None

        # Base incident probability per lap (significantly increased for realism)
        base_prob = self.track.sc_probability * 0.04  # Scale to per-lap

        # Weather multiplier
        weather = race_state.weather
        weather_mult = 1.0
        if hasattr(weather, 'condition'):
            if weather.condition in ("DRIZZLE", "LIGHT_RAIN"):
                weather_mult = 1.5
            elif weather.condition == "HEAVY_RAIN":
                weather_mult = 2.5

        # First lap multiplier (highest risk)
        lap_mult = 2.0 if race_state.lap == 1 else 1.0

        # Calculate final probability
        incident_prob = base_prob * weather_mult * lap_mult

        if self._rng.random() < incident_prob:
            # Weight incident selection toward more aggressive drivers
            alive_cars = [c for c in race_state.leaderboard if c.alive]
            if not alive_cars:
                return None

            weights = [0.5 + max(0.0, c.driver.aggression - 0.60) for c in alive_cars]
            total_w = sum(weights)
            pick = self._rng.random() * total_w
            car = alive_cars[-1]
            cumulative = 0.0
            for c, w in zip(alive_cars, weights):
                cumulative += w
                if pick <= cumulative:
                    car = c
                    break

            driver = car.driver

            # Severity skewed by driver aggression (aggressive drivers crash harder)
            aggression_bias = (driver.aggression - 0.70) * 0.15
            severity_roll = self._rng.random() + aggression_bias
            if severity_roll < 0.40:
                severity = "minor"
                description = f"{driver.name} has a minor off-track moment"
            elif severity_roll < 0.70:
                severity = "moderate"
                description = f"{driver.name} spins but continues"
            elif severity_roll < 0.90:
                severity = "major"
                description = f"{driver.name} crashes into the barrier"
            else:
                severity = "critical"
                description = f"{driver.name} has a major crash — car stopped on track"

            return {
                "driver_number": driver.number,
                "driver_name": driver.name,
                "severity": severity,
                "description": description,
                "lap": race_state.lap,
                "requires_sc": severity in ("major", "critical"),
                "requires_red": severity == "critical" and self._rng.random() < 0.35,
                "sector": self._rng.randint(1, 3),
                "processed": False,
            }

        return None


def get_all_drivers() -> List[Driver]:
    """
    Return a list of all 20 2024 F1 drivers.

    Returns:
        List of Driver objects.
    """
    return list(DRIVER_DATABASE.values())


def get_driver_by_code(code: str) -> Driver:
    """
    Retrieve a driver by their three-letter code.

    Args:
        code: Three-letter driver code (e.g., 'VER', 'HAM').

    Returns:
        Matching Driver object.

    Raises:
        KeyError: If the driver code is not found.
    """
    if code not in DRIVER_DATABASE:
        available = ", ".join(sorted(DRIVER_DATABASE.keys()))
        raise KeyError(f"Driver '{code}' not found. Available: {available}")
    return DRIVER_DATABASE[code]
