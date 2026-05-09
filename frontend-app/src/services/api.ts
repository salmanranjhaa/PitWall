/**
 * Real API client — connects to the FastAPI backend at localhost:8000
 * via the Vite dev-server proxy (/api → http://localhost:8000).
 */

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const fetchTracks = () => get<{ tracks: Track[]; count: number }>("/data/tracks");
export const fetchTeams  = () => get<{ teams: Team[];   count: number }>("/data/teams");
export const fetchFastF1Status = () => get<FastF1Status>("/data/fastf1/status");

// ---------------------------------------------------------------------------
// Race session control
// ---------------------------------------------------------------------------

export interface StartRacePayload {
  track_name: string;
  player_team: string;
  starting_compound: string;
  air_temperature: number;
  player_driver?: number;
}

// ---------------------------------------------------------------------------
// Qualifying types
// ---------------------------------------------------------------------------

export interface QDriverState {
  name: string;
  number: number;
  team: string;
  tier?: string;
  wet_skill?: number;
  best_time: number | null;
  last_time: number | null;
  compound: string;
  laps_done: number;
  is_player: boolean;
  is_eliminated: boolean;
  q2_compound: string | null;
  sets_new?: Record<string, number>;
  sets_used?: Record<string, number>;
  // enriched by classification
  position: number;
  gap: number | null;
  in_danger: boolean;
}

export interface GridEntry {
  position: number;
  name: string;
  number: number;
  team: string;
  best_time: number | null;
  q2_compound: string | null;
  is_player: boolean;
}

export interface QualifyingState {
  segment: "Q1" | "Q2" | "Q3";
  segment_index: number;
  time_remaining: number;
  total_time: number;
  tick: number;
  max_ticks: number;
  track_evolution: number;
  classification: QDriverState[];
  player_best: number | null;
  player_last: number | null;
  player_position: number | null;
  player_compound: string;
  player_sets_new?: Record<string, number>;
  player_sets_used?: Record<string, number>;
  player_can_lap?: boolean;
  segment_finished: boolean;
  qualifying_complete: boolean;
  starting_grid: GridEntry[];
  elimination_count: number;
  safe_count: number;
  track_name: string;
  // returned by player_flying_lap only
  player_lap_time?: number;
  is_personal_best?: boolean;
  set_type_used?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Qualifying API calls
// ---------------------------------------------------------------------------

export interface StartQualifyingPayload {
  track_name: string;
  player_team: string;
  player_driver?: number;
}

export const startQualifying = (payload: StartQualifyingPayload) =>
  post<{ session_id: string; state: QualifyingState }>("/qualify/start", payload);

export const advanceQualifyingTime = (sessionId: string) =>
  post<{ state: QualifyingState }>("/qualify/advance?session_id=" + sessionId, {});

export const doPlayerLap = (sessionId: string, compound: string) =>
  post<QualifyingState>("/qualify/lap", { session_id: sessionId, compound });

export const nextQualifyingSegment = (sessionId: string) =>
  post<{ state: QualifyingState }>("/qualify/next-segment?session_id=" + sessionId, {});

export const getQualifyingState = (sessionId: string) =>
  get<{ state: QualifyingState }>("/qualify/state?session_id=" + sessionId);

export const startRace = (payload: StartRacePayload) =>
  post<{ session_id: string; state: RaceState }>("/race/start", payload);

export const advanceLap = (sessionId: string, actions?: Record<string, unknown>) =>
  post<{ state: RaceState }>("/race/advance?session_id=" + sessionId, actions ?? {});

export const playerPit = (sessionId: string, compound: string) =>
  post<{ state: RaceState }>("/race/pit", { session_id: sessionId, compound });

export const getRaceState = (sessionId: string) =>
  get<{ state: RaceState }>("/race/state?session_id=" + sessionId);

export const setErsMode = (sessionId: string, mode: string) =>
  post<{ state: RaceState }>("/race/ers", { session_id: sessionId, mode });

// ---------------------------------------------------------------------------
// Auto-run SSE stream
// ---------------------------------------------------------------------------

/**
 * Open a Server-Sent Events stream that auto-advances the race lap by lap.
 * The backend pushes a JSON event for each lap until the race finishes.
 *
 * Returns a cleanup function — call it to abort the stream.
 */
export function streamAutoRace(
  sessionId: string,
  onLap: (state: RaceState) => void,
  onFinished: (state: RaceState) => void,
  onError?: (err: Event) => void,
  onPhase?: (phase: string, lights?: number) => void,
  speed?: number,
): () => void {
  const url = `${BASE}/race/stream?session_id=${encodeURIComponent(sessionId)}&speed=${speed ?? 5}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    const data = JSON.parse(e.data) as {
      state?: RaceState; finished?: boolean;
      phase?: string; lights?: number;
    };

    // Pre-race phase events
    if (data.phase === "FORMATION" || data.phase === "LIGHTS_OUT") {
      onPhase?.(data.phase, data.lights);
      return;
    }

    if (!data.state) return;

    if (data.finished || data.phase === "FINISHED") {
      onFinished(data.state);
      es.close();
    } else {
      onLap(data.state);
    }
  };

  es.onerror = (e) => {
    onError?.(e);
    es.close();
  };

  return () => es.close();
}

// ---------------------------------------------------------------------------
// Strategy / ML
// ---------------------------------------------------------------------------

export const getStrategyRecommendation = (sessionId: string) =>
  get<StrategyRecommendation>(`/strategy/recommendation?session_id=${sessionId}`);

export const getWinProbability = (sessionId: string) =>
  get<{ win_probability: number }>(`/strategy/win-probability?session_id=${sessionId}`);

export const getTireLife = (sessionId: string) =>
  get<{ remaining_laps: number }>(`/strategy/tire-life?session_id=${sessionId}`);

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export const getCurrentWeather = (sessionId: string) =>
  get<WeatherSnapshot>(`/weather/current?session_id=${sessionId}`);

export const getWeatherForecast = (sessionId: string) =>
  get<{ forecast: WeatherSnapshot[] }>(`/weather/forecast?session_id=${sessionId}`);

export interface RealWeatherConditions {
  source: string;           // "open-meteo-live" | "historical-profile" | "historical-profile-fallback"
  track: string;
  air_temp: number;
  track_temp?: number;
  humidity: number;
  wind_speed: number;
  rain_mm: number;
  is_raining: boolean;
  condition: string;
  rain_probability: number;
  forecast_6h: Array<{
    hour: number;
    temp: number;
    rain_prob: number;
    rain_mm: number;
    condition: string;
  }>;
  error?: string;
}

export const getRealWeather = (track: string) =>
  get<RealWeatherConditions>(`/weather/real-conditions?track=${encodeURIComponent(track)}`);

// ---------------------------------------------------------------------------
// Data / FastF1 DB
// ---------------------------------------------------------------------------

export const listSessions = () =>
  get<{ sessions: DBSession[]; count: number }>("/data/sessions");

export const ingestSession = (year: number, gp: string, session = "R") =>
  post<{ status: string; result: IngestResult }>("/data/ingest", { year, gp, session });

export const getSessionLaps = (sessionId: number, driver?: string, compound?: string) => {
  let q = `/data/sessions/${sessionId}/laps`;
  const params = new URLSearchParams();
  if (driver)   params.set("driver", driver);
  if (compound) params.set("compound", compound);
  if (params.toString()) q += "?" + params.toString();
  return get<{ laps: DBLap[]; count: number }>(q);
};

export const getSessionSummary = (sessionId: number) =>
  get<SessionSummary>(`/data/sessions/${sessionId}/summary`);

export const getTireDegradationData = (sessionId: number) =>
  get<{ degradation: TireDegradationRow[] }>(`/data/sessions/${sessionId}/tire_degradation`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Track {
  name: string;
  location: string;
  length_km: number;
  laps: number;
  corners: number;
  type: string;
  tire_severity?: number;   // 1 (low) to 10 (extreme)
  sc_probability?: number;
  country?: string;
}

export interface Team {
  name: string;
  color: string;
  drivers: string[];
  team_id: string;
}

export interface FastF1Status {
  available: boolean;
  version: string | null;
  cache_dir: string;
  requires_api_key: boolean;
  note: string;
}

export interface TireState {
  compound: string;
  age: number;
  wear: number;
}

export interface DriverInfo {
  name: string;
  team: string;
  number: number;
}

export interface CarStateApi {
  driver: DriverInfo | string;
  position: number;
  tire: TireState;
  fuel: number;
  lap_time: number;
  total_time: number;
  pits: number;
  gap_to_leader: number | null;
  gap_to_next?: number;
  ers_mode: string;
  ers_battery: number;
  track_fraction?: number;
  track_limit_violations?: number;
  contact_penalties?: number;
  dnf?: boolean;
  dnf_reason?: string;
}

export interface RacePhase {
  phase: "FORMATION" | "LIGHTS_OUT" | "RACING" | "SAFETY_CAR" | "FINISHED";
  lap: number;
  total_laps: number;
  message?: string;
}

export interface RaceEventEntry {
  event_type: string;
  lap?: number;
  data?: Record<string, unknown>;
}

export interface RaceState {
  current_lap: number;
  lap?: number;
  total_laps: number;
  phase: string;
  player_car?: CarStateApi;
  player?: CarStateApi;
  leaderboard: CarStateApi[];
  weather: WeatherSnapshot;
  events: string[];
  strategy_messages: StrategyMsg[];
  messages?: StrategyMsg[];
  events_log?: RaceEventEntry[];
  flag?: string;
  finished: boolean;
}

export interface StrategyMsg {
  type: string;
  text: string;
  confidence: number;
  trigger_lap?: number;
}

export interface WeatherSnapshot {
  condition: string;
  air_temp: number;
  track_temp: number;
  rain_probability: number;
  is_raining: boolean;
  wind_speed?: number;
}

export interface StrategyRecommendation {
  recommendation: string;
  recommended_compound: string;
  confidence: number;
  reason: string;
  messages: { type: string; text: string; confidence: number }[];
}

export interface DBSession {
  id: number;
  year: number;
  event_name: string;
  session_type: string;
  circuit: string;
  date: string;
  ingested_at: string;
  lap_count: number;
}

export interface IngestResult {
  session_id: number;
  year: number;
  event: string;
  session_type: string;
  laps_ingested: number;
  weather_rows_ingested: number;
}

export interface DBLap {
  id: number;
  session_id: number;
  driver: string;
  team: string;
  lap_number: number;
  compound: string;
  tyre_life: number;
  lap_time_s: number;
  sector1_s: number;
  sector2_s: number;
  sector3_s: number;
  is_valid: number;
  stint: number;
  position: number;
  speed_trap: number;
}

export interface SessionSummary {
  drivers: DriverSummary[];
  weather_summary: Record<string, number>;
}

export interface DriverSummary {
  driver: string;
  team: string;
  total_laps: number;
  fastest_lap_s: number;
  avg_lap_s: number;
  max_tyre_life: number;
  stints: number;
  best_pos: number;
  worst_pos: number;
}

export interface TireDegradationRow {
  compound: string;
  tyre_life: number;
  avg_lap_s: number;
  min_lap_s: number;
  sample_count: number;
}
