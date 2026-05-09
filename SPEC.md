# Scuderia V2 — Master Specification

## Architecture
```
project/
├── backend/                    # Python FastAPI + ML + Simulation
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── routers/
│   │   │   ├── race.py        # Race simulation endpoints
│   │   │   ├── strategy.py    # ML strategy predictions
│   │   │   ├── weather.py     # Weather data & forecasts
│   │   │   └── data.py        # FastF1 data endpoints
│   │   ├── simulation/
│   │   │   ├── engine.py      # Main simulation loop
│   │   │   ├── physics.py     # Car physics, tire, fuel models
│   │   │   ├── weather.py     # Weather system (Markov chain)
│   │   │   ├── ai_opponents.py# AI driver behavior
│   │   │   ├── tracks.py      # Track database (24 circuits)
│   │   │   └── events.py      # Safety car, incidents, flags
│   │   ├── ml/
│   │   │   ├── train_tire.py  # Tire degradation model trainer
│   │   │   ├── train_laptime.py # Lap time predictor trainer
│   │   │   ├── train_strategy.py # Strategy optimizer
│   │   │   ├── predict.py     # Real-time inference
│   │   │   └── features.py    # Feature engineering
│   │   └── models/            # Saved model artifacts
│   ├── data/
│   │   ├── ingest.py          # FastF1 data ingestion
│   │   └── cache/             # FastF1 cache directory
│   └── requirements.txt
│
├── frontend/                   # React V2 (deployed)
│   ├── src/
│   │   ├── pages/             # 6 screens
│   │   ├── components/        # Shared + feature components
│   │   └── hooks/             # API hooks, simulation hooks
│   └── public/
```

## Backend API Endpoints

### Race Simulation
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/race/start` | Start new race with config |
| POST | `/api/race/advance` | Advance 1 lap |
| POST | `/api/race/pit` | Player pit stop decision |
| GET | `/api/race/state` | Current race state |
| POST | `/api/race/ers` | Set ERS deployment mode |

### Strategy / ML
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/strategy/recommendation` | AI strategy suggestion |
| GET | `/api/strategy/pit-window` | Optimal pit window analysis |
| GET | `/api/strategy/tire-life` | Predicted tire life remaining |
| GET | `/api/strategy/win-probability` | Win probability chart data |

### Weather
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/weather/current` | Current weather state |
| GET | `/api/weather/forecast` | Upcoming laps forecast |
| GET | `/api/weather/history/{track}` | Historical weather by track |

### Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/data/tracks` | List all tracks with parameters |
| GET | `/api/data/teams` | Team performance data |
| POST | `/api/data/refresh` | Refresh FastF1 data |

## Key Data Structures

### RaceState
```json
{
  "lap": 4, "total_laps": 44, "status": "GREEN_FLAG",
  "leaderboard": [...],
  "player": {"position": 1, "tire": {"compound": "SOFT", "age": 3, "wear": 0.25}},
  "weather": {"condition": "DRY", "track_temp": 32, "air_temp": 16, "rain_probability": 0.05},
  "messages": [{"type": "WARNING", "text": "Rain expected in 8 laps", "confidence": 0.72}]
}
```

### StrategyMessage
```json
{"type": "URGENT|WARNING|INFO|OPPORTUNITY", "text": "...", "confidence": 0.85, "trigger_lap": 12}
```

## ML Models (pre-trained, shipped with backend)
1. `tire_degradation_lgbm.pkl` — LightGBM for tire degradation prediction
2. `lap_time_lgbm.pkl` — LightGBM for lap time prediction
3. `strategy_mcts.json` — MCTS strategy tree parameters

## Implementation Priority
P0: Simulation engine + FastAPI + Frontend scaffold + Dashboard
P1: ML training pipeline + Tire/laptime models + Weather system
P2: AI opponents + Strategy optimizer + V2 UI features
P3: Advanced features (ERS modeling, full track evolution)
