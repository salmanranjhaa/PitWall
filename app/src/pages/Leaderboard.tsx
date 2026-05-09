import { motion } from 'framer-motion';
import StatsOverview from '@/components/leaderboard/StatsOverview';
import SortableTable from '@/components/leaderboard/SortableTable';
import TeamChart from '@/components/leaderboard/TeamChart';
import PersonalBests from '@/components/leaderboard/PersonalBests';

export default function Leaderboard() {
  return (
    <div
      className="min-h-[100dvh]"
      style={{
        backgroundColor: '#0F0F14',
        backgroundImage: `
          linear-gradient(135deg, #0A0A0F 0%, #141420 50%, #0A0A0F 100%),
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.01) 2px,
            rgba(255,255,255,0.01) 4px
          )
        `,
      }}
    >
      {/* Page Header */}
      <motion.div
        className="px-6 md:px-page pt-8 pb-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        <div className="max-w-[1200px] mx-auto">
          <h1
            className="text-[2.5rem] font-black tracking-[-0.02em] uppercase"
            style={{ color: '#F0F0F5' }}
          >
            RANGLISTE
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#8B8BA0' }}>
            Deine Simulationshistorie auf einen Blick
          </p>
        </div>
      </motion.div>

      {/* Stats Overview Cards */}
      <StatsOverview />

      {/* Results Table */}
      <SortableTable />

      {/* Team Performance Chart */}
      <TeamChart />

      {/* Personal Bests */}
      <PersonalBests />

      {/* Bottom spacer */}
      <div className="h-16" />
    </div>
  );
}
