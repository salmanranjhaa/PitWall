"""
Per-sector race simulation helpers.

The race engine still advances one public tick per lap, but each lap is now
resolved as three sector times. Sector flags and weather can affect only part
of a lap, and the frontend/API can inspect the latest sector split for every
car.
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Optional

from .events import FlagState
from .tracks import Track


class SectorSimulator:
    """Split and adjust lap times by circuit sector."""

    def __init__(self, track: Track, random_seed: Optional[int] = None) -> None:
        self.track = track
        self._rng = random.Random(random_seed)
        self._base_weights = self._derive_base_weights(track)

    def split_lap(
        self,
        lap_time: float,
        car: Any,
        weather: Any,
        flag: FlagState,
        sector_flags: Dict[int, str],
    ) -> List[float]:
        """
        Return sector times that sum to the effective lap time.

        Normal stochastic sector variation is normalized back to the input lap
        time. Local yellow flags then add localized time loss on top.
        """
        weights = list(self._base_weights)
        dampness = getattr(weather, "track_dampness", 0.0) if weather else 0.0

        # Technical middle sectors are hit harder by wet conditions.
        if dampness > 0.12:
            weights[1] += min(0.025, dampness * 0.030)
            weights[2] -= min(0.015, dampness * 0.015)

        # DRS-heavy circuits tend to make the final sector more variable.
        if getattr(car, "drs_available", False) and flag == FlagState.GREEN:
            weights[2] -= 0.008
            weights[0] += 0.003

        weights = self._normalize(weights)
        sectors = []
        for weight in weights:
            noise = self._rng.gauss(0.0, 0.0035)
            sectors.append(max(1.0, lap_time * max(0.1, weight + noise)))

        # Normalize ordinary sector noise back to the physics lap time.
        total = sum(sectors)
        if total > 0:
            scale = lap_time / total
            sectors = [s * scale for s in sectors]

        for sector, sector_flag in sector_flags.items():
            if sector_flag == "YELLOW" and 1 <= sector <= 3:
                sectors[sector - 1] *= 1.08
            elif sector_flag == "DOUBLE_YELLOW" and 1 <= sector <= 3:
                sectors[sector - 1] *= 1.14

        return [round(s, 3) for s in sectors]

    @staticmethod
    def _derive_base_weights(track: Track) -> List[float]:
        weights = [0.333, 0.334, 0.333]
        corner_bias = min(0.025, max(0.0, (track.corners - 14) * 0.002))
        drs_bias = min(0.020, track.drs_zones * 0.004)

        weights[1] += corner_bias
        weights[2] -= corner_bias * 0.6
        weights[2] -= drs_bias
        weights[0] += drs_bias * 0.5
        return SectorSimulator._normalize(weights)

    @staticmethod
    def _normalize(weights: List[float]) -> List[float]:
        total = sum(max(0.05, w) for w in weights)
        return [max(0.05, w) / total for w in weights]
