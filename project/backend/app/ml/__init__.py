"""
ML pipeline for F1 Race Strategy Simulator.

Exposes the MLPredictor singleton and feature engineering utilities
for tire degradation and lap time prediction models.
"""

from .predict import MLPredictor, predictor
from .features import extract_tire_features, extract_laptime_features

__all__ = [
    "MLPredictor",
    "predictor",
    "extract_tire_features",
    "extract_laptime_features",
]
