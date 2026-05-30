"""
Real-Time ML Inference Module

Provides the MLPredictor class that loads pre-trained models and exposes
a unified prediction API for tire degradation, lap times, strategy
recommendations, win probability, and tire life projections.

When model files are absent, every method falls back to physics-based
formulas so the API always returns meaningful results.
"""

import logging
import math
import os
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

import lightgbm as lgb

from ml.features import TRACK_CHARACTERISTICS, TRACK_KEY_LABELS
from ml.strategy_mcts import MCTSStrategyPlanner

logger = logging.getLogger(__name__)

_COMPOUND_INT = {"SOFT": 0, "MEDIUM": 1, "HARD": 2, "INTERMEDIATE": 3, "WET": 4}
_UNKNOWN_TRACK_LABEL = len(TRACK_KEY_LABELS)  # 24 — one past the last known key

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

# Physics-based constants ---------------------------------------------------
COMPOUND_RATES = {"SOFT": 0.065, "MEDIUM": 0.040, "HARD": 0.025, "INTERMEDIATE": 0.035, "WET": 0.030}
FUEL_EFFECT_KG = 0.03  # seconds per kg
PIT_LOSS_SECONDS = {
    "bahrain": 22, "jeddah": 24, "albert_park": 21, "suzuka": 23,
    "shanghai": 22, "miami": 21, "monaco": 25, "silverstone": 22,
    "spa": 24, "monza": 20, "barcelona": 22, "red_bull_ring": 20,
    "yas_marina": 22, "default": 22,
}
TRACK_BASE_TIMES = {
    "bahrain": 92.0, "jeddah": 89.0, "albert_park": 78.0, "suzuka": 90.0,
    "shanghai": 95.0, "miami": 92.0, "monaco": 75.0, "silverstone": 88.0,
    "spa": 105.0, "monza": 82.0, "barcelona": 80.0, "red_bull_ring": 70.0,
    "yas_marina": 85.0, "default": 88.0,
}
SC_PROBABILITY_PER_LAP = {
    "monaco": 0.08, "singapore": 0.07, "baku": 0.06, "jeddah": 0.05,
    "default": 0.03,
}


class MLPredictor:
    """
    Unified ML predictor for F1 strategy simulation.

    Loads pre-trained LightGBM models from ``backend/app/models/``.
    If a model file is missing, the corresponding method falls back to
    a physics-based heuristic so the API never returns empty-handed.
    """

    def __init__(self, models_dir: Optional[str] = None) -> None:
        self.models_dir = models_dir or MODELS_DIR
        self.tire_model: Optional[lgb.LGBMRegressor] = self._load_model("tire_degradation_lgbm.pkl")
        self.laptime_model: Optional[lgb.LGBMRegressor] = self._load_model("lap_time_dry_lgbm.pkl")
        self.laptime_wet_model: Optional[lgb.LGBMRegressor] = self._load_model("lap_time_wet_lgbm.pkl")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _load_model(self, name: str) -> Optional[lgb.LGBMRegressor]:
        path = os.path.join(self.models_dir, name)
        if os.path.exists(path):
            logger.info("Loaded model: %s", path)
            return joblib.load(path)
        logger.warning("Model not found (will use fallback): %s", path)
        return None

    @staticmethod
    def _normalize_track(track: str) -> str:
        return str(track).lower().replace(" ", "_")

    @staticmethod
    def _compound_rate(compound: str) -> float:
        return COMPOUND_RATES.get(compound.upper(), 0.040)

    # ------------------------------------------------------------------
    # Tire degradation
    # ------------------------------------------------------------------
    def predict_tire_degradation(
        self,
        track: str,
        compound: str,
        tire_age: int,
        track_temp: float,
        air_temp: float,
    ) -> float:
        """
        Predict lap time delta (seconds) versus a fresh tire.

        If the ML model is loaded it is used directly; otherwise a
        physics-based exponential degradation formula is applied.

        Args:
            track: Circuit name (e.g. 'silverstone').
            compound: Tire compound (SOFT, MEDIUM, HARD, ...).
            tire_age: Laps completed on the current tire.
            track_temp: Track surface temperature (°F or °C proxy).
            air_temp: Ambient air temperature.

        Returns:
            Estimated lap time delta in seconds (>= 0).
        """
        compound = compound.upper()
        track_norm = self._normalize_track(track)
        tc = TRACK_CHARACTERISTICS.get(track_norm, {
            "abrasion": 3, "length_km": 5.0, "high_speed_corners": 5, "braking_zones": 5,
        })
        compound_int = _COMPOUND_INT.get(compound, 1)
        track_label = TRACK_KEY_LABELS.get(track_norm, _UNKNOWN_TRACK_LABEL)

        if self.tire_model is not None:
            features = pd.DataFrame([{
                "tire_age": tire_age,
                "tire_age_squared": tire_age ** 2,
                "tire_age_sqrt": math.sqrt(tire_age + 1e-6),
                "compound_soft": int(compound == "SOFT"),
                "compound_medium": int(compound == "MEDIUM"),
                "compound_hard": int(compound == "HARD"),
                "compound_intermediate": int(compound == "INTERMEDIATE"),
                "compound_wet": int(compound == "WET"),
                "track_temp": track_temp,
                "track_temp_squared": track_temp ** 2,
                "air_temp": air_temp,
                "track_abrasion": tc["abrasion"],
                "track_length_km": tc["length_km"],
                "high_speed_corners": tc["high_speed_corners"],
                "braking_zones": tc["braking_zones"],
                "compound_x_track_temp": compound_int * track_temp,
                "stint_progress_pct": min(tire_age / 20, 1.0),
                "is_fresh_stint": int(tire_age <= 3),
                "is_end_of_stint": int(tire_age > 16),
                "session_progress_pct": 0.5,
                "track_key_cat": track_label,
            }])
            # Align columns with model
            try:
                pred = float(self.tire_model.predict(features)[0])
                return max(pred, 0.0)
            except Exception as exc:
                logger.warning("ML tire prediction failed (%s), using fallback", exc)

        # --- Physics fallback ---
        rate = self._compound_rate(compound)
        temp_factor = 1.0 + (track_temp - 100) / 200
        if tire_age <= 3:
            delta = rate * 0.3 * tire_age * temp_factor
        else:
            delta = rate * (tire_age ** 1.3) * temp_factor
        return max(delta, 0.0)

    # ------------------------------------------------------------------
    # Lap time prediction
    # ------------------------------------------------------------------
    def predict_lap_time(
        self,
        track: str,
        driver: str,
        compound: str,
        tire_age: int,
        fuel_load: float,
        weather_state: Optional[Dict] = None,
    ) -> float:
        """
        Predict absolute lap time in seconds.

        Combines:
          - Track base reference time
          - Tire degradation delta
          - Fuel load penalty (~0.03 s/kg)
          - Weather adjustment (rain / temperature)

        Uses the appropriate ML model (dry / wet) when available.

        Args:
            track: Circuit name.
            driver: Driver identifier (affects base pace estimate).
            compound: Tire compound.
            tire_age: Laps on current tire.
            fuel_load: Remaining fuel in kg.
            weather_state: Dict with keys ``is_raining``, ``rain_intensity``,
                           ``air_temp``, ``track_temp``.

        Returns:
            Predicted lap time in seconds.
        """
        weather_state = weather_state or {}
        track_norm = self._normalize_track(track)
        compound = compound.upper()
        is_raining = bool(weather_state.get("is_raining", False))
        air_temp = float(weather_state.get("air_temp", 25))
        track_temp = float(weather_state.get("track_temp", 100))

        tc = TRACK_CHARACTERISTICS.get(track_norm, {
            "abrasion": 3, "length_km": 5.0, "high_speed_corners": 5, "braking_zones": 5,
        })
        compound_int = _COMPOUND_INT.get(compound, 1)
        track_label = TRACK_KEY_LABELS.get(track_norm, _UNKNOWN_TRACK_LABEL)

        # Base time
        base = TRACK_BASE_TIMES.get(track_norm, TRACK_BASE_TIMES["default"])

        # Tire degradation
        tire_delta = self.predict_tire_degradation(
            track, compound, tire_age, track_temp, air_temp
        )

        # Fuel effect
        fuel_effect = max(fuel_load, 0) * FUEL_EFFECT_KG

        # Weather effect
        rain_delta = 0.0
        if is_raining:
            intensity = int(weather_state.get("rain_intensity", 1))
            rain_delta = {1: 3.0, 2: 8.0, 3: 15.0}.get(intensity, 5.0)

        total = base + tire_delta + fuel_effect + rain_delta

        # Try ML override if available
        model = self.laptime_wet_model if is_raining and self.laptime_wet_model else self.laptime_model
        if model is not None:
            try:
                features = pd.DataFrame([{
                    "compound_encoded": compound_int,
                    "tyre_life": tire_age,
                    "fuel_load": max(fuel_load, 0),
                    "fuel_effect_s": fuel_effect,
                    "air_temp": air_temp,
                    "track_temp": track_temp,
                    "is_raining": int(is_raining),
                    "rain_intensity": int(weather_state.get("rain_intensity", 0)),
                    "track_dampness": float(weather_state.get("track_dampness", 0)),
                    "track_evolution_factor": 0.5,
                    "race_progress_pct": 0.5,
                    "drs_used": 0,
                    "is_in_dirty_air": 0,
                    "is_being_pushed": 0,
                    "compound_x_is_wet": compound_int * int(is_raining),
                    "compound_x_track_temp": compound_int * track_temp,
                    "tire_age_x_is_wet": tire_age * int(is_raining),
                    "track_abrasion": tc["abrasion"],
                    "track_length_km": tc["length_km"],
                    "high_speed_corners": tc["high_speed_corners"],
                    "braking_zones": tc["braking_zones"],
                    "track_key_cat": track_label,
                }])
                ml_pred = float(model.predict(features)[0])
                # Blend physics + ML (60/40) for robustness
                total = 0.6 * ml_pred + 0.4 * total
            except Exception as exc:
                logger.debug("ML laptime override failed (%s), keeping physics estimate", exc)

        return round(total, 3)

    # ------------------------------------------------------------------
    # Strategy recommendation
    # ------------------------------------------------------------------
    def get_strategy_recommendation(self, race_state: Dict) -> Dict:
        """
        Get AI strategy recommendation using Monte Carlo Tree Search.

        Evaluates pit and stay-out branches with a UCT search tree, then
        returns the highest-value first action and supporting diagnostics.

        Args:
            race_state: Dictionary describing the current race situation.

        Returns:
            Recommendation dict with keys:
                - action (str): "PIT_NOW" or "STAY_OUT"
                - recommended_compound (str)
                - confidence (float)
                - reason (str)
                - messages (list)
        """
        seed = (
            int(race_state.get("current_lap", 0)) * 31
            + int(race_state.get("current_position", 10)) * 7
            + int(race_state.get("tire_age", 0))
        )
        planner = MCTSStrategyPlanner(
            predictor=self,
            iterations=int(race_state.get("mcts_iterations", 320)),
            rollout_depth=int(race_state.get("mcts_rollout_depth", 18)),
            random_seed=seed,
        )
        return planner.recommend(race_state)

    def _simulate_rollout(
        self,
        state: Dict,
        action: str,
        track: str,
        compound: str,
    ) -> float:
        """
        Single Monte Carlo rollout.

        Returns a score: higher is better (points-based).
        """
        laps_remaining = max(
            state.get("laps_remaining", 1),
            state.get("total_laps", 50) - state.get("current_lap", 1),
        )
        pos = int(state.get("current_position", 1))
        tire_age = int(state.get("tire_age", 0))
        fuel = float(state.get("fuel_remaining_kg", 50))
        weather = state.get("weather", {})

        pit_loss = PIT_LOSS_SECONDS.get(track, PIT_LOSS_SECONDS["default"])

        total_time = 0.0
        current_pos = pos

        for lap in range(laps_remaining):
            # Weather evolution
            is_raining = bool(weather.get("is_raining", False))
            rain_intensity = int(weather.get("rain_intensity", 0))

            # Update state per lap
            if action == "PIT" and lap == 0:
                total_time += pit_loss
                tire_age = 0
                fuel = max(fuel - 2, 10)  # pit stop burns little fuel
                # Switch to recommended compound
                compound = "MEDIUM" if laps_remaining > 15 else "SOFT"

            # Predict lap time
            lt = self.predict_lap_time(
                track=track,
                driver="PLAYER",
                compound=compound,
                tire_age=tire_age,
                fuel_load=fuel,
                weather_state={"is_raining": is_raining, "rain_intensity": rain_intensity,
                               "air_temp": weather.get("air_temp", 25),
                               "track_temp": weather.get("track_temp", 100)},
            )
            total_time += lt + np.random.normal(0, 0.15)

            # Tire age / fuel progression
            tire_age += 1
            fuel = max(fuel - 1.5, 10)

            # Random safety car
            sc_prob = SC_PROBABILITY_PER_LAP.get(track, SC_PROBABILITY_PER_LAP["default"])
            if np.random.random() < sc_prob:
                total_time += np.random.uniform(10, 25)

        # Score: lower total time -> higher score (invert)
        score = 1000 - total_time + (21 - current_pos) * 5
        return score

    # ------------------------------------------------------------------
    # Win probability
    # ------------------------------------------------------------------
    def get_win_probability(self, race_state: Dict) -> float:
        """
        Run Monte Carlo simulation to estimate win probability.

        1 000 simulations are run from the current state.  The player's
        car is compared against simple AI opponents each lap.

        Args:
            race_state: Current race state dict.

        Returns:
            Win probability in [0.0, 1.0].
        """
        n_sims = 1000
        wins = 0
        laps_remaining = max(
            race_state.get("laps_remaining", 1),
            race_state.get("total_laps", 50) - race_state.get("current_lap", 1),
        )
        player_pos = int(race_state.get("current_position", 1))
        track = self._normalize_track(race_state.get("track_name", "bahrain"))
        compound = str(race_state.get("compound", "MEDIUM")).upper()
        tire_age = int(race_state.get("tire_age", 0))
        fuel = float(race_state.get("fuel_remaining_kg", 50))

        for _ in range(n_sims):
            positions = list(range(1, 21))
            # Shuffle to simulate other cars
            others = [p for p in positions if p != player_pos]
            np.random.shuffle(others)
            sim_positions = [player_pos] + others

            sim_tire_age = tire_age
            sim_fuel = fuel
            sim_compound = compound

            for lap in range(laps_remaining):
                # Predict player lap time
                lt_player = self.predict_lap_time(
                    track=track,
                    driver="PLAYER",
                    compound=sim_compound,
                    tire_age=sim_tire_age,
                    fuel_load=sim_fuel,
                )
                lt_player += np.random.normal(0, 0.2)

                # Predict opponents (rough)
                lt_opp = lt_player + np.random.normal(0.3, 0.5)

                # Position update heuristic
                if lt_player < lt_opp - 0.5 and sim_positions[0] > 1:
                    # Gain position
                    idx = sim_positions.index(player_pos)
                    sim_positions[idx], sim_positions[idx - 1] = (
                        sim_positions[idx - 1], sim_positions[idx]
                    )
                elif lt_player > lt_opp + 0.5 and sim_positions[0] < 20:
                    idx = sim_positions.index(player_pos)
                    if idx < 19:
                        sim_positions[idx], sim_positions[idx + 1] = (
                            sim_positions[idx + 1], sim_positions[idx]
                        )

                sim_tire_age += 1
                sim_fuel = max(sim_fuel - 1.5, 10)

            if sim_positions[0] == 1:
                wins += 1

        return round(wins / n_sims, 4)

    # ------------------------------------------------------------------
    # Tire life prediction
    # ------------------------------------------------------------------
    def get_tire_life_prediction(
        self,
        current_wear: float,
        compound: str,
        pace: str = "normal",
    ) -> int:
        """
        Predict remaining laps before the tire cliff.

        Projects forward using the degradation model until the delta
        exceeds a compound-specific threshold (~2-3s).

        Args:
            current_wear: Current lap time delta in seconds.
            compound: Tire compound.
            pace: Driving pace ('slow', 'normal', 'aggressive').

        Returns:
            Estimated remaining laps (integer, >= 0).
        """
        compound = compound.upper()
        # Cliff thresholds per compound
        thresholds = {"SOFT": 2.0, "MEDIUM": 3.0, "HARD": 4.0, "INTERMEDIATE": 3.5, "WET": 3.5}
        threshold = thresholds.get(compound, 3.0)

        # Pace multiplier (aggressive drivers degrade faster)
        pace_mult = {"slow": 0.8, "normal": 1.0, "aggressive": 1.3}.get(pace, 1.0)

        remaining = 0
        wear = current_wear
        rate = self._compound_rate(compound)

        while wear < threshold and remaining < 100:
            wear += rate * pace_mult
            remaining += 1

        return max(remaining, 0)


# Singleton instance used by the API
predictor = MLPredictor()
