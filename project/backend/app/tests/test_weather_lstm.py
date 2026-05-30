"""Scenario tests for recurrent weather forecasting."""

from simulation.tracks import get_track
from simulation.weather import WeatherState, WeatherSystem


def test_lstm_blended_forecast_returns_lap_states():
    system = WeatherSystem(get_track("Spa"), race_month=8, random_seed=42)
    current = WeatherState(
        condition="DRIZZLE",
        air_temp=18.0,
        track_temp=23.0,
        humidity=82.0,
        rain_intensity=0.15,
        track_dampness=0.22,
        wind_speed=8.0,
    )

    forecast = system.get_forecast(current, 6)

    assert len(forecast) == 6
    assert all(0.0 <= state.track_dampness <= 1.0 for state in forecast)
    assert all(state.condition in ("DRY", "DRIZZLE", "LIGHT_RAIN", "HEAVY_RAIN") for state in forecast)


def test_forecast_does_not_mutate_race_weather_rng():
    track = get_track("Silverstone")
    current = WeatherState(condition="DRY", air_temp=20.0, track_temp=34.0, humidity=55.0)

    system_a = WeatherSystem(track, race_month=7, random_seed=9)
    system_b = WeatherSystem(track, race_month=7, random_seed=9)

    system_a.get_forecast(current, 10)
    next_a = system_a.advance(current)
    next_b = system_b.advance(current)

    assert next_a == next_b
