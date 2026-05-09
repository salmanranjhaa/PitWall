import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BrainCircuit, TrendingUp, Timer, Gauge, CheckCircle, Target, Zap,
  ChevronRight, AlertTriangle, Check,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── constants ─────────────────────────────────────────────────────────────────

const TIRE_C = {
  SOFT: "#E8103A", MEDIUM: "#FFD300", HARD: "#CCCCCC",
  INTERMEDIATE: "#00D084", WET: "#1E90FF",
};

// ── types ─────────────────────────────────────────────────────────────────────

interface Stint { compound: string; laps: number }

interface StrategyPlan {
  id: "conservative" | "balanced" | "aggressive";
  name: string;
  stints: Stint[];
  pitLaps: number[];
  riskLabel: string;
  riskColor: string;
  expectedPos: string;
  summary: string;
  stops: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function tireLife(severity: number) {
  return {
    SOFT:   Math.max(8,  Math.round(22 - (severity - 1) * 1.5)),
    MEDIUM: Math.max(12, Math.round(32 - (severity - 1) * 2.0)),
    HARD:   Math.max(18, Math.round(44 - (severity - 1) * 2.7)),
  };
}

function computeStrategies(
  totalLaps: number,
  life: { SOFT: number; MEDIUM: number; HARD: number },
  rainProb: number,
): StrategyPlan[] {
  if (rainProb > 0.55) {
    const cross = Math.round(totalLaps * 0.38);
    const earlyCross = Math.round(totalLaps * 0.22);
    return [
      {
        id: "conservative", name: "Full Wet",
        stints: [{ compound: "INTERMEDIATE", laps: totalLaps }],
        pitLaps: [], stops: 0,
        riskLabel: "Low", riskColor: "#00D084", expectedPos: "P3-P6",
        summary: "Stay on inters throughout — safe if rain continues",
      },
      {
        id: "balanced", name: "Inter → Soft",
        stints: [{ compound: "INTERMEDIATE", laps: cross }, { compound: "SOFT", laps: totalLaps - cross }],
        pitLaps: [cross], stops: 1,
        riskLabel: "Medium", riskColor: "#FFB800", expectedPos: "P1-P3",
        summary: `Cross to slicks at lap ${cross} as track dries`,
      },
      {
        id: "aggressive", name: "Early Cross",
        stints: [{ compound: "INTERMEDIATE", laps: earlyCross }, { compound: "SOFT", laps: totalLaps - earlyCross }],
        pitLaps: [earlyCross], stops: 1,
        riskLabel: "High", riskColor: "#FF2D2D", expectedPos: "P1",
        summary: `Gamble — cross at lap ${earlyCross}, track risk`,
      },
    ];
  }

  const p1c = Math.min(Math.max(Math.round(life.MEDIUM * 0.88), 12), Math.round(totalLaps * 0.5));
  const p1b = Math.min(Math.max(Math.round(life.SOFT  * 0.85), 10), Math.round(totalLaps * 0.42));
  const p1a = Math.min(Math.max(Math.round(life.SOFT  * 0.80),  8), 20);
  const p2a = Math.min(p1a + Math.max(Math.round(life.MEDIUM * 0.80), 12), Math.round(totalLaps * 0.75));

  return [
    {
      id: "conservative", name: "Conservative",
      stints: [
        { compound: "MEDIUM", laps: p1c },
        { compound: "HARD",   laps: totalLaps - p1c },
      ],
      pitLaps: [p1c], stops: 1,
      riskLabel: "Low", riskColor: "#00D084", expectedPos: "P3-P6",
      summary: `MED ${p1c} laps → HARD finish`,
    },
    {
      id: "balanced", name: "Balanced",
      stints: [
        { compound: "SOFT", laps: p1b },
        { compound: "HARD", laps: totalLaps - p1b },
      ],
      pitLaps: [p1b], stops: 1,
      riskLabel: "Medium", riskColor: "#FFB800", expectedPos: "P2-P4",
      summary: `SOFT ${p1b} laps → HARD finish`,
    },
    {
      id: "aggressive", name: "Aggressive",
      stints: [
        { compound: "SOFT",   laps: p1a },
        { compound: "MEDIUM", laps: p2a - p1a },
        { compound: "SOFT",   laps: totalLaps - p2a },
      ],
      pitLaps: [p1a, p2a], stops: 2,
      riskLabel: "High", riskColor: "#FF2D2D", expectedPos: "P1-P2",
      summary: `SOFT ${p1a} → MED ${p2a - p1a} → SOFT ${totalLaps - p2a}`,
    },
  ];
}

function buildDegradationCurve(compound: string, life: { SOFT: number; MEDIUM: number; HARD: number }) {
  const maxLap = compound === "SOFT"
    ? life.SOFT + 6 : compound === "MEDIUM"
    ? life.MEDIUM + 10 : life.HARD + 14;
  const cliff = compound === "SOFT"
    ? life.SOFT * 0.85 : compound === "MEDIUM"
    ? life.MEDIUM * 0.9 : life.HARD * 0.92;
  return Array.from({ length: maxLap + 1 }, (_, lap) => {
    const base = compound === "SOFT" ? 0.06 : compound === "MEDIUM" ? 0.04 : 0.025;
    const expFactor = lap > cliff ? Math.pow(1.12, lap - cliff) : 1;
    return { lap, loss: parseFloat((base * lap * expFactor).toFixed(3)) };
  });
}

// ── components ────────────────────────────────────────────────────────────────

function StintBar({ stints, pitLaps, totalLaps }: { stints: Stint[]; pitLaps: number[]; totalLaps: number }) {
  return (
    <div className="relative pb-6">
      <div className="flex h-10 rounded overflow-hidden gap-px">
        {stints.map((s, i) => {
          const pct = (s.laps / totalLaps) * 100;
          const col = TIRE_C[s.compound as keyof typeof TIRE_C] ?? "#888";
          return (
            <div key={i} className="flex flex-col items-center justify-center overflow-hidden relative"
              style={{ width: `${pct}%`, backgroundColor: col + "CC" }}
              title={`${s.compound}: ${s.laps} laps`}
            >
              {pct > 8 && (
                <span className="text-[9px] font-black text-black/80 leading-tight">
                  {s.compound === "INTERMEDIATE" ? "INT" : s.compound[0]}
                </span>
              )}
              {pct > 14 && (
                <span className="text-[8px] font-mono text-black/60">{s.laps}L</span>
              )}
            </div>
          );
        })}
      </div>
      {pitLaps.map((lap, i) => (
        <div key={i} className="absolute top-0 pointer-events-none"
          style={{ left: `${(lap / totalLaps) * 100}%`, transform: "translateX(-50%)" }}>
          <div className="w-px h-10 bg-white/70" />
          <span className="absolute top-11 left-1/2 -translate-x-1/2 text-[8px] font-mono text-neural-purple whitespace-nowrap">
            PIT L{lap}
          </span>
        </div>
      ))}
      {/* Lap tick marks every 10% */}
      <div className="flex mt-1">
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((frac) => (
          <div key={frac} className="flex-none text-[8px] font-mono text-text-ghost"
            style={{ position: "absolute", left: `${frac * 100}%`, transform: "translateX(-50%)", top: "calc(100% + 2px)" }}>
            {Math.round(frac * totalLaps) > 0 && frac < 1 ? `L${Math.round(frac * totalLaps)}` : frac === 1 ? "END" : "START"}
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENARIO_ICONS = {
  conservative: CheckCircle,
  balanced: Target,
  aggressive: Zap,
};

// ── main component ────────────────────────────────────────────────────────────

export default function StrategyAnalysis() {
  // Read context from localStorage (set by Setup.tsx)
  const trackKey    = localStorage.getItem("f1_track_key")      ?? "Spa";
  const trackName   = localStorage.getItem("f1_track_name")     ?? "Belgian Grand Prix";
  const severity    = parseInt(localStorage.getItem("f1_tire_severity")    ?? "4");
  const rainProb    = parseFloat(localStorage.getItem("f1_rain_probability") ?? "0");
  const totalLaps   = parseInt(localStorage.getItem("f1_total_laps")       ?? "44");
  const playerTeam  = localStorage.getItem("f1_player_team")    ?? "";

  // Try to read committed strategy from localStorage
  const committedRaw = localStorage.getItem("f1_strategy_plan");
  const committed: StrategyPlan | null = committedRaw ? JSON.parse(committedRaw) : null;

  const life = tireLife(severity);
  const strategies = useMemo(
    () => computeStrategies(totalLaps, life, rainProb),
    [totalLaps, severity, rainProb],
  );

  const [activeId, setActiveId] = useState<"conservative" | "balanced" | "aggressive">(
    (committed?.id ?? "balanced") as "conservative" | "balanced" | "aggressive",
  );
  const [activeTire, setActiveTire] = useState<"SOFT" | "MEDIUM" | "HARD">("SOFT");

  const activeScenario = strategies.find((s) => s.id === activeId) ?? strategies[1];
  const degradData = buildDegradationCurve(activeTire, life);

  const hasSession = !!localStorage.getItem("f1_session_id");

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-12">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Strategy Analysis</h1>
          <p className="text-text-secondary text-sm mt-1">
            {trackName} · {totalLaps} laps · severity {severity}/8 · {Math.round(rainProb * 100)}% rain
          </p>
        </div>
        {committed && (
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-text-ghost">Committed plan</p>
            <p className="text-sm font-bold text-ferrari-gold">{committed.name}</p>
            <p className="text-[10px] text-text-ghost">{committed.summary}</p>
          </div>
        )}
      </div>

      {/* ── Main 2-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* LEFT — scenario selector + details */}
        <div className="lg:col-span-2 space-y-4">

          {/* Scenario cards */}
          <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-neural-purple" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-ghost">Strategy Options</span>
            </div>
            <div className="divide-y divide-border-subtle">
              {strategies.map((s) => {
                const Icon = SCENARIO_ICONS[s.id];
                const isActive = activeId === s.id;
                const isCommitted = committed?.id === s.id;
                return (
                  <motion.button key={s.id}
                    onClick={() => setActiveId(s.id)}
                    whileHover={{ x: 2 }}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                      isActive ? "bg-surface-inner/60" : "hover:bg-surface-inner/30"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: s.riskColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-bold text-text-primary">{s.name}</span>
                        {isCommitted && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-ferrari-gold/15 text-ferrari-gold border border-ferrari-gold/30">
                            COMMITTED
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-ghost truncate">{s.summary}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-bold" style={{ color: s.riskColor }}>{s.riskLabel}</p>
                      <p className="text-[10px] font-mono text-ferrari-gold">{s.expectedPos}</p>
                    </div>
                    {isActive && (
                      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: s.riskColor }} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Active scenario details */}
          <div className="bg-surface rounded-lg border border-border-subtle p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-text-ghost">Scenario Details</span>
              <span className="text-[10px] font-bold" style={{ color: activeScenario.riskColor }}>
                {activeScenario.riskLabel} Risk
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-ghost">Stops</span>
                <span className="font-mono text-text-primary">{activeScenario.stops}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-ghost">Pit laps</span>
                <span className="font-mono text-text-primary">
                  {activeScenario.pitLaps.length ? activeScenario.pitLaps.map((l) => `L${l}`).join(" + ") : "No stop"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-ghost">Expected finish</span>
                <span className="font-mono text-ferrari-gold">{activeScenario.expectedPos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-ghost">Stints</span>
                <div className="flex items-center gap-1">
                  {activeScenario.stints.map((s, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TIRE_C[s.compound as keyof typeof TIRE_C] ?? "#888" }} />
                      <span className="text-[10px] font-mono text-text-primary">{s.compound[0]}</span>
                      {i < activeScenario.stints.length - 1 && <ChevronRight className="w-2.5 h-2.5 text-text-ghost" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Compound obligation */}
            {rainProb < 0.5 && (
              <div className="mt-3 pt-3 border-t border-border-subtle">
                {(() => {
                  const dry = new Set(activeScenario.stints.map((s) => s.compound).filter((c) => c !== "INTERMEDIATE" && c !== "WET"));
                  const met = dry.size >= 2;
                  return (
                    <div className={`flex items-center gap-1.5 text-[10px] ${met ? "text-success-green" : "text-warning-amber"}`}>
                      {met ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      F1 compound rule {met ? "satisfied ✓" : "— NOT MET"}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Override note */}
            <div className="mt-3 p-2 rounded bg-neural-purple/5 border border-neural-purple/15 text-[9px] text-text-ghost leading-relaxed">
              Strategy is advisory. During the race, press <span className="text-neural-purple font-bold">PIT NOW</span> on the dashboard whenever you want to pit — this overrides the plan.
            </div>
          </div>

          {/* Tire life reference */}
          <div className="bg-surface rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-soft-red" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-ghost">Tire Life — {trackKey}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["SOFT", "MEDIUM", "HARD"] as const).map((c) => (
                <div key={c} className="text-center rounded-lg p-2 bg-carbon">
                  <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: TIRE_C[c] }} />
                  <p className="text-[10px] font-bold text-text-primary">~{life[c]}L</p>
                  <p className="text-[8px] text-text-ghost">{c[0]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — stint visualization + degradation */}
        <div className="lg:col-span-3 space-y-4">

          {/* Stint bar visualization */}
          <div className="bg-surface rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-4">
              <Timer className="w-4 h-4 text-rosso" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-ghost">
                {activeScenario.name} — Stint Timeline
              </span>
              <span className="ml-auto text-[10px] font-mono text-text-ghost">{totalLaps} laps total</span>
            </div>
            <StintBar
              stints={activeScenario.stints}
              pitLaps={activeScenario.pitLaps}
              totalLaps={totalLaps}
            />
            {/* Legend */}
            <div className="flex gap-4 mt-3 flex-wrap">
              {activeScenario.stints.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TIRE_C[s.compound as keyof typeof TIRE_C] + "CC" ?? "#888CC" }} />
                  <span className="text-[10px] text-text-secondary">{s.compound} — {s.laps} laps</span>
                </div>
              ))}
              {activeScenario.pitLaps.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-px h-3 bg-white/60" />
                  <span className="text-[10px] text-neural-purple">Pit stops</span>
                </div>
              )}
            </div>
          </div>

          {/* Pit window comparison (all 3 scenarios) */}
          <div className="bg-surface rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-opportunity-green" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-ghost">All Scenarios Compared</span>
            </div>
            <div className="space-y-3">
              {strategies.map((s) => {
                const isActive = activeId === s.id;
                const isCommitted = committed?.id === s.id;
                return (
                  <button key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={`w-full text-left transition-all ${isActive ? "opacity-100" : "opacity-50 hover:opacity-75"}`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold" style={{ color: s.riskColor }}>{s.name}</span>
                        {isCommitted && <span className="text-ferrari-gold">★ committed</span>}
                      </div>
                      <span className="font-mono text-text-ghost">{s.summary}</span>
                    </div>
                    <div className="flex h-4 rounded overflow-hidden gap-px">
                      {s.stints.map((st, i) => (
                        <div key={i}
                          style={{
                            width: `${(st.laps / totalLaps) * 100}%`,
                            backgroundColor: (TIRE_C[st.compound as keyof typeof TIRE_C] ?? "#888") + "BB",
                          }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tire degradation model */}
          <div className="bg-surface rounded-lg border border-border-subtle p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-soft-red" />
                <span className="text-xs font-bold uppercase tracking-wider text-text-ghost">Degradation Model</span>
              </div>
              <div className="flex gap-1">
                {(["SOFT", "MEDIUM", "HARD"] as const).map((c) => (
                  <button key={c}
                    onClick={() => setActiveTire(c)}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${
                      activeTire === c ? "opacity-100" : "opacity-40 hover:opacity-70 border-border-subtle"
                    }`}
                    style={activeTire === c ? { borderColor: TIRE_C[c] + "60", color: TIRE_C[c], backgroundColor: TIRE_C[c] + "15" } : {}}
                  >
                    {c[0]}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={degradData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3D" />
                <XAxis dataKey="lap" stroke="#55556B" fontSize={10} tickLine={false}
                  label={{ value: "Tire age (laps)", position: "insideBottom", offset: -4, fill: "#55556B", fontSize: 10 }} />
                <YAxis stroke="#55556B" fontSize={10} tickLine={false} width={40}
                  label={{ value: "Loss (s/lap)", angle: -90, position: "insideLeft", fill: "#55556B", fontSize: 10, offset: 8 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#16161E", border: "1px solid #2D2D3D", borderRadius: 8, color: "#F0F0F5", fontSize: 11 }}
                  formatter={(v: number) => [`+${v.toFixed(3)}s`, "Time loss"]}
                />
                <Line type="monotone" dataKey="loss" stroke={TIRE_C[activeTire]}
                  strokeWidth={2.5} dot={false} />
                {/* Cliff marker */}
                <Line type="monotone"
                  dataKey={() => 0.5}
                  stroke="transparent" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[9px] text-text-ghost mt-1">
              {activeTire === "SOFT" ? "Exponential cliff after degradation window" :
               activeTire === "MEDIUM" ? "Linear wear, gradual cliff near end" :
               "Slow, predictable — suited to long final stints"}
              {" · "}Estimated window: ~{life[activeTire]} laps at {trackKey}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
