# F1 Sim — Session Handover

_Generated after major implementation session. Resume from here in the next Claude session._

---

## What Was Implemented This Session

### 1. Simulation Speed Controller
- **Backend** (`project/backend/app/routers/race.py`): Added `speed: int = 5` query param to `/api/race/stream`. Maps to `_SPEED_TO_SLEEP = {1: 2.0, 2: 1.0, 5: 0.4, 10: 0.15, 20: 0.02}` seconds per lap. Generator now checks `engine.current_lap > 0` to skip formation/lights sequence on reconnect.
- **api.ts**: `streamAutoRace()` now accepts `speed?: number` as 6th param, appended to SSE URL.
- **Dashboard.tsx**: `simSpeed` state (1/2/5/10/20×), `isPaused` state. Speed controller bar below stats row. Changing speed closes old stream and reopens with new speed param. Pause closes stream; resume reopens (backend skips intro since race already started).

### 2. INT / WET Tire Options in Pit UI
- **Dashboard.tsx**: Pit stop section split into two rows: row 1 = SOFT/MEDIUM/HARD, row 2 = INTERMEDIATE/WET. When `weather.is_raining=true`, the wet compound buttons glow with a weather-blue border and show "↑ RAIN" indicator.

### 3. DRIVER / RACE Message Tab Split
- **Dashboard.tsx**: Strategy messages panel replaced with tabbed UI.
  - **DRIVER tab**: Shows `strategy_messages` — INFO/WARNING/URGENT/OPPORTUNITY cards (driver-targeted from ML).
  - **RACE tab**: Shows `events_log` accumulation — overtakes, pit stops, SC, DNF, yellow flags, penalties. Events are deduplicated via `seenEventsRef` (Set of `"lap-type-data"` keys). Badge shows count. Reverse-chronological order.
- **api.ts**: Added `RaceEventEntry` interface, `StrategyMsg` interface, `events_log?: RaceEventEntry[]` to `RaceState`.

### 4. Production-Quality Track Maps with Sector Coloring
- **Background agent** extracted real FastF1 telemetry for all 24 circuits (80 points each, 2024 data).
- **trackPaths.ts**: Complete rewrite with real coordinates + `s1End`/`s2End` sector fractions for all 24 circuits (Bahrain, Jeddah, Melbourne, Suzuka, Shanghai, Miami, Imola, Monaco, Canada, Spain, Austria, Silverstone, Hungary, Spa, Zandvoort, Monza, Baku, Singapore, COTA, Mexico, Brazil, Las Vegas, Qatar, Abu Dhabi).
- **TrackMap.tsx**: SVG polyline split into 3 colored sectors (S1=red #FF3333, S2=purple #A78BFA, S3=cyan #22D3EE). Sector boundary tick marks rendered as perpendicular lines. Legend shows S1/S2/S3 colors + tire compound colors.

### 5. Backend ML Track Identity Feature (previous sessions)
- `ingest_and_train.py`: Added `_event_to_track_key()` with 45 keyword mappings and `track_key_cat` feature.
- `features.py`: Added `TRACK_KEY_LABELS` (alphabetically sorted, 0–23 encoding for 24 tracks).
- `predict.py`: Fixed compound encoding (integer 0–4, not float COMPOUND_RATES), added `track_key_cat` to inference features.
- Models retrained on 63,985 laps (2022–2024). Dry lap time R² improved from −0.034 → +0.381.

---

## Files Changed This Session

| File | Change |
|------|--------|
| `project/backend/app/routers/race.py` | Speed param + skip-intro on reconnect |
| `frontend-app/src/services/api.ts` | Speed param, `RaceEventEntry`, `StrategyMsg`, `events_log` type |
| `frontend-app/src/pages/Dashboard.tsx` | Speed controller, INT/WET tires, DRIVER/RACE tabs, useCallback handlers |
| `frontend-app/src/data/trackPaths.ts` | Full rewrite with 24 real telemetry circuits + sector fractions |
| `frontend-app/src/components/TrackMap.tsx` | Sector-colored SVG rendering + tick marks |

---

## Pending / Next Steps (in priority order)

### P0 — Qualifying Mode ✓ IMPLEMENTED (resume if bugs found)

User wants:
1. **Qualifying simulation** — Q1/Q2/Q3 format with timed sessions, tire strategy, track evolution
2. **Gamification** — interactive decisions rather than pure dashboard watching

**Qualifying design:**
- New backend endpoint `POST /api/qualify/start` with `{track_name, player_team, player_driver}` 
- New backend endpoint `POST /api/qualify/lap` — simulates one flying lap attempt
- Session state: `Q1` (20 min, 20 cars → 15 survive), `Q2` (15 min, 15 → 10), `Q3` (12 min, top 10)
- Player choices each segment: tire compound (Q1/Q2 usually SOFT; Q3 must start race on Q2 tires), when to do flying laps (track improves over session - rubber laid down), fuel load = 0
- New frontend page `Qualifying.tsx` with countdown timer, sector times, provisional grid positions

**Gamification ideas (pick 2-3 for v1):**
1. **Pit stop timing** - Bar fills as mechanics work; press button in green zone for undercut/bonus
2. **Compound obligation prompt** - Race control message when approaching end without 2 compounds; player must confirm/respond
3. **ERS tactical control** - Deploy/harvest buttons that affect next lap time
4. **Race director calls** - Pop-up: "Investigate possible track limits violation by CAR X - Accept/Reject penalty?" 
5. **Driver briefing objectives** - Before race: choose target (P1/Podium/Points/Beat Teammate) → affects win probability display

### P1 — Sector Times Display (partially requested by user)
- Backend: `CarState.to_dict()` needs to expose `sector1_s`, `sector2_s`, `sector3_s` (if available from physics model).
- Frontend: Show S1/S2/S3 times on the player info panel or a sector delta widget. Color-code purple=personal best, green=overall best.

### P2 — Tire Crossover Indicators (user mentioned "tire crossover thingys for mixed conditions")
- Dashboard: When `rain_probability` crosses thresholds (~30% = INT crossover, ~70% = WET crossover), show a visual indicator in the pit stop panel and/or weather panel — e.g. "INT window" highlighted when 20–50% rain probability.
- This is UI-only; no backend change needed.

### P3 — BDI AI Opponents (deferred to v2, user agreed)
- Architecture: Each AI car gets `beliefs: Dict` (current race state knowledge), `desires: List[str]` (maximize finishing position), and committed `intents: Intent` (EXTEND_STINT, PIT_NEXT_LAP, DEFEND_UNDERCUT, OVERCUT). Intents persist across laps.
- Implementation: New file `simulation/bdi_agents.py`. `AIOpponents` class modified to use BDI loop per car. See `simulation/ai_opponents.py` for current scripted logic.

### P4 — Proper ERS Strategy Controls in UI
- Currently ERS mode is read-only. Add ERS mode buttons: CHARGE / BALANCED / ATTACK / DEFEND to the Strategy Engine panel.
- Backend endpoint `/api/race/ers` already exists in `race.py`.

### P5 — Race Results Screen
- When `phase === "FINISHED"`, show a full-screen results overlay: final classification, fastest lap, pit stop summary.

### P6 — FastF1 2025 Data Ingestion
- The models are trained on 2022–2024. Re-run `ingest_and_train.py` once 2025 season data is available on FastF1.
- Command: `cd project/backend && python scripts/ingest_and_train.py --years 2025`

---

## How To Resume

```bash
# Start backend (from project/backend/)
uvicorn app.main:app --reload --port 8000

# Start frontend (from frontend-app/)
npm run dev
```

Open http://localhost:5173, configure a race in Setup, start it. The Dashboard should show:
- Real circuit shape with S1/S2/S3 color coding
- Speed controller: PAUSE / 1× / 2× / 5× / 10× / 20×
- Pit options: SOFT / MEDIUM / HARD / INTERMEDIATE / WET (rain-highlighted)
- Message tabs: DRIVER (strategy) and RACE (events log)

### Known issues to watch
1. TypeScript strict mode may warn about `StrategyMsg | string` union in Dashboard — messages from backend can be either (legacy vs new format). Current code handles both.
2. The `bg-weather-blue` Tailwind color must be defined in `tailwind.config.*` — if not, replace with `bg-blue-400`.
3. If the SSE stream auto-closes on speed change, check that `cleanupRef.current?.()` runs before opening the new stream (it does — the useEffect body calls it explicitly before `streamAutoRace`).

---

_Last updated: 2026-05-09. Next priority: Sector times + tire crossover indicators._
