import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Timer, TrendingUp } from 'lucide-react';
import { raceData } from './data';
import { TEAM_COLORS } from './data';
import { formatDate } from './utils';

function getPersonalBests(data: typeof raceData) {
  // Best finish: lowest position number
  const bestFinishEntry = data.reduce((best, race) =>
    race.position < best.position ? race : best
  );

  // Fastest lap: smallest lap time string
  const fastestLapEntry = data.reduce((fastest, race) => {
    if (lapTimeToMs(race.bestLap) < lapTimeToMs(fastest.bestLap)) return race;
    return fastest;
  });

  // Best strategy: which strategy had most wins with most uses
  const strategyMap = new Map<string, { wins: number; total: number }>();
  data.forEach((race) => {
    const strat = race.strategy.join('\u2192');
    const current = strategyMap.get(strat) || { wins: 0, total: 0 };
    current.total++;
    if (race.position === 1) current.wins++;
    strategyMap.set(strat, current);
  });

  let bestStrategy = 'S\u2192M\u2192H';
  let bestWinRate = 0;
  strategyMap.forEach((stats, strat) => {
    const rate = stats.wins / stats.total;
    if (stats.total >= 3 && rate > bestWinRate) {
      bestWinRate = rate;
      bestStrategy = strat;
    }
  });

  // If no strategy has 3+ uses, just pick the one with most wins
  if (bestWinRate === 0) {
    let maxWins = 0;
    strategyMap.forEach((stats, strat) => {
      if (stats.wins > maxWins) {
        maxWins = stats.wins;
        bestStrategy = strat;
      }
    });
  }

  return {
    bestFinish: bestFinishEntry,
    fastestLap: fastestLapEntry,
    bestStrategy,
    bestStrategyRate: Math.round(bestWinRate * 100),
  };
}

function lapTimeToMs(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 * 1000 + parseFloat(parts[1]) * 1000;
  }
  return 0;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

export default function PersonalBests() {
  const bests = useMemo(() => getPersonalBests(raceData), []);

  return (
    <section className="px-6 md:px-page py-section">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          className="text-[1.5rem] font-semibold tracking-[0.05em] uppercase mb-6 text-center"
          style={{ color: '#F0F0F5' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          PERSOENLICHE BESTLEISTUNGEN
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Best Finish */}
          <motion.div
            className="relative overflow-hidden rounded-xl border border-[#FFB800] p-6 text-center"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              boxShadow: '0 0 24px rgba(255,184,0,0.1)',
            }}
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            {/* Gold shimmer */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.08) 50%, transparent 100%)',
                  animation: 'shimmer 2s infinite',
                }}
              />
            </div>

            <div className="relative">
              <div className="flex justify-center mb-3">
                <TrendingUp className="w-6 h-6" style={{ color: '#FFB800' }} />
              </div>
              <h3
                className="text-xs font-semibold tracking-[0.1em] uppercase mb-2"
                style={{ color: '#55556B' }}
              >
                BESTER FINISH
              </h3>
              <div
                className="font-mono text-[3rem] font-medium leading-none tracking-[-0.03em]"
                style={{ color: '#FFB800' }}
              >
                P{bests.bestFinish.position}
              </div>
              <p className="mt-2 text-xs" style={{ color: '#8B8BA0' }}>
                {bests.bestFinish.track} &mdash; {formatDate(bests.bestFinish.date)}
              </p>
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: TEAM_COLORS[bests.bestFinish.team].bg,
                    color: TEAM_COLORS[bests.bestFinish.team].text,
                  }}
                >
                  {bests.bestFinish.team}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Fastest Lap */}
          <motion.div
            className="relative overflow-hidden rounded-xl border p-6 text-center"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              borderColor: '#2D2D3D',
            }}
            custom={1}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <div className="flex justify-center mb-3">
              <Zap className="w-6 h-6" style={{ color: '#FFB800' }} />
            </div>
            <h3
              className="text-xs font-semibold tracking-[0.1em] uppercase mb-2"
              style={{ color: '#55556B' }}
            >
              SCHNELLSTE RUNDE
            </h3>
            <div
              className="font-mono text-[3rem] font-medium leading-none tracking-[-0.03em]"
              style={{ color: '#FFB800' }}
            >
              {bests.fastestLap.bestLap}
            </div>
            <p className="mt-2 text-xs" style={{ color: '#8B8BA0' }}>
              {bests.fastestLap.track} &mdash; {formatDate(bests.fastestLap.date)}
            </p>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                style={{
                  backgroundColor: TEAM_COLORS[bests.fastestLap.team].bg,
                  color: TEAM_COLORS[bests.fastestLap.team].text,
                }}
              >
                {bests.fastestLap.team}
              </span>
            </div>
          </motion.div>

          {/* Best Strategy */}
          <motion.div
            className="relative overflow-hidden rounded-xl border p-6 text-center"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              borderColor: '#2D2D3D',
            }}
            custom={2}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <div className="flex justify-center mb-3">
              <Timer className="w-6 h-6" style={{ color: '#00D084' }} />
            </div>
            <h3
              className="text-xs font-semibold tracking-[0.1em] uppercase mb-2"
              style={{ color: '#55556B' }}
            >
              BESTE STRATEGIE
            </h3>
            <div
              className="font-mono text-[2rem] font-medium leading-none tracking-[-0.02em]"
              style={{ color: '#F0F0F5' }}
            >
              {bests.bestStrategy}
            </div>
            <p className="mt-2 text-xs" style={{ color: '#8B8BA0' }}>
              {bests.bestStrategyRate}% Siegrate
            </p>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="text-xs" style={{ color: '#00D084' }}>
                Meiste erfolgreiche Strategie
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
