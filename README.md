# 🏎️ Scuderia — F1 Race Strategy Simulator

<div align="center">

![F1 Simulator Banner](https://img.shields.io/badge/Formula%201-Strategy%20Simulator-E10600?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![LightGBM](https://img.shields.io/badge/LightGBM-ML%20Engine-6B3FA0?style=for-the-badge)

**A full-stack Formula 1 race strategy simulator powered by real F1 data, machine learning, and autonomous BDI AI agents.**

[🚀 Quick Start](#-quick-start) · [🏗️ Architecture](#️-architecture) · [🤖 BDI Agents](#-bdi-agents) · [🧠 ML Pipeline](#-ml-pipeline) · [📡 API Reference](#-api-reference)

</div>

---

## 📖 Overview

Scuderia is a lap-by-lap Formula 1 race strategy simulator that places you in the role of a race engineer. You make real-time decisions — **tire strategy, pit stop timing, ERS deployment** — while competing against 19 AI opponents, each driven by an autonomous **BDI (Belief-Desire-Intention) agent** with a unique personality profile modelled on real 2025 F1 drivers.

The simulation is grounded in:
- **Real F1 telemetry** via the FastF1 Python library
- **Machine learning** for tire degradation and lap time prediction (LightGBM)
- **Monte Carlo Tree Search** for optimal strategy recommendation
- **Markov chain weather simulation** blended with an LSTM-style forecaster
- **Full qualifying simulation** (Q1 → Q2 → Q3 knockout) to generate realistic grids

---

## ✨ Features

| Feature | Description |
|---|---|
| 🏁 **Race Simulation** | Full lap-by-lap race with 20 drivers, pit stops, DRS, ERS, safety cars, red flags |
| 🤖 **BDI AI Agents** | Each AI driver has Beliefs, Desires & Intentions — they reason, commit to plans, model rivals |
| 🧠 **ML Lap Time Prediction** | LightGBM models trained on real FastF1 data for tire degradation & lap times |
| 🌧️ **Dynamic Weather** | Markov chain weather transitions (DRY → DRIZZLE → LIGHT_RAIN → HEAVY_RAIN) with tire crossover logic |
| 🎯 **MCTS Strategy Engine** | Monte Carlo Tree Search with 320 iterations + 18-lap rollouts for pit window advice |
| 🏟️ **24 F1 Circuits** | Authentic track database with tire severity, pit loss, DRS zones, fuel consumption |
| 📊 **Driver Profiles** | 20 real 2025 F1 drivers with 10 sub-attributes (PAC/RAC/AWA/EXP) driving BDI behaviour |
| 🔢 **Qualifying Session** | Full Q1/Q2/Q3 simulation with real elimination rules |
| 📡 **FastAPI Backend** | RESTful API with auto-generated Swagger docs |
| ⚛️ **React Dashboard** | Real-time strategy dashboard with live leaderboard, weather panel, sector flags |

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SCUDERIA F1 SIM                             │
│                                                                     │
│  ┌─────────────────────────┐      ┌──────────────────────────────┐  │
│  │      FRONTEND           │      │         BACKEND              │  │
│  │   React 19 + Vite       │◄────►│      FastAPI 0.104+          │  │
│  │   TypeScript 5.9        │      │      Python 3.11+            │  │
│  │   Tailwind + shadcn/ui  │      │      Uvicorn ASGI            │  │
│  │   Recharts + Framer     │      │                              │  │
│  │                         │      │  ┌────────────────────────┐  │  │
│  │  Pages:                 │      │  │    SIMULATION ENGINE    │  │  │
│  │  ├── Setup              │      │  │                        │  │  │
│  │  ├── Qualifying         │      │  │  RaceEngine            │  │  │
│  │  ├── Dashboard          │      │  │  ├─ WeatherSystem      │  │  │
│  │  ├── Strategy           │      │  │  ├─ CarPhysics         │  │  │
│  │  ├── Weather            │      │  │  ├─ BDI Agents (×19)   │  │  │
│  │  ├── Leaderboard        │      │  │  ├─ SafetyCarCtrl      │  │  │
│  │  └── Results            │      │  │  └─ EventBus           │  │  │
│  └─────────────────────────┘      │  └────────────────────────┘  │  │
│           │                       │                              │  │
│           │ HTTP / Proxy          │  ┌────────────────────────┐  │  │
│           │ localhost:3000→8000   │  │      ML PIPELINE       │  │  │
│           │                       │  │                        │  │  │
│           └───────────────────►   │  │  LightGBM (tire deg)  │  │  │
│                                   │  │  LightGBM (lap time)  │  │  │
│                                   │  │  MCTS Strategy Plan   │  │  │
│                                   │  │  FastF1 Data Ingest   │  │  │
│                                   │  └────────────────────────┘  │  │
│                                   │                              │  │
│                                   │  ┌────────────────────────┐  │  │
│                                   │  │       DATA LAYER       │  │  │
│                                   │  │  SQLite (FastF1 cache) │  │  │
│                                   │  │  FastF1 .pkl cache     │  │  │
│                                   │  └────────────────────────┘  │  │
│                                   └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Backend Module Map

```
project/backend/app/
│
├── main.py                    ← FastAPI app factory, CORS, router registration
├── db.py                      ← SQLite connection, WAL mode, schema
│
├── routers/                   ← API endpoint handlers
│   ├── race.py                ← /api/race/* — start, advance, pit, ERS
│   ├── strategy.py            ← /api/strategy/* — MCTS recommendations
│   ├── weather.py             ← /api/weather/* — current, forecast, history
│   ├── qualify.py             ← /api/qualify/* — qualifying session endpoints
│   └── data.py                ← /api/data/* — tracks, teams, FastF1 refresh
│
├── simulation/                ← Core simulation subsystems
│   ├── engine.py              ← RaceEngine — the main orchestrator (1,800+ lines)
│   ├── physics.py             ← CarPhysics, BlendedLapTimeEngine, tire models
│   ├── weather.py             ← WeatherSystem — Markov chain transitions
│   ├── weather_lstm.py        ← LSTM-style recurrent weather forecaster
│   ├── ai_opponents.py        ← AIOpponentController, Driver dataclass, DRIVER_DATABASE
│   ├── driver_profile.py      ← DriverProfile (10 sub-attributes) for all 20 drivers
│   ├── tracks.py              ← Track database — 24 F1 circuits
│   ├── events.py              ← SafetyCarController, RaceEventBus, FlagState
│   ├── qualifying.py          ← Full Q1/Q2/Q3 knockout simulation
│   └── sector.py              ← Sector time simulation
│
├── agents/                    ← BDI agent framework
│   ├── base.py                ← BDIAgent abstract base class
│   ├── beliefs.py             ← BeliefBase, TireBelief, RivalBelief, RaceContextBelief
│   ├── desires.py             ← GoalType enum, DesireSet deliberation engine
│   ├── plans.py               ← PlanName enum, PlanLibrary, Plan/PlanStep dataclasses
│   ├── driver_agent.py        ← DriverAgent — full BDI cycle (perceive→deliberate→execute)
│   ├── engineer_agent.py      ← RaceEngineerAgent — player-facing recommendations
│   └── personality.py        ← Personality derivation from DriverProfile + PlanSelector
│
└── ml/                        ← Machine learning pipeline
    ├── features.py            ← Feature engineering for tire/laptime models
    ├── predict.py             ← MLPredictor — real-time inference wrapper
    ├── strategy_mcts.py       ← MCTSStrategyPlanner — UCT tree search
    ├── train_tire.py          ← LightGBM tire degradation trainer
    └── train_laptime.py       ← LightGBM lap time predictor trainer
```

---

## 🤖 BDI Agents

The most technically interesting part of this project. Every AI driver is an **autonomous BDI agent** — not a simple scripted decision tree.

### What is BDI?

BDI (Belief-Desire-Intention) is a cognitive agent architecture where:

- **Beliefs** — the agent's model of the current world state (updated every lap)
- **Desires** — a priority-ranked set of goals the agent wants to achieve
- **Intentions** — the multi-lap plan the agent has committed to

### Why BDI fits F1

Every real F1 driver:
1. Maintains a *mental model* of the race — gap to rivals, tire wear, fuel, weather → **Beliefs**
2. Has *competing goals* — win the race, protect position, manage the tire, beat team-mate → **Desires**
3. *Commits to a plan* that spans multiple laps — undercut window, safety car gamble, push to the end → **Intentions**

### The BDI Cycle (per lap, per driver)

```
┌───────────────────────────────────────────────────────────────────┐
│                    RaceEngine.advance_lap()                       │
│                                                                   │
│   for each DriverAgent (19 AI cars):                              │
│                                                                   │
│   1. PERCEIVE  ─────────────────────────────────────────────────  │
│      agent.perceive(race_state)                                   │
│      └─ BeliefBase.update_from_state()                            │
│         ├─ SelfBelief    (position, tire wear, fuel, ERS)         │
│         ├─ RivalBelief   (gap, tire age, undercut status ×19)     │
│         └─ RaceContext   (flag, weather, pit loss, laps left)     │
│                                                                   │
│   2. DELIBERATE ────────────────────────────────────────────────  │
│      DesireSet.deliberate(beliefs, personality)                   │
│      └─ returns priority-ranked list of active Desires            │
│         e.g. [PIT_NOW(0.95), DEFEND_FROM_UNDERCUT(0.80), ...]    │
│                                                                   │
│   3. SELECT PLAN ───────────────────────────────────────────────  │
│      PlanSelector.select(desires, beliefs, personality)           │
│      └─ Commitment check: don't interrupt plan unless P > 0.85   │
│         PlanLibrary.build(plan_name, beliefs, personality)        │
│                                                                   │
│   4. EXECUTE ───────────────────────────────────────────────────  │
│      action = agent.execute()   → AgentAction                     │
│      └─ returns PlanStep: {PIT, PUSH, MANAGE, ATTACK, DEFEND}    │
│         with compound + intensity modifier                        │
│                                                                   │
│   → Apply action to CarState (pace multiplier, pit request)       │
└───────────────────────────────────────────────────────────────────┘
```

### Driver Personality System

Each driver has a `DriverProfile` with **10 sub-attributes** (0–100 integers, F1 game-style):

| Sub-attribute | Effect on BDI |
|---|---|
| `qualifying_pace` + `race_pace` | Contributes to PAC rating, base lap time |
| `overtaking` | Lowers attack gap threshold — attacks from further back |
| `defending` | Widens defence gap — reacts to threats earlier |
| `tire_management` | Delays pit trigger + extends stint beyond predicted life |
| `adaptability` | Raises rain threshold — stays on slicks longer |
| `control` + `experience` | Raises plan commitment threshold — won't panic-switch |
| `start_skill` | Q1/Q2/Q3 reaction time advantage |
| `accuracy` | Contributes to consistency of lap times |

These are then **automatically derived** into a `Personality` object with real threshold values (not just weights):

```python
# Example: Max Verstappen (overtaking=95, tire_management=82)
attack_gap = 0.80 + (0.95 * 0.25) + (1-patience) * 0.20  # → 1.14s attack gap
tire_pit   = 0.85 + (0.82/100 * 0.10)                     # → 0.932 wear trigger
```

### Available Plans

| Plan | Description |
|---|---|
| `PIT_THIS_LAP` | Immediate pit stop |
| `UNDERCUT_RIVAL` | Pit before rival, emerge on fresh rubber |
| `ATTACK_DRS_ZONE` | Follow close → DRS → attempt overtake |
| `DEFEND_INSIDE_LINE` | Hold inside line, block DRS |
| `DEFEND_PUSH` | Push hard to open gap |
| `PUSH_MODE` | Maximum pace for 3 laps |
| `MANAGE_MODE` | Conserve tires for 6 laps |
| `PIT_UNDER_SC` | Safety car pit stop |
| `EXTEND_STINT` | Nurse tires for 5 more laps |
| `RAIN_TRANSITION` | Pit → wet compound → build pace |

---

## 🧠 ML Pipeline

### Models

| Model | Algorithm | Purpose |
|---|---|---|
| `tire_degradation_lgbm.pkl` | LightGBM | Predicts wear rate per lap given compound, age, weather, track |
| `lap_time_lgbm.pkl` | LightGBM | Predicts lap time given compound, fuel, track, driver, conditions |

### Training Data
Models are trained on real historical data pulled from **FastF1** (Ergast F1 API + Cosworth telemetry). The `data/` directory manages:
- Session ingestion via `ingest.py`
- Local SQLite caching (`f1sim.db`) with `sessions`, `laps`, and `weather` tables
- Feature engineering in `ml/features.py` (80+ features including sector times, tire age, stint, weather)

### Blended Lap Time Engine

The `BlendedLapTimeEngine` combines:
- **ML predictor** (when a trained model is available and confident)
- **Physics heuristic** (fallback — baseline pace + compound delta + degradation curve + fuel effect)

```
Lap Time = ML_prediction * weight + Physics_heuristic * (1 - weight)
```

### MCTS Strategy Planner

The `MCTSStrategyPlanner` runs **320 iterations** of UCT (Upper Confidence Bounds for Trees) search:

```
1. SELECT     — traverse tree using UCT formula
2. EXPAND     — add new action node (STAY_OUT or PIT_{COMPOUND})
3. ROLLOUT    — simulate 18 laps forward using physics heuristic
4. BACKPROP   — propagate reward score up the tree
5. RECOMMEND  — return action with highest average reward
```

The reward function accounts for: final position points, position score, cumulative race time, and pit stop count penalty.

---

## 🌧️ Weather System

Weather evolves lap-by-lap using a **Markov chain** over 4 states:

```
     ┌──── 85% ────┐
     │             ▼
 ┌───┴───┐    ┌────────┐    ┌────────────┐    ┌────────────┐
 │  DRY  │───►│DRIZZLE │───►│ LIGHT_RAIN │───►│ HEAVY_RAIN │
 └───────┘    └────────┘    └────────────┘    └────────────┘
    10%↗         40%↙            25%↙             30%↙
```

The **Markov forecast** (50 Monte Carlo simulations) is blended with an **LSTM-style recurrent forecaster** (55% weight) for the weather panel display.

Tire crossover logic:
| Track Dampness | Recommended Tire |
|---|---|
| < 8% | SLICK |
| 8–20% | MARGINAL_SLICK (risky) |
| 20–55% | INTERMEDIATE |
| 55–65% | MARGINAL_WET (risky) |
| > 65% | WET (required) |

---

## 🗺️ Data Flow

```
User selects track, team, compound
           │
           ▼
  POST /api/race/start
           │
           ▼
  RaceEngine.start_race()
  ├─ WeatherSystem.initialize()      → initial WeatherState
  ├─ _simulate_qualifying()          → 20-driver grid (Q1/Q2/Q3)
  ├─ Create 20 × CarState
  ├─ Build 20 × BlendedLapTimeEngine
  ├─ Create 19 × DriverAgent (BDI)
  └─ Create RaceEngineerAgent
           │
           ▼  (lap by lap)
  POST /api/race/advance
           │
           ▼
  RaceEngine.advance_lap()
  ├─ 1. WeatherSystem.advance()      → next WeatherState
  ├─ 2. Process player ERS action
  ├─ 3. agent.perceive / deliberate / execute  (×19 BDI agents)
  ├─ 4. Calculate lap times (BlendedLapTimeEngine)
  ├─ 5. Update positions & gaps
  ├─ 6. RaceEngineerAgent cycle      → player recommendation
  ├─ 7. SafetyCarController.check()  → deploy SC/VSC/Red Flag
  ├─ 8. _check_incidents()           → crashes, punctures
  ├─ 9. _consume_resources()         → fuel burn, ERS recharge
  └─ 10. _generate_messages()        → strategy messages
           │
           ▼
  RaceState.to_dict()                → JSON response to frontend
```

---

## 📡 API Reference

All endpoints are served at `http://localhost:8000`. Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Race

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/race/start` | Start a new race (requires config body) |
| `POST` | `/api/race/advance` | Advance one lap (returns full RaceState) |
| `POST` | `/api/race/pit` | Player pit stop (compound selection) |
| `GET` | `/api/race/state` | Current race state (no simulation advance) |
| `POST` | `/api/race/ers` | Set ERS deployment mode |

### Strategy

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/strategy/recommendation` | MCTS-based strategy advice |
| `GET` | `/api/strategy/pit-window` | Optimal pit window analysis |
| `GET` | `/api/strategy/tire-life` | Predicted tire life remaining |
| `GET` | `/api/strategy/win-probability` | Win probability chart data |

### Weather

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/weather/current` | Current WeatherState |
| `GET` | `/api/weather/forecast` | Next N laps forecast |
| `GET` | `/api/weather/history/{track}` | Historical weather by circuit |

### Data

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/data/tracks` | All 24 tracks with parameters |
| `GET` | `/api/data/teams` | Team performance data |
| `POST` | `/api/data/refresh` | Trigger FastF1 data refresh |

### Qualifying

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/qualify/start` | Start qualifying session |
| `POST` | `/api/qualify/advance` | Advance qualifying |
| `GET` | `/api/qualify/results` | Final qualifying classification |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git

### 1. Clone the repository

```bash
git clone https://github.com/salmanranjhaa/F1-sim.git
cd F1-sim
```

### 2. Backend Setup

```bash
cd project/backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\Activate.ps1

# Activate (macOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend
python start.py
```

The API will be available at `http://localhost:8000`  
Swagger UI: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend-app

# Install dependencies
npm install

# Start dev server
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### 4. (Optional) Train ML Models

```bash
cd project/backend

# Ingest historical FastF1 data (requires internet, takes a while)
python -m app.data.ingest

# Train tire degradation model
python -m app.ml.train_tire

# Train lap time model
python -m app.ml.train_laptime
```

> **Note:** The simulation runs without trained models — it falls back to the physics heuristic. ML models improve lap time accuracy when available.

---

## 📁 Project Structure

```
F1-sim/
│
├── project/
│   └── backend/                  ← Python FastAPI backend
│       ├── app/
│       │   ├── main.py           ← FastAPI entry point
│       │   ├── db.py             ← SQLite database layer
│       │   ├── routers/          ← API route handlers
│       │   ├── simulation/       ← Race engine + physics + weather
│       │   ├── agents/           ← BDI agent framework
│       │   └── ml/               ← Machine learning pipeline
│       ├── data/                 ← FastF1 data cache (gitignored)
│       ├── requirements.txt
│       └── start.py
│
├── frontend-app/                 ← React + TypeScript frontend
│   ├── src/
│   │   ├── pages/                ← 8 application screens
│   │   ├── components/           ← Shared + feature components
│   │   ├── hooks/                ← API hooks, simulation hooks
│   │   ├── services/             ← API client layer
│   │   └── data/                 ← Static data (teams, drivers)
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
├── SPEC.md                       ← Original specification document
└── BDI_AGENTS.md                 ← BDI agent design document
```

---

## ⚙️ Configuration

### Backend CORS

The backend uses environment-based CORS configuration. Create `project/backend/.env`:

```env
# Comma-separated list of allowed frontend origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

If `ALLOWED_ORIGINS` is not set, the backend defaults to allowing `localhost:3000` and `localhost:5173` only (development safe defaults).

### Frontend API Proxy

The Vite dev server proxies all `/api/*` requests to `http://localhost:8000`. This is configured in `frontend-app/vite.config.ts` and requires no changes for local development.

---

## 🧪 Testing

```bash
cd project/backend

# Run the test suite
python -m pytest

# Run with verbose output
python -m pytest -v

# Run a specific test
python test_profiles.py
```

---

## 🛠️ Tech Stack

### Backend
| Library | Version | Purpose |
|---|---|---|
| FastAPI | ≥0.104 | REST API framework |
| Uvicorn | ≥0.24 | ASGI server |
| Pydantic | ≥2.5 | Data validation / serialization |
| LightGBM | ≥4.1 | ML tire/laptime models |
| scikit-learn | ≥1.3 | Feature engineering |
| FastF1 | ≥3.1 | Real F1 telemetry data |
| NumPy / Pandas | — | Numerical computation |
| SQLite3 | stdlib | Local data caching |

### Frontend
| Library | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | ~5.9 | Type safety |
| Vite | 7 | Build tool + dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| shadcn/ui + Radix UI | — | Accessible component primitives |
| Recharts | 2.15 | Race charts and graphs |
| Framer Motion | 12 | UI animations |
| React Router | 7 | Client-side routing |
| Lucide React | — | Icon library |

---

## 🔒 Security Notes

- No API keys, secrets, or credentials are stored in this repository
- The SQLite database (`f1sim.db`) and all ML model files (`*.pkl`) are gitignored
- FastF1 cache files are gitignored
- CORS is configured to restrict origins to localhost in development (see [Configuration](#️-configuration))
- For production deployment, update `ALLOWED_ORIGINS` to your actual frontend domain

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is for educational and portfolio purposes. Formula 1 branding, team names, and driver names are the property of their respective owners.

---

<div align="center">

Built with ❤️ and a bit of tire degradation anxiety.

</div>
