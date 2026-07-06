"""
F1 Car Physics Module

Handles all physics calculations for lap time computation including tire degradation,
fuel load effects, weather impact, DRS advantage, ERS deployment, and track evolution.
"""

import math
import random
from dataclasses import dataclass, field
from typing import Optional, Dict, Any

import numpy as np

from .tracks import Track


# =============================================================================
# TIRE COMPOUND DEFINITIONS
# =============================================================================

@dataclass(frozen=True)
class TireCompound:
    """
    Immutable definition of a tire compound's characteristics.

    Attributes:
        name: Compound identifier string.
        grip: Relative grip coefficient (1.0 = best dry grip).
        degradation_rate: Lap time degradation per lap of wear (seconds).
        wet_grip: Relative grip coefficient in wet conditions.
        stint_limit: Maximum recommended laps before severe degradation.
        optimal_temp_low: Lower bound of optimal operating temperature (Celsius).
        optimal_temp_high: Upper bound of optimal operating temperature (Celsius).
    """
    name: str
    grip: float
    degradation_rate: float
    wet_grip: float
    stint_limit: int
    optimal_temp_low: float
    optimal_temp_high: float


# Pre-defined tire compounds used in Formula 1
SOFT = TireCompound(
    name="SOFT", grip=1.0, degradation_rate=0.065,
    wet_grip=0.45, stint_limit=25,
    optimal_temp_low=25.0, optimal_temp_high=40.0,   # track surface °C
)
MEDIUM = TireCompound(
    name="MEDIUM", grip=0.985, degradation_rate=0.040,
    wet_grip=0.40, stint_limit=35,
    optimal_temp_low=20.0, optimal_temp_high=45.0,
)
HARD = TireCompound(
    name="HARD", grip=0.965, degradation_rate=0.025,
    wet_grip=0.35, stint_limit=50,
    optimal_temp_low=15.0, optimal_temp_high=50.0,
)
INTERMEDIATE = TireCompound(
    name="INTERMEDIATE", grip=0.85, degradation_rate=0.020,
    wet_grip=0.75, stint_limit=30,
    optimal_temp_low=10.0, optimal_temp_high=30.0,
)
WET = TireCompound(
    name="WET", grip=0.70, degradation_rate=0.015,
    wet_grip=1.0, stint_limit=40,
    optimal_temp_low=5.0, optimal_temp_high=25.0,
)

TIRE_COMPOUNDS: Dict[str, TireCompound] = {
    "SOFT": SOFT,
    "MEDIUM": MEDIUM,
    "HARD": HARD,
    "INTERMEDIATE": INTERMEDIATE,
    "WET": WET,
}

# Maximum stint lengths per compound (used in degradation phase calculations)
STINT_LIMITS = {"SOFT": 25, "MEDIUM": 35, "HARD": 50, "INTERMEDIATE": 30, "WET": 40}


# =============================================================================
# ERS MODE DEFINITIONS
# =============================================================================

@dataclass(frozen=True)
class ERSMode:
    """
    Energy Recovery System deployment mode.

    Attributes:
        name: Mode identifier.
        lap_time_delta: Time advantage per lap in seconds.
        energy_cost: Energy depletion per lap (% of total capacity).
        description: Human-readable description of the mode.
    """
    name: str
    lap_time_delta: float
    energy_cost: float
    description: str


# 2026 power units: ~50/50 combustion/electric split makes energy management
# central. CHARGE deliberately lifts-and-coasts to harvest; running the
# battery flat causes "clipping" (derate) on the straights.
ERS_MODES: Dict[str, ERSMode] = {
    "CHARGE": ERSMode("CHARGE", -0.30, -20.0, "Harvest mode — slower lap, big battery recharge"),
    "NONE": ERSMode("NONE", 0.0, 0.0, "No extra deployment"),
    "BALANCED": ERSMode("BALANCED", 0.15, 8.0, "Balanced energy usage"),
    "ATTACK": ERSMode("ATTACK", 0.35, 18.0, "Maximum deployment"),
    "DEFEND": ERSMode("DEFEND", 0.25, 14.0, "Defensive deployment"),
}


# =============================================================================
# CAR PHYSICS CLASS
# =============================================================================

class CarPhysics:
    """
    Physics engine for a single Formula 1 car.

    Computes realistic lap times accounting for tire degradation (three-phase model),
    fuel mass effect, weather conditions, DRS advantage, ERS deployment, track
    evolution (rubbering-in), traffic interference, and driver variability.
    """

    # Fuel effect: each kg of fuel costs approximately 0.03 seconds per lap.
    FUEL_EFFECT_PER_KG: float = 0.03

    # 2026 Manual Override Mode (replaces DRS): extra electrical deployment
    # when within 1s of the car ahead — worth ~0.45s but costs battery.
    DRS_LAP_ADVANTAGE: float = 0.45

    # Track evolution: lap times improve by ~0.006s per lap as track rubbers in.
    TRACK_EVOLUTION_PER_LAP: float = 0.006

    # Base driver variability (standard deviation in seconds) for realistic lap spread.
    DRIVER_VARIABILITY_SIGMA: float = 0.15

    def __init__(
        self,
        team: str,
        base_pace: float,
        track: Track,
        random_seed: Optional[int] = None,
    ) -> None:
        """
        Initialize the CarPhysics instance.

        Args:
            team: Name of the constructor (e.g., 'Red Bull Racing').
            base_pace: Base lap time capability of the car in seconds (lower = faster).
            track: Track instance describing the current circuit.
            random_seed: Optional seed for reproducible randomness.
        """
        self.team = team
        self.base_pace = base_pace
        self.track = track
        self._rng = random.Random(random_seed)

    def calculate_lap_time(
        self,
        tire_age: int,
        compound: str,
        fuel_load: float,
        weather: Any,  # WeatherState
        track_evolution: int,
        drs_used: bool,
        ers_mode: str,
        traffic_gap: Optional[float] = None,
    ) -> float:
        """
        Calculate a complete lap time with all physics factors applied.

        The lap time is computed as:
            lap_time = base_pace
                       + tire_degradation_penalty
                       + fuel_penalty
                       + weather_penalty
                       - track_evolution_gain
                       - DRS_advantage (if used)
                       - ERS_advantage
                       + traffic_penalty
                       + driver_variability_noise

        Args:
            tire_age: Number of laps completed on the current tire set.
            compound: Tire compound name (SOFT, MEDIUM, HARD, INTERMEDIATE, WET).
            fuel_load: Remaining fuel in kilograms.
            weather: Current WeatherState object.
            track_evolution: Number of race laps completed (for rubbering-in effect).
            drs_used: Whether DRS was available and used on this lap.
            ers_mode: ERS deployment mode name (NONE, BALANCED, ATTACK, DEFEND).
            traffic_gap: Gap to car ahead in seconds; None if clear track.

        Returns:
            Lap time in seconds.
        """
        # Start from base pace
        lap_time = self.base_pace

        # 1. Tire degradation penalty (three-phase model)
        tire_delta = self.tire_degradation_delta(
            compound=compound,
            tire_age=tire_age,
            track_temp=getattr(weather, "track_temp", 35.0),
            air_temp=getattr(weather, "air_temp", 25.0),
            driving_style="neutral",
        )
        lap_time += tire_delta

        # 2. Fuel load effect (heavier car = slower)
        fuel_delta = self.fuel_effect(fuel_load)
        lap_time += fuel_delta

        # 3. Weather impact (rain, track temperature, dampness)
        weather_delta = self.weather_delta(weather, compound)
        lap_time += weather_delta

        # 4. Track evolution (track gets faster as rubber builds up)
        track_evo_gain = self.TRACK_EVOLUTION_PER_LAP * min(track_evolution, 60)
        lap_time -= track_evo_gain

        # 5. DRS advantage
        if drs_used:
            lap_time -= self.DRS_LAP_ADVANTAGE

        # 6. ERS deployment advantage
        ers = ERS_MODES.get(ers_mode, ERS_MODES["NONE"])
        lap_time -= ers.lap_time_delta

        # 7. Traffic penalty (following closely costs aerodynamic performance)
        if traffic_gap is not None and traffic_gap < 1.5:
            # Dirty air effect: up to 0.8s loss when within 0.5s
            traffic_penalty = max(0.0, 0.8 - 0.8 * (traffic_gap / 1.5))
            lap_time += traffic_penalty

        # 8. Driver variability (small random noise for realism)
        noise = self._rng.gauss(0.0, self.DRIVER_VARIABILITY_SIGMA)
        lap_time += noise

        return max(lap_time, self.base_pace * 0.92)  # Hard floor for realism

    def tire_degradation_delta(
        self,
        compound: str,
        tire_age: int,
        track_temp: float,
        air_temp: float = 25.0,
        driving_style: str = "neutral",
    ) -> float:
        """
        Compute the lap time penalty from tire degradation using a three-phase model.

        Phase 1 (laps 0-3): Initial bedding-in. Mild, near-linear degradation.
            penalty = rate * 0.3 * tire_age

        Phase 2 (laps 4 to stint_limit * 0.6): Working phase. Accelerating degradation.
            penalty = rate * tire_age^1.3

        Phase 3 (beyond stint_limit * 0.6): Cliff phase. Severe degradation.
            penalty = rate * tire_age^1.3 * cliff_multiplier^2.5

        Args:
            compound: Tire compound name.
            tire_age: Number of laps on current tires (0 = brand new).
            track_temp: Track surface temperature in Celsius.
            driving_style: Driving aggression ("conservative", "neutral", "aggressive").

        Returns:
            Total tire degradation penalty in seconds.
        """
        if tire_age <= 0:
            return 0.0

        tc = TIRE_COMPOUNDS.get(compound, MEDIUM)
        rate = tc.degradation_rate
        stint_limit = STINT_LIMITS.get(compound, 30)

        # Temperature effect: optimal grip within window, degradation increases outside
        temp_mid = (tc.optimal_temp_low + tc.optimal_temp_high) / 2.0
        temp_deviation = abs(track_temp - temp_mid) / 20.0  # normalized per 20C
        temp_multiplier = 1.0 + max(0.0, temp_deviation - 0.5) * 0.3

        # Driving style multiplier
        style_multipliers = {"conservative": 0.8, "neutral": 1.0, "aggressive": 1.3}
        style_mult = style_multipliers.get(driving_style, 1.0)

        # Air temperature: hot air reduces tire cooling → faster degradation on slicks
        # Cold air → tires may not reach operating window → graining effect
        air_mult = 1.0
        if compound in ("SOFT", "MEDIUM", "HARD"):
            if air_temp > 30.0:
                air_mult = 1.0 + (air_temp - 30.0) * 0.015   # +1.5% per °C above 30
            elif air_temp < 15.0:
                air_mult = 1.0 + (15.0 - air_temp) * 0.010   # graining penalty below 15°C

        effective_rate = rate * temp_multiplier * style_mult * air_mult

        # Three-phase degradation model
        phase1_end = 3
        phase2_end = int(stint_limit * 0.6)

        if tire_age <= phase1_end:
            # Phase 1: Bedding-in (gentle degradation)
            penalty = effective_rate * 0.3 * tire_age
        elif tire_age <= phase2_end:
            # Phase 2: Working range (accelerating degradation)
            # Cumulative penalty from Phase 1 + Phase 2 contribution
            phase1_penalty = effective_rate * 0.3 * phase1_end
            phase2_age = tire_age - phase1_end
            phase2_penalty = effective_rate * (phase2_age ** 1.3)
            penalty = phase1_penalty + phase2_penalty
        else:
            # Phase 3: Cliff (severe degradation)
            phase1_penalty = effective_rate * 0.3 * phase1_end
            phase2_age = phase2_end - phase1_end
            phase2_penalty = effective_rate * (phase2_age ** 1.3)

            phase3_age = tire_age - phase2_end
            # Cliff severity scales with how far past the limit we are
            cliff_severity = 1.0 + (phase3_age / max(stint_limit - phase2_end, 1)) * 2.0
            phase3_penalty = effective_rate * (phase3_age ** 1.3) * (cliff_severity ** 2.5)

            penalty = phase1_penalty + phase2_penalty + phase3_penalty

        return penalty

    def fuel_effect(self, fuel_load: float) -> float:
        """
        Calculate the lap time penalty from fuel load.

        Each kilogram of fuel adds approximately 0.03 seconds per lap.
        This is a well-established rule of thumb in Formula 1 engineering.

        Args:
            fuel_load: Remaining fuel in kilograms.

        Returns:
            Lap time penalty in seconds.
        """
        return fuel_load * self.FUEL_EFFECT_PER_KG

    def weather_delta(self, weather: Any, compound: str) -> float:  # noqa: C901
        """
        Calculate the lap time impact from current weather conditions.

        Factors considered:
        - Rain intensity: higher rain = slower lap times
        - Track dampness: wet track surface reduces grip
        - Tire compound suitability: slicks in wet are dangerous, inters/wets on dry overheat

        Args:
            weather: Current WeatherState object.
            compound: Current tire compound name.

        Returns:
            Lap time penalty (positive) or gain (negative) in seconds.
        """
        condition = getattr(weather, "condition", "DRY")
        rain_intensity = getattr(weather, "rain_intensity", 0.0)
        track_dampness = getattr(weather, "track_dampness", 0.0)

        penalty = 0.0

        # Base rain penalty: each 10% rain intensity adds ~3.5s on slicks
        if compound in ("SOFT", "MEDIUM", "HARD"):
            if condition in ("DRIZZLE", "LIGHT_RAIN", "HEAVY_RAIN"):
                # Slicks in rain: massive penalty and risk
                rain_penalty = rain_intensity * 35.0  # up to ~35s on slicks in heavy rain
                dampness_penalty = track_dampness * 8.0
                penalty += rain_penalty + dampness_penalty

            elif track_dampness > 0.05:
                # Damp track with slicks: moderate penalty
                penalty += track_dampness * 3.0

        elif compound == "INTERMEDIATE":
            if condition == "DRY":
                # Inters on dry track: overheating, faster degradation
                penalty += 2.5
            elif condition in ("DRIZZLE", "LIGHT_RAIN"):
                # Optimal inter conditions: slight advantage over slicks
                penalty += rain_intensity * 5.0 + track_dampness * 1.5
            elif condition == "HEAVY_RAIN":
                # Inters in heavy rain: aquaplaning risk
                penalty += rain_intensity * 12.0

        elif compound == "WET":
            if condition == "DRY":
                # Wet tires on dry: severe overheating
                penalty += 8.0
            elif condition == "DRIZZLE":
                # Wet tires in drizzle: slow but safe
                penalty += 4.0
            elif condition in ("LIGHT_RAIN", "HEAVY_RAIN"):
                # Wet tires in rain: optimal, minimal penalty
                penalty += rain_intensity * 2.0

        # Track surface temperature outside optimal window
        track_temp = getattr(weather, "track_temp", 35.0)
        air_temp   = getattr(weather, "air_temp",   25.0)
        tc = TIRE_COMPOUNDS.get(compound, MEDIUM)
        if track_temp < tc.optimal_temp_low - 10:
            # Under-temperature: tires don't switch on properly
            penalty += 0.8
        elif track_temp > tc.optimal_temp_high + 10:
            # Over-temperature: overheating / blistering
            penalty += 1.2

        # Air temperature modifies compound operating window
        if compound in ("SOFT", "MEDIUM", "HARD"):
            if air_temp < 10.0:   # very cold — tires won't come in
                penalty += 1.5
            elif air_temp < 15.0:
                penalty += 0.5
            elif air_temp > 40.0:  # extreme heat — overheat
                penalty += 0.4

        return penalty

    def get_tire_grip(self, compound: str, weather: Any) -> float:
        """
        Get the current effective grip level for a tire compound given weather.

        Args:
            compound: Tire compound name.
            weather: Current WeatherState.

        Returns:
            Effective grip coefficient (0.0 to 1.0).
        """
        tc = TIRE_COMPOUNDS.get(compound, MEDIUM)
        condition = getattr(weather, "condition", "DRY")

        if condition in ("DRIZZLE", "LIGHT_RAIN", "HEAVY_RAIN"):
            return tc.wet_grip
        return tc.grip

    def get_tire_stint_limit(self, compound: str) -> int:
        """
        Get the recommended maximum stint length for a tire compound.

        Args:
            compound: Tire compound name.

        Returns:
            Maximum recommended laps before severe degradation.
        """
        return STINT_LIMITS.get(compound, 30)


# =============================================================================
# BLENDED LAP TIME ENGINE
# =============================================================================

class BlendedLapTimeEngine:
    """
    Integrates an ML predictor with CarPhysics for lap time computation.

    The ML model provides a more accurate tire degradation delta than the
    analytical three-phase model (because it was trained on real FastF1 data).
    All other physics effects — fuel load, DRS, ERS, traffic, noise — are
    sourced from the wrapped CarPhysics instance, keeping team/driver-specific
    base pace intact.

    Falls back to pure CarPhysics if the ML predictor is unavailable or raises.
    """

    def __init__(
        self,
        car_physics: CarPhysics,
        predictor: Optional[Any] = None,
        track_name: str = "default",
    ) -> None:
        self.car_physics = car_physics
        self.predictor = predictor
        self.track_name = track_name

    def calculate_lap_time(
        self,
        tire_age: int,
        compound: str,
        fuel_load: float,
        weather: Any,
        track_evolution: int,
        drs_used: bool,
        ers_mode: str,
        traffic_gap: Optional[float] = None,
    ) -> float:
        """
        Calculate a complete lap time, blending ML degradation with physics.

        Components:
          base_pace (team/driver specific, from CarPhysics)
          + tire_delta      (ML if available, else physics three-phase)
          + fuel_penalty    (physics: 0.03 s/kg)
          + weather_penalty (physics: compound mismatch, rain)
          - track_evo_gain  (physics: 0.006 s/lap rubbering-in)
          - DRS_advantage   (physics: 0.35 s when used)
          - ERS_advantage   (physics: per-mode delta)
          + traffic_penalty (physics: dirty-air up to 0.8 s)
          + driver_noise    (physics: gaussian 0.15 s sigma)
        """
        lap_time = self.car_physics.base_pace

        # Tire degradation — prefer ML
        lap_time += self._tire_delta(compound, tire_age, weather)

        # Fuel load
        lap_time += self.car_physics.fuel_effect(fuel_load)

        # Weather (compound mismatch, rain penalty)
        lap_time += self.car_physics.weather_delta(weather, compound)

        # Track evolution (rubbering-in)
        lap_time -= self.car_physics.TRACK_EVOLUTION_PER_LAP * min(track_evolution, 60)

        # DRS
        if drs_used:
            lap_time -= self.car_physics.DRS_LAP_ADVANTAGE

        # ERS deployment
        ers = ERS_MODES.get(ers_mode, ERS_MODES["NONE"])
        lap_time -= ers.lap_time_delta

        # Traffic (dirty air)
        if traffic_gap is not None and traffic_gap < 1.5:
            lap_time += max(0.0, 0.8 - 0.8 * (traffic_gap / 1.5))

        # Driver variability noise
        lap_time += self.car_physics._rng.gauss(0.0, self.car_physics.DRIVER_VARIABILITY_SIGMA)

        return max(lap_time, self.car_physics.base_pace * 0.92)

    def _tire_delta(self, compound: str, tire_age: int, weather: Any) -> float:
        """Return tire degradation delta using ML when available, else physics."""
        track_temp = getattr(weather, "track_temp", 35.0)
        air_temp   = getattr(weather, "air_temp",   25.0)
        if self.predictor is not None:
            try:
                return float(self.predictor.predict_tire_degradation(
                    track=self.track_name,
                    compound=compound,
                    tire_age=tire_age,
                    track_temp=track_temp,
                    air_temp=air_temp,
                ))
            except Exception:
                pass
        return self.car_physics.tire_degradation_delta(
            compound=compound,
            tire_age=tire_age,
            track_temp=track_temp,
            air_temp=air_temp,
        )
