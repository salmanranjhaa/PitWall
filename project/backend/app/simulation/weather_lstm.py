"""
Lightweight LSTM-style weather forecaster.

This module intentionally avoids TensorFlow/PyTorch so the simulator keeps its
current dependency footprint. The forecaster uses a real recurrent LSTM cell
implemented with NumPy, calibrated with deterministic weights and seasonal
track priors. It is used as a forecast model and blended with the existing
Markov model.
"""

from __future__ import annotations

import math
import random
from typing import List, Optional

import numpy as np

from .weather import CONDITION_RAIN_INTENSITY, WeatherState


class LSTMWeatherForecaster:
    """Small deterministic LSTM forecaster for lap-by-lap weather."""

    def __init__(self, seasonal_rain_probability: float, random_seed: Optional[int] = None) -> None:
        self.seasonal_rain_probability = max(0.0, min(1.0, seasonal_rain_probability))
        rng = np.random.default_rng(random_seed if random_seed is not None else 17)
        self.input_size = 7
        self.hidden_size = 8
        self.wx = rng.normal(0.0, 0.28, (self.input_size, self.hidden_size * 4))
        self.wh = rng.normal(0.0, 0.18, (self.hidden_size, self.hidden_size * 4))
        self.bias = np.zeros(self.hidden_size * 4)

        # Bias the cell toward meteorologically plausible persistence.
        self.bias[: self.hidden_size] = 0.35      # input gate
        self.bias[self.hidden_size: self.hidden_size * 2] = 1.25  # forget gate
        self.bias[self.hidden_size * 3:] = 0.15   # output gate

        self._rng = random.Random(random_seed)

    def forecast(self, current: WeatherState, laps: int) -> List[WeatherState]:
        """Forecast upcoming weather states."""
        h = np.zeros(self.hidden_size)
        c = np.zeros(self.hidden_size)
        state = current.copy()
        result: List[WeatherState] = []

        for lap_offset in range(max(0, laps)):
            x = self._encode(state, lap_offset)
            gates = x @ self.wx + h @ self.wh + self.bias
            i = self._sigmoid(gates[: self.hidden_size])
            f = self._sigmoid(gates[self.hidden_size: self.hidden_size * 2])
            g = np.tanh(gates[self.hidden_size * 2: self.hidden_size * 3])
            o = self._sigmoid(gates[self.hidden_size * 3:])
            c = f * c + i * g
            h = o * np.tanh(c)

            state = self._decode_next(state, h, lap_offset)
            result.append(state.copy())

        return result

    def _encode(self, state: WeatherState, lap_offset: int) -> np.ndarray:
        condition_index = {"DRY": 0.0, "DRIZZLE": 0.33, "LIGHT_RAIN": 0.66, "HEAVY_RAIN": 1.0}.get(
            state.condition, 0.0
        )
        return np.array([
            condition_index,
            float(state.rain_intensity),
            float(state.track_dampness),
            (float(state.air_temp) - 5.0) / 40.0,
            (float(state.track_temp) - 8.0) / 57.0,
            float(state.humidity) / 100.0,
            self.seasonal_rain_probability + 0.02 * math.sin(lap_offset / 4.0),
        ])

    def _decode_next(self, current: WeatherState, h: np.ndarray, lap_offset: int) -> WeatherState:
        memory = float(np.mean(h[:4]))
        rain_momentum = float(h[4] - h[5])
        persistence = {
            "DRY": -0.15,
            "DRIZZLE": 0.10,
            "LIGHT_RAIN": 0.25,
            "HEAVY_RAIN": 0.45,
        }.get(current.condition, 0.0)

        rain_signal = self._scalar_sigmoid(
            -1.15
            + self.seasonal_rain_probability * 3.0
            + current.rain_intensity * 1.9
            + current.track_dampness * 1.3
            + persistence
            + memory
            + rain_momentum * 0.8
        )
        rain_signal = max(0.0, min(1.0, rain_signal))

        drying = 0.035 + max(0.0, current.track_temp - current.air_temp) * 0.002
        wetting = rain_signal * (0.04 + self.seasonal_rain_probability * 0.08)
        dampness = current.track_dampness + wetting - drying
        dampness += self._rng.gauss(0.0, 0.006)
        dampness = max(0.0, min(1.0, dampness))

        if rain_signal < 0.18 and dampness < 0.10:
            condition = "DRY"
        elif rain_signal < 0.38:
            condition = "DRIZZLE"
        elif rain_signal < 0.70:
            condition = "LIGHT_RAIN"
        else:
            condition = "HEAVY_RAIN"

        rain_intensity = CONDITION_RAIN_INTENSITY[condition]
        air_temp = current.air_temp + self._rng.gauss(0.0, 0.12)
        track_temp = current.track_temp
        humidity = current.humidity

        if condition == "DRY":
            track_temp += 0.20
            humidity -= 0.35
        elif condition == "DRIZZLE":
            track_temp -= 0.10
            humidity += 0.35
        else:
            track_temp -= 0.35 + rain_intensity * 0.25
            air_temp -= 0.05
            humidity += 0.80

        wind = current.wind_speed + self._rng.gauss(0.0, 0.6)

        return WeatherState(
            condition=condition,
            air_temp=round(max(5.0, min(45.0, air_temp)), 1),
            track_temp=round(max(8.0, min(65.0, track_temp)), 1),
            humidity=round(max(20.0, min(100.0, humidity)), 1),
            rain_intensity=round(rain_intensity, 3),
            track_dampness=round(dampness, 3),
            wind_speed=round(max(0.0, wind), 1),
        )

    @staticmethod
    def _sigmoid(x: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(x, -40.0, 40.0)))

    @staticmethod
    def _scalar_sigmoid(x: float) -> float:
        x = max(-40.0, min(40.0, x))
        return 1.0 / (1.0 + math.exp(-x))
