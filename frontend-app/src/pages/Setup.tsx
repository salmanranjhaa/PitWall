import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Cloud, Droplets, Wind, Thermometer, Check,
  BrainCircuit, Flag, User, AlertTriangle,
} from "lucide-react";
import { TEAMS, TRACKS } from "@/data/mockData";
import { startRace, getRealWeather, type RealWeatherConditions } from "@/services/api";

// ── constants ─────────────────────────────────────────────────────────────────

const TRACK_KEY_MAP: Record<string, string> = {
  "Bahrain Grand Prix": "Bahrain", "Saudi Arabian Grand Prix": "Jeddah",
  "Australian Grand Prix": "Melbourne", "Japanese Grand Prix": "Suzuka",
  "Chinese Grand Prix": "Shanghai", "Miami Grand Prix": "Miami",
  "Emilia Romagna Grand Prix": "Imola", "Monaco Grand Prix": "Monaco",
  "Canadian Grand Prix": "Canada", "Spanish Grand Prix": "Spain",
  "Austrian Grand Prix": "Austria", "British Grand Prix": "Silverstone",
  "Hungarian Grand Prix": "Hungary", "Belgian Grand Prix": "Spa",
  "Dutch Grand Prix": "Zandvoort", "Italian Grand Prix": "Monza",
  "Azerbaijan Grand Prix": "Baku", "Singapore Grand Prix": "Singapore",
  "United States Grand Prix": "COTA", "Mexico City Grand Prix": "Mexico",
  "Sao Paulo Grand Prix": "Brazil", "Las Vegas Grand Prix": "Las Vegas",
  "Qatar Grand Prix": "Qatar", "Abu Dhabi Grand Prix": "Abu Dhabi",
};

const TRACK_SEVERITY: Record<string, number> = {
  "Bahrain": 8, "Jeddah": 5, "Melbourne": 6, "Suzuka": 7, "Shanghai": 7,
  "Miami": 6, "Imola": 5, "Monaco": 3, "Canada": 4, "Spain": 5,
  "Austria": 4, "Silverstone": 6, "Hungary": 5, "Spa": 4, "Zandvoort": 5,
  "Monza": 3, "Baku": 4, "Singapore": 4, "COTA": 7, "Mexico": 3,
  "Brazil": 5, "Las Vegas": 3, "Qatar": 7, "Abu Dhabi": 5,
};

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

function toFlag(cc: string): string {
  return cc.toUpperCase().split("").map((c) =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("");
}

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
        summary: "Stay on inters — safe if rain continues all race",
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
        summary: `Gamble — cross early at lap ${earlyCross}, track risk`,
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

// ── components ────────────────────────────────────────────────────────────────

function StintBar({ stints, pitLaps, totalLaps }: { stints: Stint[]; pitLaps: number[]; totalLaps: number }) {
  return (
    <div className="relative pb-5">
      <div className="flex h-8 rounded overflow-hidden gap-px">
        {stints.map((s, i) => {
          const pct = (s.laps / totalLaps) * 100;
          const col = TIRE_C[s.compound as keyof typeof TIRE_C] ?? "#888";
          return (
            <div key={i} className="flex items-center justify-center overflow-hidden"
              style={{ width: `${pct}%`, backgroundColor: col + "CC" }}
              title={`${s.compound}: ${s.laps} laps`}
            >
              {pct > 10 && (
                <span className="text-[9px] font-black text-black/80 select-none leading-none">
                  {s.compound === "INTERMEDIATE" ? "INT" : s.compound[0]}{" "}{s.laps}L
                </span>
              )}
            </div>
          );
        })}
      </div>
      {pitLaps.map((lap, i) => (
        <div key={i} className="absolute top-0 pointer-events-none"
          style={{ left: `${(lap / totalLaps) * 100}%`, transform: "translateX(-50%)" }}>
          <div className="w-px h-8 bg-white/60" />
          <span className="absolute top-9 left-1/2 -translate-x-1/2 text-[8px] font-mono text-neural-purple whitespace-nowrap">
            L{lap}
          </span>
        </div>
      ))}
    </div>
  );
}

function SeverityDots({ severity }: { severity: number }) {
  const level = Math.round(severity / 2); // 1-4 dots
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((d) => (
        <div key={d} className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: d <= level ? (level >= 4 ? "#FF2D2D" : level === 3 ? "#FFB800" : "#00D084") : "#2D2D3D" }} />
      ))}
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "CIRCUIT" },
    { n: 2, label: "TEAM" },
    { n: 3, label: "DRIVER" },
    { n: 4, label: "STRATEGY" },
  ] as const;
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 ${step >= s.n ? "opacity-100" : "opacity-30"}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
              step > s.n ? "bg-ferrari-gold border-ferrari-gold text-black"
              : step === s.n ? "border-ferrari-gold text-ferrari-gold"
              : "border-border-subtle text-text-ghost"
            }`}>
              {step > s.n ? "✓" : s.n}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:block ${
              step === s.n ? "text-ferrari-gold" : "text-text-ghost"
            }`}>{s.label}</span>
          </div>
          {i < 3 && (
            <div className={`mx-1 h-px w-8 transition-colors ${step > s.n ? "bg-ferrari-gold/50" : "bg-border-subtle"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Setup() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedTrack, setSelectedTrack] = useState(TRACKS[13]); // Belgian GP default
  const [selectedTeam, setSelectedTeam] = useState<typeof TEAMS[number] | null>(null);
  const [selectedDriverNumber, setSelectedDriverNumber] = useState<number | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyPlan | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [realWeather, setRealWeather] = useState<RealWeatherConditions | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const trackKey = TRACK_KEY_MAP[selectedTrack.name] ?? "Spa";
  const severity = TRACK_SEVERITY[trackKey] ?? 5;
  const life = tireLife(severity);
  const rainProb = realWeather?.rain_probability ?? 0;

  const strategies = useMemo(
    () => computeStrategies(selectedTrack.laps, life, rainProb),
    [selectedTrack.laps, life.SOFT, life.MEDIUM, life.HARD, rainProb],
  );

  // Auto-select balanced strategy when strategies change
  useEffect(() => {
    setSelectedStrategy(strategies.find((s) => s.id === "balanced") ?? strategies[1]);
  }, [strategies]);

  // Fetch real weather whenever track changes (step 4 needs it)
  useEffect(() => {
    setRealWeather(null);
    setWeatherLoading(true);
    getRealWeather(trackKey)
      .then(setRealWeather)
      .catch(() => setRealWeather(null))
      .finally(() => setWeatherLoading(false));
  }, [trackKey]);

  const airTemp = realWeather?.air_temp ?? 22;
  const startingCompound = selectedStrategy?.stints[0]?.compound ?? "SOFT";

  const persistAndGo = (destination: "/dashboard" | "/qualifying") => async () => {
    if (!selectedTeam || isStarting) return;
    setIsStarting(true);

    // Persist all setup state
    localStorage.setItem("f1_player_team",      selectedTeam.name);
    localStorage.setItem("f1_track_name",        selectedTrack.name);
    localStorage.setItem("f1_track_key",         trackKey);
    localStorage.setItem("f1_temperature",       String(airTemp));
    localStorage.setItem("f1_tire_severity",     String(severity));
    localStorage.setItem("f1_rain_probability",  String(rainProb));
    localStorage.setItem("f1_total_laps",        String(selectedTrack.laps));
    if (selectedDriverNumber != null)
      localStorage.setItem("f1_player_driver", String(selectedDriverNumber));
    if (selectedStrategy)
      localStorage.setItem("f1_strategy_plan", JSON.stringify(selectedStrategy));

    if (destination === "/qualifying") {
      setIsStarting(false);
      navigate("/qualifying");
      return;
    }

    try {
      const result = await startRace({
        track_name:        trackKey,
        player_team:       selectedTeam.name,
        starting_compound: startingCompound,
        air_temperature:   airTemp,
        player_driver:     selectedDriverNumber ?? undefined,
      });
      localStorage.setItem("f1_session_id", result.session_id);
      navigate("/dashboard");
    } catch {
      localStorage.setItem("f1_session_id", "mock");
      navigate("/dashboard");
    } finally {
      setIsStarting(false);
    }
  };

  const canAdvanceFrom = (s: number) => {
    if (s === 1) return true;
    if (s === 2) return !!selectedTeam;
    if (s === 3) return !!selectedTeam && selectedDriverNumber != null;
    return !!selectedTeam && selectedDriverNumber != null && !!selectedStrategy;
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">

      {/* Hero */}
      <div className="py-6 mb-2">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
          New Race
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Configure your weekend. Your team-mate races under AI control.
        </p>
      </div>

      <StepIndicator step={step} />

      <AnimatePresence mode="wait">

        {/* ── Step 1: Circuit ─────────────────────────────────────────────── */}
        {step === 1 && (
          <motion.div key="step1"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs uppercase tracking-[0.2em] text-ferrari-gold font-bold">01 / Choose Circuit</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {TRACKS.map((track) => {
                const key = TRACK_KEY_MAP[track.name] ?? "";
                const sev = TRACK_SEVERITY[key] ?? 5;
                const isSelected = selectedTrack.name === track.name;
                return (
                  <button key={track.name}
                    onClick={() => { setSelectedTrack(track); setStep(2); }}
                    className={`p-3 rounded-lg border text-left transition-all hover:scale-[1.01] ${
                      isSelected
                        ? "border-ferrari-gold/60 bg-ferrari-gold/5 ring-1 ring-ferrari-gold/30"
                        : "border-border-subtle bg-surface hover:border-text-ghost/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-xl leading-none">{toFlag(track.flag)}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-ferrari-gold" />}
                    </div>
                    <p className="text-[11px] font-bold text-text-primary leading-tight mb-0.5">
                      {track.name.replace(" Grand Prix", "").replace(" City", "")}
                    </p>
                    <p className="text-[9px] text-text-ghost mb-1.5">{track.laps} laps</p>
                    <SeverityDots severity={sev} />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Team ─────────────────────────────────────────────────── */}
        {step === 2 && (
          <motion.div key="step2"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs uppercase tracking-[0.2em] text-ferrari-gold font-bold">02 / Choose Team</span>
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-[10px] text-text-ghost">{toFlag(selectedTrack.flag)} {selectedTrack.name.replace(" Grand Prix", "")}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {TEAMS.map((team) => {
                const isSelected = selectedTeam?.name === team.name;
                return (
                  <button key={team.code}
                    onClick={() => {
                      setSelectedTeam(team);
                      setSelectedDriverNumber(team.drivers[0].number);
                      setStep(3);
                    }}
                    className={`rounded-lg overflow-hidden border transition-all hover:scale-[1.01] ${
                      isSelected ? "border-ferrari-gold/50 ring-1 ring-ferrari-gold/30" : "border-border-subtle"
                    }`}
                  >
                    <div className="h-1" style={{ backgroundColor: team.color }} />
                    <div className="bg-surface p-3 text-left">
                      <span className="text-xs font-black tracking-wider" style={{ color: team.color }}>
                        {team.code}
                      </span>
                      <p className="text-text-primary text-sm font-semibold mt-1 truncate">{team.name}</p>
                      <div className="mt-2 space-y-0.5">
                        {team.drivers.map((d) => (
                          <p key={d.number} className="text-[10px] text-text-ghost truncate">
                            #{d.number} {d.name.split(" ").pop()}
                          </p>
                        ))}
                      </div>
                      {isSelected && (
                        <div className="mt-2 text-[9px] font-bold text-ferrari-gold">SELECTED ✓</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(1)}
              className="mt-6 flex items-center gap-1.5 text-text-ghost text-xs hover:text-text-secondary transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to circuit
            </button>
          </motion.div>
        )}

        {/* ── Step 3: Driver ───────────────────────────────────────────────── */}
        {step === 3 && selectedTeam && (
          <motion.div key="step3"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs uppercase tracking-[0.2em] text-ferrari-gold font-bold">03 / Choose Driver</span>
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-[10px] text-text-ghost" style={{ color: selectedTeam.color }}>{selectedTeam.name}</span>
            </div>

            <p className="text-xs text-text-ghost mb-4">
              You control one driver. Your team-mate races under AI strategy.
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {selectedTeam.drivers.map((driver) => {
                const isActive = selectedDriverNumber === driver.number;
                return (
                  <button key={driver.number}
                    onClick={() => { setSelectedDriverNumber(driver.number); setStep(4); }}
                    className={`p-4 rounded-lg border text-left transition-all hover:scale-[1.01] ${
                      isActive
                        ? "border-ferrari-gold/50 bg-ferrari-gold/5 ring-1 ring-ferrari-gold/30"
                        : "border-border-subtle bg-surface hover:border-text-ghost/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-3.5 h-3.5" style={{ color: selectedTeam.color }} />
                      <span className="text-sm font-black tracking-wide" style={{ color: selectedTeam.color }}>
                        #{driver.number}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-text-primary">{driver.name}</p>
                    <p className="text-[10px] text-text-ghost mt-1">{selectedTeam.name}</p>
                    {isActive && <p className="text-[9px] text-ferrari-gold mt-1.5 font-bold">YOUR DRIVER ✓</p>}
                  </button>
                );
              })}
            </div>

            {/* AI team-mate note */}
            <div className="mt-4 max-w-sm p-3 rounded-lg bg-neural-purple/5 border border-neural-purple/20 text-[10px] text-text-ghost">
              The other driver will race under AI control with an independent strategy.
              You only pit YOUR driver by pressing PIT NOW during the race.
            </div>

            <button onClick={() => setStep(2)}
              className="mt-6 flex items-center gap-1.5 text-text-ghost text-xs hover:text-text-secondary transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to team
            </button>
          </motion.div>
        )}

        {/* ── Step 4: Strategy + Go ───────────────────────────────────────── */}
        {step === 4 && selectedTeam && (
          <motion.div key="step4"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ferrari-gold font-bold">04 / Pre-Race Strategy</span>
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-[10px] text-text-ghost">
                {toFlag(selectedTrack.flag)}{" "}
                {selectedTrack.name.replace(" Grand Prix", "")} · {selectedTrack.laps} laps
              </span>
            </div>

            {/* Strategy engine header */}
            <div className="flex items-start gap-3 bg-neural-purple/5 border border-neural-purple/20 rounded-lg p-4">
              <BrainCircuit className="w-5 h-5 text-neural-purple flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-text-primary mb-0.5">Strategy Engine</p>
                <p className="text-xs text-text-secondary">
                  Calculated from tire degradation model for {trackKey} (severity {severity}/8),
                  {selectedTrack.laps} laps, {rainProb > 0.5 ? "wet" : "dry"} conditions.
                  Select a plan — you can deviate at any time by pressing PIT NOW during the race.
                </p>
              </div>
            </div>

            {/* Scenario cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {strategies.map((s) => {
                const isActive = selectedStrategy?.id === s.id;
                return (
                  <button key={s.id} onClick={() => setSelectedStrategy(s)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isActive
                        ? "ring-2 scale-[1.02]"
                        : "border-border-subtle bg-surface hover:border-text-ghost/30"
                    }`}
                    style={isActive ? { borderColor: s.riskColor + "80", "--tw-ring-color": s.riskColor, backgroundColor: s.riskColor + "08" } as React.CSSProperties : {}}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-text-primary">{s.name}</span>
                      {isActive && <Check className="w-4 h-4" style={{ color: s.riskColor }} />}
                    </div>

                    {/* Compact stint bar */}
                    <div className="flex h-3 rounded overflow-hidden gap-px mb-3">
                      {s.stints.map((st, i) => (
                        <div key={i}
                          style={{
                            width: `${(st.laps / selectedTrack.laps) * 100}%`,
                            backgroundColor: (TIRE_C[st.compound as keyof typeof TIRE_C] ?? "#888") + "CC",
                          }}
                        />
                      ))}
                    </div>

                    <p className="text-[10px] text-text-ghost mb-2">{s.summary}</p>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold" style={{ color: s.riskColor }}>
                        {s.riskLabel} risk
                      </span>
                      <span className="font-mono text-ferrari-gold">{s.expectedPos}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected strategy — full stint bar */}
            {selectedStrategy && (
              <div className="bg-surface rounded-lg border border-border-subtle p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-text-primary">{selectedStrategy.name} — Stint Plan</p>
                  <div className="flex items-center gap-3 text-[10px] text-text-ghost">
                    {selectedStrategy.stops === 0 ? "No stops" : `${selectedStrategy.stops} stop${selectedStrategy.stops > 1 ? "s" : ""}`}
                    <span>·</span>
                    {selectedStrategy.pitLaps.map((l) => `Pit L${l}`).join(", ") || "Stay out"}
                  </div>
                </div>
                <StintBar
                  stints={selectedStrategy.stints}
                  pitLaps={selectedStrategy.pitLaps}
                  totalLaps={selectedTrack.laps}
                />

                {/* Tire color legend */}
                <div className="flex gap-3 mt-2 flex-wrap">
                  {selectedStrategy.stints.map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: TIRE_C[s.compound as keyof typeof TIRE_C] ?? "#888" }} />
                      <span className="text-[9px] text-text-ghost">{s.compound} ({s.laps}L)</span>
                    </div>
                  ))}
                </div>

                {/* Compound obligation check */}
                {rainProb < 0.5 && (
                  <div className="mt-3 pt-2 border-t border-border-subtle">
                    {(() => {
                      const dryCompounds = new Set(selectedStrategy.stints.map((s) => s.compound).filter((c) => c !== "INTERMEDIATE" && c !== "WET"));
                      const met = dryCompounds.size >= 2;
                      return (
                        <div className={`flex items-center gap-1.5 text-[10px] ${met ? "text-success-green" : "text-warning-amber"}`}>
                          {met ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          Compound rule: must use ≥2 dry compounds
                          {met ? " — satisfied ✓" : " — NOT MET, add a stop with a different compound"}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Weather card */}
            <div className="bg-surface rounded-lg border border-border-subtle p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-weather-blue" />
                  <span className="text-xs font-bold uppercase tracking-wider text-text-ghost">Race Conditions</span>
                </div>
                {realWeather && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${
                    realWeather.source === "open-meteo-live"
                      ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/8"
                      : "text-amber-400 border-amber-400/30 bg-amber-400/8"
                  }`}>
                    {realWeather.source === "open-meteo-live" ? "LIVE" : "HISTORICAL"}
                  </span>
                )}
              </div>

              {weatherLoading && (
                <div className="text-text-ghost text-xs animate-pulse">Fetching {trackKey} conditions…</div>
              )}

              {!weatherLoading && realWeather && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-ferrari-gold" />
                    <div>
                      <p className="text-text-ghost text-[9px]">Air</p>
                      <p className="font-bold text-text-primary">{realWeather.air_temp}°C</p>
                    </div>
                  </div>
                  {realWeather.track_temp != null && (
                    <div className="flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-rosso" />
                      <div>
                        <p className="text-text-ghost text-[9px]">Track</p>
                        <p className="font-bold text-text-primary">{realWeather.track_temp}°C</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-neural-cyan" />
                    <div>
                      <p className="text-text-ghost text-[9px]">Rain chance</p>
                      <p className="font-bold text-text-primary">{Math.round(rainProb * 100)}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-text-secondary" />
                    <div>
                      <p className="text-text-ghost text-[9px]">Wind</p>
                      <p className="font-bold text-text-primary">{realWeather.wind_speed} km/h</p>
                    </div>
                  </div>
                </div>
              )}

              {!weatherLoading && !realWeather && (
                <p className="text-text-ghost text-xs">Weather unavailable — simulation defaults used</p>
              )}

              {/* Rain warning if strategy is dry */}
              {rainProb > 0.4 && selectedStrategy && selectedStrategy.stints[0].compound !== "INTERMEDIATE" && selectedStrategy.stints[0].compound !== "WET" && (
                <div className="mt-3 flex items-center gap-2 text-[10px] text-warning-amber bg-warning-amber/5 border border-warning-amber/20 rounded p-2">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  {Math.round(rainProb * 100)}% rain chance — consider a wet-weather strategy
                </div>
              )}
            </div>

            {/* Selected driver summary */}
            {selectedTeam && selectedDriverNumber && (
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedTeam.color }} />
                <span className="font-bold text-text-primary">
                  {selectedTeam.drivers.find((d) => d.number === selectedDriverNumber)?.name ?? ""}
                </span>
                <span className="text-text-ghost">·</span>
                <span>{selectedTeam.name}</span>
                <span className="text-text-ghost">·</span>
                <span>Starting: <span className="font-mono font-bold" style={{ color: TIRE_C[startingCompound as keyof typeof TIRE_C] }}>{startingCompound}</span></span>
              </div>
            )}

            {/* CTA buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={persistAndGo("/qualifying")}
                disabled={!selectedTeam || isStarting}
                className="h-16 rounded-lg font-bold uppercase tracking-wider text-base transition-all border border-neural-cyan/40 bg-neural-cyan/10 text-neural-cyan hover:bg-neural-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="block text-[9px] font-normal normal-case tracking-normal opacity-70 mb-0.5">Q1 → Q2 → Q3</span>
                QUALIFYING
              </button>
              <button
                onClick={persistAndGo("/dashboard")}
                disabled={!selectedTeam || isStarting}
                className="h-16 rounded-lg font-bold uppercase tracking-wider text-base transition-all shimmer-bg text-white shadow-lg shadow-rosso/20 hover:shadow-xl hover:shadow-rosso/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="block text-[9px] font-normal normal-case tracking-normal opacity-70 mb-0.5">Skip qualifying</span>
                {isStarting ? "STARTING…" : "RACE NOW"}
              </button>
            </div>

            <button onClick={() => setStep(3)}
              className="flex items-center gap-1.5 text-text-ghost text-xs hover:text-text-secondary transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to driver
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
