"""
Tire Degradation Model Trainer

Trains a LightGBM regressor to predict lap time delta (seconds slower
than a fresh tire baseline) given tire age, compound, track temperature,
and other contextual features.

Includes a synthetic data generation path so the model can be trained
and saved even when FastF1 data is not yet available.
"""

import os
import sys
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

import lightgbm as lgb


# ---------------------------------------------------------------------------
# Feature / target column names
# ---------------------------------------------------------------------------
FEATURE_COLS = [
    "tire_age",
    "tire_age_squared",
    "tire_age_sqrt",
    "compound_soft",
    "compound_medium",
    "compound_hard",
    "compound_intermediate",
    "compound_wet",
    "track_temp",
    "track_temp_squared",
    "air_temp",
    "track_abrasion",
    "track_length_km",
    "high_speed_corners",
    "braking_zones",
    "compound_x_track_temp",
    "stint_progress_pct",
    "is_fresh_stint",
    "is_end_of_stint",
    "session_progress_pct",
]

TARGET_COL = "lap_time_delta_from_fresh"


# ---------------------------------------------------------------------------
# Data preparation
# ---------------------------------------------------------------------------
def prepare_training_data(lap_records: List[dict]) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Prepare tire degradation training data from raw lap records.

    Each record should contain at minimum:
        {
            "track": str,
            "driver": str,
            "compound": str (SOFT|MEDIUM|HARD),
            "tyre_life": int,
            "track_temp": float,
            "air_temp": float,
            "lap_time": float,
            "stint_start_lap_time": float,
            "stint_number": int (optional),
            "lap_number": int (optional),
            "total_laps": int (optional),
        }

    Target is ``lap_time_delta`` = lap_time - stint_start_lap_time.

    Args:
        lap_records: List of lap-level dictionaries.

    Returns:
        (X, y) where X is a DataFrame of engineered features and y is the
        target Series (delta in seconds).
    """
    if not lap_records:
        return pd.DataFrame(), pd.Series(dtype=float)

    df = pd.DataFrame(lap_records)

    # Ensure required columns exist
    required = {"compound", "tyre_life", "lap_time", "stint_start_lap_time"}
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")

    # --- Target: lap time delta from fresh tire ---
    df["lap_time"] = pd.to_numeric(df["lap_time"], errors="coerce")
    df["stint_start_lap_time"] = pd.to_numeric(df["stint_start_lap_time"], errors="coerce")
    df[TARGET_COL] = df["lap_time"] - df["stint_start_lap_time"]

    # --- Compound one-hot ---
    df["compound"] = df["compound"].fillna("MEDIUM").astype(str).str.upper()
    for cp in ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]:
        df[f"compound_{cp.lower()}"] = (df["compound"] == cp).astype(int)

    # --- Core numeric features ---
    df["tire_age"] = pd.to_numeric(df["tyre_life"], errors="coerce").fillna(0)
    df["tire_age_squared"] = df["tire_age"] ** 2
    df["tire_age_sqrt"] = np.sqrt(df["tire_age"].clip(lower=0) + 1e-6)

    df["track_temp"] = pd.to_numeric(df.get("track_temp", 100), errors="coerce").fillna(100)
    df["air_temp"] = pd.to_numeric(df.get("air_temp", 25), errors="coerce").fillna(25)
    df["track_temp_squared"] = df["track_temp"] ** 2

    # --- Track characteristics (merged from static lookup) ---
    from .features import TRACK_CHARACTERISTICS

    def _get_track(track: str) -> dict:
        t = str(track).lower().replace(" ", "_")
        return TRACK_CHARACTERISTICS.get(t, {
            "abrasion": 3, "length_km": 5.0, "high_speed_corners": 5, "braking_zones": 5
        })

    track_info = df["track"].apply(_get_track)
    df["track_abrasion"] = track_info.apply(lambda x: x["abrasion"])
    df["track_length_km"] = track_info.apply(lambda x: x["length_km"])
    df["high_speed_corners"] = track_info.apply(lambda x: x["high_speed_corners"])
    df["braking_zones"] = track_info.apply(lambda x: x["braking_zones"])

    # --- Interactions ---
    compound_enc = df["compound"].map({"SOFT": 0, "MEDIUM": 1, "HARD": 2, "INTERMEDIATE": 3, "WET": 4}).fillna(1)
    df["compound_x_track_temp"] = compound_enc * df["track_temp"]

    # --- Stint context ---
    df["stint_number"] = pd.to_numeric(df.get("stint_number", 1), errors="coerce").fillna(1)
    df["stint_length"] = pd.to_numeric(df.get("stint_length", 20), errors="coerce").fillna(20)
    df["stint_progress_pct"] = (df["tire_age"] / df["stint_length"]).clip(upper=1.0)
    df["is_fresh_stint"] = (df["tire_age"] <= 3).astype(int)
    df["is_end_of_stint"] = (df["tire_age"] > df["stint_length"] * 0.8).astype(int)

    lap_num = pd.to_numeric(df.get("lap_number", 1), errors="coerce").fillna(1)
    total_laps = pd.to_numeric(df.get("total_laps", 50), errors="coerce").fillna(50)
    df["session_progress_pct"] = (lap_num / total_laps).clip(upper=1.0)

    # Select feature columns that exist
    available_cols = [c for c in FEATURE_COLS if c in df.columns]
    X = df[available_cols].fillna(0)
    y = df[TARGET_COL]

    return X, y


# ---------------------------------------------------------------------------
# Model training
# ---------------------------------------------------------------------------
def train_tire_degradation_model(
    X: pd.DataFrame, y: pd.Series
) -> lgb.LGBMRegressor:
    """
    Train a LightGBM regressor for tire degradation prediction.

    Uses a monotonicity constraint on tyre_life (degradation must not
    decrease as the tire gets older). 5-fold time-series cross-validation
    is performed and metrics are printed to stdout.

    Args:
        X: Feature DataFrame (must contain ``tire_age`` column).
        y: Target Series (lap time delta in seconds).

    Returns:
        Trained LightGBM regressor fitted on the full dataset.
    """
    if X.empty or y.empty:
        raise ValueError("Training data is empty.")

    # Build monotonic constraints vector aligned to X columns
    mono_constraints = []
    for col in X.columns:
        if col in ("tire_age", "tire_age_squared"):
            mono_constraints.append(1)   # increasing -> higher delta
        else:
            mono_constraints.append(0)   # no constraint

    model = lgb.LGBMRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=8,
        subsample=0.8,
        colsample_bytree=0.8,
        monotone_constraints=mono_constraints,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )

    # Time-series cross-validation
    tscv = TimeSeriesSplit(n_splits=5)
    fold_rmse: List[float] = []
    fold_r2: List[float] = []

    print("[train_tire] Time-series CV (5 folds)")
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X), start=1):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        model.fit(X_train, y_train)
        preds = model.predict(X_val)
        rmse = np.sqrt(mean_squared_error(y_val, preds))
        r2 = r2_score(y_val, preds)
        fold_rmse.append(rmse)
        fold_r2.append(r2)
        print(f"  Fold {fold}: RMSE={rmse:.4f}s  R2={r2:.4f}")

    print(f"[train_tire] Mean RMSE: {np.mean(fold_rmse):.4f}s  Mean R2: {np.mean(fold_r2):.4f}")

    # Final fit on all data
    model.fit(X, y)
    return model


def save_model(model, path: str) -> None:
    """Persist a trained model with joblib."""
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    joblib.dump(model, path)
    print(f"[train_tire] Model saved -> {path}")


def load_model(path: str) -> lgb.LGBMRegressor:
    """Load a trained model from disk."""
    return joblib.load(path)


# ---------------------------------------------------------------------------
# Synthetic data generator (for bootstrapping when FastF1 unavailable)
# ---------------------------------------------------------------------------
def _generate_synthetic_training_data(n_stints: int = 2000) -> List[dict]:
    """
    Generate realistic synthetic tire degradation data.

    Degradation patterns are derived from F1 literature:
        - SOFT:  0.065 s/lap base rate, cliff at ~10-14 laps
        - MEDIUM: 0.040 s/lap base rate, cliff at ~18-25 laps
        - HARD:   0.025 s/lap base rate, cliff at ~30-45 laps

    Each stint is a separate lap record with increasing tire age and
    correspondingly increasing lap time delta.
    """
    np.random.seed(42)
    compounds = {
        "SOFT": {"rate": 0.065, "stint_len": 18, "cliff": 12},
        "MEDIUM": {"rate": 0.040, "stint_len": 28, "cliff": 22},
        "HARD": {"rate": 0.025, "stint_len": 45, "cliff": 38},
    }
    tracks = list({
        "bahrain", "jeddah", "albert_park", "suzuka", "shanghai",
        "miami", "monaco", "silverstone", "spa", "monza",
    })
    drivers = ["VER", "HAM", "LEC", "NOR", "ALO", "SAI", "RUS", "PER"]

    records: List[dict] = []

    for _ in range(n_stints):
        compound = np.random.choice(list(compounds.keys()), p=[0.35, 0.40, 0.25])
        info = compounds[compound]
        track = np.random.choice(tracks)
        driver = np.random.choice(drivers)
        track_temp = np.random.uniform(80, 130)
        air_temp = np.random.uniform(18, 35)
        stint_len = max(int(info["stint_len"] + np.random.normal(0, 3)), 5)
        stint_num = np.random.randint(1, 4)

        # Base fresh-tire lap time (track-dependent)
        base_time = np.random.uniform(72, 100)
        stint_start_time = base_time + np.random.normal(0, 0.3)

        temp_factor = 1.0 + (track_temp - 100) / 200

        for lap_in_stint in range(stint_len):
            tire_age = lap_in_stint
            # Degradation: low rate for first 3 laps (warmup), then accelerating
            if tire_age <= 3:
                delta = info["rate"] * 0.3 * tire_age * temp_factor
            else:
                delta = info["rate"] * (tire_age ** 1.3) * temp_factor

            # Add noise
            delta += np.random.normal(0, 0.15)

            records.append({
                "track": track,
                "driver": driver,
                "compound": compound,
                "tyre_life": tire_age,
                "track_temp": round(track_temp, 2),
                "air_temp": round(air_temp, 2),
                "lap_time": round(stint_start_time + delta, 4),
                "stint_start_lap_time": round(stint_start_time, 4),
                "stint_number": stint_num,
                "lap_number": np.random.randint(1, 70),
                "total_laps": 57,
                "stint_length": stint_len,
            })

    return records


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("[train_tire] Generating synthetic training data...")
    synthetic_records = _generate_synthetic_training_data(n_stints=2000)
    print(f"[train_tire] Generated {len(synthetic_records)} lap records")

    X, y = prepare_training_data(synthetic_records)
    print(f"[train_tire] Feature matrix: {X.shape}  |  Target: {y.shape}")

    print("[train_tire] Training LightGBM model...")
    model = train_tire_degradation_model(X, y)

    # Save
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(models_dir, exist_ok=True)
    save_path = os.path.join(models_dir, "tire_degradation_lgbm.pkl")
    save_model(model, save_path)
    print("[train_tire] Done.")
