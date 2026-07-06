import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Trophy, RotateCcw, TrendingUp, Zap, Flag, Timer, ChevronRight, Star,
} from "lucide-react";
import { isLoggedIn, submitRaceResult, type RaceResultResponse } from "@/services/auth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Legend,
} from "recharts";
import type { CarStateApi, RaceEventEntry } from "@/services/api";

// ── types ─────────────────────────────────────────────────────────────────────

interface LapHistoryEntry {
  lap: number;
  lapTimeS: number;
  compound: string;
  position: number;
}

interface RaceResult {
  trackName: string;
  playerTeam: string;
  totalLaps: number;
  playerPosition: number | null;
  lapHistory: LapHistoryEntry[];
  finalLeaderboard: CarStateApi[];
  eventsLog: RaceEventEntry[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

const tireColors: Record<string, string> = {
  SOFT: "#E8103A", MEDIUM: "#FFD300", HARD: "#F5F5F5",
  INTERMEDIATE: "#00D084", WET: "#1E90FF",
};

const teamColors: Record<string, string> = {
  "Red Bull Racing": "#1E41FF", "Mercedes": "#00D2BE", "Ferrari": "#FF1E00",
  "McLaren": "#FF8700", "Aston Martin": "#006F62", "Alpine": "#0090FF",
  "Williams": "#00A0DE", "Racing Bulls": "#6692FF", "Audi": "#BB0A30", "Haas": "#B6BABD", "Cadillac": "#D4AF37",
};

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function formatLapTime(seconds: number): string {
  if (!seconds || seconds < 10) return "--:--.---";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

function formatGap(base: number, time: number, pos: number): string {
  if (pos === 1) return "WINNER";
  const diff = time - base;
  return diff > 0 ? `+${diff.toFixed(3)}s` : "—";
}

function positionColor(pos: number): string {
  if (pos === 1) return "#FFD700";
  if (pos === 2) return "#C0C0C0";
  if (pos === 3) return "#CD7F32";
  return "#6B6B8A";
}

const tooltipStyle = {
  backgroundColor: "#16161E",
  border: "1px solid #2D2D3D",
  borderRadius: 8,
  color: "#F0F0F5",
  fontSize: 12,
};

// ── stint analysis helper ─────────────────────────────────────────────────────

interface Stint {
  compound: string;
  startLap: number;
  endLap: number;
  laps: number;
}

function extractStints(lapHistory: LapHistoryEntry[]): Stint[] {
  if (!lapHistory.length) return [];
  const stints: Stint[] = [];
  let current: Stint = { compound: lapHistory[0].compound, startLap: lapHistory[0].lap, endLap: lapHistory[0].lap, laps: 1 };
  for (let i = 1; i < lapHistory.length; i++) {
    const entry = lapHistory[i];
    if (entry.compound === current.compound) {
      current.endLap = entry.lap;
      current.laps++;
    } else {
      stints.push(current);
      current = { compound: entry.compound, startLap: entry.lap, endLap: entry.lap, laps: 1 };
    }
  }
  stints.push(current);
  return stints;
}

// ── main component ────────────────────────────────────────────────────────────

export default function Results() {
  const navigate = useNavigate();

  const result: RaceResult | null = useMemo(() => {
    try {
      const raw = localStorage.getItem("f1_last_race_result");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Record the finished race on the player's profile (once per session).
  const [careerResult, setCareerResult] = useState<RaceResultResponse | null>(null);
  useEffect(() => {
    const sessionId = localStorage.getItem("f1_session_id");
    if (!result || !sessionId || sessionId === "mock" || !isLoggedIn()) return;
    if (localStorage.getItem("pitwall_submitted_session") === sessionId) return;
    submitRaceResult(sessionId)
      .then((r) => {
        localStorage.setItem("pitwall_submitted_session", sessionId);
        setCareerResult(r);
      })
      .catch(() => { /* already recorded or race not finished — ignore */ });
  }, [result]);

  // ── derived data ────────────────────────────────────────────────────────────

  const lapHistory     = result?.lapHistory ?? [];
  const leaderboard    = result?.finalLeaderboard ?? [];
  const eventsLog      = result?.eventsLog ?? [];
  const playerTeam     = result?.playerTeam ?? "Unknown";
  const trackName      = result?.trackName ?? "Unknown Track";
  const playerPosition = result?.playerPosition ?? null;
  const totalLaps      = result?.totalLaps ?? 0;

  const podium = leaderboard.slice(0, 3).map((car) => ({
    name: typeof car.driver === "string" ? car.driver : car.driver?.name ?? "?",
    team: typeof car.driver === "string" ? "" : car.driver?.team ?? "",
    position: car.position,
    totalTime: car.total_time,
  }));

  const winnerTime = leaderboard[0]?.total_time ?? 0;

  const stints = useMemo(() => extractStints(lapHistory), [lapHistory]);

  const avgLapTime = useMemo(() => {
    if (!lapHistory.length) return 0;
    return lapHistory.reduce((s, l) => s + l.lapTimeS, 0) / lapHistory.length;
  }, [lapHistory]);

  const fastestLap = useMemo(() =>
    lapHistory.reduce((best, l) => l.lapTimeS < best.lapTimeS ? l : best, lapHistory[0] ?? { lap: 0, lapTimeS: Infinity }),
  [lapHistory]);

  // Position chart data — downsample to ≤30 points for readability
  const positionChartData = useMemo(() => {
    const step = Math.max(1, Math.floor(lapHistory.length / 30));
    return lapHistory.filter((_, i) => i % step === 0 || i === lapHistory.length - 1)
      .map((l) => ({ lap: l.lap, position: l.position, compound: l.compound }));
  }, [lapHistory]);

  // Lap time chart data — with 3-lap rolling average
  const lapTimeChartData = useMemo(() => {
    return lapHistory.map((l, i) => {
      const window = lapHistory.slice(Math.max(0, i - 2), i + 1);
      const avg = window.reduce((s, w) => s + w.lapTimeS, 0) / window.length;
      return {
        lap: l.lap,
        lapTime: +l.lapTimeS.toFixed(3),
        rolling: +avg.toFixed(3),
        compound: l.compound,
      };
    });
  }, [lapHistory]);

  // Events worth surfacing
  const keyEvents = useMemo(() =>
    eventsLog.filter((e) =>
      ["overtake", "pit", "safety_car", "dnf", "tire_blowout"].includes(e.event_type)
    ).slice(-20),
  [eventsLog]);

  // ── no-data fallback ────────────────────────────────────────────────────────

  if (!result) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-6">
        <Flag className="w-16 h-16 text-text-ghost" />
        <div className="text-center">
          <h2 className="text-2xl font-black text-text-primary uppercase">No Race Data</h2>
          <p className="text-text-secondary mt-2">Complete a race to see your results here.</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-rosso hover:bg-rosso/90 text-white rounded-lg font-bold uppercase tracking-wider transition-all"
        >
          Start New Race
        </button>
      </div>
    );
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ferrari-gold font-semibold">Race Complete</p>
          <h1 className="text-3xl font-black uppercase text-text-primary">{trackName}</h1>
        </div>
        {playerPosition && (
          <div className="text-right">
            <p className="text-xs text-text-ghost uppercase tracking-wider">Your finish</p>
            <p className="text-4xl font-black" style={{ color: positionColor(playerPosition) }}>
              P{playerPosition}
            </p>
          </div>
        )}
      </motion.div>

      {/* Career points banner */}
      {careerResult && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            backgroundColor: careerResult.points > 0 ? "#FFB80015" : "#16161E",
            borderColor: careerResult.points > 0 ? "#FFB80040" : "#2D2D3D",
          }}>
          <Star className="w-5 h-5" style={{ color: careerResult.points > 0 ? "#FFB800" : "#6B6B8A" }} />
          <p className="text-sm text-text-secondary">
            {careerResult.dnf
              ? "DNF recorded on your driver profile — no points this time."
              : careerResult.points > 0
                ? <>Result saved to your profile — <span className="font-black text-amber-400">+{careerResult.points} championship points</span>{careerResult.is_win ? " and a WIN 🏆" : careerResult.is_podium ? " and a podium!" : "!"}</>
                : "Result saved to your driver profile — points are awarded for a top-10 finish."}
          </p>
        </motion.div>
      )}

      {/* Podium */}
      {podium.length >= 3 && (
        <div className="flex items-end justify-center gap-3 md:gap-6 h-52">
          {/* P2 */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }} className="flex flex-col items-center w-28 md:w-36">
            <p className="text-sm font-bold text-text-primary text-center truncate w-full">{podium[1].name}</p>
            <p className="text-xs text-text-secondary mb-1">{podium[1].team}</p>
            <div className="w-full h-28 rounded-t-lg flex items-center justify-center"
              style={{ background: `linear-gradient(to top, ${teamColors[podium[1].team] ?? "#888"}22, ${teamColors[podium[1].team] ?? "#888"}08)`, borderTop: `2px solid ${teamColors[podium[1].team] ?? "#888"}66` }}>
              <span className="text-3xl font-black opacity-60" style={{ color: "#C0C0C0" }}>2</span>
            </div>
          </motion.div>

          {/* P1 */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }} className="flex flex-col items-center w-32 md:w-40">
            <Trophy className="w-5 h-5 text-ferrari-gold mb-1" />
            <p className="text-base font-black text-ferrari-gold text-center truncate w-full">{podium[0].name}</p>
            <p className="text-xs text-text-secondary mb-1">{podium[0].team}</p>
            <div className="w-full h-40 rounded-t-lg flex items-center justify-center"
              style={{ background: "linear-gradient(to top, #FFD70022, #FFD70008)", borderTop: "2px solid #FFD70066" }}>
              <span className="text-4xl font-black text-ferrari-gold/60">1</span>
            </div>
          </motion.div>

          {/* P3 */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }} className="flex flex-col items-center w-28 md:w-36">
            <p className="text-sm font-bold text-text-primary text-center truncate w-full">{podium[2].name}</p>
            <p className="text-xs text-text-secondary mb-1">{podium[2].team}</p>
            <div className="w-full h-20 rounded-t-lg flex items-center justify-center"
              style={{ background: `linear-gradient(to top, ${teamColors[podium[2].team] ?? "#888"}22, ${teamColors[podium[2].team] ?? "#888"}08)`, borderTop: `2px solid ${teamColors[podium[2].team] ?? "#888"}66` }}>
              <span className="text-3xl font-black opacity-60" style={{ color: "#CD7F32" }}>3</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quick stats strip */}
      {lapHistory.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Laps", value: String(totalLaps), icon: Flag },
            { label: "Pit Stops", value: String(Math.max(0, stints.length - 1)), icon: RotateCcw },
            { label: "Fastest Lap", value: formatLapTime(fastestLap.lapTimeS), icon: Timer, sub: `L${fastestLap.lap}` },
            { label: "Avg Lap", value: formatLapTime(avgLapTime), icon: TrendingUp },
          ].map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="bg-surface rounded-lg border border-border-subtle p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-text-ghost" />
                <p className="text-[10px] text-text-ghost uppercase tracking-wider">{label}</p>
              </div>
              <p className="text-xl font-black font-mono text-text-primary">{value}</p>
              {sub && <p className="text-[10px] text-text-ghost">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Final standings */}
      {leaderboard.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rosso" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Final Standings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-ghost text-[10px] uppercase">
                  <th className="px-3 py-2 text-left">Pos</th>
                  <th className="px-3 py-2 text-left">Driver</th>
                  <th className="px-3 py-2 text-left hidden sm:table-cell">Team</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">Total Time</th>
                  <th className="px-3 py-2 text-left">Gap</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 20).map((car, i) => {
                  const driverName = typeof car.driver === "string" ? car.driver : car.driver?.name ?? "?";
                  const driverTeam = typeof car.driver === "string" ? playerTeam : car.driver?.team ?? "";
                  const isPlayer   = driverTeam === playerTeam;
                  const pts        = F1_POINTS[i] ?? 0;
                  const pos        = car.position ?? i + 1;
                  return (
                    <motion.tr key={i}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.03 }}
                      className={`border-t border-border-subtle transition-colors ${isPlayer ? "bg-ferrari-gold/5" : "hover:bg-surface-inner/30"}`}>
                      <td className="px-3 py-2.5 font-mono font-black" style={{ color: positionColor(pos) }}>
                        P{pos}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {isPlayer && <span className="text-[9px] bg-ferrari-gold/20 text-ferrari-gold border border-ferrari-gold/30 rounded px-1 font-bold">YOU</span>}
                          <span className="text-text-primary font-medium">{driverName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: teamColors[driverTeam] ?? "#888" }} />
                          <span className="text-text-secondary text-xs">{driverTeam}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-text-secondary text-xs hidden md:table-cell">
                        {formatLapTime(car.total_time)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-text-ghost text-xs">
                        {formatGap(winnerTime, car.total_time, pos)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-ferrari-gold">
                        {pts > 0 ? pts : "—"}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Position history chart */}
      {positionChartData.length > 2 && (
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-neural-cyan" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Your Race — Position History</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={positionChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3D" />
              <XAxis dataKey="lap" stroke="#55556B" fontSize={11} label={{ value: "Lap", position: "insideBottomRight", offset: -5, fill: "#6B6B8A", fontSize: 11 }} />
              <YAxis reversed domain={[1, 20]} stroke="#55556B" fontSize={11}
                ticks={[1, 3, 5, 8, 10, 15, 20]}
                label={{ value: "Position", angle: -90, position: "insideLeft", fill: "#6B6B8A", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(v: number) => [`P${v}`, "Position"]} />
              <ReferenceLine y={playerPosition ?? 1} stroke="#FFD700" strokeDasharray="4 2" strokeWidth={1} opacity={0.4} />
              <Line type="monotone" dataKey="position" stroke="#FF1E00" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Lap time chart */}
      {lapTimeChartData.length > 2 && (
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-warning-amber" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Lap Time Evolution</h3>
            <span className="text-xs text-text-ghost ml-auto">dashed = 3-lap rolling avg</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lapTimeChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3D" />
              <XAxis dataKey="lap" stroke="#55556B" fontSize={11} />
              <YAxis stroke="#55556B" fontSize={11} domain={["auto", "auto"]}
                tickFormatter={(v: number) => `${v.toFixed(0)}s`} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [formatLapTime(v), name === "lapTime" ? "Lap Time" : "Rolling Avg"]} />
              <Line type="monotone" dataKey="lapTime" stroke="#FFD300" strokeWidth={1.5} dot={false} opacity={0.7} name="lapTime" />
              <Line type="monotone" dataKey="rolling" stroke="#00D4FF" strokeWidth={2} dot={false} strokeDasharray="5 3" name="rolling" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tire stint breakdown */}
      {stints.length > 0 && (
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-neural-purple" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Tire Strategy</h3>
          </div>
          <div className="space-y-3">
            {stints.map((stint, i) => {
              const pct = totalLaps > 0 ? (stint.laps / totalLaps) * 100 : 0;
              const color = tireColors[stint.compound] ?? "#888";
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-text-primary">{stint.compound}</span>
                      <span className="text-text-ghost">Stint {i + 1}</span>
                    </div>
                    <span className="text-text-secondary font-mono">L{stint.startLap}–{stint.endLap} · {stint.laps} laps</span>
                  </div>
                  <div className="h-2 bg-carbon rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.8 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stint length bar chart */}
          <ResponsiveContainer width="100%" height={100} className="mt-4">
            <BarChart data={stints.map((s, i) => ({ name: `S${i + 1}`, laps: s.laps, compound: s.compound }))} barSize={32}>
              <XAxis dataKey="name" stroke="#55556B" fontSize={11} />
              <YAxis stroke="#55556B" fontSize={11} tickFormatter={(v: number) => `${v}L`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _: string, entry: { payload?: { compound?: string } }) => [
                `${v} laps (${entry.payload?.compound ?? ""})`, "Duration",
              ]} />
              <Bar dataKey="laps" radius={[4, 4, 0, 0]}>
                {stints.map((s, i) => (
                  <Cell key={i} fill={tireColors[s.compound] ?? "#888"} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Key events timeline */}
      {keyEvents.length > 0 && (
        <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
            <Flag className="w-4 h-4 text-warning-amber" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Race Incidents</h3>
          </div>
          <div className="p-4 space-y-2">
            {keyEvents.map((e, i) => {
              const d = (e.data ?? {}) as Record<string, string | number>;
              const label = e.event_type === "overtake"
                ? `${d.attacker} overtakes ${d.defender}`
                : e.event_type === "pit"
                ? `${d.driver} pits → ${d.compound}`
                : e.event_type === "safety_car"
                ? "Safety Car deployed"
                : e.event_type === "dnf"
                ? `DNF — ${d.driver}: ${d.reason ?? "retirement"}`
                : e.event_type === "tire_blowout"
                ? `Blowout — ${d.driver}`
                : e.event_type.replace(/_/g, " ");
              const dotColor = e.event_type === "safety_car" ? "#FFD300"
                : e.event_type === "dnf" || e.event_type === "tire_blowout" ? "#FF2D2D"
                : e.event_type === "pit" ? "#7B61FF"
                : e.event_type === "overtake" ? "#00D4FF"
                : "#6B6B8A";
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 text-xs">
                  <span className="text-text-ghost font-mono w-10 shrink-0">L{e.lap ?? "?"}</span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  <span className="text-text-secondary capitalize">{label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => navigate("/")}
          className="flex-1 h-12 bg-rosso hover:bg-rosso/90 text-white rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Race
        </button>
        <button
          onClick={() => navigate("/leaderboard")}
          className="flex-1 h-12 border border-border-subtle text-text-primary hover:bg-surface rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
        >
          <Trophy className="w-4 h-4" />
          Records
        </button>
      </div>
    </div>
  );
}
