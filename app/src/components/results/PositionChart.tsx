import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { lapPositions } from './mockData';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

const teamLines = [
  { key: 'ferrari', name: 'Ferrari', color: '#FF1E00' },
  { key: 'mercedes', name: 'Mercedes', color: '#00F5D4' },
  { key: 'redbull', name: 'Red Bull', color: '#0033A0' },
  { key: 'mclaren', name: 'McLaren', color: '#FF8700' },
  { key: 'williams', name: 'Williams', color: '#00A0DE' },
];

/* ─── Custom Tooltip ───────────────────────────────────── */

function PositionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: number }) {
  if (!active || !payload) return null;
  const sorted = [...payload].sort((a, b) => a.value - b.value);
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{ backgroundColor: '#16161E', border: '1px solid #2D2D3D' }}
    >
      <p className="font-medium mb-1.5" style={{ color: '#F0F0F5' }}>Runde {label}</p>
      {sorted.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span style={{ color: '#8B8BA0' }}>{entry.name}:</span>
          <span className="font-medium ml-auto pl-3" style={{ color: '#F0F0F5', fontFamily: "'Geist Mono', monospace" }}>
            P{entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ─── Custom Legend ────────────────────────────────────── */

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs" style={{ color: '#8B8BA0' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Chart ───────────────────────────────────────── */

export default function PositionChart() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-30% 0px' });

  return (
    <section className="py-8 px-4 md:px-6">
      <motion.div
        ref={ref}
        className="max-w-[1000px] mx-auto"
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, ease: easePrimary }}
      >
        {/* Section header */}
        <div className="mb-6">
          <h2
            className="text-2xl font-semibold tracking-[0.05em] uppercase"
            style={{ color: '#F0F0F5' }}
          >
            RENNWIEDERGABE
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#8B8BA0' }}>
            Positionsentwicklung über alle 44 Runden
          </p>
        </div>

        {/* Chart container */}
        <motion.div
          className="rounded-xl p-6"
          style={{ backgroundColor: '#1E1E28' }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: easePrimary }}
        >
          <h3
            className="text-sm font-semibold tracking-[0.1em] uppercase mb-1"
            style={{ color: '#55556B' }}
          >
            POSITIONSENTWICKLUNG
          </h3>
          <p className="text-xs mb-4" style={{ color: '#55556B' }}>
            Positionswechsel über das Rennen
          </p>

          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={lapPositions} margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="rgba(255,255,255,0.04)"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey="lap"
                tick={{ fontSize: 11, fill: '#55556B' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval={4}
                label={{ value: 'Runde', position: 'insideBottom', offset: -2, style: { fill: '#55556B', fontSize: 11 } }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#55556B' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                domain={[1, 5]}
                reversed
                allowDecimals={false}
                ticks={[1, 2, 3, 4, 5]}
                label={{ value: 'Position', angle: -90, position: 'insideLeft', offset: 20, style: { fill: '#55556B', fontSize: 11 } }}
              />
              <Tooltip content={<PositionTooltip />} />
              <Legend content={<CustomLegend />} />
              {teamLines.map((team, i) => (
                <Line
                  key={team.key}
                  type="stepAfter"
                  dataKey={team.key}
                  name={team.name}
                  stroke={team.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: team.color }}
                  animationDuration={2000}
                  animationBegin={isInView ? i * 200 : 99999}
                  style={{
                    filter: `drop-shadow(0 0 4px ${team.color}30)`,
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>
    </section>
  );
}
