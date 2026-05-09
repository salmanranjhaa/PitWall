"""
Lap Time Predictor Trainer

Trains hierarchical LightGBM models for lap time prediction:
  - Dry-conditions model (R^2 target >= 0.90)
  - Wet-conditions model (R^2 target >= 0.70)

When sufficient FastF1 data is unavailable, falls back to synthetic
training data generation.
"""

import os
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

import lightgbm as lgb


# ---------------------------------------------------------------------------
# Feature columns (subset used after feature engineering)
# ---------------------------------------------------------------------------
FEATURE_COLS = [
    "compound_encoded",
    "tyre_life",
    "fuel_load",
    "fuel_effect_s",
    "air_temp",
    "track_temp",
    "is_raining",
    "rain_intensity",
    "track_dampness",
    "track_evolution_factor",
    "race_progress_pct",
    "drs_used",
    "is_in_dirty_air",
    "is_being_pushed",
    "compound_x_is_wet",
    "compound_x_track_temp",
    "tire_age_x_is_wet",
    "track_abrasion",
    "track_length_km",
    "high_speed_corners",
    "braking_zones",
]

TARGET_COL = "lap_time_s"


# ---------------------------------------------------------------------------
# Data preparation
# ---------------------------------------------------------------------------
def prepare_laptime_training_data(lap_records: List[dict]) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Prepare lap time prediction training data from raw lap records.

    Expected record keys:
        {
            "track": str,
            "driver": str,
            "compound": str,
            "tyre_life": int,
            "fuel_load_kg": float,
            "air_temp": float,
            "track_temp": float,
            "is_raining": int (0 or 1),
            "rain_intensity": int (0-3),
            "drs_used": int (0 or 1),
            "lap_time_s": float,
            "lap_number": int,
            "total_laps": int,
        }

    Returns:
        (X, y) feature matrix and target vector.
    """
    if not lap_records:
        return pd.DataFrame(), pd.Series(dtype=float)

    df = pd.DataFrame(lap_records)
    df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors="coerce").fillna(0)

    # Compound encoding
    df["compound"] = df.get("compound", "MEDIUM").fillna("MEDIUM").astype(str).str.upper()
    enc = {"SOFT": 0, "MEDIUM": 1, "HARD": 2, "INTERMEDIATE": 3, "WET": 4}
    df["compound_encoded"] = df["compound"].map(enc).fillna(1).astype(int)

    df["tyre_life"] = pd.to_numeric(df.get("tyre_life", 0), errors="coerce").fillna(0)
    df["fuel_load"] = pd.to_numeric(df.get("fuel_load_kg", 50), errors="coerce").fillna(50)
    df["fuel_effect_s"] = df["fuel_load"] * 0.03

    df["air_temp"] = pd.to_numeric(df.get("air_temp", 25), errors="coerce").fillna(25)
    df["track_temp"] = pd.to_numeric(df.get("track_temp", 100), errors="coerce").fillna(100)
    df["is_raining"] = pd.to_numeric(df.get("is_raining", 0), errors="coerce").fillna(0).astype(int)
    df["rain_intensity"] = pd.to_numeric(df.get("rain_intensity", 0), errors="coerce").fillna(0).astype(int)
    df["track_dampness"] = df["is_raining"] * 0.8 + (df["track_temp"] < 30).astype(float) * 0.2

    lap_num = pd.to_numeric(df.get("lap_number", 1), errors="coerce").fillna(1)
    total_laps = pd.to_numeric(df.get("total_laps", 50), errors="coerce").fillna(50)
    df["track_evolution_factor"] = 1 - np.exp(-lap_num / 10)
    df["race_progress_pct"] = (lap_num / total_laps).clip(upper=1.0)

    df["drs_used"] = pd.to_numeric(df.get("drs_used", 0), errors="coerce").fillna(0).astype(int)
    df["is_in_dirty_air"] = pd.to_numeric(df.get("is_in_dirty_air", 0), errors="coerce").fillna(0).astype(int)
    df["is_being_pushed"] = pd.to_numeric(df.get("is_being_pushed", 0), errors="coerce").fillna(0).astype(int)

    # Interactions
    df["compound_x_is_wet"] = df["compound_encoded"] * df["is_raining"]
    df["compound_x_track_temp"] = df["compound_encoded"] * df["track_temp"]
    df["tire_age_x_is_wet"] = df["tyre_life"] * df["is_raining"]

    # Track features
    from .features import TRACK_CHARACTERISTICS

    def _track_info(track: str) -> dict:
        t = str(track).lower().replace(" ", "_")
        return TRACK_CHARACTERISTICS.get(t, {
            "abrasion": 3, "length_km": 5.0, "high_speed_corners": 5, "braking_zones": 5,
        })

    track_info = df["track"].apply(_track_info)
    df["track_abrasion"] = track_info.apply(lambda x: x["abrasion"])
    df["track_length_km"] = track_info.apply(lambda x: x["length_km"])
    df["high_speed_corners"] = track_info.apply(lambda x: x["high_speed_corners"])
    df["braking_zones"] = track_info.apply(lambda x: x["braking_zones"])

    available_cols = [c for c in FEATURE_COLS if c in df.columns]
    X = df[available_cols].fillna(0)
    y = df[TARGET_COL]
    return X, y


# ---------------------------------------------------------------------------
# Model training
# ---------------------------------------------------------------------------
def _cv_fit(
    model: lgb.LGBMRegressor, X: pd.DataFrame, y: pd.Series, label: str
) -> lgb.LGBMRegressor:
    """Run 5-fold time-series CV, print metrics, then fit on full data."""
    tscv = TimeSeriesSplit(n_splits=5)
    rmse_scores: List[float] = []
    r2_scores_list: List[float] = []

    print(f"[train_laptime] Time-series CV for {label} (5 folds)")
    for fold, (tr_idx, val_idx) in enumerate(tscv.split(X), start=1):
        model.fit(X.iloc[tr_idx], y.iloc[tr_idx])
        preds = model.predict(X.iloc[val_idx])
        rmse = np.sqrt(mean_squared_error(y.iloc[val_idx], preds))
        r2 = r2_score(y.iloc[val_idx], preds)
        rmse_scores.append(rmse)
        r2_scores_list.append(r2)
        print(f"  Fold {fold}: RMSE={rmse:.4f}s  R2={r2:.4f}")

    print(f"[train_laptime] {label} mean RMSE: {np.mean(rmse_scores):.4f}s  mean R2: {np.mean(r2_scores_list):.4f}")

    # Final fit
    model.fit(X, y)
    return model


def train_laptime_predictor(
    X: pd.DataFrame, y: pd.Series
) -> Dict[str, lgb.LGBMRegressor]:
    """
    Train hierarchical LightGBM models for lap time prediction.

    Separate dry and wet models are trained for better accuracy in each
    condition domain.  Returns a dictionary of trained models.

    Args:
        X: Feature DataFrame (must contain ``is_raining`` column).
        y: Target Series (lap time in seconds).

    Returns:
        Dictionary with keys ``lap_time_dry``, ``lap_time_wet``.
    """
    if X.empty or y.empty:
        raise ValueError("Training data is empty.")

    dry_mask = X.get("is_raining", pd.Series(0, index=X.index)) == 0
    wet_mask = ~dry_mask

    models: Dict[str, lgb.LGBMRegressor] = {}

    # --- Dry model ---
    X_dry = X[dry_mask] if dry_mask.sum() > 0 else X
    y_dry = y[dry_mask] if dry_mask.sum() > 0 else y
    dry_model = lgb.LGBMRegressor(
        n_estimators=600,
        learning_rate=0.03,
        max_depth=10,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )
    models["lap_time_dry"] = _cv_fit(dry_model, X_dry, y_dry, "dry")

    # --- Wet model ---
    if wet_mask.sum() >= 100:
        wet_model = lgb.LGBMRegressor(
            n_estimators=400,
            learning_rate=0.05,
            max_depth=8,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=43,
            n_jobs=-1,
            verbose=-1,
        )
        models["lap_time_wet"] = _cv_fit(
            wet_model, X[wet_mask], y[wet_mask], "wet"
        )
    else:
        print("[train_laptime] Insufficient wet data; skipping wet model.")

    return models


def save_models(models: Dict[str, lgb.LGBMRegressor], output_dir: str) -> None:
    """Persist all trained lap time models."""
    os.makedirs(output_dir, exist_ok=True)
    for name, model in models.items():
        path = os.path.join(output_dir, f"{name}_lgbm.pkl")
        joblib.dump(model, path)
        print(f"[train_laptime] Saved {name} -> {path}")


# ---------------------------------------------------------------------------
# Synthetic data generator
# ---------------------------------------------------------------------------
def _generate_synthetic_laptime_data(n_laps: int = 5000) -> List[dict]:
    """Generate realistic synthetic lap records for training."""
    np.random.seed(123)
    compounds = {"SOFT": 0, "MEDIUM": 1, "HARD": 2}
    tracks = ["bahrain", "silverstone", "spa", "monaco", "monza", "suzuka"]
    drivers = ["VER", "HAM", "LEC", "NOR", "ALO", "SAI"]

    records: List[dict] = []
    for _ in range(n_laps):
        track = np.random.choice(tracks)
        compound = np.random.choice(list(compounds.keys()))
        driver = np.random.choice(drivers)
        tyre_life = np.random.randint(0, 40)
        lap_num = np.random.randint(1, 60)
        total_laps = 57
        is_raining = np.random.choice([0, 1], p=[0.85, 0.15])
        rain_intensity = np.random.choice([0, 1, 2, 3], p=[0.85, 0.08, 0.05, 0.02]) if is_raining else 0

        fuel_load = max(110 - lap_num * 1.5, 10)
        base_time = {"bahrain": 92, "silverstone": 88, "spa": 105,
                     "monaco": 75, "monza": 82, "suzuka": 90}.get(track, 90)

        # Tire degradation
        deg_rate = {"SOFT": 0.065, "MEDIUM": 0.040, "HARD": 0.025}[compound]
        deg = deg_rate * (tyre_life ** 1.2)

        # Fuel effect
        fuel_effect = fuel_load * 0.03

        # Weather effect
        wet_delta = 0
        if rain_intensity == 1:
            wet_delta = np.random.uniform(2, 5)
        elif rain_intensity == 2:
            wet_delta = np.random.uniform(5, 10)
        elif rain_intensity == 3:
            wet_delta = np.random.uniform(10, 20)

        # Track evolution (slight improvement)
        evo = -0.02 * lap_num

        noise = np.random.normal(0, 0.3)
        lap_time = base_time + deg + fuel_effect + wet_delta + evo + noise

        records.append({
            "track": track,
            "driver": driver,
            "compound": compound,
            "tyre_life": tyre_life,
            "fuel_load_kg": round(fuel_load, 2),
            "air_temp": round(np.random.uniform(18, 35), 2),
            "track_temp": round(np.random.uniform(30, 130), 2),
            "is_raining": is_raining,
            "rain_intensity": rain_intensity,
            "drs_used": int(np.random.choice([0, 1], p=[0.3, 0.7])),
            "lap_time_s": round(lap_time, 4),
            "lap_number": lap_num,
            "total_laps": total_laps,
            "is_in_dirty_air": int(np.random.choice([0, 1], p=[0.7, 0.3])),
            "is_being_pushed": int(np.random.choice([0, 1], p=[0.8, 0.2])),
        })
    return records


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("[train_laptime] Generating synthetic training data...")
    records = _generate_synthetic_laptime_data(n_laps=5000)
    print(f"[train_laptime] Generated {len(records)} lap records")

    X, y = prepare_laptime_training_data(records)
    print(f"[train_laptime] Feature matrix: {X.shape}  |  Target: {y.shape}")

    print("[train_laptime] Training hierarchical models...")
    models = train_laptime_predictor(X, y)

    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    save_models(models, models_dir)
    print("[train_laptime] Done.")
