import { useMemo, useEffect, useRef, useState } from "react";
import { getTrackPath } from "@/data/trackPaths";
import type { CarStateApi } from "@/services/api";

const TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "#1E41FF",
  "Mercedes": "#00D2BE",
  "Ferrari": "#FF1E00",
  "McLaren": "#FF8700",
  "Aston Martin": "#006F62",
  "Alpine": "#0090FF",
  "Williams": "#00A0DE",
  "RB": "#1434CB",
  "Kick Sauber": "#A3A3A3",
  "Haas": "#B6BABD",
};

const TIRE_COLORS: Record<string, string> = {
  SOFT: "#E8103A", S: "#E8103A",
  MEDIUM: "#FFD300", M: "#FFD300",
  HARD: "#CCCCCC", H: "#CCCCCC",
  INTERMEDIATE: "#00D084", I: "#00D084",
  WET: "#1E90FF", W: "#1E90FF",
};

const SECTOR_COLORS = ["#FF3333", "#A78BFA", "#22D3EE"];

// Backend sends track_fraction as an absolute monotonically-increasing value:
//   fraction = current_lap - (gap_to_leader / ref_lap_time)
// so each lap tick the value increases by ~1.0 and the frontend lerps a full lap forward.
// Display uses (fraction % 1.0) to get 0–1 circuit position.
// diff > 1.5 = more than one full lap jump (SC compression, rejoin) → snap.
// diff < 0 = car fell back on track (pit stop during the tick) → still animate forward
//             to the pit-exit position which is ~(1 + diff) laps forward.
function lerpFractionForward(from: number, to: number, t: number): number {
  let diff = to - from;
  if (diff < -1.5 || diff > 2.5) return to; // extreme discontinuity — snap
  if (diff < 0) diff += 1;                   // pit-stop setback: animate to ~pit-exit position
  return from + diff * t;
}

function getTLA(name: string | undefined): string {
  if (!name) return "???";
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1].toUpperCase();
  return last.slice(0, 3);
}

function buildDistances(points: [number, number][]): number[] {
  const d = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    d.push(d[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return d;
}

function interpolate(
  points: [number, number][],
  dists: number[],
  fraction: number,
): [number, number] {
  const total = dists[dists.length - 1];
  if (total === 0) return points[0];
  const target = ((fraction % 1) + 1) % 1 * total;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] >= target) {
      const segLen = dists[i] - dists[i - 1];
      if (segLen === 0) return points[i];
      const t = (target - dists[i - 1]) / segLen;
      return [
        points[i - 1][0] + t * (points[i][0] - points[i - 1][0]),
        points[i - 1][1] + t * (points[i][1] - points[i - 1][1]),
      ];
    }
  }
  return points[points.length - 1];
}

function SectorTick({ p0, p1, color }: { p0: [number, number]; p1: [number, number]; color: string }) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const hw = 3.5;
  return (
    <line
      x1={p0[0] + nx * hw} y1={p0[1] + ny * hw}
      x2={p0[0] - nx * hw} y2={p0[1] - ny * hw}
      stroke={color} strokeWidth={1.5} opacity={0.85}
    />
  );
}

function SFLine({ points }: { points: [number, number][] }) {
  if (points.length < 2) return null;
  const [x0, y0] = points[0];
  const [x1, y1] = points[1];
  const dx = x1 - x0; const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len; const ny = dx / len; // perpendicular across track
  const tx =  dx / len; const ty =  dy / len; // tangent = direction of travel
  const hw = 5.5;

  // Checkered finish-line segments
  const segs = 8;
  const step = (hw * 2) / segs;
  const checks = Array.from({ length: segs }, (_, i) => {
    const t0 = -hw + i * step;
    const t1 = t0 + step;
    return {
      x1: x0 + nx * t0, y1: y0 + ny * t0,
      x2: x0 + nx * t1, y2: y0 + ny * t1,
      dark: i % 2 === 0,
    };
  });

  // Label offset: perpendicular + slightly outside the track
  const lx = x0 + nx * (hw + 4);
  const ly = y0 + ny * (hw + 4);

  return (
    <g>
      {/* White base */}
      <line x1={x0 + nx * hw} y1={y0 + ny * hw} x2={x0 - nx * hw} y2={y0 - ny * hw}
        stroke="#FFFFFF" strokeWidth={4} opacity={1} />
      {/* Checkered overlay */}
      {checks.map((c, i) => c.dark && (
        <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
          stroke="#111111" strokeWidth={4} opacity={0.85} />
      ))}
      {/* Gold accent line */}
      <line x1={x0 + nx * hw} y1={y0 + ny * hw} x2={x0 - nx * hw} y2={y0 - ny * hw}
        stroke="#FFD300" strokeWidth={0.6} opacity={0.7} />
      {/* Direction-of-travel arrow just ahead of the line */}
      <text x={x0 + tx * 5} y={y0 + ty * 5 + 1}
        textAnchor="middle" fontSize={3.5} fill="#FFD300" opacity={0.8}>▶</text>
      {/* S/F label */}
      <text x={lx} y={ly + 1} textAnchor="middle"
        fontSize={3} fontFamily="'Courier New', monospace" fontWeight="bold"
        fill="#FFD300" stroke="#0A0A1A" strokeWidth={0.7}
        style={{ paintOrder: "stroke" } as React.CSSProperties}>S/F</text>
    </g>
  );
}

// ── animated car dot ─────────────────────────────────────────────────────────

interface CarDotProps {
  points: [number, number][];
  dists: number[];
  targetFraction: number;
  color: string;
  tireColor: string;
  tla: string;
  isPlayer: boolean;
  isPitting: boolean;
  pits: number;
  animDurationMs: number;
  isLeader?: boolean;
  lapsDown?: number;
  onLapCross?: () => void;
}

function CarDot({ points, dists, targetFraction, color, tireColor, tla, isPlayer, isPitting, pits, animDurationMs, isLeader = false, lapsDown = 0, onLapCross }: CarDotProps) {
  // Absolute (non-wrapping) position — increases monotonically.
  // display fraction = absRef.current % 1.0
  const absRef    = useRef(targetFraction);
  const targetRef = useRef(targetFraction);
  const lastRef   = useRef<number | null>(null);
  const rafRef    = useRef<number | null>(null);
  const onLapCrossRef = useRef(onLapCross);
  const [xy, setXY] = useState<[number, number]>(() => interpolate(points, dists, targetFraction % 1.0));

  // Keep targetRef in sync silently — the RAF loop reads it via ref.
  // Only hard-snap absRef on extreme anomalies (>2.5 laps ahead or going backwards).
  useEffect(() => {
    const diff = targetFraction - targetRef.current;
    if (diff < -0.5 || diff > 2.5) {
      absRef.current = targetFraction; // teleport: SC restart, reconnect, pit teleport
    }
    targetRef.current = targetFraction;
  }, [targetFraction]);

  // Keep lap-cross callback in sync without restarting the RAF loop.
  useEffect(() => { onLapCrossRef.current = onLapCross; }, [onLapCross]);

  // Perpetual RAF loop — car is always moving, never stationary between laps.
  // animDurationMs = real milliseconds for one full circuit at the current sim speed.
  // Backend states are soft checkpoints; gentle correction keeps sync.
  useEffect(() => {
    if (animDurationMs === 0) {
      // Paused — snap to target and stop
      absRef.current = targetRef.current;
      setXY(interpolate(points, dists, ((targetRef.current % 1.0) + 1.0) % 1.0));
      return;
    }

    const rate = 1.0 / animDurationMs; // fractions per ms — 1 full circuit per interval

    const tick = (now: number) => {
      const dt = lastRef.current !== null ? Math.min(now - lastRef.current, 100) : 0;
      lastRef.current = now;

      // Detect S/F crossing BEFORE advancing (fire when floor increments)
      const prevFloor = Math.floor(absRef.current);

      // Constant-speed advance — car is always exactly animDurationMs behind the live target.
      // Being ~1.0 behind targetRef is NORMAL (we are animating the current lap).
      absRef.current += dt * rate;

      const newFloor = Math.floor(absRef.current);
      if (newFloor > prevFloor && onLapCrossRef.current) {
        onLapCrossRef.current();
      }

      // Only two special cases:
      const ahead = absRef.current - targetRef.current;
      if (Math.abs(ahead) > 1.5) {
        // >1.5 laps off (speed change, SC compression, reconnect) — hard snap
        absRef.current = targetRef.current;
      } else if (ahead > 0.5) {
        // Car has gone noticeably past the checkpoint (e.g., under SC cars slow,
        // animation ran past them) — gently shed the excess over ~10 seconds
        absRef.current -= ahead * 0.005;
      }

      setXY(interpolate(points, dists, ((absRef.current % 1.0) + 1.0) % 1.0));
      rafRef.current = requestAnimationFrame(tick);
    };

    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [animDurationMs, points, dists]); // targetFraction + onLapCross handled via refs

  const [cx, cy] = xy;

  return (
    <g style={{ cursor: "default" }} opacity={lapsDown > 0 ? 0.55 : 1}>
      {/* Pulsing glow for player */}
      {isPlayer && (
        <>
          <circle cx={cx} cy={cy} r={7} fill={color} opacity={0.08} />
          <circle cx={cx} cy={cy} r={4.5} fill="none" stroke="#FFD300" strokeWidth={1.3} opacity={0.9} />
        </>
      )}

      {/* Pit indicator ring */}
      {isPitting && (
        <circle cx={cx} cy={cy} r={5.5} fill="none" stroke="#7B61FF"
          strokeWidth={1} strokeDasharray="2 2" opacity={0.8} />
      )}

      {/* Main dot */}
      <circle
        cx={cx} cy={cy}
        r={isPlayer ? 3.2 : 2.4}
        fill={color}
        stroke={isPlayer ? "#FFD300" : "#16161E"}
        strokeWidth={isPlayer ? 0.7 : 0.4}
        opacity={0.97}
      />

      {/* Tire indicator */}
      <circle cx={cx + 2.8} cy={cy - 2.8} r={1.2} fill={tireColor} opacity={0.9} />

      {/* Leader crown */}
      {isLeader && (
        <text x={cx} y={cy - 10.5} textAnchor="middle" fontSize={4.5} fill="#FFD300" opacity={0.95}>♛</text>
      )}

      {/* TLA label */}
      <text
        x={cx} y={cy - 6}
        textAnchor="middle"
        fontSize={isPlayer ? 3.8 : 3.0}
        fontFamily="'Courier New', monospace"
        fontWeight={isPlayer ? "900" : "600"}
        fill={isPlayer ? "#FFD300" : "#D0D0E0"}
        opacity={0.9}
      >
        {tla}
      </text>

      {/* Lapped car badge */}
      {lapsDown > 0 && (
        <text x={cx} y={cy + 7.5} textAnchor="middle" fontSize={2.5}
          fontFamily="monospace" fill="#FF6B6B" opacity={0.9}>
          L{lapsDown}
        </text>
      )}

      {/* Pit count badge */}
      {pits > 0 && (
        <text
          x={cx + 3.5} y={cy + 5.5}
          textAnchor="middle"
          fontSize={2.5}
          fontFamily="monospace"
          fill="#A78BFA"
          opacity={0.85}
        >
          {pits}P
        </text>
      )}
    </g>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface TrackMapProps {
  trackKey: string;
  cars: CarStateApi[];
  playerTeam?: string;
  className?: string;
  animDurationMs?: number;
  onLeaderLapCross?: () => void;
}

export default function TrackMap({ trackKey, cars, playerTeam, className = "", animDurationMs = 800, onLeaderLapCross }: TrackMapProps) {
  const { points, s1End, s2End } = getTrackPath(trackKey);

  const { dists, s1Idx, s2Idx, seg1, seg2, seg3 } = useMemo(() => {
    const d = buildDistances(points);
    const n = points.length;
    const i1 = Math.min(Math.round(s1End * n), n - 2);
    const i2 = Math.min(Math.round(s2End * n), n - 1);
    const toStr = (pts: [number, number][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");
    return {
      dists: d, s1Idx: i1, s2Idx: i2,
      seg1: toStr(points.slice(0, i1 + 1)),
      seg2: toStr(points.slice(i1, i2 + 1)),
      seg3: toStr([...points.slice(i2), points[0]]),
    };
  }, [points, s1End, s2End]);

  const activeCars = cars.filter((c) => !(c as { dnf?: boolean }).dnf);
  const sortedCars = [...activeCars].sort((a, b) => a.position - b.position);

  // Absolute fraction of the leader — used to compute laps-down for each car.
  // Using the raw gap formula: lapsDown = floor(leaderFraction - carFraction)
  const leaderFraction = sortedCars[0]
    ? ((sortedCars[0] as { track_fraction?: number }).track_fraction ?? 0)
    : 0;

  const s1BoundaryPoint = points[s1Idx] as [number, number];
  const s2BoundaryPoint = points[s2Idx] as [number, number];
  const s1NextPoint = points[Math.min(s1Idx + 1, points.length - 1)] as [number, number];
  const s2NextPoint = points[Math.min(s2Idx + 1, points.length - 1)] as [number, number];

  // Track the previous pit count per driver to detect a pit happening
  const prevPitsRef = useRef<Record<string, number>>({});

  return (
    <div className={`relative bg-carbon rounded-lg overflow-hidden ${className}`}>
      <svg
        viewBox="-4 -4 108 83"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ minHeight: 180 }}
      >
        {/* Track shadow */}
        <polyline
          points={[seg1, seg2, seg3].join(" ")}
          fill="none" stroke="#1A1A2E" strokeWidth={8}
          strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Sector arcs */}
        <polyline points={seg1} fill="none" stroke={SECTOR_COLORS[0]}
          strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <polyline points={seg2} fill="none" stroke={SECTOR_COLORS[1]}
          strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        <polyline points={seg3} fill="none" stroke={SECTOR_COLORS[2]}
          strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />

        {/* Centre dashed racing line */}
        <polyline points={[seg1, seg2, seg3].join(" ")} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={1.2}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 5" />

        {/* Sector boundary ticks */}
        <SectorTick p0={s1BoundaryPoint} p1={s1NextPoint} color={SECTOR_COLORS[1]} />
        <SectorTick p0={s2BoundaryPoint} p1={s2NextPoint} color={SECTOR_COLORS[2]} />

        {/* Start/Finish */}
        <SFLine points={points} />

        {/* Animated car dots — render back-to-front so P1 on top */}
        {[...sortedCars].reverse().map((car) => {
          const fraction  = (car as { track_fraction?: number }).track_fraction ?? 0;
          const driverObj = typeof car.driver === "object" ? car.driver as { name: string; team: string; number: number } : null;
          const team      = driverObj?.team ?? "";
          const name      = driverObj?.name ?? (typeof car.driver === "string" ? car.driver : "");
          const tla       = getTLA(name);
          const color     = TEAM_COLORS[team] ?? "#888888";
          const isPlayer  = playerTeam ? team === playerTeam : false;
          const isLeader  = car.position === 1;
          const compound  = car.tire?.compound ?? "MEDIUM";
          const tireColor = TIRE_COLORS[compound] ?? "#888888";
          const pits      = car.pits ?? 0;
          const key       = tla + "-" + team;
          const lapsDown  = Math.max(0, Math.floor(leaderFraction - fraction));

          // Detect mid-lap pit (pits count increased since last render)
          const prevPits = prevPitsRef.current[key] ?? pits;
          const isPitting = pits > prevPits;
          prevPitsRef.current[key] = pits;

          return (
            <CarDot
              key={key}
              points={points}
              dists={dists}
              targetFraction={fraction}
              color={color}
              tireColor={tireColor}
              tla={tla}
              isPlayer={isPlayer}
              isPitting={isPitting}
              pits={pits}
              animDurationMs={animDurationMs}
              isLeader={isLeader}
              lapsDown={lapsDown}
              onLapCross={isLeader ? onLeaderLapCross : undefined}
            />
          );
        })}
      </svg>

      {/* Sector legend */}
      <div className="absolute bottom-1.5 left-2 flex gap-3 items-center">
        {(["S1", "S2", "S3"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-5 h-1 rounded-full" style={{ backgroundColor: SECTOR_COLORS[i] }} />
            <span className="text-[8px] font-mono" style={{ color: SECTOR_COLORS[i] }}>{s}</span>
          </div>
        ))}
        <div className="w-px h-3 bg-border-subtle mx-0.5" />
        {(["S", "M", "H", "I", "W"] as const).map((c, i) => {
          const full = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"][i];
          return (
            <div key={c} className="flex items-center gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TIRE_COLORS[full] }} />
              <span className="text-[8px] text-text-ghost font-mono">{c}</span>
            </div>
          );
        })}
      </div>

      {/* Pit lane indicator strip */}
      <div className="absolute top-1.5 left-2 flex items-center gap-1.5">
        <span className="text-[8px] text-text-ghost font-mono uppercase tracking-wider">S/F</span>
        <span className="text-[8px] text-border-subtle">·</span>
        <span className="text-[8px] font-mono text-neural-purple opacity-70">P = pit stop count</span>
      </div>

      <div className="absolute top-1.5 right-2">
        <span className="text-[9px] text-text-ghost font-mono">{trackKey}</span>
      </div>
    </div>
  );
}
