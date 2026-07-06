import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloudRain, Sun, TrendingUp,
  AlertTriangle, AlertCircle, CheckCircle, Timer, Flag,
  ChevronDown, ChevronUp, BrainCircuit, Navigation,
  Pause, Play, User2, Radio, X, Headphones, Trophy, BarChart2,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  streamAutoRace, playerPit,
  type RaceState, type CarStateApi, type RaceEventEntry, type StrategyMsg,
  type BDIState, type EngineerRecommendation,
} from "@/services/api";
import TrackMap from "@/components/TrackMap";

// ── helpers ──────────────────────────────────────────────────────────────────

const tireColors: Record<string, string> = {
  SOFT: "#E8103A", S: "#E8103A",
  MEDIUM: "#FFD300", M: "#FFD300",
  HARD: "#F5F5F5", H: "#F5F5F5",
  INTERMEDIATE: "#00D084", I: "#00D084",
  WET: "#1E90FF", W: "#1E90FF",
};

const tireShort: Record<string, string> = {
  SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W",
};

const teamColors: Record<string, string> = {
  "Red Bull Racing": "#1E41FF", "Mercedes": "#00D2BE", "Ferrari": "#FF1E00",
  "McLaren": "#FF8700", "Aston Martin": "#006F62", "Alpine": "#0090FF",
  "Williams": "#00A0DE", "Racing Bulls": "#6692FF", "Audi": "#BB0A30", "Haas": "#B6BABD", "Cadillac": "#D4AF37",
};

const msgCfg: Record<string, { color: string; bg: string; border: string; Icon: typeof CheckCircle }> = {
  INFO:        { color: "#00D4FF", bg: "bg-blue-500/10",  border: "border-blue-500/30",  Icon: CheckCircle  },
  WARNING:     { color: "#FFB800", bg: "bg-amber-500/10", border: "border-amber-500/30", Icon: AlertTriangle },
  OPPORTUNITY: { color: "#00F5A0", bg: "bg-green-500/10", border: "border-green-500/30", Icon: TrendingUp   },
  URGENT:      { color: "#FF2D2D", bg: "bg-red-500/10",   border: "border-red-500/30",   Icon: AlertCircle  },
};

const eventCfg: Record<string, { color: string; symbol: string }> = {
  overtake:              { color: "#00D4FF", symbol: "⟳" },
  pit:                   { color: "#7B61FF", symbol: "⬡" },
  safety_car:            { color: "#FFD300", symbol: "⚐" },
  virtual_safety_car:    { color: "#FFA500", symbol: "⚐" },
  dnf:                   { color: "#FF2D2D", symbol: "✕" },
  tire_blowout:          { color: "#FF2D2D", symbol: "💥" },
  track_limits_penalty:  { color: "#FFAA00", symbol: "⚠" },
  incident:              { color: "#FF8C00", symbol: "⚡" },
  yellow_flag:           { color: "#FFD300", symbol: "⚑" },
  contact:               { color: "#FF6B35", symbol: "⚡" },
  green_flag:            { color: "#00D084", symbol: "⚑" },
};

function formatRaceEvent(e: RaceEventEntry): string {
  const L = e.lap ? `L${e.lap} — ` : "";
  const d = (e.data ?? {}) as Record<string, string | number>;
  switch (e.event_type) {
    case "overtake":
      return `${L}${d.attacker ?? "?"} overtakes ${d.defender ?? "?"}`;
    case "pit":
      return `${L}${d.driver ?? "?"} pits → ${d.compound ?? "?"}${d.reason ? ` (${d.reason})` : ""}`;
    case "safety_car":
      return `${L}Safety Car deployed`;
    case "virtual_safety_car":
      return `${L}Virtual Safety Car`;
    case "green_flag":
      return `${L}SC in — Green flag, racing resumes`;
    case "yellow_flag":
      return `${L}Yellow flag — Sector ${d.sector ?? "?"} (${d.driver ?? "?"})`;
    case "dnf":
      return `${L}DNF — ${d.driver ?? "?"}: ${d.reason ?? "retirement"}`;
    case "tire_blowout":
      return `${L}BLOWOUT — ${d.driver ?? "?"}`;
    case "track_limits_penalty":
      return `${L}${d.driver ?? "?"} track limits — +5s penalty`;
    case "incident": {
      const desc = (d.description as string) ?? (d.driver_name as string) ?? "?";
      return `${L}Incident: ${desc}`;
    }
    case "contact":
      return `${L}Contact — ${d.attacker ?? "?"} / ${d.defender ?? "?"}`;
    default:
      return `${L}${e.event_type?.replace(/_/g, " ")}`;
  }
}

function formatLapTime(seconds: number): string {
  if (!seconds || seconds < 10) return "--:--.---";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

function CircularProgress({ value, size = 64, strokeWidth = 5, color = "#7B61FF" }: {
  value: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2D2D3D" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={circ - (value / 100) * circ}
        strokeLinecap="round" className="transition-all duration-500" />
    </svg>
  );
}

function TireWearRing({ wear, size = 56 }: { wear: number; size?: number }) {
  const sw = 4, radius = (size - sw) / 2, circ = 2 * Math.PI * radius;
  const color = wear > 80 ? "#FF2D2D" : wear > 50 ? "#FFAA00" : "#00D084";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2D2D3D" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={circ - ((100 - wear) / 100) * circ} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-mono font-bold" style={{ color }}>{Math.round(wear)}%</span>
    </div>
  );
}

// ── race finished prompt ──────────────────────────────────────────────────────

function RaceFinishedPrompt({
  playerPosition,
  winnerName,
  winnerTeam,
  onReview,
  onDismiss,
}: {
  playerPosition: number | null;
  winnerName: string;
  winnerTeam: string;
  onReview: () => void;
  onDismiss: () => void;
}) {
  const pos = playerPosition ?? 0;
  const label =
    pos === 1 ? { text: "VICTORY!", color: "#FFD300", icon: "🏆" } :
    pos === 2 ? { text: "P2 — PODIUM", color: "#C0C0C0", icon: "🥈" } :
    pos === 3 ? { text: "P3 — PODIUM", color: "#CD7F32", icon: "🥉" } :
    pos <= 10 ? { text: `P${pos} — POINTS`, color: "#00D4FF", icon: "✓" } :
                { text: `P${pos} — FINISH`, color: "#8B8BA8", icon: "⬛" };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#16161E", border: "1px solid #2D2D3D" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Checkered header strip */}
        <div className="h-2 w-full"
          style={{ background: "repeating-linear-gradient(90deg,#fff 0px,#fff 8px,#111 8px,#111 16px)" }} />

        <div className="p-6 text-center">
          {/* Result */}
          <div className="text-4xl mb-2">{label.icon}</div>
          <h2 className="text-3xl font-black uppercase tracking-widest mb-1"
            style={{ color: label.color }}>{label.text}</h2>
          <p className="text-text-ghost text-xs uppercase tracking-widest mb-5">Race Complete</p>

          {/* Winner */}
          <div className="bg-carbon rounded-xl p-3 mb-5 text-left">
            <p className="text-[9px] uppercase tracking-wider text-text-ghost mb-1">Race Winner</p>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-ferrari-gold flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-text-primary">{winnerName}</p>
                <p className="text-[10px] text-text-ghost">{winnerTeam}</p>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <button
            onClick={onReview}
            className="w-full h-12 rounded-xl font-black uppercase tracking-wider text-sm mb-2 flex items-center justify-center gap-2 transition-all"
            style={{ backgroundColor: "#FF1E0020", border: "1px solid #FF1E0060", color: "#FF6B6B" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FF1E0035"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FF1E0020"; }}
          >
            <BarChart2 className="w-4 h-4" />
            Review Results
          </button>
          <button
            onClick={onDismiss}
            className="w-full h-9 rounded-xl text-[11px] text-text-ghost bg-carbon border border-border-subtle hover:text-text-secondary transition-colors font-semibold"
          >
            Stay on Dashboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── race phase overlay ────────────────────────────────────────────────────────

function RacePhaseOverlay({ phase, lights }: { phase: string; lights?: number }) {
  if (phase === "RACING" || phase === "FINISHED") return null;
  return (
    <AnimatePresence>
      <motion.div
        key={phase + (lights ?? "")}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      >
        {phase === "FORMATION" && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
            <Flag className="w-16 h-16 text-ferrari-gold mx-auto mb-4" />
            <h2 className="text-4xl font-black uppercase tracking-widest text-white mb-2">Formation Lap</h2>
            <p className="text-text-secondary text-lg">Cars leaving the pit lane…</p>
          </motion.div>
        )}
        {phase === "LIGHTS_OUT" && typeof lights === "number" && lights > 0 && (
          <div className="text-center">
            <div className="flex gap-4 mb-6 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.div key={n}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: n <= lights ? 1 : 0.7, opacity: n <= lights ? 1 : 0.2 }}
                  className={`w-12 h-12 rounded-full border-2 ${n <= lights ? "bg-red-600 border-red-400 shadow-lg shadow-red-500/50" : "bg-carbon border-border-subtle"}`}
                />
              ))}
            </div>
            <p className="text-text-ghost text-sm uppercase tracking-widest">Lights on</p>
          </div>
        )}
        {phase === "LIGHTS_OUT" && lights === 0 && (
          <motion.div initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <h1 className="text-7xl font-black uppercase text-rosso tracking-widest">GO GO GO!</h1>
            <p className="text-white text-xl mt-2 font-bold uppercase tracking-widest">Lights out!</p>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ── SC / VSC race-engineer notification ──────────────────────────────────────
//
// Design intent: this is the v1 interface for the BDI race-engineer agent.
// In v2, the content (beliefs, recommendation, intention) flows from the BDI
// module rather than being computed inline. The UI pattern stays the same.

interface SCNotifProps {
  flagType: string;
  currentLap: number;
  totalLaps: number;
  player: CarStateApi | null;
  recommendation: { compound: string; reason: string };
  onPitNow: (compound: string) => void;
  onDismiss: () => void;
}

function SCNotification({
  flagType, currentLap, totalLaps, player, recommendation, onPitNow, onDismiss,
}: SCNotifProps) {
  const [pitCompound, setPitCompound] = useState(recommendation.compound);
  const isVSC = flagType.includes("VSC") || flagType.includes("VIRTUAL");
  const label = isVSC ? "VIRTUAL SC" : "SAFETY CAR";
  const accent = isVSC ? "#FFA500" : "#FFD300";
  const wear = Math.round((player?.tire?.wear ?? 0) * 100);
  const wearColor = wear > 60 ? "#FF2D2D" : wear > 35 ? "#FFAA00" : "#00D084";

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 220 }}
      className="fixed bottom-6 right-4 z-40 w-72 rounded-xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: "#16161E", border: `1px solid ${accent}50` }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: `${accent}14` }}>
        <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: accent }} />
        <Flag className="w-3 h-3 flex-shrink-0" style={{ color: accent }} />
        <span className="text-[11px] font-black uppercase tracking-widest flex-1" style={{ color: accent }}>
          {label}
        </span>
        <span className="text-[10px] font-mono text-text-ghost">Lap {currentLap}/{totalLaps}</span>
        <button onClick={onDismiss} className="ml-1 text-text-ghost hover:text-text-secondary transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Tire + gap context (beliefs) */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="bg-carbon rounded-lg p-2 text-center">
            <p className="text-text-ghost mb-0.5">Pos</p>
            <p className="font-mono font-black text-ferrari-gold">P{player?.position ?? "—"}</p>
          </div>
          <div className="bg-carbon rounded-lg p-2 text-center">
            <p className="text-text-ghost mb-0.5">Tire</p>
            <p className="font-mono font-bold" style={{ color: tireColors[player?.tire?.compound ?? "M"] ?? "#888" }}>
              {tireShort[player?.tire?.compound ?? "M"] ?? "?"} {player?.tire?.age ?? 0}L
            </p>
          </div>
          <div className="bg-carbon rounded-lg p-2 text-center">
            <p className="text-text-ghost mb-0.5">Wear</p>
            <p className="font-mono font-bold" style={{ color: wearColor }}>{wear}%</p>
          </div>
        </div>

        {/* Tire wear bar */}
        <div className="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${wear}%`, backgroundColor: wearColor }} />
        </div>

        {/* Gap context */}
        {player && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-text-ghost">Gap ahead</span>
            <span className="font-mono text-text-primary">
              {player.gap_to_next != null ? `+${player.gap_to_next.toFixed(1)}s` : "—"}
            </span>
            <span className="text-text-ghost ml-auto">To leader</span>
            <span className="font-mono text-text-primary">
              {player.gap_to_leader ? `+${player.gap_to_leader.toFixed(1)}s` : "P1"}
            </span>
          </div>
        )}

        {/* Engineer recommendation (desire) */}
        <div className="border-t border-border-subtle/50 pt-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Headphones className="w-3 h-3 text-neural-purple" />
            <span className="text-[9px] uppercase tracking-wider text-neural-purple font-bold">
              Engineer
            </span>
          </div>

          {/* Compound selector (intention) */}
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            {(["SOFT", "MEDIUM", "HARD"] as const).map((c) => (
              <button key={c} onClick={() => setPitCompound(c)}
                className={`relative py-2 rounded-lg border text-[9px] font-bold text-center transition-all ${
                  pitCompound === c ? "border-2" : "border-border-subtle/60 bg-carbon"
                }`}
                style={pitCompound === c ? { borderColor: tireColors[c], backgroundColor: `${tireColors[c]}15`, color: tireColors[c] } : {}}
              >
                <div className="w-2.5 h-2.5 rounded-full mx-auto mb-0.5" style={{ backgroundColor: tireColors[c] }} />
                {c[0]}
                {/* Dot marks recommended compound */}
                {c === recommendation.compound && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-neural-purple" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-text-ghost italic leading-relaxed">{recommendation.reason}</p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onPitNow(pitCompound)}
            className="py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
            style={{ backgroundColor: "#FF2D2D22", border: "1px solid #FF2D2D55", color: "#FF6B6B" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FF2D2D35"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FF2D2D22"; }}
          >
            Pit — {pitCompound[0]}
          </button>
          <button
            onClick={onDismiss}
            className="py-2.5 rounded-lg bg-carbon border border-border-subtle text-text-ghost text-[10px] font-bold uppercase tracking-wider hover:text-text-secondary transition-colors"
          >
            Stay Out
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── speed controller ──────────────────────────────────────────────────────────

const SPEED_OPTIONS = [1, 2, 5, 10, 20] as const;
// Mirrors the backend _SPEED_TO_SLEEP map — seconds of real time per race lap.
// 1x is deliberately slow (30s/lap) so the player can read data and make calls.
const SPEED_SECONDS_PER_LAP: Record<number, number> = { 1: 30, 2: 15, 5: 6, 10: 3, 20: 1 };
type SimSpeed = typeof SPEED_OPTIONS[number];

// ── main component ────────────────────────────────────────────────────────────

interface LapHistoryEntry {
  lap: number; lapTimeS: number; compound: string; position: number;
}

export default function Dashboard() {
  const navigate     = useNavigate();
  const sessionId    = localStorage.getItem("f1_session_id")    ?? "mock";
  const playerTeam   = localStorage.getItem("f1_player_team")   ?? "Ferrari";
  const trackName    = localStorage.getItem("f1_track_name")    ?? "Belgian Grand Prix";
  const trackKey     = localStorage.getItem("f1_track_key")     ?? "Spa";
  const tireSeverity = parseInt(localStorage.getItem("f1_tire_severity") ?? "5");

  const [phase, setPhase]           = useState<string>("FORMATION");
  const [lightsCount, setLightsCount] = useState<number>(0);
  const [raceState, setRaceState]   = useState<RaceState | null>(null);
  const [lapHistory, setLapHistory] = useState<LapHistoryEntry[]>([]);
  // (win probability history removed — chart removed from UI)
  const [showLapHistory, setShowLapHistory] = useState(false);
  const [isPitting, setIsPitting]   = useState(false);
  const [selectedPitTire, setSelectedPitTire] = useState("MEDIUM");

  // Speed controller
  const [simSpeed, setSimSpeed]     = useState<SimSpeed>(1);
  const [isPaused, setIsPaused]     = useState(false);
  useEffect(() => { simSpeedRef.current = simSpeed; }, [simSpeed]);

  // Animation-driven lap counter — increments when leader's dot crosses S/F
  const [displayedLap, setDisplayedLap] = useState(0);
  const displayedLapRef = useRef(0);

  // Message tabs
  const [msgTab, setMsgTab]         = useState<"DRIVER" | "RACE">("DRIVER");
  const [raceEventsLog, setRaceEventsLog] = useState<RaceEventEntry[]>([]);
  const seenEventsRef = useRef(new Set<string>());

  const cleanupRef      = useRef<(() => void) | null>(null);
  const raceFinishedRef = useRef(false);
  const lapHistoryRef   = useRef<LapHistoryEntry[]>([]);

  // Lap queue — ensures every lap is shown for at least minLapMs regardless of stream speed
  const lapQueueRef     = useRef<RaceState[]>([]);
  const queueTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simSpeedRef     = useRef(1); // kept in sync with simSpeed state

  // SC / VSC engineer notification
  const [showSCNotif, setShowSCNotif]   = useState(false);
  const prevFlagRef = useRef<string | undefined>(undefined);

  // Race-finished results prompt
  const [showResultsPrompt, setShowResultsPrompt] = useState(false);

  // Weather history — one entry per lap for the forecast strip
  const [weatherHistory, setWeatherHistory] = useState<{ lap: number; rainProb: number; isRaining: boolean }[]>([]);

  // Competitor lap time tracking — driver name → per-lap array
  const [compLapHistory, setCompLapHistory] = useState<Record<string, Array<{ lap: number; lapTimeS: number; compound: string }>>>({});
  // Which competitors to overlay on the lap time chart
  const [selectedCompDrivers, setSelectedCompDrivers] = useState<string[]>([]);
  // Lap chart view mode
  const [lapChartMode, setLapChartMode] = useState<"PLAYER" | "COMPARE">("PLAYER");

  // Per-track tire life estimates (mirrors TRACK_TIRE_SEVERITY in Setup.tsx)
  const _tireLife = useMemo(() => {
    const sev = tireSeverity;
    return {
      SOFT:   Math.max(8,  Math.round(22 - (sev - 1) * 1.5)),
      MEDIUM: Math.max(12, Math.round(32 - (sev - 1) * 2.0)),
      HARD:   Math.max(18, Math.round(44 - (sev - 1) * 2.7)),
      INTERMEDIATE: 35, WET: 50,
    };
  }, [tireSeverity]);

  // Derived player state
  const player     = raceState?.player ?? raceState?.player_car ?? raceState?.leaderboard?.[0] ?? null;
  const currentLap = raceState?.current_lap ?? raceState?.lap ?? 0;
  const totalLaps  = raceState?.total_laps ?? 57;
  const tireWear   = player ? Math.round(player.tire.wear * 100) : 0;
  const tireAge    = player?.tire.age ?? 0;
  const compound   = player?.tire.compound ?? "MEDIUM";
  const isRaining  = raceState?.weather?.is_raining ?? false;

  // F1 compound obligation: must use ≥2 dry compounds in a dry race
  const compoundsUsed = useMemo(() => {
    const dry = new Set<string>();
    lapHistory.forEach((l) => {
      if (l.compound !== "INTERMEDIATE" && l.compound !== "WET") dry.add(l.compound);
    });
    return dry;
  }, [lapHistory]);
  const obligationMet = compoundsUsed.size >= 2 || isRaining;
  const lapsLeft = totalLaps - currentLap;

  // S/F crossing callback — fired by leader's CarDot animation when it crosses S/F line.
  // This drives the lap counter so it updates exactly when the dot visually crosses the line.
  const handleLeaderLapCross = useCallback(() => {
    setDisplayedLap((prev) => {
      const next = prev + 1;
      displayedLapRef.current = next;
      return next;
    });
  }, []);

  // Safety sync: if backend races far ahead of the animation-driven counter, snap it.
  // Also initializes displayedLap from backend on first state.
  useEffect(() => {
    if (currentLap <= 0) return;
    if (displayedLapRef.current === 0) {
      setDisplayedLap(currentLap);
      displayedLapRef.current = currentLap;
    } else if (currentLap > displayedLapRef.current + 3) {
      setDisplayedLap(currentLap);
      displayedLapRef.current = currentLap;
    }
  }, [currentLap]);

  // Core state application — called by the queue drain for each lap
  const applyLapState = useCallback((state: RaceState) => {
    setRaceState(state);
    setPhase("RACING");

    const p = state.player ?? state.player_car ?? state.leaderboard?.[0];
    if (p) {
      const newEntry = { lap: state.current_lap, lapTimeS: p.lap_time, compound: p.tire.compound, position: p.position };
      setLapHistory((prev) => {
        const next = [...prev.slice(-49), newEntry];
        lapHistoryRef.current = next;
        return next;
      });
    }

    if (state.weather) {
      setWeatherHistory((prev) => [
        ...prev.slice(-19),
        { lap: state.current_lap, rainProb: state.weather.rain_probability, isRaining: state.weather.is_raining },
      ]);
    }

    const incoming = state.events_log ?? [];
    const truly_new = incoming.filter((e) => {
      const key = `${e.lap}-${e.event_type}-${JSON.stringify(e.data ?? {})}`;
      if (seenEventsRef.current.has(key)) return false;
      seenEventsRef.current.add(key);
      return true;
    });
    if (truly_new.length > 0) {
      setRaceEventsLog((prev) => [...prev.slice(-80), ...truly_new]);
    }

    setCompLapHistory((prev) => {
      const next = { ...prev };
      state.leaderboard.forEach((car) => {
        const name = typeof car.driver === "object"
          ? (car.driver as { name: string }).name
          : String(car.driver);
        if (car.lap_time > 10) {
          next[name] = [...(prev[name] ?? []).slice(-49), {
            lap: state.current_lap,
            lapTimeS: car.lap_time,
            compound: car.tire?.compound ?? "MEDIUM",
          }];
        }
      });
      return next;
    });
  }, []);

  // Queue drain — processes one lap at a time at a controlled rate
  const drainLapQueue = useCallback(() => {
    queueTimerRef.current = null;
    if (lapQueueRef.current.length === 0) return;

    const state = lapQueueRef.current.shift()!;
    applyLapState(state);

    if (lapQueueRef.current.length === 0) return;

    // Min display time per lap: 200ms at 1x, 80ms at 5x, 40ms at 10x+
    // If queue is backed up (>6 laps), halve the delay to drain faster
    const base = Math.max(40, 800 / simSpeedRef.current);
    const delay = lapQueueRef.current.length > 6 ? base / 2 : base;
    queueTimerRef.current = setTimeout(drainLapQueue, delay);
  }, [applyLapState]);

  // Stable stream callback — just enqueues; drain handles display timing
  const handleLap = useCallback((state: RaceState) => {
    // Cap queue at 20 to avoid runaway lag — drop oldest if needed
    if (lapQueueRef.current.length >= 20) lapQueueRef.current.shift();
    lapQueueRef.current.push(state);
    if (queueTimerRef.current === null) drainLapQueue();
  }, [drainLapQueue]);

  const handleFinished = useCallback((state: RaceState) => {
    setRaceState(state);
    setPhase("FINISHED");
    raceFinishedRef.current = true;
    // Accumulate final events
    const incoming = state.events_log ?? [];
    const truly_new = incoming.filter((e) => {
      const key = `${e.lap}-${e.event_type}-${JSON.stringify(e.data ?? {})}`;
      if (seenEventsRef.current.has(key)) return false;
      seenEventsRef.current.add(key);
      return true;
    });
    if (truly_new.length > 0) {
      setRaceEventsLog((prev) => [...prev.slice(-80), ...truly_new]);
    }

    // Persist race result for Results page
    try {
      const playerCar = state.player ?? state.player_car ?? state.leaderboard?.[0];
      localStorage.setItem("f1_last_race_result", JSON.stringify({
        trackName:        localStorage.getItem("f1_track_name") ?? "Unknown",
        playerTeam:       localStorage.getItem("f1_player_team") ?? "Unknown",
        totalLaps:        state.total_laps,
        playerPosition:   playerCar?.position ?? null,
        lapHistory:       lapHistoryRef.current,
        finalLeaderboard: state.leaderboard,
        eventsLog:        incoming,
      }));
    } catch (_) { /* storage full — skip */ }
  }, []);

  const handleError = useCallback((_err: Event) => {
    setPhase((curr) => (curr === "FINISHED" ? "FINISHED" : "RACING"));
  }, []);

  const handlePhase = useCallback((p: string, lights?: number) => {
    // Don't revert to pre-race phases once race is underway
    setPhase((curr) => {
      if ((curr === "RACING" || curr === "FINISHED") &&
          (p === "FORMATION" || p === "LIGHTS_OUT")) return curr;
      return p;
    });
    if (p === "LIGHTS_OUT" && lights !== undefined) setLightsCount(lights);
  }, []);

  // Stream lifecycle — restarts on speed/pause changes
  useEffect(() => {
    // Close any existing stream first and flush the lap queue
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (queueTimerRef.current !== null) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    lapQueueRef.current = [];

    if (sessionId === "mock") {
      setPhase("RACING");
      return;
    }
    if (isPaused || raceFinishedRef.current) return;

    cleanupRef.current = streamAutoRace(
      sessionId,
      handleLap,
      handleFinished,
      handleError,
      handlePhase,
      simSpeed,
    );

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, simSpeed, isPaused]);

  // Show results prompt shortly after race ends
  useEffect(() => {
    if (phase !== "FINISHED") return;
    const t = setTimeout(() => setShowResultsPrompt(true), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  // SC/VSC detection — show engineer notification when flag changes to SC/VSC
  useEffect(() => {
    if (!raceState) return;
    const curr = raceState.flag ?? raceState.phase;
    const prev = prevFlagRef.current;
    const nowSC = curr === "SAFETY_CAR" || curr === "VSC" || curr === "VIRTUAL_SAFETY_CAR";
    const wasSC = prev === "SAFETY_CAR" || prev === "VSC" || prev === "VIRTUAL_SAFETY_CAR";
    if (nowSC && !wasSC) setShowSCNotif(true);
    if (!nowSC && wasSC) setShowSCNotif(false);
    prevFlagRef.current = curr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceState?.flag, raceState?.phase]);

  // Engineer recommendation from BDI race-engineer agent
  const engineerRec: EngineerRecommendation | null = raceState?.engineer_recommendation ?? null;

  // Derive SC notification recommendation from engineer agent (fallback to inline logic)
  const scRecommendation = useMemo(() => {
    if (engineerRec?.compound) {
      return { compound: engineerRec.compound, reason: engineerRec.rationale };
    }
    if (!player) return { compound: "MEDIUM", reason: "SC window — standard pit opportunity" };
    if (isRaining) return { compound: "INTERMEDIATE", reason: "Wet track — switch to intermediates" };
    const wear = player.tire.wear;
    const lapsLeft2 = totalLaps - currentLap;
    const unusedDry = (["HARD", "MEDIUM", "SOFT"] as const)
      .find((c) => !compoundsUsed.has(c) && c !== compound);
    if (wear > 0.55 && unusedDry) return { compound: unusedDry, reason: `Tires ${Math.round(wear * 100)}% worn — use SC to meet compound rule` };
    if (wear > 0.55) return { compound: compound === "SOFT" ? "MEDIUM" : "HARD", reason: `High wear — switch before cliff` };
    if (compoundsUsed.size < 2 && unusedDry) return { compound: unusedDry, reason: `Compound obligation — must use ${unusedDry} before finish` };
    if (lapsLeft2 > 20) return { compound: "MEDIUM", reason: "SC window: extend strategy, protect tires for final push" };
    return { compound: "SOFT", reason: "Final stint — attack on fresh softs" };
  }, [engineerRec, raceState?.flag, raceState?.phase, player, isRaining, compoundsUsed, compound, currentLap, totalLaps]);

  const handlePitNow = async () => {
    if (sessionId === "mock" || !raceState || isPitting) return;
    setIsPitting(true);
    setShowSCNotif(false);
    try {
      const result = await playerPit(sessionId, selectedPitTire);
      setRaceState(result.state);
    } catch (err) {
      console.error("Pit stop failed:", err);
    } finally {
      setIsPitting(false);
    }
  };

  const handleSCPit = async (pitCompound: string) => {
    if (sessionId === "mock" || !raceState || isPitting) return;
    setShowSCNotif(false);
    setSelectedPitTire(pitCompound);
    setIsPitting(true);
    try {
      const result = await playerPit(sessionId, pitCompound);
      setRaceState(result.state);
    } catch (err) {
      console.error("SC pit failed:", err);
    } finally {
      setIsPitting(false);
    }
  };

  const weather       = raceState?.weather;
  const leaderboard   = raceState?.leaderboard ?? [];
  const stratMsgs     = (raceState?.strategy_messages ?? raceState?.messages ?? []) as (StrategyMsg | string)[];
  const lastLapEntry  = lapHistory[lapHistory.length - 1];
  const prevLapEntry  = lapHistory[lapHistory.length - 2];
  const lapDelta      = lastLapEntry && prevLapEntry ? lastLapEntry.lapTimeS - prevLapEntry.lapTimeS : 0;
  const winProb       = player ? Math.max(5, Math.round(100 - (player.position - 1) * 5)) : 50;
  const flagColor     = raceState?.flag === "SAFETY_CAR" ? "#FFD300"
    : raceState?.flag === "RED" ? "#FF2D2D"
    : raceState?.flag === "YELLOW" ? "#FFD300"
    : "#22C55E";

  // Predicted finish position — tire-age + wear delta vs nearby rivals
  const predictedPosition = useMemo(() => {
    if (!player || leaderboard.length === 0) return null;
    const pos = player.position;
    const active = leaderboard.filter((c) => !(c as { dnf?: boolean }).dnf);
    const nearby = active.filter((c) => {
      const cPos = c.position;
      return Math.abs(cPos - pos) <= 4 && cPos !== pos;
    });
    if (nearby.length === 0) return pos;
    const avgNearbyAge  = nearby.reduce((s, c) => s + (c.tire?.age ?? 0), 0) / nearby.length;
    const avgNearbyWear = nearby.reduce((s, c) => s + (c.tire?.wear ?? 0), 0) / nearby.length;
    // Positive = player fresher/less worn = predict gain
    const ageAdv  = (avgNearbyAge  - (player.tire?.age  ?? 0)) / 12;
    const wearAdv = (avgNearbyWear - (player.tire?.wear ?? 0)) * 1.5;
    const lapsRemaining = totalLaps - currentLap;
    // Penalise if compound obligation unmet and few laps left
    const obPenalty = !obligationMet && lapsRemaining < 12 ? 2 : 0;
    const delta = Math.round(ageAdv + wearAdv) - obPenalty;
    return Math.max(1, Math.min(active.length, pos - delta));
  }, [player, leaderboard, obligationMet, totalLaps, currentLap]);

  // Sorted driver list for comparison selector (active + DNF)
  const allDriverNames = useMemo(() => {
    return leaderboard.map((c) => {
      const n = typeof c.driver === "object" ? (c.driver as { name: string }).name : String(c.driver);
      return n;
    });
  }, [leaderboard]);

  // Build combined chart data for comparison mode
  const compareChartData = useMemo(() => {
    const allSelected = [
      "YOU",
      ...selectedCompDrivers,
    ];
    // Find player name
    const playerName = player ? (
      typeof player.driver === "object" ? (player.driver as { name: string }).name : String(player.driver)
    ) : null;

    // Collect all lap numbers present across selected drivers
    const lapSet = new Set<number>();
    lapHistory.forEach((l) => lapSet.add(l.lap));
    selectedCompDrivers.forEach((name) => {
      (compLapHistory[name] ?? []).forEach((l) => lapSet.add(l.lap));
    });
    const laps = [...lapSet].sort((a, b) => a - b);

    // Build index maps
    const playerMap = new Map(lapHistory.map((l) => [l.lap, l.lapTimeS]));
    const compMaps: Record<string, Map<number, number>> = {};
    selectedCompDrivers.forEach((name) => {
      compMaps[name] = new Map((compLapHistory[name] ?? []).map((l) => [l.lap, l.lapTimeS]));
    });

    return laps.map((lap) => {
      const row: Record<string, number | undefined> = { lap };
      row["YOU"] = playerMap.get(lap);
      selectedCompDrivers.forEach((name) => {
        row[name] = compMaps[name].get(lap);
      });
      return row;
    });
  }, [lapHistory, compLapHistory, selectedCompDrivers, player]);

  return (
    <>
      <RacePhaseOverlay phase={phase} lights={lightsCount} />

      {/* SC / VSC engineer notification — non-blocking, slides in from right */}
      <AnimatePresence>
        {showSCNotif && phase === "RACING" && (
          <SCNotification
            flagType={raceState?.flag ?? raceState?.phase ?? "SAFETY_CAR"}
            currentLap={currentLap}
            totalLaps={totalLaps}
            player={player}
            recommendation={scRecommendation}
            onPitNow={handleSCPit}
            onDismiss={() => setShowSCNotif(false)}
          />
        )}
      </AnimatePresence>

      {/* Race finished — results prompt */}
      <AnimatePresence>
        {showResultsPrompt && phase === "FINISHED" && (() => {
          const winner = leaderboard.find((c) => c.position === 1);
          const winnerObj = typeof winner?.driver === "object"
            ? winner.driver as { name: string; team: string }
            : null;
          const winnerName = winnerObj?.name ?? (typeof winner?.driver === "string" ? winner.driver : "—");
          const winnerTeam = winnerObj?.team ?? "";
          return (
            <RaceFinishedPrompt
              playerPosition={player?.position ?? null}
              winnerName={winnerName}
              winnerTeam={winnerTeam}
              onReview={() => navigate("/results")}
              onDismiss={() => setShowResultsPrompt(false)}
            />
          );
        })()}
      </AnimatePresence>

      <div className="p-3 md:p-4 max-w-[1600px] mx-auto space-y-3 pb-8">

        {/* ── Stats Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface rounded-lg border border-border-subtle p-3">
            <div className="flex items-center gap-2 mb-1">
              <Flag className="w-3.5 h-3.5 text-rosso" />
              <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">LAP</span>
            </div>
            <p className="text-2xl font-mono font-black text-text-primary">
              {displayedLap > 0 ? displayedLap : currentLap} <span className="text-text-ghost text-lg">/ {totalLaps}</span>
            </p>
          </div>

          <div className="bg-surface rounded-lg border border-border-subtle p-3">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="w-3.5 h-3.5 text-neural-cyan" />
              <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">LAST LAP</span>
            </div>
            <p className="text-2xl font-mono font-black text-text-primary">
              {lastLapEntry ? formatLapTime(lastLapEntry.lapTimeS) : "--:--.---"}
            </p>
            {lastLapEntry && prevLapEntry && (
              <span className={`text-xs font-mono font-bold ${lapDelta < 0 ? "text-success-green" : "text-alert-red"}`}>
                {lapDelta < 0 ? "-" : "+"}{Math.abs(lapDelta).toFixed(3)}s
              </span>
            )}
          </div>

          <div className="bg-surface rounded-lg border border-border-subtle p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-ferrari-gold" />
              <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">POSITION</span>
            </div>
            <p className="text-3xl font-black text-ferrari-gold">P{player?.position ?? "—"}</p>
          </div>

          <div className="bg-surface rounded-lg border border-border-subtle p-3">
            <div className="flex items-center gap-2 mb-1">
              <Navigation className="w-3.5 h-3.5 text-success-green" />
              <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">TEAM</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamColors[playerTeam] ?? "#FF1E00" }} />
              <p className="text-lg font-bold text-text-primary">{playerTeam}</p>
            </div>
          </div>
        </div>

        {/* ── Speed Controller ──────────────────────────────────────────────── */}
        <div className="bg-surface rounded-lg border border-border-subtle px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mr-1">
            Sim Speed
          </span>

          {/* Flag indicator */}
          {raceState?.flag && raceState.flag !== "GREEN" && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider mr-1"
              style={{ borderColor: flagColor, color: flagColor, backgroundColor: `${flagColor}15` }}>
              <Flag className="w-2.5 h-2.5" />
              {raceState.flag.replace(/_/g, " ")}
            </div>
          )}

          {/* Pause / Resume */}
          <button
            onClick={() => {
              if (raceFinishedRef.current) return;
              setIsPaused((p) => !p);
            }}
            disabled={phase === "FINISHED"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${
              isPaused
                ? "border-success-green/50 bg-success-green/10 text-success-green"
                : "border-border-subtle bg-carbon text-text-secondary hover:border-text-ghost/30"
            }`}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {isPaused ? "RESUME" : "PAUSE"}
          </button>

          {/* Speed buttons */}
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setSimSpeed(s); setIsPaused(false); }}
              disabled={phase === "FINISHED"}
              className={`px-2.5 py-1.5 rounded border text-[11px] font-mono font-bold transition-all disabled:opacity-40 ${
                simSpeed === s && !isPaused
                  ? "border-neural-cyan/60 bg-neural-cyan/10 text-neural-cyan"
                  : "border-border-subtle bg-carbon text-text-ghost hover:border-text-ghost/30 hover:text-text-secondary"
              }`}
            >
              {s}×
            </button>
          ))}

          <div className="ml-auto text-[10px] font-mono text-text-ghost">
            {phase === "FINISHED" ? (
              <span className="text-ferrari-gold font-bold uppercase tracking-wider">RACE FINISHED</span>
            ) : isPaused ? (
              <span className="text-warning-amber">PAUSED</span>
            ) : (
              <span>{simSpeed}× speed · {SPEED_SECONDS_PER_LAP[simSpeed]}s / lap</span>
            )}
          </div>
        </div>

        {/* ── 3-Column Layout ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-3 space-y-3">

            {/* Weather */}
            <div className="bg-surface rounded-lg border border-border-subtle p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-weather-blue" />
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Weather</span>
                </div>
                <span className="text-xs font-mono text-text-secondary">Lap {currentLap}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {weather?.is_raining
                    ? <CloudRain className="w-8 h-8 text-weather-blue" />
                    : <Sun className="w-8 h-8 text-warning-amber" />}
                  <div>
                    <p className="text-sm font-bold text-text-primary">{weather?.condition ?? "DRY"}</p>
                    <p className="text-xs text-text-secondary">{weather?.air_temp?.toFixed(1) ?? "--"}°C air</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-ghost">Rain</p>
                  <p className="text-sm font-mono font-bold text-weather-blue">
                    {((weather?.rain_probability ?? 0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-carbon rounded-full overflow-hidden">
                <div className="h-full bg-weather-blue rounded-full transition-all"
                  style={{ width: `${(weather?.rain_probability ?? 0) * 100}%` }} />
              </div>

              {/* Lap-by-lap rain probability history strip */}
              {weatherHistory.length > 1 && (
                <div className="mt-3 pt-2 border-t border-border-subtle">
                  <p className="text-[9px] text-text-ghost uppercase tracking-wider mb-1.5">Rain % · Last {weatherHistory.length} laps</p>
                  <div className="flex items-end gap-0.5 h-8">
                    {weatherHistory.map((w) => {
                      const pct = Math.round(w.rainProb * 100);
                      const barH = Math.max(2, pct);
                      const barColor = w.isRaining ? "#22d3ee" : pct > 30 ? "#fbbf24" : "#4ade80";
                      return (
                        <div key={w.lap} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`L${w.lap}: ${pct}%`}>
                          <div
                            className="w-full rounded-t-sm transition-all"
                            style={{ height: `${barH}%`, backgroundColor: barColor, opacity: 0.7 + (pct / 100) * 0.3 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[8px] text-text-ghost mt-0.5">
                    <span>L{weatherHistory[0]?.lap}</span>
                    <span>L{weatherHistory[weatherHistory.length - 1]?.lap}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ML Strategy Engine */}
            <div className="bg-surface rounded-lg border border-border-subtle p-3">
              <div className="flex items-center gap-2 mb-3">
                <BrainCircuit className="w-4 h-4 text-neural-purple" />
                <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Strategy Engine</span>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <CircularProgress value={winProb} size={64} strokeWidth={5} color="#7B61FF" />
                <div className="flex-1">
                  <p className="text-2xl font-black text-neural-purple">{winProb.toFixed(0)}%</p>
                  <p className="text-[10px] uppercase tracking-wider text-text-ghost">Win Probability</p>
                  {predictedPosition !== null && player && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-text-ghost">Predicted:</span>
                      <span className={`text-sm font-black font-mono ${
                        predictedPosition < player.position ? "text-emerald-400"
                        : predictedPosition > player.position ? "text-alert-red"
                        : "text-text-secondary"
                      }`}>
                        P{predictedPosition}
                      </span>
                      {predictedPosition !== player.position && (
                        <span className={`text-[9px] font-bold ${predictedPosition < player.position ? "text-emerald-400" : "text-alert-red"}`}>
                          {predictedPosition < player.position ? `▲${player.position - predictedPosition}` : `▼${predictedPosition - player.position}`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">ERS Mode</span>
                  <span className="text-text-primary font-mono font-semibold">{player?.ers_mode ?? "BALANCED"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">ERS Battery</span>
                  <span className="text-text-primary font-mono font-semibold">{player?.ers_battery?.toFixed(0) ?? "--"}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">Fuel</span>
                  <span className="text-text-primary font-mono font-semibold">{player?.fuel?.toFixed(1) ?? "--"} kg</span>
                </div>
              </div>

              {/* BDI Debug Panel (dev-only) */}
              {import.meta.env.DEV && raceState?.bdi_states && (
                <div className="mt-3 pt-3 border-t border-border-subtle/50">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-ghost mb-1.5">
                    BDI Debug
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                    {Object.values(raceState.bdi_states).map((state: BDIState) => (
                      <div
                        key={state.driver_number}
                        className="text-[9px] p-1.5 rounded bg-carbon border border-border-subtle/40"
                      >
                        <span className="font-semibold text-text-primary">#{state.driver_number}</span>{" "}
                        <span className="text-ferrari-gold">{state.top_desire ?? "—"}</span>
                        <div className="text-text-ghost truncate">
                          {state.current_plan ?? "NO_PLAN"} | s{state.plan_step}
                        </div>
                        {state.tire_degrading_faster && (
                          <span className="text-alert-red">deg+</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tire Status */}
            <div className="bg-surface rounded-lg border border-border-subtle p-3">
              <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Current Tire</span>
              <div className="flex items-center gap-3 mt-2">
                <TireWearRing wear={tireWear} size={56} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tireColors[compound] }} />
                    <span className="text-sm font-bold text-text-primary">{compound}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">Age: {tireAge} laps</p>
                  {/* Expected remaining laps based on track severity */}
                  {(() => {
                    const expectedLife = _tireLife[compound as keyof typeof _tireLife] ?? 20;
                    const remaining = Math.max(0, expectedLife - tireAge);
                    const urgency = remaining <= 3 ? "text-alert-red" : remaining <= 8 ? "text-warning-amber" : "text-text-ghost";
                    return (
                      <p className={`text-[10px] mt-0.5 font-mono ${urgency}`}>
                        ~{remaining} laps left (est.)
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* F1 Compound Obligation */}
            {!isRaining && (
              <div className={`rounded-lg border p-3 ${
                obligationMet
                  ? "bg-success-green/5 border-success-green/20"
                  : lapsLeft <= 15
                  ? "bg-alert-red/10 border-alert-red/40"
                  : "bg-surface border-border-subtle"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Compound Rule</span>
                  <span className={`text-[10px] font-bold uppercase ${obligationMet ? "text-success-green" : "text-alert-red"}`}>
                    {obligationMet ? "✓ MET" : "NOT MET"}
                  </span>
                </div>
                <p className="text-[10px] text-text-ghost mb-2">Use ≥2 dry compounds to finish legally.</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(["SOFT", "MEDIUM", "HARD"] as const).map((c) => (
                    <span key={c}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        compoundsUsed.has(c)
                          ? "border-transparent"
                          : "border-border-subtle text-text-ghost opacity-50"
                      }`}
                      style={compoundsUsed.has(c)
                        ? { backgroundColor: `${tireColors[c]}22`, color: tireColors[c], borderColor: `${tireColors[c]}44` }
                        : {}}
                    >
                      {c[0]}
                    </span>
                  ))}
                </div>
                {!obligationMet && lapsLeft <= 15 && (
                  <p className="text-[10px] text-alert-red font-bold mt-2 uppercase tracking-wider">
                    ⚠ {lapsLeft} laps left — pit for different compound!
                  </p>
                )}
              </div>
            )}

            {/* Pit Stop Control */}
            <div className="bg-surface rounded-lg border border-border-subtle p-3">
              <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Pit Stop</span>
              {/* Dry compounds */}
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {([
                  { label: "SOFT",   color: "#E8103A" },
                  { label: "MEDIUM", color: "#FFD300" },
                  { label: "HARD",   color: "#F5F5F5" },
                ] as const).map((t) => (
                  <button key={t.label}
                    onClick={() => setSelectedPitTire(t.label)}
                    className={`p-2 rounded border text-center transition-all ${
                      selectedPitTire === t.label
                        ? "border-ferrari-gold/50 bg-ferrari-gold/5"
                        : "border-border-subtle bg-carbon hover:border-text-ghost/30"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: t.color }} />
                    <p className="text-[10px] font-bold text-text-primary">{t.label}</p>
                  </button>
                ))}
              </div>
              {/* Wet compounds — highlighted when raining */}
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                {([
                  { label: "INTERMEDIATE", color: "#00D084", shortLabel: "INTER" },
                  { label: "WET",          color: "#1E90FF", shortLabel: "WET"   },
                ] as const).map((t) => (
                  <button key={t.label}
                    onClick={() => setSelectedPitTire(t.label)}
                    className={`p-2 rounded border text-center transition-all ${
                      selectedPitTire === t.label
                        ? "border-weather-blue/60 bg-weather-blue/8"
                        : isRaining
                        ? "border-weather-blue/30 bg-weather-blue/10 hover:border-weather-blue/50"
                        : "border-border-subtle bg-carbon hover:border-text-ghost/30"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: t.color }} />
                    <p className="text-[10px] font-bold text-text-primary">{t.shortLabel}</p>
                    {isRaining && (
                      <p className="text-[8px] font-mono" style={{ color: t.color }}>↑ RAIN</p>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={handlePitNow}
                disabled={isPitting || phase !== "RACING"}
                className="w-full h-11 mt-3 rounded-lg bg-alert-red/10 border border-alert-red/30 text-alert-red font-bold uppercase tracking-wider text-sm hover:bg-alert-red/20 transition-colors disabled:opacity-40"
              >
                {isPitting ? "PITTING…" : "PIT NOW"}
              </button>
            </div>
          </div>

          {/* CENTER COLUMN */}
          <div className="lg:col-span-6 space-y-3">

            {/* Track Map */}
            <div className="bg-surface rounded-lg border border-border-subtle p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-neural-cyan" />
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Live Track Map</span>
                </div>
                <span className="text-[10px] text-text-ghost font-mono">
                  {leaderboard.filter((c) => !(c as any).dnf).length} cars active
                </span>
              </div>
              <TrackMap
                trackKey={trackKey}
                cars={leaderboard}
                playerTeam={playerTeam}
                className="h-56"
                animDurationMs={(isPaused || phase === "FINISHED") ? 0 : SPEED_SECONDS_PER_LAP[simSpeed] * 1000}
                onLeaderLapCross={handleLeaderLapCross}
              />
            </div>

            {/* ── DRIVER / RACE message tabs — moved high ───────────────── */}
            <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
              {/* Tab header */}
              <div className="flex border-b border-border-subtle">
                <button
                  onClick={() => setMsgTab("DRIVER")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] uppercase tracking-wider font-bold transition-colors ${
                    msgTab === "DRIVER"
                      ? "text-neural-cyan border-b-2 border-neural-cyan bg-neural-cyan/5"
                      : "text-text-ghost hover:text-text-secondary"
                  }`}
                >
                  <User2 className="w-3 h-3" />
                  Driver
                </button>
                <button
                  onClick={() => setMsgTab("RACE")}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] uppercase tracking-wider font-bold transition-colors relative ${
                    msgTab === "RACE"
                      ? "text-ferrari-gold border-b-2 border-ferrari-gold bg-ferrari-gold/5"
                      : "text-text-ghost hover:text-text-secondary"
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  Race Events
                  {raceEventsLog.length > 0 && (
                    <span className="ml-1 text-[9px] font-mono bg-ferrari-gold/20 text-ferrari-gold px-1 rounded">
                      {raceEventsLog.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab content */}
              <div className="p-3 space-y-2 max-h-44 overflow-y-auto">
                {msgTab === "DRIVER" && (
                  <>
                    {/* BDI Engineer recommendation (non-SC) */}
                    {engineerRec && engineerRec.priority !== "INFO" && raceState?.flag !== "SAFETY_CAR" && raceState?.phase !== "SAFETY_CAR" && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`border rounded-lg p-2.5 ${
                          engineerRec.priority === "URGENT"
                            ? "bg-alert-red/10 border-alert-red/40"
                            : "bg-emerald-500/10 border-emerald-500/30"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Headphones className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-neural-purple" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neural-purple mb-0.5">
                              Engineer — {engineerRec.priority}
                            </p>
                            <p className="text-xs text-text-primary font-semibold truncate">
                              {engineerRec.headline}
                            </p>
                            <p className="text-[10px] text-text-ghost mt-0.5">
                              {engineerRec.rationale}
                            </p>
                            {engineerRec.action === "PIT_NOW" && engineerRec.compound && (
                              <button
                                onClick={() => handleSCPit(engineerRec.compound!)}
                                className="mt-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-alert-red/15 border border-alert-red/40 text-alert-red hover:bg-alert-red/25 transition-colors"
                              >
                                Pit — {engineerRec.compound}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {stratMsgs.length === 0 && !engineerRec && (
                      <p className="text-xs text-text-ghost text-center py-4">No strategy messages yet</p>
                    )}
                    {/* Filter SC/VSC URGENT pit messages — those surface via the SC popup instead */}
                    {stratMsgs
                      .filter((msg) => {
                        const text = typeof msg === "string" ? msg : msg.text ?? "";
                        const isSCRedundant = (raceState?.flag === "SAFETY_CAR" || raceState?.phase === "SAFETY_CAR") &&
                          (text.toLowerCase().includes("safety car") || text.toLowerCase().includes("pit immediately"));
                        return !isSCRedundant;
                      })
                      .slice(-4)
                      .map((msg, i) => {
                        const text = typeof msg === "string" ? msg : msg.text ?? "";
                        const type = typeof msg === "object" ? (msg.type ?? "INFO") : "INFO";
                        const cfg  = msgCfg[type] ?? msgCfg.INFO;
                        const Icon = cfg.Icon;
                        return (
                          <motion.div key={i}
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className={`${cfg.bg} border ${cfg.border} rounded-lg p-2.5`}
                          >
                            <div className="flex items-start gap-2">
                              <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
                              <p className="text-xs text-text-secondary">{text}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                  </>
                )}

                {msgTab === "RACE" && (
                  <>
                    {raceEventsLog.length === 0 && (
                      <p className="text-xs text-text-ghost text-center py-4">
                        {phase === "FORMATION" || phase === "LIGHTS_OUT"
                          ? "Waiting for race start…"
                          : "No incidents recorded yet"}
                      </p>
                    )}
                    {[...raceEventsLog].reverse().map((e, i) => {
                      const cfg = eventCfg[e.event_type] ?? { color: "#8B8BA8", symbol: "•" };
                      return (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-2 py-1.5 border-b border-border-subtle/40 last:border-0"
                        >
                          <span className="text-base leading-none mt-0.5 flex-shrink-0" style={{ color: cfg.color }}>
                            {cfg.symbol}
                          </span>
                          <p className="text-xs font-mono" style={{ color: cfg.color }}>
                            {formatRaceEvent(e)}
                          </p>
                        </motion.div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Lap Time Chart — PLAYER mode + COMPARE mode */}
            <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
              {/* Header with mode toggle */}
              <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-neural-cyan" />
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Lap Times</span>
                </div>
                <div className="flex items-center gap-1">
                  {(["PLAYER", "COMPARE"] as const).map((mode) => (
                    <button key={mode}
                      onClick={() => setLapChartMode(mode)}
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all ${
                        lapChartMode === mode
                          ? "bg-neural-cyan/20 text-neural-cyan border border-neural-cyan/30"
                          : "text-text-ghost hover:text-text-secondary"
                      }`}
                    >
                      {mode === "PLAYER" ? "Mine" : "Compare"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3">
                {lapChartMode === "PLAYER" ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={lapHistory}>
                      <defs>
                        <linearGradient id="lapGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#FF1E00" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#FF1E00" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3D" />
                      <XAxis dataKey="lap" stroke="#55556B" fontSize={10} tickLine={false} />
                      <YAxis stroke="#55556B" fontSize={10} tickLine={false}
                        tickFormatter={(v: number) => v > 0 ? formatLapTime(v) : ""} width={60} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#16161E", border: "1px solid #2D2D3D", borderRadius: 8, color: "#F0F0F5", fontSize: 11 }}
                        formatter={(v: number) => [formatLapTime(v), "Lap Time"]}
                      />
                      <Area type="monotone" dataKey="lapTimeS" name="Lap Time" stroke="#FF1E00"
                        fill="url(#lapGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <>
                    {/* Driver selector — scroll horizontal */}
                    <div className="flex flex-wrap gap-1.5 mb-3 max-h-16 overflow-y-auto">
                      {allDriverNames.map((name, i) => {
                        const isSelected = selectedCompDrivers.includes(name);
                        // Assign a colour per driver (cycle through a palette)
                        const palette = ["#00D2BE","#FF8700","#1E41FF","#006F62","#0090FF","#00A0DE","#FFD300","#A78BFA","#A3A3A3","#B6BABD","#22D3EE","#F472B6","#34D399","#FB923C","#818CF8","#E879F9","#4ADE80","#FACC15","#60A5FA","#F87171"];
                        const driverColor = palette[i % palette.length];
                        return (
                          <button key={name}
                            onClick={() => setSelectedCompDrivers((prev) =>
                              isSelected ? prev.filter((n) => n !== name) : [...prev, name]
                            )}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all truncate max-w-[80px] ${
                              isSelected
                                ? "opacity-100"
                                : "opacity-40 hover:opacity-70 border-border-subtle text-text-ghost"
                            }`}
                            style={isSelected ? { borderColor: driverColor, color: driverColor, backgroundColor: `${driverColor}18` } : {}}
                            title={name}
                          >
                            {name.split(" ").pop()?.slice(0, 3).toUpperCase() ?? name.slice(0, 3)}
                          </button>
                        );
                      })}
                      {allDriverNames.length === 0 && (
                        <span className="text-[9px] text-text-ghost">Race data loading…</span>
                      )}
                    </div>

                    {/* Multi-line chart */}
                    {compareChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={compareChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3D" />
                          <XAxis dataKey="lap" stroke="#55556B" fontSize={10} tickLine={false} />
                          <YAxis stroke="#55556B" fontSize={10} tickLine={false}
                            tickFormatter={(v: number) => v > 0 ? formatLapTime(v) : ""} width={60} domain={["auto","auto"]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#16161E", border: "1px solid #2D2D3D", borderRadius: 8, color: "#F0F0F5", fontSize: 11 }}
                            formatter={(v: number, name: string) => [formatLapTime(v), name]}
                          />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          {/* Player line always shown */}
                          <Line type="monotone" dataKey="YOU" stroke="#FF1E00" strokeWidth={2.5}
                            dot={false} connectNulls name="YOU" />
                          {/* Competitor lines */}
                          {selectedCompDrivers.map((name, i) => {
                            const palette = ["#00D2BE","#FF8700","#1E41FF","#006F62","#0090FF","#00A0DE","#FFD300","#A78BFA","#A3A3A3","#B6BABD","#22D3EE","#F472B6","#34D399","#FB923C","#818CF8","#E879F9","#4ADE80","#FACC15","#60A5FA","#F87171"];
                            const idx = allDriverNames.indexOf(name);
                            return (
                              <Line key={name} type="monotone" dataKey={name}
                                stroke={palette[(idx >= 0 ? idx : i) % palette.length]}
                                strokeWidth={1.5} dot={false} connectNulls
                                name={name.split(" ").pop()?.slice(0, 3).toUpperCase() ?? name}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-32 text-text-ghost text-xs">
                        {selectedCompDrivers.length === 0
                          ? "Select drivers above to compare"
                          : "Waiting for lap data…"}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-3 space-y-3">

            {/* Live Leaderboard — full grid including DNFs */}
            <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
              <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flag className="w-3.5 h-3.5 text-rosso" />
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Live Leaderboard</span>
                </div>
                <span className="text-[10px] font-mono text-text-ghost">
                  {leaderboard.filter((c) => !(c as { dnf?: boolean }).dnf).length}/{leaderboard.length} active
                </span>
              </div>
              <div className="divide-y divide-border-subtle max-h-[480px] overflow-y-auto">
                {/* Active cars first, then DNFs */}
                {[
                  ...leaderboard.filter((c) => !(c as { dnf?: boolean }).dnf),
                  ...leaderboard.filter((c) => !!(c as { dnf?: boolean }).dnf),
                ].map((car) => {
                  const driverObj  = typeof car.driver === "object"
                    ? car.driver as { name: string; team: string; number: number }
                    : null;
                  const driverName = driverObj?.name ?? (typeof car.driver === "string" ? car.driver : "—");
                  const driverTeam = driverObj?.team ?? "";
                  const isPlayer   = driverTeam === playerTeam;
                  const isDnf      = !!(car as { dnf?: boolean; dnf_reason?: string }).dnf;
                  const dnfReason  = (car as { dnf_reason?: string }).dnf_reason ?? "retired";
                  const tc         = tireShort[car.tire?.compound ?? "M"] ?? "M";
                  const lapTimeStr = car.lap_time > 10 ? formatLapTime(car.lap_time) : null;
                  return (
                    <div key={`${driverName}-${car.position}`}
                      className={`px-2.5 py-1.5 flex items-center gap-2 transition-colors ${
                        isPlayer ? "bg-ferrari-gold/5 border-l-2 border-ferrari-gold" : "hover:bg-surface-inner/40"
                      } ${isDnf ? "opacity-40" : ""}`}
                    >
                      {/* Position */}
                      <span className={`text-[10px] font-mono font-black w-5 shrink-0 ${
                        car.position === 1 ? "text-ferrari-gold"
                        : car.position <= 3 ? "text-warning-amber"
                        : "text-text-ghost"
                      }`}>
                        {isDnf ? "—" : car.position}
                      </span>

                      {/* Team color dot */}
                      <div className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: teamColors[driverTeam] ?? "#888" }} />

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {isPlayer && <span className="text-[8px] bg-ferrari-gold/20 text-ferrari-gold border border-ferrari-gold/30 rounded px-0.5 font-bold leading-tight">YOU</span>}
                          <p className="text-[11px] font-semibold text-text-primary truncate">{driverName}</p>
                        </div>
                        {isDnf
                          ? <p className="text-[9px] text-alert-red uppercase tracking-wide">DNF · {dnfReason}</p>
                          : lapTimeStr && <p className="text-[9px] text-text-ghost font-mono">{lapTimeStr}</p>}
                      </div>

                      {/* Tire */}
                      {!isDnf && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-mono font-bold px-1 rounded"
                            style={{ backgroundColor: `${tireColors[car.tire?.compound ?? "M"]}22`, color: tireColors[car.tire?.compound ?? "M"] }}>
                            {tc}
                          </span>
                          <span className="text-[9px] font-mono text-text-ghost w-4">{car.tire?.age ?? 0}</span>
                        </div>
                      )}

                      {/* Gap */}
                      <span className="text-[9px] font-mono text-text-secondary w-14 text-right shrink-0">
                        {isDnf
                          ? <span className="text-alert-red">DNF</span>
                          : car.gap_to_leader == null ? "—"
                          : car.gap_to_leader === 0 ? <span className="text-ferrari-gold">LEAD</span>
                          : `+${car.gap_to_leader.toFixed(1)}`
                        }
                      </span>
                    </div>
                  );
                })}
                {leaderboard.length === 0 && (
                  <div className="px-3 py-6 text-center text-text-ghost text-xs">
                    {phase === "FORMATION" ? "Formation lap in progress…" : "Waiting for race data…"}
                  </div>
                )}
              </div>
            </div>

            {/* Gap info */}
            {player && (
              <div className="bg-surface rounded-lg border border-border-subtle p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-opportunity-green" />
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Gaps</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-ghost">Gap ahead</span>
                    <span className="font-mono text-text-primary">
                      {player.gap_to_next != null ? `+${player.gap_to_next.toFixed(2)}s` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-ghost">Gap to leader</span>
                    <span className="font-mono text-text-primary">
                      {player.gap_to_leader != null && player.gap_to_leader > 0
                        ? `+${player.gap_to_leader.toFixed(2)}s` : "Leader"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-ghost">Pit stops</span>
                    <span className="font-mono text-text-primary">{player.pits}</span>
                  </div>
                  {(player.track_limit_violations ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-warning-amber">Track limits</span>
                      <span className="font-mono text-warning-amber">
                        {player.track_limit_violations} violation{(player.track_limit_violations ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  {(player.contact_penalties ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-alert-red">Contact pen.</span>
                      <span className="font-mono text-alert-red">{player.contact_penalties} × 5s</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Lap History Collapsible ────────────────────────────────────────── */}
        <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
          <button onClick={() => setShowLapHistory(!showLapHistory)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-inner/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-neural-cyan" />
              <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold">Lap History</span>
            </div>
            {showLapHistory ? <ChevronUp className="w-4 h-4 text-text-ghost" /> : <ChevronDown className="w-4 h-4 text-text-ghost" />}
          </button>
          {showLapHistory && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-ghost text-[10px] uppercase border-t border-border-subtle">
                    <th className="px-3 py-2 text-left">Lap</th>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-left">Tire</th>
                    <th className="px-3 py-2 text-left">Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {lapHistory.slice(-20).reverse().map((row) => (
                    <tr key={row.lap} className="border-t border-border-subtle/50 hover:bg-surface-inner/30">
                      <td className="px-3 py-1.5 font-mono font-bold text-text-primary">{row.lap}</td>
                      <td className="px-3 py-1.5 font-mono text-neural-cyan">{formatLapTime(row.lapTimeS)}</td>
                      <td className="px-3 py-1.5">
                        <span className="font-bold" style={{ color: tireColors[row.compound] ?? "#aaa" }}>
                          {tireShort[row.compound] ?? row.compound}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-ferrari-gold">P{row.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
