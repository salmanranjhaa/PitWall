import { motion } from 'framer-motion';
import { AlignJustify } from 'lucide-react';
import type { LeaderboardEntry } from './data';
import { formatLapTime } from './data';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

function TireBadge({ compound }: { compound: 'S' | 'M' | 'H' }) {
  const color = compound === 'S' ? '#E8103A' : compound === 'M' ? '#FFD300' : '#F5F5F5';
  const label = compound === 'S' ? 'S' : compound === 'M' ? 'M' : 'H';
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-xs font-bold tracking-wider"
      style={{
        backgroundColor: `${color}26`,
        border: `1px solid ${color}66`,
        color,
        minWidth: 32,
        height: 22,
        padding: '0 8px',
      }}
    >
      {label}
    </span>
  );
}

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <motion.div
      className="flex flex-col border-l border-[#2D2D3D] overflow-hidden"
      style={{
        width: 340,
        minWidth: 340,
        backgroundColor: 'transparent',
      }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.5, ease: easePrimary }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-6 py-4"
        style={{ borderBottom: '1px solid #2D2D3D' }}
      >
        <AlignJustify className="w-4 h-4" style={{ color: '#55556B' }} />
        <h3
          className="text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ color: '#55556B' }}
        >
          LIVE-RANGLISTE
        </h3>
      </div>

      {/* Table Header */}
      <div
        className="grid gap-2 px-4 py-3"
        style={{
          gridTemplateColumns: '36px 1fr 44px 40px 68px 36px 56px',
          borderBottom: '1px solid #2D2D3D',
        }}
      >
        {['Pos', 'Team', 'Reif.', 'Alter', 'Letzte', 'Stops', 'Rückst.'].map(
          (header) => (
            <span
              key={header}
              className="text-[11px] font-semibold tracking-wider uppercase"
              style={{ color: '#55556B' }}
            >
              {header}
            </span>
          )
        )}
      </div>

      {/* Table Rows */}
      <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 300px)' }}>
        {entries.map((entry, i) => (
          <motion.div
            key={entry.team}
            className="grid gap-2 px-4 py-2.5 transition-colors duration-150 cursor-default items-center"
            style={{
              gridTemplateColumns: '36px 1fr 44px 40px 68px 36px 56px',
              borderBottom: '1px solid rgba(45,45,61,0.5)',
              backgroundColor: entry.isPlayer
                ? 'rgba(255,184,0,0.04)'
                : 'transparent',
              borderLeft: entry.isPlayer
                ? '2px solid #FFB800'
                : '2px solid transparent',
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.55 + i * 0.06,
              ease: easePrimary,
            }}
            whileHover={{
              backgroundColor: '#2A2A38',
            }}
          >
            {/* Position */}
            <span
              className="text-sm font-mono font-medium"
              style={{
                color: entry.position === 1 ? '#FFB800' : '#F0F0F5',
              }}
            >
              P{entry.position}
            </span>

            {/* Team */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.teamColor }}
              />
              <span
                className="text-sm truncate"
                style={{ color: '#F0F0F5' }}
              >
                {entry.team}
              </span>
            </div>

            {/* Tire */}
            <TireBadge compound={entry.tire} />

            {/* Tire Age */}
            <span
              className="text-sm font-mono font-medium text-center"
              style={{ color: '#8B8BA0' }}
            >
              {entry.tireAge}
            </span>

            {/* Last Lap */}
            <span
              className="text-sm font-mono font-medium"
              style={{ color: '#F0F0F5' }}
            >
              {formatLapTime(entry.lastLap)}
            </span>

            {/* Stops */}
            <span
              className="text-sm font-mono font-medium text-center"
              style={{ color: '#8B8BA0' }}
            >
              {entry.stops}
            </span>

            {/* Gap */}
            <span
              className="text-sm font-mono font-medium"
              style={{
                color: entry.position === 1 ? '#FFB800' : '#8B8BA0',
              }}
            >
              {entry.gap}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
