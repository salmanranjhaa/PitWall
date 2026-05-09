"""
Feature engineering module for F1 Race Strategy Simulator ML pipeline.

Extracts and transforms raw lap/weather/race data into ML-ready feature
matrices for tire degradation, lap time prediction, and strategy
recommendation models.
"""

from typing import Dict, List, Optional
import numpy as np
import pandas as pd


# Track characteristics database (static per circuit)
TRACK_CHARACTERISTICS = {
    "bahrain": {"abrasion": 3, "length_km": 5.412, "high_speed_corners": 6, "braking_zones": 4, "overtake_difficulty": 0.6},
    "jeddah": {"abrasion": 2, "length_km": 6.174, "high_speed_corners": 9, "braking_zones": 3, "overtake_difficulty": 0.7},
    "albert_park": {"abrasion": 2, "length_km": 5.278, "high_speed_corners": 5, "braking_zones": 4, "overtake_difficulty": 0.8},
    "suzuka": {"abrasion": 4, "length_km": 5.807, "high_speed_corners": 7, "braking_zones": 5, "overtake_difficulty": 0.3},
    "shanghai": {"abrasion": 3, "length_km": 5.451, "high_speed_corners": 4, "braking_zones": 4, "overtake_difficulty": 0.5},
    "miami": {"abrasion": 3, "length_km": 5.412, "high_speed_corners": 5, "braking_zones": 4, "overtake_difficulty": 0.6},
    "imola": {"abrasion": 3, "length_km": 4.909, "high_speed_corners": 6, "braking_zones": 5, "overtake_difficulty": 0.3},
    "monaco": {"abrasion": 1, "length_km": 3.337, "high_speed_corners": 0, "braking_zones": 8, "overtake_difficulty": 0.1},
    "barcelona": {"abrasion": 4, "length_km": 4.675, "high_speed_corners": 5, "braking_zones": 5, "overtake_difficulty": 0.5},
    "villeneuve": {"abrasion": 3, "length_km": 4.361, "high_speed_corners": 4, "braking_zones": 6, "overtake_difficulty": 0.7},
    "red_bull_ring": {"abrasion": 2, "length_km": 4.318, "high_speed_corners": 5, "braking_zones": 3, "overtake_difficulty": 0.7},
    "silverstone": {"abrasion": 4, "length_km": 5.891, "high_speed_corners": 8, "braking_zones": 6, "overtake_difficulty": 0.8},
    "hungaroring": {"abrasion": 3, "length_km": 4.381, "high_speed_corners": 4, "braking_zones": 6, "overtake_difficulty": 0.2},
    "spa": {"abrasion": 3, "length_km": 7.004, "high_speed_corners": 10, "braking_zones": 5, "overtake_difficulty": 0.8},
    "zandvoort": {"abrasion": 3, "length_km": 4.259, "high_speed_corners": 6, "braking_zones": 5, "overtake_difficulty": 0.3},
    "monza": {"abrasion": 2, "length_km": 5.793, "high_speed_corners": 5, "braking_zones": 4, "overtake_difficulty": 0.8},
    "baku": {"abrasion": 2, "length_km": 6.003, "high_speed_corners": 3, "braking_zones": 8, "overtake_difficulty": 0.9},
    "marina_bay": {"abrasion": 2, "length_km": 4.940, "high_speed_corners": 7, "braking_zones": 10, "overtake_difficulty": 0.2},
    "americas": {"abrasion": 4, "length_km": 5.513, "high_speed_corners": 6, "braking_zones": 5, "overtake_difficulty": 0.6},
    "interlagos": {"abrasion": 3, "length_km": 4.309, "high_speed_corners": 4, "braking_zones": 5, "overtake_difficulty": 0.7},
    "vegas": {"abrasion": 2, "length_km": 6.201, "high_speed_corners": 7, "braking_zones": 5, "overtake_difficulty": 0.7},
    "losail": {"abrasion": 2, "length_km": 5.380, "high_speed_corners": 8, "braking_zones": 3, "overtake_difficulty": 0.6},
    "yas_marina": {"abrasion": 2, "length_km": 5.281, "high_speed_corners": 5, "braking_zones": 5, "overtake_difficulty": 0.6},
    "mexico": {"abrasion": 2, "length_km": 4.304, "high_speed_corners": 4, "braking_zones": 6, "overtake_difficulty": 0.6},
}

# Integer label for each track key — alphabetically sorted for stable encoding across runs.
# Unknown tracks map to len(TRACK_KEY_LABELS) (i.e. 24).
TRACK_KEY_LABELS: dict[str, int] = {
    key: i for i, key in enumerate(sorted(TRACK_CHARACTERISTICS.keys()))
}

# Compound encoding mapping
COMPOUND_ENCODING = {"SOFT": 0, "MEDIUM": 1, "HARD": 2, "INTERMEDIATE": 3, "WET": 4}

# Fuel consumption per track (kg/lap) - approximations
FUEL_CONSUMPTION = {
    "spa": 1.7, "monza": 1.4, "silverstone": 1.5, "suzuka": 1.5,
    "yas_marina": 1.4, "bahrain": 1.5, "jeddah": 1.6, "default": 1.5,
}


def _add_track_features(df: pd.DataFrame) -> pd.DataFrame:
    """Merge static track characteristics into a DataFrame."""
    track_name = df.get("track", df.get("track_id", pd.Series(["default"] * len(df))))
    track_name = track_name.astype(str).str.lower().str.replace(" ", "_")

    df["track_abrasion"] = track_name.map(
        {k: v["abrasion"] for k, v in TRACK_CHARACTERISTICS.items()}
    ).fillna(3.0)
    df["track_length_km"] = track_name.map(
        {k: v["length_km"] for k, v in TRACK_CHARACTERISTICS.items()}
    ).fillna(5.0)
    df["high_speed_corners"] = track_name.map(
        {k: v["high_speed_corners"] for k, v in TRACK_CHARACTERISTICS.items()}
    ).fillna(5.0)
    df["braking_zones"] = track_name.map(
        {k: v["braking_zones"] for k, v in TRACK_CHARACTERISTICS.items()}
    ).fillna(5.0)
    df["overtake_difficulty"] = track_name.map(
        {k: v["overtake_difficulty"] for k, v in TRACK_CHARACTERISTICS.items()}
    ).fillna(0.5)
    return df


def extract_tire_features(lap_data: pd.DataFrame) -> pd.DataFrame:
    """
    Extract ML features for the tire degradation model.

    Features produced:
        - compound_onehot (SOFT, MEDIUM, HARD, INTERMEDIATE, WET)
        - tyre_life / tire_age / tire_age_squared / tire_age_sqrt
        - track_temp, air_temp, track_temp_squared
        - track_name_encoded (numeric), driver_encoded (numeric)
        - stint_number, stint_progress_pct
        - is_fresh_stint, is_end_of_stint
        - compound_x_track_temp (interaction)
        - track_abrasion, track_length_km, high_speed_corners, braking_zones
        - session_progress_pct
        - lap_time_delta_from_fresh (target)

    Args:
        lap_data: Raw lap-level DataFrame with columns including
                  Compound, TyreLife, LapTime, TrackTemp, AirTemp,
                  Driver, Track, Stint, etc.

    Returns:
        DataFrame with engineered features ready for model training/inference.
    """
    df = lap_data.copy()

    # --- Core tire features ---
    df["tyre_life"] = pd.to_numeric(df.get("TyreLife", df.get("tyre_life", 0)), errors="coerce").fillna(0)
    df["tire_age"] = df["tyre_life"]
    df["tire_age_squared"] = df["tire_age"] ** 2
    df["tire_age_sqrt"] = np.sqrt(df["tire_age"].clip(lower=0) + 1e-6)

    # --- Compound one-hot encoding ---
    compound_col = df.get("Compound", df.get("compound", pd.Series(["MEDIUM"] * len(df))))
    compound_col = compound_col.fillna("MEDIUM").astype(str).str.upper()
    for cp in ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]:
        df[f"compound_{cp.lower()}"] = (compound_col == cp).astype(int)
    df["compound_encoded"] = compound_col.map(COMPOUND_ENCODING).fillna(1).astype(int)

    # --- Environmental features ---
    df["track_temp"] = pd.to_numeric(df.get("TrackTemp", df.get("track_temp", df.get("track_temp_c", 100))), errors="coerce").fillna(100)
    df["air_temp"] = pd.to_numeric(df.get("AirTemp", df.get("air_temp", df.get("air_temp_c", 25))), errors="coerce").fillna(25)
    df["track_temp_squared"] = df["track_temp"] ** 2

    # --- Track characteristics ---
    df = _add_track_features(df)

    # --- Compound x temperature interaction ---
    df["compound_x_track_temp"] = df["compound_encoded"] * df["track_temp"]

    # --- Driver / stint context ---
    driver_col = df.get("Driver", df.get("driver", pd.Series(["UNK"] * len(df))))
    df["driver_encoded"] = pd.Categorical(driver_col.fillna("UNK")).codes

    df["stint_number"] = pd.to_numeric(df.get("Stint", df.get("stint_number", 1)), errors="coerce").fillna(1)
    # Estimate stint length if not present
    if "stint_length" in df.columns:
        df["stint_length"] = pd.to_numeric(df["stint_length"], errors="coerce").fillna(20)
    else:
        df["stint_length"] = 20  # default estimate
    df["stint_progress_pct"] = (df["tire_age"] / df["stint_length"]).clip(upper=1.0)
    df["is_fresh_stint"] = (df["tire_age"] <= 3).astype(int)
    df["is_end_of_stint"] = (df["tire_age"] > df["stint_length"] * 0.8).astype(int)

    # --- Session progress ---
    lap_num = pd.to_numeric(df.get("LapNumber", df.get("lap_number", 1)), errors="coerce").fillna(1)
    total_laps = pd.to_numeric(df.get("total_laps", 50), errors="coerce").fillna(50)
    df["session_progress_pct"] = (lap_num / total_laps).clip(upper=1.0)

    # --- Target: lap_time_delta_from_fresh ---
    lap_time = pd.to_numeric(df.get("LapTime", df.get("lap_time_s", 0)), errors="coerce").fillna(0)
    # Compute delta from fresh-tire baseline (stint first-lap reference)
    if "stint_start_lap_time" in df.columns:
        fresh_time = pd.to_numeric(df["stint_start_lap_time"], errors="coerce").fillna(lap_time)
    else:
        # Approximate: use stint minimum as fresh-tire proxy
        fresh_time = lap_time  # placeholder; overwritten below per-stint
    df["lap_time_delta_from_fresh"] = lap_time - fresh_time

    # Per-stint delta calculation: group by driver+stint, delta from first lap
    if "Driver" in df.columns and "Stint" in df.columns:
        df["_group"] = df["Driver"].astype(str) + "_" + df["Stint"].astype(str)
        df["_stint_first"] = df.groupby("_group")["lap_time_delta_from_fresh"].transform("first")
        df["lap_time_delta_from_fresh"] = df["lap_time_delta_from_fresh"] - df["_stint_first"]
        df = df.drop(columns=["_group", "_stint_first"], errors="ignore")

    return df


def extract_laptime_features(
    lap_data: pd.DataFrame, weather_data: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    """
    Extract ML features for lap time prediction.

    Features produced:
        - track, driver, compound (encoded)
        - tyre_life, fuel_load, fuel_effect_s
        - air_temp, track_temp, is_raining, rain_intensity, track_dampness
        - drs_used, ers_deployed
        - sector1_time, sector2_time, sector3_time
        - track_evolution_factor, race_progress_pct
        - is_in_dirty_air, is_being_pushed
        - compound_x_is_wet, compound_x_track_temp, tire_age_x_is_wet
        - driver_elo, team_elo

    Args:
        lap_data: Raw lap-level DataFrame.
        weather_data: Optional weather DataFrame to merge on nearest timestamp.

    Returns:
        DataFrame with engineered features for lap time prediction.
    """
    df = lap_data.copy()

    # --- Identity features ---
    compound_col = df.get("Compound", df.get("compound", pd.Series(["MEDIUM"] * len(df))))
    compound_col = compound_col.fillna("MEDIUM").astype(str).str.upper()
    df["compound"] = compound_col
    df["compound_encoded"] = compound_col.map(COMPOUND_ENCODING).fillna(1).astype(int)

    df["tyre_life"] = pd.to_numeric(df.get("TyreLife", df.get("tyre_life", 0)), errors="coerce").fillna(0)

    driver_col = df.get("Driver", df.get("driver", pd.Series(["UNK"] * len(df))))
    df["driver_encoded"] = pd.Categorical(driver_col.fillna("UNK")).codes

    team_col = df.get("Team", df.get("team", pd.Series(["UNK"] * len(df))))
    df["team_encoded"] = pd.Categorical(team_col.fillna("UNK")).codes

    # --- Fuel features ---
    track_name = df.get("track", df.get("track_id", pd.Series(["default"] * len(df))))
    track_name = track_name.astype(str).str.lower().str.replace(" ", "_")
    consumption = track_name.map(FUEL_CONSUMPTION).fillna(FUEL_CONSUMPTION["default"])
    lap_num = pd.to_numeric(df.get("LapNumber", df.get("lap_number", 1)), errors="coerce").fillna(1)
    total_laps = pd.to_numeric(df.get("total_laps", 50), errors="coerce").fillna(50)
    df["fuel_load"] = (110 - lap_num * consumption).clip(lower=10)
    df["fuel_effect_s"] = df["fuel_load"] * 0.03

    # --- Weather features ---
    df["air_temp"] = pd.to_numeric(df.get("AirTemp", df.get("air_temp", 25)), errors="coerce").fillna(25)
    df["track_temp"] = pd.to_numeric(df.get("TrackTemp", df.get("track_temp", 100)), errors="coerce").fillna(100)
    df["humidity"] = pd.to_numeric(df.get("Humidity", df.get("humidity", 50)), errors="coerce").fillna(50)
    df["is_raining"] = pd.to_numeric(df.get("Rainfall", df.get("is_raining", 0)), errors="coerce").fillna(0).astype(int)
    df["rain_intensity"] = pd.to_numeric(df.get("rain_intensity", df["is_raining"]), errors="coerce").fillna(0)
    # Track dampness: estimated from rain + track temp
    df["track_dampness"] = df["is_raining"] * 0.8 + (df["track_temp"] < 30).astype(float) * 0.2

    # --- Merge weather data if provided ---
    if weather_data is not None and not weather_data.empty:
        weather_data = weather_data.copy()
        weather_data["Time"] = pd.to_timedelta(weather_data["Time"], errors="coerce")
        df["Time"] = pd.to_timedelta(df.get("Time", pd.Series([pd.Timedelta(0)] * len(df))), errors="coerce")
        # Merge on nearest time
        df = pd.merge_asof(
            df.sort_values("Time"),
            weather_data.sort_values("Time"),
            on="Time",
            direction="nearest",
            tolerance=pd.Timedelta("60s"),
        )

    # --- DRS / ERS features ---
    df["drs_used"] = pd.to_numeric(df.get("DRS", df.get("drs_used", 0)), errors="coerce").fillna(0).astype(int)
    df["ers_deployed"] = pd.to_numeric(df.get("ers_deployed", 0), errors="coerce").fillna(0)

    # --- Sector times ---
    for s in [1, 2, 3]:
        sec_col = f"Sector{s}Time"
        if sec_col in df.columns:
            df[f"sector{s}_time"] = pd.to_timedelta(df[sec_col], errors="coerce").dt.total_seconds()
        else:
            df[f"sector{s}_time"] = 0.0

    # --- Track evolution ---
    df["track_evolution_factor"] = 1 - np.exp(-lap_num / 10)
    df["race_progress_pct"] = (lap_num / total_laps).clip(upper=1.0)

    # --- Track features ---
    df = _add_track_features(df)

    # --- Traffic features ---
    gap_ahead = pd.to_numeric(df.get("gap_to_ahead_s", df.get("gap_to_leader", 99)), errors="coerce").fillna(99)
    gap_behind = pd.to_numeric(df.get("gap_to_behind_s", 99), errors="coerce").fillna(99)
    df["is_in_dirty_air"] = (gap_ahead < 2.0).astype(int)
    df["is_being_pushed"] = (gap_behind < 1.0).astype(int)

    # --- Interaction features ---
    df["compound_x_is_wet"] = df["compound_encoded"] * df["is_raining"]
    df["compound_x_track_temp"] = df["compound_encoded"] * df["track_temp"]
    df["tire_age_x_is_wet"] = df["tyre_life"] * df["is_raining"]
    df["tyrelife_x_tracktemp"] = df["tyre_life"] * df["track_temp"]

    # --- Lap time target ---
    if "lap_time_s" not in df.columns:
        lap_time = df.get("LapTime", pd.Series([0.0] * len(df)))
        if hasattr(lap_time, "dt"):
            df["lap_time_s"] = pd.to_timedelta(lap_time, errors="coerce").dt.total_seconds()
        else:
            df["lap_time_s"] = pd.to_numeric(lap_time, errors="coerce").fillna(0)

    return df


def create_strategy_features(race_state: dict) -> pd.DataFrame:
    """
    Create a feature row for strategy recommendation from the current race state.

    Features produced:
        - laps_remaining, current_position
        - gap_to_leader, gap_to_next
        - tire_age, compound (encoded)
        - fuel_remaining, fuel_effect_s
        - weather_forecast_rain_prob, sc_probability
        - track_overtake_difficulty
        - race_progress_pct
        - is_fresh_stint, is_end_of_stint

    Args:
        race_state: Dictionary with keys:
            - current_lap, total_laps, current_position
            - gap_to_leader, gap_to_next, gap_to_behind
            - tire_age, compound, fuel_remaining_kg
            - weather_forecast (dict with rain_probability)
            - sc_probability, track_name

    Returns:
        Single-row DataFrame with strategy features.
    """
    state = race_state
    laps_total = max(state.get("total_laps", 50), 1)
    current_lap = state.get("current_lap", 1)
    laps_remaining = laps_total - current_lap

    compound = str(state.get("compound", "MEDIUM")).upper()
    compound_enc = COMPOUND_ENCODING.get(compound, 1)

    tire_age = float(state.get("tire_age", 0))
    stint_length = float(state.get("stint_length", 20))

    # Track info
    track_name = str(state.get("track_name", "bahrain")).lower().replace(" ", "_")
    track_chars = TRACK_CHARACTERISTICS.get(track_name, {
        "abrasion": 3, "length_km": 5.0, "high_speed_corners": 5,
        "braking_zones": 5, "overtake_difficulty": 0.5,
    })

    weather = state.get("weather_forecast", {})
    rain_prob = float(weather.get("rain_probability", 0.0))

    features = {
        "laps_remaining": laps_remaining,
        "current_position": int(state.get("current_position", 1)),
        "gap_to_leader": float(state.get("gap_to_leader", 0.0)),
        "gap_to_next": float(state.get("gap_to_next", 5.0)),
        "gap_to_behind": float(state.get("gap_to_behind", 5.0)),
        "tire_age": tire_age,
        "tire_age_squared": tire_age ** 2,
        "compound_encoded": compound_enc,
        "compound_soft": int(compound == "SOFT"),
        "compound_medium": int(compound == "MEDIUM"),
        "compound_hard": int(compound == "HARD"),
        "fuel_remaining": float(state.get("fuel_remaining_kg", 50.0)),
        "fuel_effect_s": float(state.get("fuel_remaining_kg", 50.0)) * 0.03,
        "weather_forecast_rain_prob": rain_prob,
        "sc_probability": float(state.get("sc_probability", 0.05)),
        "track_overtake_difficulty": track_chars["overtake_difficulty"],
        "track_abrasion": track_chars["abrasion"],
        "track_length_km": track_chars["length_km"],
        "race_progress_pct": current_lap / laps_total,
        "is_fresh_stint": int(tire_age <= 3),
        "is_end_of_stint": int(tire_age > stint_length * 0.8),
        "stint_progress_pct": min(tire_age / max(stint_length, 1), 1.0),
    }

    return pd.DataFrame([features])
