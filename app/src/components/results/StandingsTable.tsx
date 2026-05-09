import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { raceResults, getTeamById, getTireById } from './mockData';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ─── Tire Dot ─────────────────────────────────────────── */

function TireDot({ tireId }: { tireId: string }) {
  const tire = getTireById(tireId);
  return (
    <span
      className="inline-block w-3 h-3 rounded-full mr-1"
      style={{ backgroundColor: tire?.color || '#55556B' }}
      title={tire?.label}
    />
  );
}

/* ─── Team Pill ────────────────────────────────────────── */

function TeamPill({ teamId }: { teamId: string }) {
  const team = getTeamById(teamId);
  return (
    <div className="flex items-center gap-2">
      <img
        src={team?.logo}
        alt={team?.shortName}
        className="w-5 h-5 shrink-0"
      />
      <span
        className="text-sm font-medium"
        style={{ color: team?.color || '#F0F0F5' }}
      >
        {team?.shortName}
      </span>
    </div>
  );
}

/* ─── Position Cell ────────────────────────────────────── */

function PositionCell({ position }: { position: number }) {
  const color = position === 1 ? '#FFB800' : position === 2 ? '#C0C0C0' : position === 3 ? '#CD7F32' : '#F0F0F5';
  return (
    <span
      className="text-sm font-bold"
      style={{ color, fontFamily: "'Geist Mono', monospace" }}
    >
      P{position}
    </span>
  );
}

/* ─── Strategy Dots ────────────────────────────────────── */

function StrategyDots({ strategy }: { strategy: string[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {strategy.map((tireId, i) => (
        <div key={i} className="flex items-center">
          <TireDot tireId={tireId} />
          {i < strategy.length - 1 && (
            <span className="text-[10px] mx-0.5" style={{ color: '#55556B' }}>→</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Main Table ───────────────────────────────────────── */

export default function StandingsTable() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20% 0px' });

  const columns = [
    { key: 'pos', label: 'POS', width: 56 },
    { key: 'team', label: 'TEAM', width: 160 },
    { key: 'driver', label: 'FAHRER', width: 140 },
    { key: 'strategy', label: 'STRATEGIE', width: 100 },
    { key: 'stops', label: 'STOPS', width: 64 },
    { key: 'raceTime', label: 'RENNAZEIT', width: 120 },
    { key: 'gap', label: 'RÜCKSTAND', width: 100 },
    { key: 'bestLap', label: 'BESTE RUNDE', width: 120 },
  ];

  return (
    <section className="py-8 px-4 md:px-6">
      <div className="max-w-[1000px] mx-auto" ref={ref}>
        {/* Section header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, x: -30 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.4, ease: easePrimary }}
        >
          <h2
            className="text-2xl font-semibold tracking-[0.05em] uppercase"
            style={{ color: '#F0F0F5' }}
          >
            ENDERGEBNISSE
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#8B8BA0' }}>
            Vollständige Rennergebnisse
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1E1E28' }}
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.1, ease: easePrimary }}
        >
          {/* Header */}
          <div
            className="grid gap-0 px-4"
            style={{
              gridTemplateColumns: columns.map((c) => `${c.width}px`).join(' '),
              borderBottom: '1px solid #2D2D3D',
            }}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="py-3.5 text-xs font-semibold tracking-[0.1em] uppercase"
                style={{ color: '#55556B' }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Rows */}
          {raceResults.map((result, i) => {
            const isFastest = result.isFastestLap;

            return (
              <motion.div
                key={result.position}
                className="grid gap-0 px-4 items-center"
                style={{
                  gridTemplateColumns: columns.map((c) => `${c.width}px`).join(' '),
                  height: 48,
                  borderBottom: i < raceResults.length - 1 ? '1px solid rgba(45,45,61,0.5)' : undefined,
                  borderLeft: isFastest ? '2px solid #FFB800' : undefined,
                  backgroundColor: isFastest ? 'rgba(255,184,0,0.04)' : undefined,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.3,
                  delay: 0.15 + i * 0.05,
                  ease: easePrimary,
                }}
              >
                {/* Position */}
                <div><PositionCell position={result.position} /></div>

                {/* Team */}
                <div><TeamPill teamId={result.teamId} /></div>

                {/* Driver */}
                <div className="text-sm" style={{ color: '#F0F0F5' }}>
                  {result.driverCode}
                </div>

                {/* Strategy */}
                <div><StrategyDots strategy={result.tireStrategy} /></div>

                {/* Stops */}
                <div
                  className="text-sm"
                  style={{ color: '#8B8BA0', fontFamily: "'Geist Mono', monospace" }}
                >
                  {result.pitStops}
                </div>

                {/* Race Time */}
                <div
                  className="text-sm"
                  style={{ color: '#F0F0F5', fontFamily: "'Geist Mono', monospace" }}
                >
                  {result.raceTime}
                </div>

                {/* Gap */}
                <div
                  className="text-sm"
                  style={{ color: '#8B8BA0', fontFamily: "'Geist Mono', monospace" }}
                >
                  {result.gap}
                </div>

                {/* Best Lap */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm"
                    style={{ color: isFastest ? '#FFB800' : '#F0F0F5', fontFamily: "'Geist Mono', monospace" }}
                  >
                    {result.bestLap}
                  </span>
                  {isFastest && (
                    <span
                      className="text-[10px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'rgba(255,184,0,0.15)',
                        color: '#FFB800',
                        border: '1px solid rgba(255,184,0,0.3)',
                      }}
                    >
                      FL
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
