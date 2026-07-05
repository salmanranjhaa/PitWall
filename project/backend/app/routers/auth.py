"""
Auth & Player Profile Endpoints

Basic account system for the gamified experience:
- Register / login with salted PBKDF2 password hashing (stdlib only)
- Bearer tokens stored server-side in SQLite
- Race results are validated against the live race engine (not client-supplied)
  and converted to championship points, wins, podiums for the player profile.
"""

import hashlib
import logging
import secrets
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from db import db, init_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])
profile_router = APIRouter(prefix="/api/profile", tags=["profile"])

init_db()

# F1 championship scoring
POINTS_BY_POSITION = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}

_PBKDF2_ITERATIONS = 200_000


# ---------------------------------------------------------------------------
# Password / token helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"

def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$")
        expected = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), _PBKDF2_ITERATIONS
        )
        return secrets.compare_digest(expected.hex(), digest_hex)
    except (ValueError, TypeError):
        return False

def _issue_token(user_id: int) -> str:
    token = secrets.token_hex(32)
    with db() as conn:
        conn.execute("INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)", (token, user_id))
    return token

def _user_from_token(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    with db() as conn:
        row = conn.execute(
            """SELECT u.id, u.username, u.display_name, u.created_at
               FROM auth_tokens t JOIN users u ON u.id = t.user_id
               WHERE t.token = ?""",
            (token,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return dict(row)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_\-]+$")
    password: str = Field(..., min_length=6, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=40)

class LoginRequest(BaseModel):
    username: str
    password: str

class RaceResultRequest(BaseModel):
    session_id: str = Field(..., description="Finished race session ID")


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@router.post("/register")
def register(req: RegisterRequest):
    display_name = (req.display_name or req.username).strip() or req.username
    with db() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (req.username,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        cur = conn.execute(
            "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
            (req.username, display_name, _hash_password(req.password)),
        )
        user_id = cur.lastrowid
    token = _issue_token(user_id)
    return {"token": token, "user": {"id": user_id, "username": req.username, "display_name": display_name}}


@router.post("/login")
def login(req: LoginRequest):
    with db() as conn:
        row = conn.execute(
            "SELECT id, username, display_name, password_hash FROM users WHERE username = ?",
            (req.username,),
        ).fetchone()
    if row is None or not _verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = _issue_token(row["id"])
    return {
        "token": token,
        "user": {"id": row["id"], "username": row["username"], "display_name": row["display_name"]},
    }


@router.post("/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        with db() as conn:
            conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
    return {"status": "ok"}


@router.get("/me")
def me(authorization: Optional[str] = Header(default=None)):
    return {"user": _user_from_token(authorization)}


# ---------------------------------------------------------------------------
# Profile / gamification endpoints
# ---------------------------------------------------------------------------

@profile_router.post("/race-result")
def submit_race_result(req: RaceResultRequest, authorization: Optional[str] = Header(default=None)):
    """
    Record a finished race for the authenticated player.

    The result is read from the server-side race engine, so the client
    cannot submit an arbitrary finishing position.
    """
    user = _user_from_token(authorization)

    from routers.race import _race_engines
    engine = _race_engines.get(req.session_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Race session not found")

    state = engine.get_state()
    status = getattr(state, "status", None) or (state.get("status") if isinstance(state, dict) else None)
    if status != "FINISHED":
        raise HTTPException(status_code=409, detail="Race is not finished yet")

    player = getattr(state, "player", None)
    if player is None:
        raise HTTPException(status_code=500, detail="No player car in session")

    position = int(player.position)
    dnf = not bool(player.alive)
    points = 0 if dnf else POINTS_BY_POSITION.get(position, 0)
    track = getattr(getattr(engine, "track", None), "name", "Unknown")
    team = getattr(engine, "player_team", "Unknown")
    total_laps = int(getattr(state, "total_laps", 0))

    with db() as conn:
        already = conn.execute(
            "SELECT id FROM race_results WHERE user_id = ? AND session_key = ?",
            (user["id"], req.session_id),
        ).fetchone()
        if already:
            raise HTTPException(status_code=409, detail="Result already recorded for this race")
        conn.execute(
            """INSERT INTO race_results
               (user_id, session_key, track, team, position, total_laps, pits, dnf, points)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user["id"], req.session_id, track, team, position, total_laps,
             int(player.pits), int(dnf), points),
        )

    return {
        "recorded": True,
        "position": position,
        "dnf": dnf,
        "points": points,
        "is_win": position == 1 and not dnf,
        "is_podium": position <= 3 and not dnf,
    }


@profile_router.get("")
def get_profile(authorization: Optional[str] = Header(default=None)):
    """Player profile: career stats plus recent race history."""
    user = _user_from_token(authorization)
    with db() as conn:
        stats = conn.execute(
            """SELECT COUNT(*)                                   AS races,
                      COALESCE(SUM(points), 0)                   AS points,
                      COALESCE(SUM(position = 1 AND dnf = 0), 0) AS wins,
                      COALESCE(SUM(position <= 3 AND dnf = 0), 0) AS podiums,
                      COALESCE(SUM(dnf), 0)                      AS dnfs,
                      MIN(CASE WHEN dnf = 0 THEN position END)   AS best_finish
               FROM race_results WHERE user_id = ?""",
            (user["id"],),
        ).fetchone()
        history = conn.execute(
            """SELECT track, team, position, total_laps, pits, dnf, points, created_at
               FROM race_results WHERE user_id = ?
               ORDER BY created_at DESC, id DESC LIMIT 20""",
            (user["id"],),
        ).fetchall()

    races = stats["races"] or 0
    points = stats["points"] or 0
    wins = stats["wins"] or 0
    podiums = stats["podiums"] or 0

    # Simple driver-rating tiers driven by career points
    if points >= 200:   tier = "WORLD CHAMPION"
    elif points >= 100: tier = "RACE WINNER"
    elif points >= 40:  tier = "PODIUM CONTENDER"
    elif points >= 10:  tier = "POINTS SCORER"
    else:               tier = "ROOKIE"

    return {
        "user": user,
        "stats": {
            "races": races,
            "points": points,
            "wins": wins,
            "podiums": podiums,
            "dnfs": stats["dnfs"] or 0,
            "best_finish": stats["best_finish"],
            "avg_points": round(points / races, 2) if races else 0.0,
            "tier": tier,
        },
        "history": [dict(r) for r in history],
    }


@profile_router.get("/leaderboard")
def global_leaderboard(limit: int = 20):
    """Global player standings ordered by career points."""
    limit = max(1, min(100, limit))
    with db() as conn:
        rows = conn.execute(
            """SELECT u.username, u.display_name,
                      COUNT(r.id)                                  AS races,
                      COALESCE(SUM(r.points), 0)                   AS points,
                      COALESCE(SUM(r.position = 1 AND r.dnf = 0), 0) AS wins,
                      COALESCE(SUM(r.position <= 3 AND r.dnf = 0), 0) AS podiums
               FROM users u LEFT JOIN race_results r ON r.user_id = u.id
               GROUP BY u.id
               ORDER BY points DESC, wins DESC, races ASC
               LIMIT ?""",
            (limit,),
        ).fetchall()
    return {
        "standings": [
            {"rank": i + 1, **dict(row)} for i, row in enumerate(rows)
        ]
    }
