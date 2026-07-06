"""
Weather Endpoints

Provides current weather conditions, forecasts, and historical weather
patterns for each track on the F1 calendar.
"""

import json
import logging
import random
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/weather", tags=["weather"])

# ---------------------------------------------------------------------------
# Circuit GPS coordinates for Open-Meteo real-weather queries
# ---------------------------------------------------------------------------
TRACK_COORDINATES: Dict[str, Tuple[float, float]] = {
    "Bahrain":    (26.032,   50.510),
    "Jeddah":     (21.633,   39.105),
    "Melbourne":  (-37.849, 144.968),
    "Suzuka":     (34.843,  136.541),
    "Shanghai":   (31.339,  121.220),
    "Miami":      (25.958,  -80.238),
    "Imola":      (44.344,   11.713),
    "Monaco":     (43.737,    7.421),
    "Canada":     (45.504,  -73.522),
    "Spain":      (41.570,    2.261),
    "Austria":    (47.220,   14.764),
    "Silverstone":(52.073,   -1.017),
    "Hungary":    (47.583,   19.249),
    "Spa":        (50.437,    5.971),
    "Zandvoort":  (52.388,    4.540),
    "Monza":      (45.616,    9.290),
    "Baku":       (40.372,   49.853),
    "Singapore":  (1.291,   103.863),
    "COTA":       (30.133,  -97.636),
    "Mexico":     (19.405,  -99.091),
    "Madrid":     (40.468,   -3.616),
    "Brazil":     (-23.701, -46.697),
    "Las Vegas":  (36.113,  -115.173),
    "Qatar":      (25.490,   51.454),
    "Abu Dhabi":  (24.469,   54.603),
}

# WMO weather code → readable condition
def _wmo_to_condition(code: int) -> str:
    if code == 0:       return "CLEAR"
    if code <= 3:       return "PARTLY_CLOUDY"
    if code <= 48:      return "FOGGY"
    if code <= 57:      return "DRIZZLE"
    if code <= 67:      return "RAIN"
    if code <= 77:      return "SNOW"
    if code <= 82:      return "SHOWERS"
    if code <= 99:      return "THUNDERSTORM"
    return "UNKNOWN"

def _fetch_open_meteo(lat: float, lon: float) -> Dict[str, Any]:
    params = urlencode({
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m",
        "hourly": "temperature_2m,precipitation_probability,rain,weather_code",
        "forecast_days": 1,
        "timezone": "auto",
    })
    url = f"https://api.open-meteo.com/v1/forecast?{params}"
    with urlopen(url, timeout=6) as resp:
        return json.loads(resp.read())

# ---------------------------------------------------------------------------
# Track-specific weather profiles (static knowledge base)
# ---------------------------------------------------------------------------
TRACK_WEATHER_PROFILES: Dict[str, Dict] = {
    "silverstone": {"avg_rain_races": 0.35, "avg_air_temp": 18, "avg_track_temp": 35, "humidity": 65, "wind_speed": 15},
    "spa": {"avg_rain_races": 0.55, "avg_air_temp": 16, "avg_track_temp": 30, "humidity": 72, "wind_speed": 12},
    "monaco": {"avg_rain_races": 0.20, "avg_air_temp": 22, "avg_track_temp": 40, "humidity": 55, "wind_speed": 8},
    "monza": {"avg_rain_races": 0.25, "avg_air_temp": 24, "avg_track_temp": 42, "humidity": 50, "wind_speed": 10},
    "bahrain": {"avg_rain_races": 0.02, "avg_air_temp": 30, "avg_track_temp": 48, "humidity": 30, "wind_speed": 18},
    "jeddah": {"avg_rain_races": 0.01, "avg_air_temp": 28, "avg_track_temp": 38, "humidity": 55, "wind_speed": 20},
    "albert_park": {"avg_rain_races": 0.30, "avg_air_temp": 20, "avg_track_temp": 35, "humidity": 58, "wind_speed": 14},
    "suzuka": {"avg_rain_races": 0.40, "avg_air_temp": 19, "avg_track_temp": 32, "humidity": 70, "wind_speed": 16},
    "shanghai": {"avg_rain_races": 0.30, "avg_air_temp": 20, "avg_track_temp": 34, "humidity": 62, "wind_speed": 11},
    "miami": {"avg_rain_races": 0.25, "avg_air_temp": 28, "avg_track_temp": 45, "humidity": 68, "wind_speed": 18},
    "baku": {"avg_rain_races": 0.10, "avg_air_temp": 25, "avg_track_temp": 38, "humidity": 52, "wind_speed": 22},
    "barcelona": {"avg_rain_races": 0.15, "avg_air_temp": 23, "avg_track_temp": 40, "humidity": 48, "wind_speed": 12},
    "red_bull_ring": {"avg_rain_races": 0.30, "avg_air_temp": 20, "avg_track_temp": 35, "humidity": 55, "wind_speed": 10},
    "hungaroring": {"avg_rain_races": 0.25, "avg_air_temp": 24, "avg_track_temp": 42, "humidity": 50, "wind_speed": 9},
    "zandvoort": {"avg_rain_races": 0.35, "avg_air_temp": 17, "avg_track_temp": 30, "humidity": 75, "wind_speed": 25},
    "singapore": {"avg_rain_races": 0.45, "avg_air_temp": 28, "avg_track_temp": 35, "humidity": 82, "wind_speed": 8},
    "yas_marina": {"avg_rain_races": 0.02, "avg_air_temp": 27, "avg_track_temp": 38, "humidity": 55, "wind_speed": 16},
    "interlagos": {"avg_rain_races": 0.35, "avg_air_temp": 22, "avg_track_temp": 38, "humidity": 60, "wind_speed": 10},
    "vegas": {"avg_rain_races": 0.05, "avg_air_temp": 18, "avg_track_temp": 28, "humidity": 25, "wind_speed": 14},
    "default": {"avg_rain_races": 0.20, "avg_air_temp": 22, "avg_track_temp": 38, "humidity": 55, "wind_speed": 12},
}


def _normalize_track(track_name: str) -> str:
    return track_name.lower().replace(" ", "_")


def _get_profile(track_name: str) -> Dict:
    return TRACK_WEATHER_PROFILES.get(_normalize_track(track_name), TRACK_WEATHER_PROFILES["default"])


def _generate_forecast(track_name: str, n_laps: int = 10) -> List[Dict]:
    """Generate a plausible lap-by-lap weather forecast."""
    profile = _get_profile(track_name)
    base_rain_prob = profile["avg_rain_races"]

    forecast = []
    current_rain_prob = base_rain_prob
    condition = "DRY"

    for lap in range(1, n_laps + 1):
        # Simple Markov-like evolution
        change = random.uniform(-0.02, 0.02)
        current_rain_prob = max(0.0, min(1.0, current_rain_prob + change))

        if current_rain_prob < 0.1:
            condition = "DRY"
        elif current_rain_prob < 0.3:
            condition = "DRY_DAMP"
        elif current_rain_prob < 0.5:
            condition = "LIGHT_RAIN"
        elif current_rain_prob < 0.7:
            condition = "MODERATE_RAIN"
        else:
            condition = "HEAVY_RAIN"

        forecast.append({
            "lap": lap,
            "rain_probability": round(current_rain_prob, 4),
            "condition": condition,
            "air_temp": round(profile["avg_air_temp"] + random.uniform(-2, 2), 1),
            "track_temp": round(profile["avg_track_temp"] + random.uniform(-3, 3), 1),
        })

    return forecast


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


def _get_session_engine(session_id: str):
    """Look up an active race engine from the race router's session store."""
    try:
        from routers.race import _race_engines
    except ImportError:
        from .race import _race_engines
    return _race_engines.get(session_id)


@router.get("/current")
def get_current_weather(session_id: str):
    """
    Get current weather conditions for an active race session.

    Reads the live WeatherState from the session's race engine; falls back
    to a representative dry-weather default if the session is unknown.
    """
    engine = _get_session_engine(session_id)
    state = engine.get_state() if engine else None
    weather = getattr(state, "weather", None) if state else None

    if weather is not None:
        return {
            "session_id": session_id,
            "condition": weather.condition,
            "air_temp": weather.air_temp,
            "track_temp": weather.track_temp,
            "air_temperature": weather.air_temp,
            "track_temperature": weather.track_temp,
            "humidity": weather.humidity,
            "rain_probability": weather.rain_intensity,
            "is_raining": bool(weather.rain_intensity > 0.05),
            "track_dampness": weather.track_dampness,
            "wind_speed": weather.wind_speed,
            "forecast_next_10_laps": getattr(state, "weather_forecast", []),
        }

    # Unknown session — representative default
    return {
        "session_id": session_id,
        "condition": "DRY",
        "air_temp": 28,
        "track_temp": 42,
        "air_temperature": 28,
        "track_temperature": 42,
        "humidity": 45,
        "rain_probability": 0.05,
        "is_raining": False,
        "track_dampness": 0.0,
        "wind_speed": 12,
        "forecast_next_10_laps": _generate_forecast("bahrain", n_laps=10),
    }


@router.get("/forecast")
def get_session_forecast(session_id: str, laps: int = 10):
    """
    Lap-by-lap weather forecast for an active race session.

    This is the endpoint the frontend calls with a session_id query param;
    the /forecast/{track_name} variant below serves track-profile forecasts.
    """
    engine = _get_session_engine(session_id)
    if engine is not None and hasattr(engine, "get_weather_forecast"):
        return {"session_id": session_id, "forecast": engine.get_weather_forecast(laps)}

    return {"session_id": session_id, "forecast": _generate_forecast("default", n_laps=laps)}


@router.get("/history/{track_name}")
def get_weather_history(track_name: str):
    """
    Historical weather patterns for a track.

    Returns aggregate statistics: rain frequency, average temperatures,
    and typical humidity levels.
    """
    profile = _get_profile(track_name)

    return {
        "track": track_name,
        "avg_rain_races": profile["avg_rain_races"],
        "avg_air_temp_c": profile["avg_air_temp"],
        "avg_track_temp_c": profile["avg_track_temp"],
        "avg_humidity_pct": profile["humidity"],
        "avg_wind_speed_kmh": profile["wind_speed"],
        "typical_conditions": "Dry / Hot" if profile["avg_air_temp"] > 25 else "Mild / Variable",
    }


@router.get("/forecast/{track_name}")
def get_weather_forecast(track_name: str, laps: int = 10):
    """
    Get a lap-by-lap weather forecast for a track.

    Uses a Markov-chain-inspired model to produce realistic transitions
    between dry, damp, and rain conditions.
    """
    forecast = _generate_forecast(track_name, n_laps=laps)
    return {
        "track": track_name,
        "laps_forecasted": laps,
        "forecast": forecast,
    }


@router.get("/real-conditions")
def get_real_conditions(track: str):
    """
    Fetch live weather for a circuit from Open-Meteo (free, no API key).
    Falls back to historical profile data if the API is unreachable.

    Query param `track` must match a key in TRACK_COORDINATES (e.g. "Spa").
    """
    # Fuzzy lookup
    coords: Optional[Tuple[float, float]] = TRACK_COORDINATES.get(track)
    if coords is None:
        t_lower = track.lower()
        for key, val in TRACK_COORDINATES.items():
            if key.lower() in t_lower or t_lower in key.lower():
                coords = val
                break

    profile = _get_profile(track)

    if coords is None:
        # Unknown track — return profile-based estimate
        return {
            "source": "historical-profile",
            "track": track,
            "air_temp": profile["avg_air_temp"],
            "humidity": profile["humidity"],
            "wind_speed": profile["wind_speed"],
            "rain_mm": 0.0,
            "is_raining": False,
            "condition": "PARTLY_CLOUDY",
            "rain_probability": profile["avg_rain_races"],
            "forecast_6h": [],
        }

    try:
        data = _fetch_open_meteo(coords[0], coords[1])
        curr = data["current"]
        hourly = data["hourly"]

        # Build 6-hour forecast from hourly data
        forecast_6h = []
        for i in range(min(6, len(hourly.get("time", [])))):
            forecast_6h.append({
                "hour": i + 1,
                "temp": hourly["temperature_2m"][i],
                "rain_prob": hourly["precipitation_probability"][i],
                "rain_mm": hourly["rain"][i],
                "condition": _wmo_to_condition(hourly["weather_code"][i]),
            })

        air_temp = curr["temperature_2m"]
        rain_mm = curr.get("rain", 0.0)
        is_raining = rain_mm > 0.1
        condition = _wmo_to_condition(curr["weather_code"])
        rain_prob_now = forecast_6h[0]["rain_prob"] / 100.0 if forecast_6h else profile["avg_rain_races"]

        # Blend real temp with historical track temp offset
        temp_offset = profile["avg_track_temp"] - profile["avg_air_temp"]
        track_temp = round(air_temp + temp_offset, 1)

        return {
            "source": "open-meteo-live",
            "track": track,
            "air_temp": round(air_temp, 1),
            "track_temp": track_temp,
            "humidity": curr.get("relative_humidity_2m", profile["humidity"]),
            "wind_speed": round(curr.get("wind_speed_10m", profile["wind_speed"]), 1),
            "rain_mm": round(rain_mm, 2),
            "is_raining": is_raining,
            "condition": condition,
            "rain_probability": round(rain_prob_now, 3),
            "forecast_6h": forecast_6h,
        }

    except Exception as exc:
        logger.warning("Open-Meteo unavailable for %s: %s — using profile fallback", track, exc)
        return {
            "source": "historical-profile-fallback",
            "track": track,
            "air_temp": profile["avg_air_temp"],
            "track_temp": profile["avg_track_temp"],
            "humidity": profile["humidity"],
            "wind_speed": profile["wind_speed"],
            "rain_mm": 0.0,
            "is_raining": False,
            "condition": "PARTLY_CLOUDY",
            "rain_probability": profile["avg_rain_races"],
            "forecast_6h": [],
            "error": str(exc),
        }
