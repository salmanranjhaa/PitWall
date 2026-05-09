"""
F1 Weather System Module

Manages dynamic weather conditions during a race using a Markov chain model for
realistic weather transitions. Provides forecasts and tire crossover recommendations
based on track dampness levels.
"""

import math
import random
from dataclasses import dataclass, field
from typing import List, Optional, Dict

import numpy as np

from .tracks import Track


# =============================================================================
# WEATHER CONDITION ENUMERATION
# =============================================================================

WEATHER_CONDITIONS = ["DRY", "DRIZZLE", "LIGHT_RAIN", "HEAVY_RAIN"]

# =============================================================================
# MARKOV TRANSITION MATRIX
# =============================================================================
# Rows: current state, Columns: next state
# States ordered: DRY, DRIZZLE, LIGHT_RAIN, HEAVY_RAIN
#
# DRY -> DRY: 85%, DRY -> DRIZZLE: 10%, DRY -> LIGHT_RAIN: 5%
# DRIZZLE -> DRY: 40%, DRIZZLE -> DRIZZLE: 35%, DRIZZLE -> LIGHT_RAIN: 25%
# LIGHT_RAIN -> DRIZZLE: 25%, LIGHT_RAIN -> LIGHT_RAIN: 40%, LIGHT_RAIN -> HEAVY_RAIN: 35%
# HEAVY_RAIN -> LIGHT_RAIN: 30%, HEAVY_RAIN -> HEAVY_RAIN: 50%, HEAVY_RAIN -> TS: 20%

TRANSITION_MATRIX: Dict[str, Dict[str, float]] = {
    "DRY": {
        "DRY": 0.85,
        "DRIZZLE": 0.10,
        "LIGHT_RAIN": 0.05,
        "HEAVY_RAIN": 0.0,
    },
    "DRIZZLE": {
        "DRY": 0.40,
        "DRIZZLE": 0.35,
        "LIGHT_RAIN": 0.25,
        "HEAVY_RAIN": 0.0,
    },
    "LIGHT_RAIN": {
        "DRY": 0.0,
        "DRIZZLE": 0.25,
        "LIGHT_RAIN": 0.40,
        "HEAVY_RAIN": 0.35,
    },
    "HEAVY_RAIN": {
        "DRY": 0.0,
        "DRIZZLE": 0.0,
        "LIGHT_RAIN": 0.30,
        "HEAVY_RAIN": 0.50,
        # "THUNDERSTORM" absorbed into HEAVY_RAIN with 20%
    },
}

# Rain intensity mapping for each condition
CONDITION_RAIN_INTENSITY = {
    "DRY": 0.0,
    "DRIZZLE": 0.15,
    "LIGHT_RAIN": 0.40,
    "HEAVY_RAIN": 0.85,
}

# Track dampness change rates (per lap) for each condition
CONDITION_DAMPNESS_DELTA = {
    "DRY": -0.03,       # Track dries ~3% per lap in dry conditions
    "DRIZZLE": 0.02,    # Light increase in drizzle
    "LIGHT_RAIN": 0.08, # Moderate increase in light rain
    "HEAVY_RAIN": 0.18, # Rapid increase in heavy rain
}

# Tire crossover thresholds based on track dampness
CROSSOVER_SLICK_MAX = 0.08       # Slicks viable below 8% dampness
CROSSOVER_INTER_MIN = 0.20       # Inters recommended above 20%
CROSSOVER_INTER_MAX = 0.55       # Inters viable up to 55%
CROSSOVER_WET_MIN = 0.65         # Wets required above 65%


# =============================================================================
# WEATHER STATE DATACLASS
# =============================================================================

@dataclass
class WeatherState:
    """
    Snapshot of current weather conditions at the circuit.

    Attributes:
        condition: Weather condition string (DRY, DRIZZLE, LIGHT_RAIN, HEAVY_RAIN).
        air_temp: Ambient air temperature in Celsius.
        track_temp: Track surface temperature in Celsius.
        humidity: Relative humidity as a percentage (0-100).
        rain_intensity: Rain intensity from 0.0 (none) to 1.0 (torrential).
        track_dampness: Track surface wetness from 0.0 (dry) to 1.0 (flooded).
        wind_speed: Wind speed in km/h.
    """
    condition: str = "DRY"
    air_temp: float = 25.0
    track_temp: float = 35.0
    humidity: float = 50.0
    rain_intensity: float = 0.0
    track_dampness: float = 0.0
    wind_speed: float = 10.0

    def is_wet(self) -> bool:
        """Return True if track conditions require wet tires."""
        return self.track_dampness > CROSSOVER_SLICK_MAX

    def is_dry(self) -> bool:
        """Return True if track is dry enough for slick tires."""
        return self.track_dampness <= CROSSOVER_SLICK_MAX

    def copy(self) -> "WeatherState":
        """Return a deep copy of this weather state."""
        return WeatherState(
            condition=self.condition,
            air_temp=self.air_temp,
            track_temp=self.track_temp,
            humidity=self.humidity,
            rain_intensity=self.rain_intensity,
            track_dampness=self.track_dampness,
            wind_speed=self.wind_speed,
        )


# =============================================================================
# WEATHER SYSTEM CLASS
# =============================================================================

class WeatherSystem:
    """
    Dynamic weather simulation using a Markov chain model.

    Weather evolves lap-by-lap with realistic transitions between dry, drizzle,
    light rain, and heavy rain states. Track dampness and temperature respond
    dynamically to the current weather condition.
    """

    def __init__(
        self,
        track: Track,
        race_month: int,
        random_seed: Optional[int] = None,
    ) -> None:
        """
        Initialize the WeatherSystem.

        Args:
            track: Track instance for location-specific weather baselines.
            race_month: Month of the race (1-12) for seasonal adjustments.
            random_seed: Optional seed for reproducible weather patterns.
        """
        self.track = track
        self.race_month = max(1, min(12, race_month))
        self._rng = random.Random(random_seed)
        self._seasonal_rain_prob = track.rain_probability.get(self.race_month, 0.1)

    def initialize(self) -> WeatherState:
        """
        Generate the initial weather state for the race start.

        The initial state is influenced by the track's seasonal rain probability.
        Higher seasonal rain chance increases the likelihood of starting in wet
        conditions.

        Returns:
            Initial WeatherState.
        """
        # Determine starting condition based on seasonal probability
        roll = self._rng.random()

        if roll < (1.0 - self._seasonal_rain_prob * 0.8):
            condition = "DRY"
        elif roll < (1.0 - self._seasonal_rain_prob * 0.5):
            condition = "DRIZZLE"
        elif roll < (1.0 - self._seasonal_rain_prob * 0.2):
            condition = "LIGHT_RAIN"
        else:
            condition = "HEAVY_RAIN"

        # Set base temperatures appropriate for the location and month
        base_air_temp = self._estimate_base_temperature()

        # Adjust temperatures based on condition
        if condition == "DRY":
            air_temp = base_air_temp + self._rng.gauss(0, 2)
            track_temp = air_temp + 10 + self._rng.gauss(0, 3)
            humidity = 40 + self._rng.gauss(0, 10)
        elif condition == "DRIZZLE":
            air_temp = base_air_temp - 3 + self._rng.gauss(0, 2)
            track_temp = air_temp + 5 + self._rng.gauss(0, 2)
            humidity = 65 + self._rng.gauss(0, 8)
        elif condition == "LIGHT_RAIN":
            air_temp = base_air_temp - 5 + self._rng.gauss(0, 2)
            track_temp = air_temp + 2 + self._rng.gauss(0, 2)
            humidity = 80 + self._rng.gauss(0, 5)
        else:  # HEAVY_RAIN
            air_temp = base_air_temp - 7 + self._rng.gauss(0, 2)
            track_temp = air_temp + self._rng.gauss(0, 1)
            humidity = 90 + self._rng.gauss(0, 5)

        # Clamp values to realistic ranges
        air_temp = max(5.0, min(45.0, air_temp))
        track_temp = max(8.0, min(65.0, track_temp))
        humidity = max(20.0, min(100.0, humidity))

        # Set rain intensity and initial dampness
        rain_intensity = CONDITION_RAIN_INTENSITY[condition]
        if condition == "DRY":
            track_dampness = max(0.0, self._rng.gauss(0.02, 0.01))
        else:
            track_dampness = rain_intensity * (0.5 + self._rng.random() * 0.3)

        wind_speed = max(0.0, 10 + self._rng.gauss(0, 8))

        return WeatherState(
            condition=condition,
            air_temp=round(air_temp, 1),
            track_temp=round(track_temp, 1),
            humidity=round(humidity, 1),
            rain_intensity=rain_intensity,
            track_dampness=round(max(0.0, min(1.0, track_dampness)), 3),
            wind_speed=round(wind_speed, 1),
        )

    def advance(self, current: WeatherState) -> WeatherState:
        """
        Advance the weather by one lap using Markov chain transitions.

        The next weather state is determined by sampling from the transition
        probability matrix based on the current condition. Temperature and
        dampness evolve smoothly.

        Args:
            current: Current WeatherState.

        Returns:
            Updated WeatherState after one lap.
        """
        # Determine next condition using Markov chain
        transitions = TRANSITION_MATRIX[current.condition]

        roll = self._rng.random()
        cumulative = 0.0
        next_condition = current.condition  # Default: stay the same

        for condition, prob in transitions.items():
            cumulative += prob
            if roll <= cumulative:
                next_condition = condition
                break

        # Handle HEAVY_RAIN thunderstorm absorption (20% -> stay heavy)
        if current.condition == "HEAVY_RAIN" and roll > 0.8:
            next_condition = "HEAVY_RAIN"

        # Create new state
        new_state = current.copy()
        new_state.condition = next_condition
        new_state.rain_intensity = CONDITION_RAIN_INTENSITY[next_condition]

        # Update track dampness based on condition and natural drying/wetting
        dampness_delta = CONDITION_DAMPNESS_DELTA[next_condition]
        new_state.track_dampness += dampness_delta
        new_state.track_dampness = max(0.0, min(1.0, new_state.track_dampness))

        # Temperature evolution
        if next_condition == "DRY":
            # Track warms up in dry conditions
            new_state.track_temp += 0.3 + self._rng.gauss(0, 0.2)
            new_state.air_temp += self._rng.gauss(0, 0.3)
            new_state.humidity = max(20.0, new_state.humidity - 0.5)
        elif next_condition in ("LIGHT_RAIN", "HEAVY_RAIN"):
            # Rain cools everything down
            new_state.track_temp -= 0.5 + self._rng.gauss(0, 0.2)
            new_state.air_temp -= 0.2 + self._rng.gauss(0, 0.1)
            new_state.humidity = min(100.0, new_state.humidity + 1.0)
        else:  # DRIZZLE
            new_state.track_temp -= 0.1 + self._rng.gauss(0, 0.1)
            new_state.humidity = min(100.0, new_state.humidity + 0.3)

        # Wind speed varies randomly
        new_state.wind_speed = max(0.0, new_state.wind_speed + self._rng.gauss(0, 2))

        # Clamp all values
        new_state.air_temp = round(max(5.0, min(45.0, new_state.air_temp)), 1)
        new_state.track_temp = round(max(8.0, min(65.0, new_state.track_temp)), 1)
        new_state.humidity = round(max(20.0, min(100.0, new_state.humidity)), 1)
        new_state.track_dampness = round(max(0.0, min(1.0, new_state.track_dampness)), 3)
        new_state.wind_speed = round(max(0.0, new_state.wind_speed), 1)

        return new_state

    def get_forecast(self, current: WeatherState, laps: int) -> List[WeatherState]:
        """
        Generate a weather forecast for the specified number of upcoming laps.

        The forecast is a Monte Carlo simulation: we run the Markov chain forward
        from the current state multiple times and return the most likely path.

        Args:
            current: Current WeatherState (starting point).
            laps: Number of laps to forecast ahead.

        Returns:
            List of WeatherState objects representing the predicted path.
        """
        # Run multiple Monte Carlo simulations and average
        num_simulations = 50
        all_paths: List[List[WeatherState]] = []

        for _ in range(num_simulations):
            path = []
            state = current.copy()
            for _ in range(laps):
                state = self.advance(state)
                path.append(state.copy())
            all_paths.append(path)

        # Aggregate: for each lap ahead, find the most common condition
        forecast: List[WeatherState] = []
        for lap_idx in range(laps):
            conditions = [path[lap_idx].condition for path in all_paths]
            most_common = max(set(conditions), key=conditions.count)

            # Average numerical values across all simulations
            avg_air_temp = np.mean([path[lap_idx].air_temp for path in all_paths])
            avg_track_temp = np.mean([path[lap_idx].track_temp for path in all_paths])
            avg_humidity = np.mean([path[lap_idx].humidity for path in all_paths])
            avg_rain = np.mean([path[lap_idx].rain_intensity for path in all_paths])
            avg_dampness = np.mean([path[lap_idx].track_dampness for path in all_paths])
            avg_wind = np.mean([path[lap_idx].wind_speed for path in all_paths])

            forecast.append(WeatherState(
                condition=most_common,
                air_temp=round(avg_air_temp, 1),
                track_temp=round(avg_track_temp, 1),
                humidity=round(avg_humidity, 1),
                rain_intensity=round(avg_rain, 3),
                track_dampness=round(avg_dampness, 3),
                wind_speed=round(avg_wind, 1),
            ))

        return forecast

    def tire_crossover_point(self, weather: WeatherState) -> str:
        """
        Determine the optimal tire type for the current weather conditions.

        Crossover thresholds:
        - SLICK: Track dampness < 8% (dry or nearly dry)
        - INTERMEDIATE: Track dampness 20-55% (damp to light wet)
        - WET: Track dampness > 65% (significantly wet)
        - MARGINAL: Track dampness 8-20% or 55-65% (difficult decision zone)

        Args:
            weather: Current WeatherState.

        Returns:
            String recommendation: "SLICK", "INTERMEDIATE", "WET", or "MARGINAL".
        """
        dampness = weather.track_dampness

        if dampness < CROSSOVER_SLICK_MAX:
            return "SLICK"
        elif dampness < CROSSOVER_INTER_MIN:
            return "MARGINAL_SLICK"  # 8-20%: risky for slicks
        elif dampness <= CROSSOVER_INTER_MAX:
            return "INTERMEDIATE"    # 20-55%: inters optimal
        elif dampness < CROSSOVER_WET_MIN:
            return "MARGINAL_WET"    # 55-65%: risky for inters
        else:
            return "WET"             # >65%: wets required

    def _estimate_base_temperature(self) -> float:
        """
        Estimate the base air temperature for the track location and month.

        Uses hemisphere-aware seasonal temperature estimation based on
        the track's geographic location and the race month.

        Returns:
            Estimated base air temperature in Celsius.
        """
        # Track-specific base temperatures by month (simplified model)
        # Northern hemisphere: warmer Jun-Aug, cooler Dec-Feb
        # Southern hemisphere: opposite pattern
        track_latitudes = {
            "Bahrain": 26.0, "Jeddah": 21.5, "Melbourne": -37.8,
            "Suzuka": 34.8, "Shanghai": 31.2, "Miami": 25.8,
            "Imola": 44.3, "Monaco": 43.7, "Canada": 45.5,
            "Spain": 41.6, "Austria": 47.2, "Silverstone": 52.1,
            "Hungary": 47.5, "Spa": 50.4, "Zandvoort": 52.4,
            "Monza": 45.6, "Baku": 40.4, "Singapore": 1.3,
            "COTA": 30.1, "Las Vegas": 36.1, "Qatar": 25.5,
            "Abu Dhabi": 24.5, "Brazil": -23.5, "Portugal": 37.2,
        }

        latitude = track_latitudes.get(self.track.country, 40.0)
        is_northern = latitude > 0
        abs_lat = abs(latitude)

        # Seasonal temperature variation: ~15C swing between summer and winter
        # at mid-latitudes, less at equator, more at high latitudes
        month_factor = abs(self.race_month - 7) / 6.0  # 0 in July, 1 in Jan/Dec
        seasonal_range = min(25.0, abs_lat * 0.4)  # degrees C seasonal swing (half-amplitude)

        if is_northern:
            # Northern: coldest in Jan (month 1), warmest in July (month 7)
            temp_offset = -seasonal_range * math.cos((self.race_month - 1) * math.pi / 6.0)
        else:
            # Southern: warmest in Jan, coldest in July
            temp_offset = seasonal_range * math.cos((self.race_month - 1) * math.pi / 6.0)

        # Base temperature by climate zone
        if abs_lat < 15:  # Tropical
            base = 30.0
        elif abs_lat < 30:  # Subtropical
            base = 25.0
        elif abs_lat < 45:  # Temperate
            base = 18.0
        elif abs_lat < 55:  # Cool temperate
            base = 14.0
        else:  # Cold
            base = 10.0

        # Night race adjustments
        night_races = ["Bahrain", "Singapore", "Abu Dhabi", "Qatar", "Jeddah", "Las Vegas"]
        night_offset = -8.0 if self.track.country in night_races else 0.0

        return base + temp_offset + night_offset
