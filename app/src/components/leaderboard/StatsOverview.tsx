import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Trophy, Zap, Star } from 'lucide-react';
import { raceData } from './data';

function useCountUp(end: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);

  return count;
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

export default function StatsOverview() {
  const totalRaces = raceData.length;
  const wins = raceData.filter((r) => r.position === 1).length;
  const fastestLaps = raceData.filter((r) => r.fastestLap).length;

  const winRate = Math.round((wins / totalRaces) * 100);

  const favTeam = raceData.reduce<Record<string, number>>((acc, r) => {
    acc[r.team] = (acc[r.team] || 0) + 1;
    return acc;
  }, {});
  const favoriteTeamName = Object.entries(favTeam).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Ferrari';
  const favoriteTeamCount = Object.entries(favTeam).sort((a, b) => b[1] - a[1])[0]?.[1] || 0;
  const favoriteTeamPercent = Math.round((favoriteTeamCount / totalRaces) * 100);

  const fastestCount = useCountUp(fastestLaps, 1200);
  const raceCount = useCountUp(totalRaces, 1200);

  return (
    <section className="px-6 md:px-page py-section">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Races */}
          <motion.div
            className="relative overflow-hidden rounded-[10px] border border-[#2D2D3D] p-5"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              borderLeft: '3px solid #FFB800',
            }}
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[0.875rem] font-semibold tracking-[0.1em] uppercase"
                style={{ color: '#55556B' }}
              >
                GESAMTRENNEN
              </span>
              <Flag className="w-5 h-5" style={{ color: '#FFB800' }} />
            </div>
            <div className="font-mono text-[3rem] font-medium leading-none tracking-[-0.03em]" style={{ color: '#F0F0F5' }}>
              {raceCount}
            </div>
            <div className="mt-2 text-xs" style={{ color: '#00D084' }}>
              +3 diese Woche
            </div>
          </motion.div>

          {/* Card 2: Win Rate */}
          <motion.div
            className="relative overflow-hidden rounded-[10px] border border-[#2D2D3D] p-5"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              borderLeft: '3px solid #00D084',
            }}
            custom={1}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[0.875rem] font-semibold tracking-[0.1em] uppercase"
                style={{ color: '#55556B' }}
              >
                SIEGRATE
              </span>
              <Trophy className="w-5 h-5" style={{ color: '#00D084' }} />
            </div>
            <div className="font-mono text-[3rem] font-medium leading-none tracking-[-0.03em]" style={{ color: '#00D084' }}>
              {winRate}%
            </div>
            <div className="mt-2 text-xs" style={{ color: '#8B8BA0' }}>
              {wins} von {totalRaces} Rennen
            </div>
          </motion.div>

          {/* Card 3: Fastest Laps */}
          <motion.div
            className="relative overflow-hidden rounded-[10px] border border-[#2D2D3D] p-5"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              borderLeft: '3px solid #FF8700',
            }}
            custom={2}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[0.875rem] font-semibold tracking-[0.1em] uppercase"
                style={{ color: '#55556B' }}
              >
                SCHNELLSTE RUNDE
              </span>
              <Zap className="w-5 h-5" style={{ color: '#FF8700' }} />
            </div>
            <div className="font-mono text-[3rem] font-medium leading-none tracking-[-0.03em]" style={{ color: '#FF8700' }}>
              {fastestCount}
            </div>
            <div className="mt-2 text-xs" style={{ color: '#8B8BA0' }}>
              {Math.round((fastestLaps / totalRaces) * 100)}% aller Rennen
            </div>
          </motion.div>

          {/* Card 4: Favorite Team */}
          <motion.div
            className="relative overflow-hidden rounded-[10px] border border-[#2D2D3D] p-5"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              borderLeft: '3px solid #FF1E00',
            }}
            custom={3}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[0.875rem] font-semibold tracking-[0.1em] uppercase"
                style={{ color: '#55556B' }}
              >
                BESTE STRATEGIE
              </span>
              <Star className="w-5 h-5" style={{ color: '#FF1E00' }} />
            </div>
            <div className="text-[1.5rem] font-semibold tracking-[-0.02em] uppercase" style={{ color: '#FF1E00' }}>
              {favoriteTeamName}
            </div>
            <div className="mt-2 text-xs" style={{ color: '#8B8BA0' }}>
              {favoriteTeamCount} Rennen ({favoriteTeamPercent}%)
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
