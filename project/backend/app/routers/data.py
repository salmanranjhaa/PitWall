"""
Data Endpoints

Static reference data (tracks, teams, compounds) PLUS FastF1 ingestion
endpoints that pull real session data into the local SQLite database.

FastF1 is open source — no API key required.
"""

import logging
import os
import sys
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from db import db, init_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data", tags=["data"])

# Initialise DB tables on first import
init_db()

# ---------------------------------------------------------------------------
# FastF1 cache dir
# ---------------------------------------------------------------------------
_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "cache")
os.makedirs(_CACHE_DIR, exist_ok=True)

try:
    import fastf1
    fastf1.Cache.enable_cache(_CACHE_DIR)
    _FF1_AVAILABLE = True
    logger.info("FastF1 %s ready, cache: %s", fastf1.__version__, _CACHE_DIR)
except Exception as exc:
    _FF1_AVAILABLE = False
    logger.warning("FastF1 not available: %s", exc)

# ---------------------------------------------------------------------------
# Static reference data
# ---------------------------------------------------------------------------

TRACK_DATABASE = {
    "bahrain":      {"name": "Bahrain International Circuit",      "location": "Sakhir, Bahrain",          "length_km": 5.412, "laps": 57, "corners": 15, "type": "Desert"},
    "jeddah":       {"name": "Jeddah Street Circuit",              "location": "Jeddah, Saudi Arabia",     "length_km": 6.174, "laps": 50, "corners": 27, "type": "Street"},
    "albert_park":  {"name": "Albert Park Circuit",                "location": "Melbourne, Australia",     "length_km": 5.278, "laps": 58, "corners": 14, "type": "Park"},
    "suzuka":       {"name": "Suzuka International Racing Course",  "location": "Suzuka, Japan",            "length_km": 5.807, "laps": 53, "corners": 18, "type": "Road"},
    "shanghai":     {"name": "Shanghai International Circuit",     "location": "Shanghai, China",          "length_km": 5.451, "laps": 56, "corners": 16, "type": "Road"},
    "miami":        {"name": "Miami International Autodrome",      "location": "Miami, USA",               "length_km": 5.412, "laps": 57, "corners": 19, "type": "Street"},
    "monaco":       {"name": "Circuit de Monaco",                  "location": "Monte Carlo, Monaco",      "length_km": 3.337, "laps": 78, "corners": 19, "type": "Street"},
    "barcelona":    {"name": "Circuit de Barcelona-Catalunya",     "location": "Montmelo, Spain",          "length_km": 4.675, "laps": 66, "corners": 16, "type": "Road"},
    "red_bull_ring":{"name": "Red Bull Ring",                      "location": "Spielberg, Austria",       "length_km": 4.318, "laps": 71, "corners": 10, "type": "Road"},
    "silverstone":  {"name": "Silverstone Circuit",                "location": "Silverstone, UK",          "length_km": 5.891, "laps": 52, "corners": 18, "type": "Road"},
    "hungaroring":  {"name": "Hungaroring",                        "location": "Budapest, Hungary",        "length_km": 4.381, "laps": 70, "corners": 14, "type": "Road"},
    "spa":          {"name": "Circuit de Spa-Francorchamps",       "location": "Stavelot, Belgium",        "length_km": 7.004, "laps": 44, "corners": 19, "type": "Road"},
    "zandvoort":    {"name": "Circuit Zandvoort",                  "location": "Zandvoort, Netherlands",   "length_km": 4.259, "laps": 72, "corners": 14, "type": "Road"},
    "monza":        {"name": "Autodromo Nazionale Monza",          "location": "Monza, Italy",             "length_km": 5.793, "laps": 53, "corners": 11, "type": "Road"},
    "baku":         {"name": "Baku City Circuit",                  "location": "Baku, Azerbaijan",         "length_km": 6.003, "laps": 51, "corners": 20, "type": "Street"},
    "singapore":    {"name": "Marina Bay Street Circuit",          "location": "Singapore",                "length_km": 4.940, "laps": 62, "corners": 23, "type": "Street"},
    "americas":     {"name": "Circuit of the Americas",            "location": "Austin, USA",              "length_km": 5.513, "laps": 56, "corners": 20, "type": "Road"},
    "mexico_city":  {"name": "Autodromo Hermanos Rodriguez",       "location": "Mexico City, Mexico",      "length_km": 4.304, "laps": 71, "corners": 17, "type": "Road"},
    "madrid":       {"name": "Madring",                            "location": "Madrid, Spain",            "length_km": 5.470, "laps": 57, "corners": 22, "type": "Street"},
    "interlagos":   {"name": "Autodromo Jose Carlos Pace",         "location": "Sao Paulo, Brazil",        "length_km": 4.309, "laps": 71, "corners": 15, "type": "Road"},
    "vegas":        {"name": "Las Vegas Strip Circuit",            "location": "Las Vegas, USA",           "length_km": 6.201, "laps": 50, "corners": 17, "type": "Street"},
    "losail":       {"name": "Lusail International Circuit",       "location": "Lusail, Qatar",            "length_km": 5.380, "laps": 57, "corners": 16, "type": "Road"},
    "yas_marina":   {"name": "Yas Marina Circuit",                 "location": "Abu Dhabi, UAE",           "length_km": 5.281, "laps": 58, "corners": 16, "type": "Road"},
}

# 2026 teams — derived from the simulation's driver database so the API,
# qualifying roster, and race engine can never disagree about the grid.
from simulation.ai_opponents import DRIVER_DATABASE, TEAM_INFO


def _build_teams() -> List[Dict]:
    teams: Dict[str, Dict] = {}
    for d in DRIVER_DATABASE.values():
        entry = teams.setdefault(d.team, {
            "name": d.team,
            "color": TEAM_INFO.get(d.team, {}).get("color", "#888888"),
            "team_id": TEAM_INFO.get(d.team, {}).get("team_id", d.team[:3].upper()),
            "drivers": [],
            "driver_numbers": [],
        })
        entry["drivers"].append(d.name.split(" ")[-1])
        entry["driver_numbers"].append(d.number)
    return list(teams.values())


TEAMS = _build_teams()

COMPOUNDS = {
    "SOFT":         {"grip": 10, "durability": 3, "optimal_range_laps": "8-14",  "color": "#FF1E00", "warmup_laps": 1},
    "MEDIUM":       {"grip": 7,  "durability": 6, "optimal_range_laps": "15-25", "color": "#FFEA00", "warmup_laps": 2},
    "HARD":         {"grip": 5,  "durability": 9, "optimal_range_laps": "25-40", "color": "#FFFFFF", "warmup_laps": 3},
    "INTERMEDIATE": {"grip": 6,  "durability": 5, "optimal_range_laps": "10-20", "color": "#43B02A", "warmup_laps": 2},
    "WET":          {"grip": 4,  "durability": 7, "optimal_range_laps": "15-30", "color": "#0067CE", "warmup_laps": 2},
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val) -> Optional[float]:
    """Convert a pandas/numpy value to a plain Python float, None if NaN."""
    try:
        f = float(val)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> Optional[int]:
    try:
        f = float(val)
        if f != f:
            return None
        return int(f)
    except (TypeError, ValueError):
        return None


def _timedelta_to_s(td) -> Optional[float]:
    """Convert pandas Timedelta to total seconds, None if NaT."""
    try:
        return td.total_seconds()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# FastF1 ingestion
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    year: int
    gp: str              # e.g. 'Bahrain', 'Monaco', or round number as string
    session: str = "R"   # R, Q, FP1, FP2, FP3, S (Sprint)


def _ingest_session(year: int, gp: str, session_type: str) -> dict:
    """
    Pull a full FastF1 session into the SQLite database.

    FastF1 caches data locally so subsequent calls are instant.
    One session load returns: laps (all drivers), weather, car data.
    """
    if not _FF1_AVAILABLE:
        raise RuntimeError("FastF1 is not installed")

    session = fastf1.get_session(year, gp, session_type)
    session.load(laps=True, weather=True, telemetry=False, messages=False)

    circuit = session.event.get("OfficialEventName", str(gp))
    event_name = session.event.get("EventName", str(gp))
    date_str = str(session.event.get("EventDate", ""))

    # Upsert session row
    with db() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO sessions (year, event_name, session_type, circuit, date)
            VALUES (?, ?, ?, ?, ?)
        """, (year, event_name, session_type, circuit, date_str))
        row = conn.execute("""
            SELECT id FROM sessions WHERE year=? AND event_name=? AND session_type=?
        """, (year, event_name, session_type)).fetchone()
        session_id = row["id"]

        # Wipe old lap/weather rows for this session so we can re-ingest cleanly
        conn.execute("DELETE FROM laps    WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM weather WHERE session_id=?", (session_id,))

    # --- Laps ---
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
            _timedelta_to_s(lap.get("LapTime")),
            _timedelta_to_s(lap.get("Sector1Time")),
            _timedelta_to_s(lap.get("Sector2Time")),
            _timedelta_to_s(lap.get("Sector3Time")),
            int(bool(lap.get("IsAccurate", True))),
            _safe_int(lap.get("Stint")),
            str(lap.get("TrackStatus", "")) or None,
            _safe_int(lap.get("Position")),
            _timedelta_to_s(lap.get("PitInTime")),
            _timedelta_to_s(lap.get("PitOutTime")),
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

    # --- Weather ---
    weather_df = session.weather_data
    if weather_df is not None and not weather_df.empty:
        weather_rows = []
        for _, w in weather_df.iterrows():
            time_s = _timedelta_to_s(w.get("Time"))
            weather_rows.append((
                session_id,
                time_s,
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
            """, weather_rows)

    return {
        "session_id": session_id,
        "year": year,
        "event": event_name,
        "session_type": session_type,
        "laps_ingested": len(lap_rows),
        "weather_rows_ingested": len(weather_df) if weather_df is not None else 0,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/tracks")
def get_tracks():
    return {"tracks": list(TRACK_DATABASE.values()), "count": len(TRACK_DATABASE)}


@router.get("/tracks/{track_name}")
def get_track_detail(track_name: str):
    track = TRACK_DATABASE.get(track_name.lower().replace(" ", "_"))
    if not track:
        return {"error": f"Track not found: {track_name}", "available": list(TRACK_DATABASE.keys())}
    return {"track": track}


@router.get("/teams")
def get_teams():
    return {"teams": TEAMS, "count": len(TEAMS)}


@router.get("/compounds")
def get_compounds():
    return {"compounds": COMPOUNDS}


@router.post("/ingest")
def ingest_session(req: IngestRequest, background_tasks: BackgroundTasks):
    """
    Trigger FastF1 data ingestion for a specific race weekend session.

    FastF1 is open source — no API key required. Data is cached locally
    so subsequent calls for the same session return instantly.

    Example body:
        {"year": 2024, "gp": "Bahrain", "session": "R"}
    """
    if not _FF1_AVAILABLE:
        raise HTTPException(503, "FastF1 library not available")

    # Run synchronously (data is small enough; background would need job tracking)
    try:
        result = _ingest_session(req.year, req.gp, req.session)
        return {"status": "ok", "result": result}
    except Exception as exc:
        logger.error("Ingestion failed: %s", exc, exc_info=True)
        raise HTTPException(500, str(exc))


@router.get("/sessions")
def list_sessions():
    """List all ingested sessions in the local database."""
    with db() as conn:
        rows = conn.execute("""
            SELECT s.id, s.year, s.event_name, s.session_type, s.circuit, s.date,
                   s.ingested_at,
                   COUNT(l.id) AS lap_count
            FROM sessions s
            LEFT JOIN laps l ON l.session_id = s.id
            GROUP BY s.id
            ORDER BY s.year DESC, s.event_name
        """).fetchall()
    return {"sessions": [dict(r) for r in rows], "count": len(rows)}


@router.get("/sessions/{session_id}/laps")
def get_session_laps(
    session_id: int,
    driver: Optional[str] = Query(None, description="Filter by driver code, e.g. VER"),
    compound: Optional[str] = Query(None, description="Filter by compound, e.g. SOFT"),
):
    """Get lap data for an ingested session, with optional driver/compound filters."""
    with db() as conn:
        query = "SELECT * FROM laps WHERE session_id=?"
        params: list = [session_id]
        if driver:
            query += " AND driver=?"
            params.append(driver.upper())
        if compound:
            query += " AND compound=?"
            params.append(compound.upper())
        query += " ORDER BY lap_number"
        rows = conn.execute(query, params).fetchall()
    return {"laps": [dict(r) for r in rows], "count": len(rows)}


@router.get("/sessions/{session_id}/weather")
def get_session_weather(session_id: int):
    """Get weather timeline for an ingested session."""
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM weather WHERE session_id=? ORDER BY time_s",
            (session_id,)
        ).fetchall()
    return {"weather": [dict(r) for r in rows]}


@router.get("/sessions/{session_id}/summary")
def get_session_summary(session_id: int):
    """
    Aggregated stats per driver for a session:
    fastest lap, median lap, avg tyre life per stint, pit count.
    """
    with db() as conn:
        rows = conn.execute("""
            SELECT
                driver, team,
                COUNT(*) AS total_laps,
                ROUND(MIN(CASE WHEN is_valid=1 AND lap_time_s > 60 THEN lap_time_s END), 3) AS fastest_lap_s,
                ROUND(AVG(CASE WHEN is_valid=1 AND lap_time_s > 60 THEN lap_time_s END), 3) AS avg_lap_s,
                MAX(tyre_life) AS max_tyre_life,
                COUNT(DISTINCT stint) AS stints,
                MAX(position) AS worst_pos,
                MIN(position) AS best_pos
            FROM laps
            WHERE session_id=?
            GROUP BY driver, team
            ORDER BY fastest_lap_s ASC NULLS LAST
        """, (session_id,)).fetchall()

        weather = conn.execute("""
            SELECT
                ROUND(AVG(air_temp),1)   AS avg_air_temp,
                ROUND(AVG(track_temp),1) AS avg_track_temp,
                ROUND(AVG(humidity),1)   AS avg_humidity,
                SUM(rainfall)            AS rainfall_periods
            FROM weather WHERE session_id=?
        """, (session_id,)).fetchone()

    return {
        "drivers": [dict(r) for r in rows],
        "weather_summary": dict(weather) if weather else {},
    }


@router.get("/sessions/{session_id}/tire_degradation")
def get_tire_degradation(session_id: int):
    """
    Per-compound lap-time progression averaged across all drivers.
    Useful for training the tire degradation ML model with real data.
    """
    with db() as conn:
        rows = conn.execute("""
            SELECT
                compound,
                tyre_life,
                ROUND(AVG(lap_time_s), 3)  AS avg_lap_s,
                ROUND(MIN(lap_time_s), 3)  AS min_lap_s,
                COUNT(*)                   AS sample_count
            FROM laps
            WHERE session_id=?
              AND is_valid=1
              AND lap_time_s > 60
              AND compound IN ('SOFT','MEDIUM','HARD')
              AND tyre_life IS NOT NULL
            GROUP BY compound, tyre_life
            ORDER BY compound, tyre_life
        """, (session_id,)).fetchall()
    return {"degradation": [dict(r) for r in rows]}


@router.get("/fastf1/status")
def fastf1_status():
    """Check FastF1 availability and cache location."""
    return {
        "available": _FF1_AVAILABLE,
        "version": fastf1.__version__ if _FF1_AVAILABLE else None,
        "cache_dir": _CACHE_DIR,
        "requires_api_key": False,
        "note": "FastF1 is open source. Data sourced from F1 live timing + Ergast API.",
    }
