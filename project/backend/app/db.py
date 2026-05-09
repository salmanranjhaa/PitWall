"""
SQLite database module.

Creates and manages a local SQLite database to store FastF1 data
(race sessions, per-lap data, weather snapshots) so subsequent
API calls don't need to re-download from FastF1 every time.

Database file: backend/data/f1sim.db
"""

import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "f1sim.db")


def _ensure_data_dir():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_connection() -> sqlite3.Connection:
    _ensure_data_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist yet."""
    _ensure_data_dir()
    with db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                year            INTEGER NOT NULL,
                event_name      TEXT    NOT NULL,
                session_type    TEXT    NOT NULL,
                circuit         TEXT    NOT NULL,
                date            TEXT,
                ingested_at     TEXT    DEFAULT (datetime('now')),
                UNIQUE(year, event_name, session_type)
            );

            CREATE TABLE IF NOT EXISTS laps (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id      INTEGER NOT NULL REFERENCES sessions(id),
                driver          TEXT    NOT NULL,
                team            TEXT,
                lap_number      INTEGER NOT NULL,
                compound        TEXT,
                tyre_life       INTEGER,
                lap_time_s      REAL,
                sector1_s       REAL,
                sector2_s       REAL,
                sector3_s       REAL,
                is_valid        INTEGER DEFAULT 1,
                stint           INTEGER,
                track_status    TEXT,
                position        INTEGER,
                pit_in_time_s   REAL,
                pit_out_time_s  REAL,
                speed_trap      REAL,
                is_personal_best INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS weather (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER NOT NULL REFERENCES sessions(id),
                time_s      REAL,
                air_temp    REAL,
                track_temp  REAL,
                humidity    REAL,
                pressure    REAL,
                wind_speed  REAL,
                wind_dir    REAL,
                rainfall    INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_laps_session ON laps(session_id);
            CREATE INDEX IF NOT EXISTS idx_laps_driver  ON laps(driver);
            CREATE INDEX IF NOT EXISTS idx_weather_session ON weather(session_id);
        """)
