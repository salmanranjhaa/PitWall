import { motion } from 'framer-motion';
import { TrendingDown } from 'lucide-react';
import type { LeaderboardEntry } from './data';
import { formatLapTime } from './data';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

interface StatsRowProps {
  currentLap: number;
  totalLaps: number;
  lastLapTime: number;
  position: number;
  playerTeam: LeaderboardEntry;
}

export default function StatsRow({ currentLap, totalLaps, lastLapTime, position, playerTeam }: StatsRowProps) {
  const delta = -0.413;
  const deltaColor = delta < 0 ? '#00D084' : '#FF2D2D';

  const stats = [
    {
      label: 'RUNDE',
      accentColor: '#FFB800',
      content: (
        <div className="flex items-baseline gap-1">
          <span
            className="text-5xl font-mono font-medium tracking-[-0.03em]"
            style={{ color: '#F0F0F5' }}
          >
            {currentLap}
          </span>
          <span
            className="text-[2rem] font-mono font-medium tracking-[-0.02em]"
            style={{ color: '#55556B' }}
          >
            / {totalLaps}
          </span>
        </div>
      ),
    },
    {
      label: 'LETZTE RUNDENZEIT',
      accentColor: '#00D084',
      content: (
        <div className="flex flex-col">
          <span
            className="text-[2rem] font-mono font-medium tracking-[-0.02em]"
            style={{ color: '#F0F0F5' }}
          >
            {formatLapTime(lastLapTime)}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <TrendingDown className="w-3 h-3" style={{ color: deltaColor }} />
            <span
              className="text-base font-mono font-medium"
              style={{ color: deltaColor }}
            >
              {delta < 0 ? '' : '+'}{delta.toFixed(3)}s
            </span>
          </div>
        </div>
      ),
    },
    {
      label: 'POSITION',
      accentColor: '#FFB800',
      content: (
        <span
          className="text-5xl font-mono font-medium tracking-[-0.03em]"
          style={{ color: '#FFB800' }}
        >
          P{position}
        </span>
      ),
    },
    {
      label: 'TEAM',
      accentColor: playerTeam.teamColor,
      content: (
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: playerTeam.teamColor }}
          />
          <span
            className="text-[0.875rem] font-semibold tracking-[0.1em] uppercase"
            style={{ color: playerTeam.teamColor }}
          >
            {playerTeam.team}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div
      className="flex gap-4 px-6 py-4"
      style={{
        minHeight: 72,
      }}
    >
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="flex-1 rounded-lg p-5 transition-all duration-200 hover:shadow-card-hover"
          style={{
            background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
            border: '1px solid #2D2D3D',
            borderLeft: `3px solid ${stat.accentColor}`,
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.2 + i * 0.08,
            ease: easePrimary,
          }}
          whileHover={{
            borderColor: 'rgba(255,184,0,0.35)',
            boxShadow: '0 0 12px rgba(255,184,0,0.08)',
          }}
        >
          <p
            className="text-[0.875rem] font-semibold tracking-[0.1em] uppercase mb-2"
            style={{ color: '#55556B' }}
          >
            {stat.label}
          </p>
          {stat.content}
        </motion.div>
      ))}
    </div>
  );
}
