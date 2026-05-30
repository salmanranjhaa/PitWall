"""Scenario tests for MCTS strategy planning."""

from ml.strategy_mcts import MCTSStrategyPlanner


class DummyPredictor:
    def predict_lap_time(self, track, driver, compound, tire_age, fuel_load, weather_state=None):
        base = 90.0
        compound_delta = {"SOFT": -0.5, "MEDIUM": 0.0, "HARD": 0.6, "INTERMEDIATE": 4.0, "WET": 8.0}[compound]
        deg = {"SOFT": 0.12, "MEDIUM": 0.06, "HARD": 0.035, "INTERMEDIATE": 0.04, "WET": 0.03}[compound]
        dampness = float((weather_state or {}).get("track_dampness", 0.0))
        wet_penalty = 12.0 if dampness > 0.25 and compound in ("SOFT", "MEDIUM", "HARD") else 0.0
        return base + compound_delta + tire_age * deg + fuel_load * 0.03 + wet_penalty


def base_state(**overrides):
    state = {
        "current_lap": 25,
        "total_laps": 57,
        "current_position": 4,
        "compound": "MEDIUM",
        "tire_age": 12,
        "fuel_remaining_kg": 48.0,
        "pits": 0,
        "gap_to_next": 2.0,
        "gap_to_behind": 3.5,
        "track_name": "bahrain",
        "weather": {"track_dampness": 0.0, "rain_intensity": 0.0, "is_raining": False},
        "dry_compounds_used": ["MEDIUM"],
    }
    state.update(overrides)
    return state


def test_mcts_pits_for_worn_soft_near_cliff():
    planner = MCTSStrategyPlanner(DummyPredictor(), iterations=90, rollout_depth=10, random_seed=7)
    rec = planner.recommend(base_state(compound="SOFT", tire_age=24))
    assert rec["recommendation"] == "PIT_NOW"
    assert rec["recommended_compound"] in ("MEDIUM", "HARD")
    assert rec["mcts"]["root_visits"] == 90


def test_mcts_selects_wet_compound_for_wet_track():
    planner = MCTSStrategyPlanner(DummyPredictor(), iterations=90, rollout_depth=8, random_seed=11)
    rec = planner.recommend(base_state(
        compound="MEDIUM",
        tire_age=4,
        weather={"track_dampness": 0.72, "rain_intensity": 0.85, "is_raining": True},
    ))
    assert rec["recommendation"] == "PIT_NOW"
    assert rec["recommended_compound"] == "WET"


def test_mcts_keeps_fresh_tires_in_dry_conditions():
    planner = MCTSStrategyPlanner(DummyPredictor(), iterations=90, rollout_depth=8, random_seed=13)
    rec = planner.recommend(base_state(compound="MEDIUM", tire_age=3, dry_compounds_used=["SOFT", "MEDIUM"]))
    assert rec["recommendation"] == "STAY_OUT"
