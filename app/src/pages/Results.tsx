import { motion } from 'framer-motion';
import PodiumSection from '@/components/results/PodiumSection';
import StandingsTable from '@/components/results/StandingsTable';
import StrategyReview from '@/components/results/StrategyReview';
import PositionChart from '@/components/results/PositionChart';
import ActionButtons from '@/components/results/ActionButtons';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ─── Divider ──────────────────────────────────────────── */

function SectionDivider() {
  return (
    <div className="max-w-[1000px] mx-auto px-4 md:px-6">
      <div style={{ height: 1, backgroundColor: 'rgba(45,45,61,0.5)' }} />
    </div>
  );
}

/* ─── Main Results Page ────────────────────────────────── */

export default function Results() {
  return (
    <motion.div
      className="min-h-[calc(100dvh-56px-48px)]"
      style={{ backgroundColor: '#0F0F14' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: easePrimary }}
    >
      {/* 1. Hero Podium Section */}
      <PodiumSection />

      {/* Divider */}
      <SectionDivider />

      {/* 2. Final Standings Table */}
      <StandingsTable />

      {/* Divider */}
      <SectionDivider />

      {/* 3. Strategy Performance Review */}
      <StrategyReview />

      {/* Divider */}
      <SectionDivider />

      {/* 4. Race Replay - Position Chart */}
      <PositionChart />

      {/* 5. Action Buttons */}
      <ActionButtons />
    </motion.div>
  );
}
