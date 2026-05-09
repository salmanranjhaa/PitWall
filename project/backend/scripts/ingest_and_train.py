"""
FastF1 Historical Data Ingestion + Model Retraining

Pulls race sessions from 2022-2025 (ground-effect era only) into the local
SQLite database, then retrains the LightGBM tire degradation and lap time
models on the real data.

Run from the project/backend directory:
    uv run python scripts/ingest_and_train.py

FastF1 is open source — no API key required.
Data is cached locally so subsequent runs are fast.
"""

import os
import sys
import time

# Make sure the app package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

import fastf1
import numpy as np
import pandas as pd
import joblib

from db import init_db, db

# FastF1 cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ---- Sessions to ingest -------------------------------------------------------
# We ingest Race sessions for 2022-2024 (≈ 70 race weekends).
# Each session gives ~1000 lap records across 20 drivers.
# Total: ~70 000 real lap records — solid training data.

# 2022+ ground-effect era only — pre-2022 tire physics are fundamentally different
# (13" Pirelli, high-rake aero) and would dilute the model for current cars.
# Sample weights bias the model toward more recent, representative seasons.
SEASONS = [2022, 2023, 2024]
SESSION_TYPE = "R"  # Race only

# Per-season sample weights: more recent data is more representative
SEASON_WEIGHTS = {2022: 0.7, 2023: 0.9, 2024: 1.0, 2025: 1.0}

# Events to skip (testing weekends handled separately)
SKIP_EVENTS: set = set()

# Map substrings found in FastF1 EventName → TRACK_CHARACTERISTICS key.
# FastF1 EventName is like "Bahrain Grand Prix", "Belgian Grand Prix", etc.
_EVENT_KEYWORDS: list[tuple[str, str]] = [
    ("bahrain",       "bahrain"),
    ("saudi",         "jeddah"),
    ("jeddah",        "jeddah"),
    ("australian",    "albert_park"),
    ("albert park",   "albert_park"),
    ("japanese",      "suzuka"),
    ("suzuka",        "suzuka"),
    ("chinese",       "shanghai"),
    ("shanghai",      "shanghai"),
    ("miami",         "miami"),
    ("emilia romagna","imola"),
    ("imola",         "imola"),
    ("monaco",        "monaco"),
    ("canadian",      "villeneuve"),
    ("montreal",      "villeneuve"),
    ("spanish",       "barcelona"),
    ("barcelona",     "barcelona"),
    ("austrian",      "red_bull_ring"),
    ("red bull ring", "red_bull_ring"),
    ("british",       "silverstone"),
    ("silverstone",   "silverstone"),
    ("hungarian",     "hungaroring"),
    ("hungaroring",   "hungaroring"),
    ("belgian",       "spa"),
    ("spa",           "spa"),
    ("francorchamps", "spa"),
    ("dutch",         "zandvoort"),
    ("zandvoort",     "zandvoort"),
    ("italian",       "monza"),
    ("monza",         "monza"),
    ("azerbaijan",    "baku"),
    ("baku",          "baku"),
    ("singapore",     "marina_bay"),
    ("marina bay",    "marina_bay"),
    ("united states", "americas"),
    ("cota",          "americas"),
    ("mexico",        "mexico"),
    ("sao paulo",     "interlagos"),
    ("brazil",        "interlagos"),
    ("interlagos",    "interlagos"),
    ("las vegas",     "vegas"),
    ("qatar",         "losail"),
    ("lusail",        "losail"),
    ("abu dhabi",     "yas_marina"),
    ("yas marina",    "yas_marina"),
]
_DEFAULT_TC = {"abrasion": 3, "length_km": 5.0, "high_speed_corners": 5, "braking_zones": 5}


def _event_to_track_key(event_name: str) -> str:
    """Map a FastF1 EventName string to a TRACK_CHARACTERISTICS key."""
    lower = str(event_name).lower()
    for keyword, key in _EVENT_KEYWORDS:
        if keyword in lower:
            return key
    return ""


def _safe_float(val) -> float | None:
    try:
        f = float(val)
        return None if f != f else f
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> int | None:
    try:
        f = float(val)
        return None if f != f else int(f)
    except (TypeError, ValueError):
        return None


def _td_s(td) -> float | None:
    try:
        return td.total_seconds()
    except Exception:
        return None


def ingest_session_to_db(year: int, gp, session_type: str = "R") -> dict:
    """Download one session from FastF1 and store it in the DB."""
    try:
        session = fastf1.get_session(year, gp, session_type)
        session.load(laps=True, weather=True, telemetry=False, messages=False)
    except Exception as exc:
        print(f"  [SKIP] {year} {gp} {session_type}: {exc}", flush=True)
        return {}

    event_name = session.event.get("EventName", str(gp))
    circuit    = session.event.get("OfficialEventName", str(gp))
    date_str   = str(session.event.get("EventDate", ""))

    with db() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO sessions (year, event_name, session_type, circuit, date)
            VALUES (?, ?, ?, ?, ?)
        """, (year, event_name, session_type, circuit, date_str))
        row = conn.execute("""
            SELECT id FROM sessions WHERE year=? AND event_name=? AND session_type=?
        """, (year, event_name, session_type)).fetchone()
        session_id = row["id"]
        conn.execute("DELETE FROM laps    WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM weather WHERE session_id=?", (session_id,))

    laps_df = session.laps
    lap_rows = []
    for _, lap in laps_df.iterrows():
        lap_rows.append((
            session_id,
            str(lap.get("Driver", "")),
            str(lap.get("Team", "")),
            _safe_int(lap.get("LapNumber")),
            str(lap.get("Compound", "")).upper() or None,
            _safe_int(lap.get("TyreLife")),
            _td_s(lap.get("LapTime")),
            _td_s(lap.get("Sector1Time")),
            _td_s(lap.get("Sector2Time")),
            _td_s(lap.get("Sector3Time")),
            int(bool(lap.get("IsAccurate", True))),
            _safe_int(lap.get("Stint")),
            str(lap.get("TrackStatus", "")) or None,
            _safe_int(lap.get("Position")),
            _td_s(lap.get("PitInTime")),
            _td_s(lap.get("PitOutTime")),
            _safe_float(lap.get("SpeedST")),
            int(bool(lap.get("IsPersonalBest", False))),
        ))

    with db() as conn:
        conn.executemany("""
            INSERT INTO laps (
                session_id, driver, team, lap_number, compound, tyre_life,
                lap_time_s, sector1_s, sector2_s, sector3_s, is_valid, stint,
                track_status, position, pit_in_time_s, pit_out_time_s,
                speed_trap, is_personal_best
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, lap_rows)

    wdf = session.weather_data
    if wdf is not None and not wdf.empty:
        wrows = []
        for _, w in wdf.iterrows():
            wrows.append((
                session_id,
                _td_s(w.get("Time")),
                _safe_float(w.get("AirTemp")),
                _safe_float(w.get("TrackTemp")),
                _safe_float(w.get("Humidity")),
                _safe_float(w.get("Pressure")),
                _safe_float(w.get("WindSpeed")),
                _safe_float(w.get("WindDirection")),
                int(bool(w.get("Rainfall", False))),
            ))
        with db() as conn:
            conn.executemany("""
                INSERT INTO weather (
                    session_id, time_s, air_temp, track_temp, humidity,
                    pressure, wind_speed, wind_dir, rainfall
                ) VALUES (?,?,?,?,?,?,?,?,?)
            """, wrows)

    print(f"  [OK] {year} {event_name}: {len(lap_rows)} laps, {len(wdf) if wdf is not None else 0} weather rows", flush=True)
    return {"session_id": session_id, "laps": len(lap_rows)}


# ---- Training data assembly ---------------------------------------------------

def load_training_data_from_db():
    """
    Pull all 2022+ laps from the DB and attach per-season sample weights.

    Weights: 2022=0.7, 2023=0.9, 2024=1.0, 2025=1.0 — more recent seasons
    matter more because car/tire behaviour evolves within the ground-effect era.
    """
    with db() as conn:
        rows = conn.execute("""
            SELECT
                l.driver, l.team,
                l.lap_number, l.compound, l.tyre_life, l.lap_time_s,
                l.is_valid, l.stint, l.position,
                s.year, s.event_name, s.circuit,
                w.air_temp, w.track_temp, w.rainfall
            FROM laps l
            JOIN sessions s ON l.session_id = s.id
            LEFT JOIN (
                SELECT session_id,
                       AVG(air_temp)   AS air_temp,
                       AVG(track_temp) AS track_temp,
                       MAX(rainfall)   AS rainfall
                FROM weather
                GROUP BY session_id
            ) w ON w.session_id = l.session_id
            WHERE l.is_valid = 1
              AND l.lap_time_s > 60
              AND l.lap_time_s < 200
              AND l.compound IN ('SOFT','MEDIUM','HARD','INTERMEDIATE','WET')
              AND l.tyre_life IS NOT NULL
        """).fetchall()

    df = pd.DataFrame([dict(r) for r in rows])
    df["sample_weight"] = df["year"].map(SEASON_WEIGHTS).fillna(1.0)

    for yr in SEASONS:
        n = (df["year"] == yr).sum()
        w = SEASON_WEIGHTS.get(yr, 1.0)
        print(f"[train] {yr}: {n:,} lap records (weight={w})")
    print(f"[train] Total: {len(df):,} records")
    return df


# ---- Tire degradation model --------------------------------------------------

def build_tire_features(df: pd.DataFrame) -> pd.DataFrame:
    from ml.features import TRACK_CHARACTERISTICS, TRACK_KEY_LABELS

    df = df.copy()
    df["compound"] = df["compound"].fillna("MEDIUM").str.upper()
    for cp in ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]:
        df[f"compound_{cp.lower()}"] = (df["compound"] == cp).astype(int)

    df["tire_age"]         = df["tyre_life"].clip(lower=0)
    df["tire_age_squared"] = df["tire_age"] ** 2
    df["tire_age_sqrt"]    = np.sqrt(df["tire_age"] + 1e-6)
    df["track_temp"]       = df["track_temp"].fillna(40)
    df["air_temp"]         = df["air_temp"].fillna(25)
    df["track_temp_squared"] = df["track_temp"] ** 2

    def _tc(event_name):
        return TRACK_CHARACTERISTICS.get(_event_to_track_key(event_name), _DEFAULT_TC)

    ti = df["event_name"].apply(_tc)
    df["track_abrasion"]     = ti.apply(lambda x: x["abrasion"])
    df["track_length_km"]    = ti.apply(lambda x: x["length_km"])
    df["high_speed_corners"] = ti.apply(lambda x: x["high_speed_corners"])
    df["braking_zones"]      = ti.apply(lambda x: x["braking_zones"])

    enc = df["compound"].map({"SOFT": 0, "MEDIUM": 1, "HARD": 2, "INTERMEDIATE": 3, "WET": 4}).fillna(1)
    df["compound_x_track_temp"] = enc * df["track_temp"]

    df["track_key_cat"] = (
        df["event_name"].apply(_event_to_track_key)
        .map(TRACK_KEY_LABELS)
        .fillna(len(TRACK_KEY_LABELS))
        .astype(int)
    )

    # Compute stint-level reference (fresh tire lap time ≈ min lap_time_s in first 3 laps)
    stint_key = ["year", "event_name", "driver", "stint"]
    fresh = df[df["tire_age"] <= 3].groupby(stint_key)["lap_time_s"].min().rename("stint_start_lap_time")
    df = df.join(fresh, on=stint_key)
    df["stint_start_lap_time"] = df["stint_start_lap_time"].fillna(df["lap_time_s"])
    df["lap_time_delta"] = (df["lap_time_s"] - df["stint_start_lap_time"]).clip(lower=-2)

    total_laps = df.groupby(["year", "event_name"])["lap_number"].transform("max")
    df["stint_length"]        = df.groupby(stint_key + ["year"])["tyre_life"].transform("max").clip(lower=5)
    df["stint_progress_pct"]  = (df["tire_age"] / df["stint_length"]).clip(upper=1.0)
    df["is_fresh_stint"]      = (df["tire_age"] <= 3).astype(int)
    df["is_end_of_stint"]     = (df["tire_age"] > df["stint_length"] * 0.8).astype(int)
    df["session_progress_pct"]= (df["lap_number"] / total_laps.clip(lower=1)).clip(upper=1.0)

    FEATURES = [
        "tire_age", "tire_age_squared", "tire_age_sqrt",
        "compound_soft", "compound_medium", "compound_hard", "compound_intermediate", "compound_wet",
        "track_temp", "track_temp_squared", "air_temp",
        "track_abrasion", "track_length_km", "high_speed_corners", "braking_zones",
        "compound_x_track_temp",
        "stint_progress_pct", "is_fresh_stint", "is_end_of_stint", "session_progress_pct",
        "track_key_cat",
    ]
    return df, df[FEATURES].fillna(0), df["lap_time_delta"]


def train_tire_model(X: pd.DataFrame, y: pd.Series, weights: pd.Series = None):
    import lightgbm as lgb
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import mean_squared_error, r2_score

    mono = [1 if c in ("tire_age", "tire_age_squared") else 0 for c in X.columns]
    model = lgb.LGBMRegressor(
        n_estimators=800, learning_rate=0.04, max_depth=8,
        subsample=0.8, colsample_bytree=0.8,
        monotone_constraints=mono, random_state=42, n_jobs=-1, verbose=-1,
    )
    cat_cols = ["track_key_cat"]
    tscv = TimeSeriesSplit(n_splits=5)
    rmses, r2s = [], []
    for fold, (tr, val) in enumerate(tscv.split(X), 1):
        w_tr = weights.iloc[tr] if weights is not None else None
        model.fit(X.iloc[tr], y.iloc[tr], sample_weight=w_tr, categorical_feature=cat_cols)
        p = model.predict(X.iloc[val])
        rmse = np.sqrt(mean_squared_error(y.iloc[val], p))
        r2   = r2_score(y.iloc[val], p)
        rmses.append(rmse); r2s.append(r2)
        print(f"  Fold {fold}: RMSE={rmse:.4f}s  R2={r2:.4f}")
    print(f"  Mean RMSE={np.mean(rmses):.4f}  Mean R2={np.mean(r2s):.4f}")
    model.fit(X, y, sample_weight=weights, categorical_feature=cat_cols)
    return model


# ---- Lap time model ---------------------------------------------------------

def build_laptime_features(df: pd.DataFrame):
    from ml.features import TRACK_CHARACTERISTICS, TRACK_KEY_LABELS

    df = df.copy()
    df["compound"] = df["compound"].fillna("MEDIUM").str.upper()
    enc = {"SOFT": 0, "MEDIUM": 1, "HARD": 2, "INTERMEDIATE": 3, "WET": 4}
    df["compound_encoded"]  = df["compound"].map(enc).fillna(1).astype(int)
    df["tyre_life"]         = df["tyre_life"].clip(lower=0)
    df["fuel_load"]         = (110 - df["lap_number"] * 1.5).clip(lower=10)
    df["fuel_effect_s"]     = df["fuel_load"] * 0.03
    df["air_temp"]          = df["air_temp"].fillna(25)
    df["track_temp"]        = df["track_temp"].fillna(40)
    df["is_raining"]        = df["rainfall"].fillna(0).astype(int)
    df["rain_intensity"]    = 0
    df["track_dampness"]    = df["is_raining"] * 0.8
    total_laps = df.groupby(["year", "event_name"])["lap_number"].transform("max")
    df["track_evolution_factor"] = 1 - np.exp(-df["lap_number"] / 10)
    df["race_progress_pct"]= (df["lap_number"] / total_laps.clip(lower=1)).clip(upper=1.0)
    df["drs_used"]         = 0
    df["is_in_dirty_air"]  = 0
    df["is_being_pushed"]  = 0
    df["compound_x_is_wet"]    = df["compound_encoded"] * df["is_raining"]
    df["compound_x_track_temp"]= df["compound_encoded"] * df["track_temp"]
    df["tire_age_x_is_wet"]    = df["tyre_life"] * df["is_raining"]

    def _tc(event_name):
        return TRACK_CHARACTERISTICS.get(_event_to_track_key(event_name), _DEFAULT_TC)

    ti = df["event_name"].apply(_tc)
    df["track_abrasion"]     = ti.apply(lambda x: x["abrasion"])
    df["track_length_km"]    = ti.apply(lambda x: x["length_km"])
    df["high_speed_corners"] = ti.apply(lambda x: x["high_speed_corners"])
    df["braking_zones"]      = ti.apply(lambda x: x["braking_zones"])

    df["track_key_cat"] = (
        df["event_name"].apply(_event_to_track_key)
        .map(TRACK_KEY_LABELS)
        .fillna(len(TRACK_KEY_LABELS))
        .astype(int)
    )

    FEATURES = [
        "compound_encoded", "tyre_life", "fuel_load", "fuel_effect_s",
        "air_temp", "track_temp", "is_raining", "rain_intensity",
        "track_dampness", "track_evolution_factor", "race_progress_pct",
        "drs_used", "is_in_dirty_air", "is_being_pushed",
        "compound_x_is_wet", "compound_x_track_temp", "tire_age_x_is_wet",
        "track_abrasion", "track_length_km", "high_speed_corners", "braking_zones",
        "track_key_cat",
    ]
    return df[FEATURES].fillna(0), df["lap_time_s"]


def train_laptime_models(X: pd.DataFrame, y: pd.Series, is_raining: pd.Series, weights: pd.Series = None):
    import lightgbm as lgb
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import mean_squared_error, r2_score

    cat_cols = ["track_key_cat"]

    def _cv_fit(model, Xf, yf, wf, label):
        tscv = TimeSeriesSplit(n_splits=5)
        rmses, r2s = [], []
        for fold, (tr, val) in enumerate(tscv.split(Xf), 1):
            w_tr = wf.iloc[tr] if wf is not None else None
            model.fit(Xf.iloc[tr], yf.iloc[tr], sample_weight=w_tr, categorical_feature=cat_cols)
            p    = model.predict(Xf.iloc[val])
            rmse = np.sqrt(mean_squared_error(yf.iloc[val], p))
            r2   = r2_score(yf.iloc[val], p)
            rmses.append(rmse); r2s.append(r2)
            print(f"  [{label}] Fold {fold}: RMSE={rmse:.4f}s  R2={r2:.4f}")
        print(f"  [{label}] Mean RMSE={np.mean(rmses):.4f}  Mean R2={np.mean(r2s):.4f}")
        model.fit(Xf, yf, sample_weight=wf, categorical_feature=cat_cols)
        return model

    models = {}
    dry_mask = is_raining == 0
    wet_mask = ~dry_mask
    w_dry = weights[dry_mask] if weights is not None else None
    w_wet = weights[wet_mask] if weights is not None else None

    dry_m = lgb.LGBMRegressor(n_estimators=800, learning_rate=0.03, max_depth=10,
                               subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1, verbose=-1)
    models["lap_time_dry"] = _cv_fit(dry_m, X[dry_mask], y[dry_mask], w_dry, "dry")

    if wet_mask.sum() >= 100:
        wet_m = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.05, max_depth=8,
                                   subsample=0.8, colsample_bytree=0.8, random_state=43, n_jobs=-1, verbose=-1)
        models["lap_time_wet"] = _cv_fit(wet_m, X[wet_mask], y[wet_mask], w_wet, "wet")
    else:
        print("  [wet] Insufficient wet data, skipping.")
    return models


# ---- Main -------------------------------------------------------------------

def main():
    init_db()

    # 1. Ingest all race sessions
    print("=" * 60)
    print("Phase 1: Ingesting FastF1 historical race data")
    print("=" * 60)
    for year in SEASONS:
        try:
            schedule = fastf1.get_event_schedule(year, include_testing=False)
        except Exception as exc:
            print(f"  [SKIP] {year}: could not get schedule — {exc}")
            continue
        for _, event in schedule.iterrows():
            gp = event.get("RoundNumber", None) or event.get("EventName", None)
            if gp is None:
                continue
            event_name = event.get("EventName", str(gp))
            if event_name in SKIP_EVENTS:
                print(f"  [SKIP] {year} {event_name}")
                continue
            print(f"  Ingesting {year} {event_name} …")
            ingest_session_to_db(year, gp, SESSION_TYPE)
            time.sleep(0.5)  # be kind to the API

    # 2. Load all data from DB
    print("\n" + "=" * 60)
    print("Phase 2: Loading training data from database")
    print("=" * 60)
    df = load_training_data_from_db()
    if df.empty:
        print("No training data found. Make sure ingestion succeeded.")
        return

    # 3. Train tire degradation model
    print("\n" + "=" * 60)
    print("Phase 3: Training tire degradation model")
    print("=" * 60)
    df_tire, X_tire, y_tire = build_tire_features(df)
    print(f"  Tire training set: {X_tire.shape}")
    tire_model = train_tire_model(X_tire, y_tire, df_tire["sample_weight"])
    path = os.path.join(MODELS_DIR, "tire_degradation_lgbm.pkl")
    joblib.dump(tire_model, path)
    print(f"  Saved → {path}")

    # 4. Train lap time models
    print("\n" + "=" * 60)
    print("Phase 4: Training lap time models")
    print("=" * 60)
    X_lt, y_lt = build_laptime_features(df)
    print(f"  Lap time training set: {X_lt.shape}")
    lt_models = train_laptime_models(X_lt, y_lt, df["rainfall"].fillna(0).astype(int), df["sample_weight"])
    for name, model in lt_models.items():
        path = os.path.join(MODELS_DIR, f"{name}_lgbm.pkl")
        joblib.dump(model, path)
        print(f"  Saved → {path}")

    print("\n[DONE] All models retrained on real FastF1 data.")


if __name__ == "__main__":
    main()
