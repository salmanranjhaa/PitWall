import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer, ChevronRight, Zap,
  AlertTriangle, CheckCircle, FastForward, Droplets,
} from "lucide-react";
import {
  startQualifying, advanceQualifyingTime, doPlayerLap,
  nextQualifyingSegment, startRace,
  type QualifyingState, type QDriverState, type GridEntry,
} from "@/services/api";

// ── constants ───────────────────────────────────────────────────────────────

const teamColors: Record<string, string> = {
  "Red Bull Racing": "#1E41FF", "Mercedes": "#00D2BE", "Ferrari": "#FF1E00",
  "McLaren": "#FF8700", "Aston Martin": "#006F62", "Alpine": "#0090FF",
  "Williams": "#00A0DE", "Racing Bulls": "#6692FF", "Audi": "#BB0A30", "Haas": "#B6BABD", "Cadillac": "#D4AF37",
};

const tireColors: Record<string, string> = {
  SOFT: "#E8103A", MEDIUM: "#FFD300", HARD: "#F5F5F5",
};

const TIER_COLORS: Record<string, string> = {
  Champion: "#FFD700",
  Experienced: "#00B4D8",
  Midfield: "#8B8BA8",
  Rookie: "#FF6B35",
};

// Flavor text shown in driver profile
const DRIVER_STYLES: Record<string, string> = {
  Verstappen: "Generational",      Leclerc: "Qualifying Ace",
  Hamilton:   "Race Craft Master", Norris: "Reigning Champion",
  Piastri:    "Ice Cold",          Russell: "Technical",
  Sainz:      "Strategic",         Alonso: "Veteran Fox",
  Antonelli:  "Rising Star",       Stroll: "Variable",
  Gasly:      "Street Fighter",    Colapinto: "Fearless",
  Albon:      "Tire Whisperer",    Lindblad: "Teen Prodigy",
  Lawson:     "Combative",         Hadjar: "Fast Riser",
  Hulkenberg: "Consistent",        Bortoleto: "Smooth Operator",
  Ocon:       "Battler",           Bearman: "Brave",
  Perez:      "Tire Specialist",   Bottas: "Metronome",
};

// Weekend allocation (must match backend TIRE_ALLOCATION)
const TIRE_ALLOCATION: Record<string, number> = { SOFT: 8, MEDIUM: 4, HARD: 2 };

const SEGMENT_COLORS: Record<string, string> = {
  Q1: "#FF1E00", Q2: "#FFD300", Q3: "#7B61FF",
};

const SEGMENT_LABELS: Record<string, string> = {
  Q1: "Q1 — Knockout (22 cars)",
  Q2: "Q2 — Knockout (16 cars)",
  Q3: "Q3 — Pole Shootout (10 cars)",
};

// ── helpers ────────────────────────────────────────────────────────────────

function fmtTime(s: number | null | undefined): string {
  if (s == null || s < 10) return "--:--.---";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(3).padStart(6, "0")}`;
}

function fmtGap(g: number | null | undefined): string {
  if (g == null) return "";
  return `+${g.toFixed(3)}`;
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function getTLA(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].slice(0, 3).toUpperCase();
}

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// Map skill 0.800–0.990 → 0–100
function normSkill(skill: number): number {
  return Math.round(((skill - 0.800) / (0.990 - 0.800)) * 100);
}

// ── TierBadge ───────────────────────────────────────────────────────────────

function TierBadge({ tier, size = "sm" }: { tier?: string; size?: "sm" | "xs" }) {
  if (!tier) return null;
  const color = TIER_COLORS[tier] ?? "#8B8BA8";
  const label = tier === "Champion" ? "C" : tier === "Experienced" ? "E" : tier === "Midfield" ? "M" : "R";
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-black flex-shrink-0 ${
        size === "sm" ? "w-4 h-4 text-[8px]" : "w-3.5 h-3.5 text-[7px]"
      }`}
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
      title={tier}
    >
      {label}
    </span>
  );
}

// ── TireSetGrid ─────────────────────────────────────────────────────────────

function TireSetGrid({
  setsNew, setsUsed, selectedCompound, onSelect, disabled,
}: {
  setsNew: Record<string, number>;
  setsUsed: Record<string, number>;
  selectedCompound: "SOFT" | "MEDIUM" | "HARD";
  onSelect: (c: "SOFT" | "MEDIUM" | "HARD") => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {(["SOFT", "MEDIUM", "HARD"] as const).map((c) => {
        const total = TIRE_ALLOCATION[c];
        const newCount = setsNew[c] ?? 0;
        const usedCount = setsUsed[c] ?? 0;
        const noSets = newCount + usedCount === 0;
        const isSelected = selectedCompound === c;

        return (
          <button
            key={c}
            onClick={() => !disabled && !noSets && onSelect(c)}
            disabled={disabled || noSets}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all ${
              isSelected && !noSets
                ? "border-2"
                : noSets
                ? "border-border-subtle/40 opacity-40 cursor-not-allowed"
                : "border-border-subtle/60 bg-carbon hover:border-text-ghost/30"
            }`}
            style={isSelected && !noSets ? {
              borderColor: tireColors[c],
              backgroundColor: `${tireColors[c]}12`,
            } : {}}
          >
            {/* Compound dot */}
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tireColors[c] }} />

            {/* Set icons */}
            <div className="flex gap-0.5 flex-1">
              {Array.from({ length: total }).map((_, i) => {
                const isNew = i < newCount;
                const isUsed = i >= newCount && i < newCount + usedCount;
                return (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      isNew ? "bg-emerald-400" : isUsed ? "bg-orange-400" : "bg-gray-700/50"
                    }`}
                  />
                );
              })}
            </div>

            {/* Count label */}
            <span className="text-[9px] font-mono w-12 text-right" style={{ color: noSets ? "#666" : tireColors[c] }}>
              {noSets ? "NONE" : `${newCount > 0 ? `${newCount}N` : ""}${usedCount > 0 ? ` ${usedCount}U` : ""}`}
            </span>
          </button>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-3 px-1 pt-0.5">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[9px] text-text-ghost">New</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-[9px] text-text-ghost">Used (+0.3%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-700/50" />
          <span className="text-[9px] text-text-ghost">Gone</span>
        </div>
      </div>
    </div>
  );
}

// ── SegmentProgress ─────────────────────────────────────────────────────────

function SegmentProgress({ segment, segIdx }: { segment: string; segIdx: number }) {
  return (
    <div className="flex items-center gap-1">
      {["Q1", "Q2", "Q3"].map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase ${
              i < segIdx ? "bg-success-green/20 text-success-green"
              : i === segIdx ? "text-white" : "bg-carbon text-text-ghost"
            }`}
            style={i === segIdx ? { backgroundColor: `${SEGMENT_COLORS[s]}25`, color: SEGMENT_COLORS[s] } : {}}
          >
            {i < segIdx && <CheckCircle className="w-3 h-3" />}
            {s}
          </div>
          {i < 2 && <ChevronRight className="w-3 h-3 text-text-ghost" />}
        </div>
      ))}
    </div>
  );
}

// ── DriverRow ───────────────────────────────────────────────────────────────

function DriverRow({
  entry, safeCount, isEliminated,
}: {
  entry: QDriverState; safeCount: number; isEliminated?: boolean;
}) {
  const isPlayer = entry.is_player;
  const inDanger = entry.in_danger;
  const isDanger2 = entry.position === safeCount;

  let rowBg = "";
  if (isPlayer) rowBg = "bg-ferrari-gold/6 border-l-2 border-ferrari-gold";
  else if (inDanger && !isEliminated) rowBg = "bg-alert-red/5";
  else if (isDanger2 && !isEliminated) rowBg = "bg-warning-amber/5";

  const posColor = inDanger && !isEliminated ? "#FF2D2D"
    : isDanger2 ? "#FFB800"
    : isPlayer ? "#FFD300"
    : "#8B8BA8";

  const tc = teamColors[entry.team] ?? "#888";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 px-3 py-2 border-b border-border-subtle/40 last:border-0 transition-colors ${rowBg}`}
    >
      <span className="w-5 text-xs font-mono font-bold" style={{ color: posColor }}>
        {entry.position}
      </span>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tc }} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className={`text-xs font-semibold ${isPlayer ? "text-ferrari-gold" : "text-text-primary"}`}>
          {getTLA(entry.name)}
        </span>
        {entry.tier && <TierBadge tier={entry.tier} size="xs" />}
        <span className="text-[10px] text-text-ghost hidden sm:inline">{entry.name}</span>
      </div>

      {/* Compound badge */}
      {entry.compound && (
        <span className="text-[9px] font-mono font-bold px-1 rounded"
          style={{ backgroundColor: `${tireColors[entry.compound] ?? "#888"}22`, color: tireColors[entry.compound] ?? "#888" }}>
          {entry.compound[0]}
        </span>
      )}

      {/* Best time */}
      <span className={`text-xs font-mono w-20 text-right ${isPlayer ? "text-ferrari-gold font-bold" : "text-text-primary"}`}>
        {fmtTime(entry.best_time)}
      </span>

      {/* Gap */}
      <span className="text-[11px] font-mono text-text-ghost w-14 text-right">
        {entry.position === 1 ? "POLE" : fmtGap(entry.gap)}
      </span>
    </motion.div>
  );
}

// ── SegmentResultOverlay ────────────────────────────────────────────────────

function SegmentResultOverlay({
  state, onContinue,
}: {
  state: QualifyingState;
  onContinue: () => void;
}) {
  const eliminated = state.classification.filter((d) => d.in_danger);
  // Q3 is done when qualifying_complete OR when we're in Q3 and segment_finished
  const isLastSegment = state.segment === "Q3" || state.qualifying_complete;
  const nextSegments = ["Q2", "Q3"];
  const nextLabel = isLastSegment
    ? "View Starting Grid →"
    : `Advance to ${nextSegments[state.segment_index] ?? "Q3"} →`;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-surface border border-border-subtle rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="text-4xl font-black mb-2" style={{ color: SEGMENT_COLORS[state.segment] }}>
            {state.segment} COMPLETE
          </div>
          {!isLastSegment && (
            <p className="text-text-secondary text-sm">
              {state.elimination_count} driver{state.elimination_count !== 1 ? "s" : ""} eliminated
            </p>
          )}
        </div>

        {!isLastSegment && eliminated.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mb-3">
              Eliminated
            </p>
            <div className="space-y-2">
              {eliminated.map((d) => (
                <div key={d.number}
                  className="flex items-center justify-between bg-alert-red/5 border border-alert-red/20 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: teamColors[d.team] ?? "#888" }} />
                    <span className={`text-sm font-semibold ${d.is_player ? "text-ferrari-gold" : "text-text-primary"}`}>
                      {d.name}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-text-ghost">{fmtTime(d.best_time)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onContinue}
          className="w-full py-3 rounded-lg font-black uppercase tracking-wider text-sm text-white transition-all"
          style={{ backgroundColor: SEGMENT_COLORS[state.segment] }}
        >
          {nextLabel}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── LapToast ────────────────────────────────────────────────────────────────

function LapToast({
  time, isPB, compound, setType,
}: {
  time: number; isPB: boolean; compound: string; setType?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-xl border shadow-xl ${
        isPB ? "bg-neural-purple/20 border-neural-purple/50" : "bg-surface border-border-subtle"
      }`}
    >
      <div className="text-center">
        {isPB && <p className="text-[10px] uppercase tracking-widest text-neural-purple font-bold mb-0.5">Personal Best</p>}
        <p className={`text-2xl font-mono font-black ${isPB ? "text-neural-purple" : "text-text-primary"}`}>
          {fmtTime(time)}
        </p>
        <p className="text-[10px] text-text-ghost mt-0.5">
          on <span style={{ color: tireColors[compound] ?? "#888" }}>{compound}</span>
          {setType === "used" && <span className="ml-1 text-orange-400">(used set)</span>}
        </p>
      </div>
    </motion.div>
  );
}

// ── StartingGrid ─────────────────────────────────────────────────────────────

function StartingGrid({
  grid, onRace,
}: {
  grid: GridEntry[]; onRace: (startCompound: string) => void;
}) {
  const playerEntry = grid.find((e) => e.is_player);
  const [selectedCompound, setSelectedCompound] = useState(
    playerEntry?.q2_compound ?? "SOFT"
  );
  const lockedCompound = playerEntry?.q2_compound;

  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <h2 className="text-3xl font-black uppercase tracking-tight text-white">Starting Grid</h2>
        <p className="text-text-secondary text-sm mt-1">Qualifying complete — full 20-car grid</p>
      </div>

      {playerEntry && (
        <div className="bg-ferrari-gold/10 border border-ferrari-gold/30 rounded-xl p-4 text-center">
          <p className="text-text-ghost text-[10px] uppercase tracking-wider mb-1">Your Grid Position</p>
          <p className="text-5xl font-black text-ferrari-gold">P{playerEntry.position}</p>
          <p className="text-sm text-text-secondary mt-1">{fmtTime(playerEntry.best_time)}</p>
          {lockedCompound && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-carbon border border-border-subtle">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tireColors[lockedCompound] }} />
              <span className="text-xs text-text-secondary">Must start on <strong className="text-text-primary">{lockedCompound}</strong> (Q2 obligation)</span>
            </div>
          )}
        </div>
      )}

      {!lockedCompound && (
        <div className="bg-surface border border-border-subtle rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mb-3">Race Start Compound</p>
          <div className="grid grid-cols-3 gap-2">
            {(["SOFT", "MEDIUM", "HARD"] as const).map((c) => (
              <button key={c} onClick={() => setSelectedCompound(c)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  selectedCompound === c ? "border-2" : "border-border-subtle bg-carbon hover:border-text-ghost/30"
                }`}
                style={selectedCompound === c ? { borderColor: tireColors[c], backgroundColor: `${tireColors[c]}15` } : {}}
              >
                <div className="w-4 h-4 rounded-full mx-auto mb-1.5" style={{ backgroundColor: tireColors[c] }} />
                <p className="text-xs font-bold text-text-primary">{c}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-border-subtle">
          <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">Full Grid Order</span>
        </div>
        <div className="divide-y divide-border-subtle/40">
          {grid.map((entry) => (
            <div key={entry.number}
              className={`flex items-center gap-3 px-4 py-2.5 ${entry.is_player ? "bg-ferrari-gold/8" : ""}`}
            >
              <span className={`w-6 text-sm font-mono font-black ${entry.is_player ? "text-ferrari-gold" : "text-text-ghost"}`}>
                {entry.position}
              </span>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: teamColors[entry.team] ?? "#888" }} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${entry.is_player ? "text-ferrari-gold" : "text-text-primary"}`}>
                  {entry.name}
                </p>
                <p className="text-[10px] text-text-ghost">{entry.team}</p>
              </div>
              {entry.q2_compound && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${tireColors[entry.q2_compound] ?? "#888"}22`, color: tireColors[entry.q2_compound] ?? "#888" }}>
                  {entry.q2_compound[0]}
                </span>
              )}
              <span className="text-xs font-mono text-text-secondary">{fmtTime(entry.best_time)}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => onRace(lockedCompound ?? selectedCompound)}
        className="w-full py-4 rounded-xl bg-rosso/90 hover:bg-rosso border border-rosso text-white font-black uppercase tracking-widest text-lg transition-all shadow-lg shadow-rosso/20"
      >
        START RACE →
      </button>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function Qualifying() {
  const navigate = useNavigate();

  const playerTeam   = localStorage.getItem("f1_player_team")   ?? "Ferrari";
  const trackKey     = localStorage.getItem("f1_track_key")     ?? "Spa";
  const trackName    = localStorage.getItem("f1_track_name")    ?? "Belgian Grand Prix";
  const playerDriver = parseInt(localStorage.getItem("f1_player_driver") ?? "0") || undefined;
  const temperature  = parseInt(localStorage.getItem("f1_temperature") ?? "28");

  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [state, setState]           = useState<QualifyingState | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [isLapping, setIsLapping]   = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lapToast, setLapToast]     = useState<{ time: number; isPB: boolean; compound: string; setType?: string } | null>(null);
  const [selectedCompound, setSelectedCompound] = useState<"SOFT" | "MEDIUM" | "HARD">("SOFT");
  const [showGrid, setShowGrid]     = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Client-side countdown timer (counts down between server ticks)
  const [displayTime, setDisplayTime] = useState<number>(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset display time whenever server sends a new time_remaining value
  useEffect(() => {
    if (state) setDisplayTime(state.time_remaining);
  }, [state?.time_remaining, state?.segment]);

  // Count down display time one second at a time (pure UI)
  useEffect(() => {
    if (!state || state.segment_finished || state.qualifying_complete) return;
    const interval = setInterval(() => {
      setDisplayTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [state?.segment_finished, state?.qualifying_complete, state?.segment]);

  const initSession = useCallback(async () => {
    setStartError(null);
    try {
      const res = await startQualifying({
        track_name: trackKey,
        player_team: playerTeam,
        player_driver: playerDriver,
      });
      setSessionId(res.session_id);
      setState(res.state);
    } catch (err) {
      console.error("Failed to start qualifying:", err);
      setStartError("Backend unreachable. Make sure the server is running on port 8000.");
    }
  }, [trackKey, playerTeam, playerDriver]);

  useEffect(() => { initSession(); }, [initSession]);

  const handleAdvance = useCallback(async () => {
    if (!sessionId || isLoading || isLapping) return;
    setIsLoading(true);
    try {
      const res = await advanceQualifyingTime(sessionId);
      setState(res.state);
      if (res.state.segment_finished) setShowResult(true);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading, isLapping]);

  const handleFlyingLap = useCallback(async () => {
    if (!sessionId || isLapping || isLoading || state?.segment_finished) return;
    setIsLapping(true);
    try {
      const res = await doPlayerLap(sessionId, selectedCompound);
      setState(res);
      if (res.error) {
        // Show error as brief toast instead of blocking UI
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        // Error is surfaced via player_can_lap flag — no additional UI needed
        return;
      }
      if (res.player_lap_time) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setLapToast({
          time: res.player_lap_time,
          isPB: res.is_personal_best ?? false,
          compound: selectedCompound,
          setType: res.set_type_used,
        });
        toastTimerRef.current = setTimeout(() => setLapToast(null), 3500);
      }
      if (res.segment_finished) setShowResult(true);
    } finally {
      setIsLapping(false);
    }
  }, [sessionId, isLapping, isLoading, selectedCompound, state?.segment_finished]);

  const handleContinue = useCallback(async () => {
    if (!sessionId) return;
    setShowResult(false);
    setIsLoading(true);
    try {
      const res = await nextQualifyingSegment(sessionId);
      setState(res.state);
      if (res.state.qualifying_complete) setShowGrid(true);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleStartRace = useCallback(async (compound: string) => {
    try {
      const result = await startRace({
        track_name: trackKey,
        player_team: playerTeam,
        starting_compound: compound,
        air_temperature: temperature,
        player_driver: playerDriver,
        // Race grid = the qualifying result the player just earned
        starting_grid: state?.starting_grid?.map((e) => e.number),
      });
      localStorage.setItem("f1_session_id", result.session_id);
      localStorage.setItem("f1_starting_compound", compound);
      if (state?.starting_grid) {
        const playerEntry = state.starting_grid.find((e) => e.is_player);
        if (playerEntry) {
          localStorage.setItem("f1_grid_position", String(playerEntry.position));
          localStorage.setItem("f1_qualifying_time", String(playerEntry.best_time ?? ""));
        }
      }
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to start race:", err);
    }
  }, [navigate, trackKey, playerTeam, temperature, playerDriver, state?.starting_grid]);

  // ── Error / Loading states ─────────────────────────────────────────────

  if (startError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-sm mx-auto p-6">
          <AlertTriangle className="w-12 h-12 text-alert-red mx-auto" />
          <p className="text-text-primary font-bold">Qualifying failed to start</p>
          <p className="text-text-ghost text-sm">{startError}</p>
          <button onClick={initSession}
            className="px-6 py-2 rounded-lg bg-rosso/10 border border-rosso/30 text-rosso font-bold text-sm hover:bg-rosso/20 transition-colors">
            Retry
          </button>
          <button onClick={() => navigate("/")}
            className="block w-full px-6 py-2 rounded-lg bg-carbon border border-border-subtle text-text-secondary text-sm hover:text-text-primary transition-colors">
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-2 border-rosso border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">Starting qualifying session — {trackName}</p>
          <p className="text-text-ghost text-xs">Connecting to backend on port 8000…</p>
        </div>
      </div>
    );
  }

  if (showGrid && state.qualifying_complete) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <StartingGrid grid={state.starting_grid} onRace={handleStartRace} />
      </div>
    );
  }

  // ── Derived state ──────────────────────────────────────────────────────

  const {
    classification, segment, segment_index, total_time,
    tick, max_ticks, track_evolution, player_best, player_last,
    player_position, safe_count, elimination_count, segment_finished,
    player_sets_new = {}, player_sets_used = {},
    player_can_lap = true,
  } = state;

  const displayProgress = 1 - displayTime / total_time;
  const segColor = SEGMENT_COLORS[segment] ?? "#FF1E00";
  const playerEntry = classification.find((d) => d.is_player);
  const safeTime = classification[safe_count - 1]?.best_time ?? null;
  const gapToSafe = playerEntry?.in_danger && safeTime != null && playerEntry.best_time != null
    ? playerEntry.best_time - safeTime
    : null;
  const playerStyle = playerEntry ? DRIVER_STYLES[getLastName(playerEntry.name)] : undefined;

  // Can player lap right now?
  const canSelectedCompoundLap =
    (player_sets_new[selectedCompound] ?? 0) + (player_sets_used[selectedCompound] ?? 0) > 0;
  const lapButtonDisabled = isLapping || isLoading || segment_finished || !player_can_lap || !canSelectedCompoundLap;

  return (
    <>
      <AnimatePresence>
        {lapToast && <LapToast {...lapToast} />}
      </AnimatePresence>

      <AnimatePresence>
        {showResult && segment_finished && (
          <SegmentResultOverlay state={state} onContinue={handleContinue} />
        )}
      </AnimatePresence>

      <div className="p-3 md:p-4 max-w-[1200px] mx-auto space-y-3 pb-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-xl border border-border-subtle p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <SegmentProgress segment={segment} segIdx={segment_index} />
              <p className="text-[10px] text-text-ghost mt-1.5 font-mono">{trackName}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Track evolution */}
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-text-ghost font-semibold mb-1">Track Rubber</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-24 h-1.5 bg-carbon rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: segColor }}
                      animate={{ width: `${track_evolution * 100}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-text-ghost">{(track_evolution * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Live countdown timer */}
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-text-ghost font-semibold mb-0.5 flex items-center justify-end gap-1">
                  <Timer className="w-2.5 h-2.5" />
                  Time
                </p>
                <motion.p
                  key={Math.floor(displayTime / 10)}
                  className="text-2xl font-mono font-black"
                  style={{ color: displayTime < 60 ? "#FF2D2D" : segColor }}
                >
                  {fmtSeconds(displayTime)}
                </motion.p>
                <div className="w-24 h-0.5 bg-carbon rounded-full overflow-hidden mt-1 ml-auto">
                  <motion.div className="h-full" style={{ backgroundColor: segColor }}
                    animate={{ width: `${displayProgress * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-[9px] text-text-ghost mt-0.5 text-right font-mono">
                  Tick {tick}/{max_ticks}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

          {/* LEFT — Player status + controls */}
          <div className="lg:col-span-4 space-y-3">

            {/* Player position + status */}
            <div className="bg-surface rounded-xl border border-border-subtle p-4">
              <p className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mb-3">Your Status</p>

              <div className="flex items-baseline gap-3 mb-3">
                <p className="text-4xl font-black" style={{ color: segColor }}>
                  {player_position != null ? `P${player_position}` : "—"}
                </p>
                <div>
                  <p className="text-sm font-mono font-black text-text-primary">{fmtTime(player_best)}</p>
                  {player_last && (
                    <p className="text-[10px] font-mono text-text-ghost">Last: {fmtTime(player_last)}</p>
                  )}
                </div>
              </div>

              {/* Elimination status */}
              {playerEntry && (
                <div className={`rounded-lg px-3 py-2 text-center mb-3 ${
                  playerEntry.in_danger
                    ? "bg-alert-red/10 border border-alert-red/30"
                    : "bg-success-green/10 border border-success-green/20"
                }`}>
                  {playerEntry.in_danger ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-alert-red mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-alert-red">IN ELIMINATION ZONE</p>
                      {gapToSafe != null && (
                        <p className="text-[10px] text-text-ghost mt-0.5">
                          Need {gapToSafe.toFixed(3)}s improvement
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-success-green mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-success-green">SAFE TO ADVANCE</p>
                    </>
                  )}
                </div>
              )}

              {/* Driver profile */}
              {playerEntry && (
                <div className="bg-carbon rounded-lg p-2.5 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    {playerEntry.tier && (
                      <span
                        className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                        style={{
                          backgroundColor: `${TIER_COLORS[playerEntry.tier] ?? "#888"}20`,
                          color: TIER_COLORS[playerEntry.tier] ?? "#888",
                          border: `1px solid ${TIER_COLORS[playerEntry.tier] ?? "#888"}40`,
                        }}
                      >
                        {playerEntry.tier}
                      </span>
                    )}
                    {playerStyle && (
                      <span className="text-[9px] text-text-ghost italic">{playerStyle}</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-text-primary mb-2">{playerEntry.name}</p>

                  {/* Skill bars */}
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-text-ghost uppercase tracking-wider">Pace</span>
                        <span className="text-[9px] font-mono text-text-ghost">
                          {playerEntry.tier ? normSkill(
                            // reverse-lookup skill from tier since QDriverState doesn't carry raw skill
                            playerEntry.tier === "Champion" ? 0.97
                            : playerEntry.tier === "Experienced" ? 0.93
                            : playerEntry.tier === "Midfield" ? 0.87
                            : 0.82
                          ) : 50}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: segColor,
                            width: `${playerEntry.tier === "Champion" ? 90
                              : playerEntry.tier === "Experienced" ? 70
                              : playerEntry.tier === "Midfield" ? 45
                              : 25}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-text-ghost uppercase tracking-wider flex items-center gap-0.5">
                          <Droplets className="w-2.5 h-2.5" />Wet
                        </span>
                        <span className="text-[9px] font-mono text-text-ghost">
                          {playerEntry.wet_skill != null ? Math.round(playerEntry.wet_skill * 100) : "—"}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-400"
                          style={{ width: `${(playerEntry.wet_skill ?? 0.85) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tire set allocation */}
            <div className="bg-surface rounded-xl border border-border-subtle p-4">
              <p className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold mb-3">
                Tire Sets — Weekend Allocation
              </p>
              <TireSetGrid
                setsNew={player_sets_new}
                setsUsed={player_sets_used}
                selectedCompound={selectedCompound}
                onSelect={setSelectedCompound}
                disabled={isLapping || segment_finished}
              />
            </div>

            {/* Session info */}
            <div className="bg-surface rounded-xl border border-border-subtle p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-ghost">Session</span>
                <span className="font-bold" style={{ color: segColor }}>{SEGMENT_LABELS[segment]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-ghost">Ticks elapsed</span>
                <span className="font-mono text-text-primary">{tick} / {max_ticks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-ghost">Cars remaining</span>
                <span className="font-mono text-text-primary">{classification.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-ghost">Will eliminate</span>
                <span className="font-mono text-alert-red">{elimination_count} slowest</span>
              </div>
            </div>

            {/* Q2 tire obligation note */}
            {segment === "Q2" && (
              <div className="bg-warning-amber/5 border border-warning-amber/30 rounded-xl p-3">
                <p className="text-[10px] font-bold text-warning-amber uppercase tracking-wider mb-1">
                  Q2 Tire Obligation
                </p>
                <p className="text-[10px] text-text-ghost leading-relaxed">
                  If you advance to Q3, you must START the race on the tires you set your Q2 time on.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={handleFlyingLap}
                disabled={lapButtonDisabled}
                className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-base text-white transition-all disabled:opacity-40 relative overflow-hidden"
                style={{ backgroundColor: segColor, boxShadow: lapButtonDisabled ? "none" : `0 4px 20px ${segColor}40` }}
              >
                {isLapping ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    On Flying Lap…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    DO FLYING LAP
                  </span>
                )}
              </button>

              {/* Hint when lap not allowed */}
              {!player_can_lap && !segment_finished && (
                <p className="text-[10px] text-center text-text-ghost animate-pulse">
                  Advance time to do another lap
                </p>
              )}
              {!canSelectedCompoundLap && player_can_lap && !segment_finished && (
                <p className="text-[10px] text-center text-orange-400">
                  No {selectedCompound} sets remaining — choose another compound
                </p>
              )}

              <button
                onClick={handleAdvance}
                disabled={isLoading || isLapping || segment_finished}
                className="w-full py-3 rounded-xl border border-border-subtle bg-carbon hover:bg-surface font-bold uppercase tracking-wider text-sm text-text-secondary transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <FastForward className="w-3.5 h-3.5" />
                {isLoading ? "Processing…" : "Advance Time (+2 min)"}
              </button>
            </div>
          </div>

          {/* RIGHT — Classification */}
          <div className="lg:col-span-8">
            <div className="bg-surface rounded-xl border border-border-subtle overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-carbon">
                <span className="w-5 text-[10px] text-text-ghost font-semibold">P</span>
                <span className="w-2 h-2" />
                <span className="flex-1 text-[10px] text-text-ghost font-semibold uppercase tracking-wider">Driver</span>
                <span className="text-[10px] text-text-ghost font-semibold w-4 mr-1">C</span>
                <span className="text-[10px] text-text-ghost font-semibold w-20 text-right">Best Time</span>
                <span className="text-[10px] text-text-ghost font-semibold w-14 text-right">Gap</span>
              </div>

              <div>
                {classification
                  .filter((d) => !d.in_danger)
                  .map((d) => (
                    <DriverRow key={d.number} entry={d} safeCount={safe_count} />
                  ))}
              </div>

              {elimination_count > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-alert-red/8 border-y border-alert-red/25">
                  <div className="flex-1 h-px bg-alert-red/30" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-alert-red">
                    Elimination Zone — P{safe_count + 1} and below
                  </span>
                  <div className="flex-1 h-px bg-alert-red/30" />
                </div>
              )}

              <div>
                {classification
                  .filter((d) => d.in_danger)
                  .map((d) => (
                    <DriverRow key={d.number} entry={d} safeCount={safe_count} />
                  ))}
              </div>

              {classification.some((d) => d.best_time === null) && (
                <div className="px-3 py-2 text-center">
                  <p className="text-[10px] text-text-ghost italic">
                    {classification.filter((d) => d.best_time === null).length} driver(s) yet to set a time
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-4 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-success-green" />
                <span className="text-[10px] text-text-ghost">P1–P{safe_count}: advance to {["Q2","Q3","RACE"][segment_index]}</span>
              </div>
              {elimination_count > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-alert-red" />
                  <span className="text-[10px] text-text-ghost">P{safe_count + 1}–P{classification.length}: eliminated</span>
                </div>
              )}
            </div>

            {/* Tier legend */}
            <div className="mt-2 flex items-center gap-3 px-1 flex-wrap">
              {Object.entries(TIER_COLORS).map(([tier, color]) => (
                <div key={tier} className="flex items-center gap-1">
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[7px] font-black"
                    style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
                  >
                    {tier[0]}
                  </span>
                  <span className="text-[9px] text-text-ghost">{tier}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
