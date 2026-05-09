import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import StatsRow from '@/components/dashboard/StatsRow';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import LapChart from '@/components/dashboard/LapChart';
import LeaderboardTable from '@/components/dashboard/LeaderboardTable';
import LapHistory from '@/components/dashboard/LapHistory';
import {
  TOTAL_LAPS,
  fullLapData,
  initialLeaderboard,
  lapHistoryData,
  type LeaderboardEntry,
  type LapHistoryEntry,
} from '@/components/dashboard/data';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function Dashboard() {
  // ─── State ───────────────────────────────────────────────────
  const [currentLap, setCurrentLap] = useState(4);
  const [currentTire, setCurrentTire] = useState<'S' | 'M' | 'H'>('S');
  const [tireAge, setTireAge] = useState(3);
  const [pitStops, setPitStops] = useState(0);
  const [selectedNextTire, setSelectedNextTire] = useState<'S' | 'M' | 'H'>('M');
  const [countdown, setCountdown] = useState(3.0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard);
  const [lapHistory, setLapHistory] = useState<LapHistoryEntry[]>(lapHistoryData);

  // Player team (Mercedes, P1)
  const playerTeam: LeaderboardEntry = {
    position: 1,
    team: 'Mercedes',
    teamColor: '#00F5D4',
    tire: currentTire,
    tireAge,
    lastLap: 117.041,
    stops: pitStops,
    gap: '\u2014',
    isPlayer: true,
  };

  // ─── Countdown Timer ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0.1) {
          return 3.0;
        }
        return prev - 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // ─── Handlers ────────────────────────────────────────────────

  const handleNextLap = useCallback(() => {
    if (currentLap >= TOTAL_LAPS) return;

    const newLap = currentLap + 1;
    setCurrentLap(newLap);
    setTireAge((prev) => prev + 1);
    setCountdown(3.0);

    // Update lap history
    const newHistoryEntry: LapHistoryEntry = {
      lap: newLap,
      time: 116.8 + Math.random() * 0.8,
      tire: currentTire,
      tireAge: tireAge + 1,
      comment: '\u2014',
    };
    setLapHistory((prev) => [newHistoryEntry, ...prev]);

    // Update leaderboard with slight variations
    setLeaderboard((prev) =>
      prev.map((entry) => {
        const baseTime = entry.lastLap;
        const variation = (Math.random() - 0.5) * 0.3;
        return {
          ...entry,
          lastLap: Math.max(116.5, baseTime + variation),
          tireAge: entry.isPlayer ? tireAge + 1 : entry.tireAge + 1,
        };
      })
    );
  }, [currentLap, currentTire, tireAge]);

  const handlePitNow = useCallback(() => {
    const newPitStops = pitStops + 1;
    setPitStops(newPitStops);
    setCurrentTire(selectedNextTire);
    setTireAge(0);
    setCountdown(3.0);

    // Add pitstop comment to history
    setLapHistory((prev) =>
      prev.map((entry, i) =>
        i === 0
          ? { ...entry, comment: 'Pitstop', tire: selectedNextTire, tireAge: 0 }
          : entry
      )
    );

    // Update leaderboard
    setLeaderboard((prev) =>
      prev.map((entry) =>
        entry.isPlayer
          ? { ...entry, tire: selectedNextTire, tireAge: 0, stops: newPitStops }
          : entry
      )
    );
  }, [pitStops, selectedNextTire]);

  const handleSelectNextTire = useCallback((compound: 'S' | 'M' | 'H') => {
    setSelectedNextTire(compound);
  }, []);

  // ─── Chart Data (only show up to current lap) ────────────────
  const chartData = fullLapData.slice(0, currentLap);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col w-full overflow-hidden"
      style={{
        minHeight: 'calc(100dvh - 56px)',
        backgroundColor: '#0F0F14',
      }}
    >
      {/* Stats Row */}
      <StatsRow
        currentLap={currentLap}
        totalLaps={TOTAL_LAPS}
        lastLapTime={lapHistory[0]?.time ?? 117.041}
        position={1}
        playerTeam={playerTeam}
      />

      {/* Three-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <LeftSidebar
          currentTire={currentTire}
          tireAge={tireAge}
          pitStops={pitStops}
          airTemp={16}
          selectedNextTire={selectedNextTire}
          onSelectNextTire={handleSelectNextTire}
          onNextLap={handleNextLap}
          onPitNow={handlePitNow}
          countdown={countdown}
        />

        {/* Center - Lap Chart */}
        <div className="flex-1 p-6 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <LapChart
              data={chartData}
              teamColor="#00F5D4"
              totalLaps={TOTAL_LAPS}
            />
          </div>

          {/* Spacer to push lap history to bottom */}
          <div className="flex-1 min-h-[80px]" />

          {/* AI Recommendation Panel (center-bottom) */}
          <motion.div
            className="relative rounded-lg overflow-hidden mb-4 mx-0"
            style={{
              background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
              border: '1px solid #2D2D3D',
              borderTop: '3px solid #FFB800',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6, ease: easePrimary }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.08) 50%, transparent 100%)',
                animation: 'shimmer 2s infinite',
              }}
            />
            <div className="p-4 relative z-10 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="#FFB800" />
                </svg>
                <span
                  className="text-xs font-semibold tracking-[0.1em] uppercase"
                  style={{ color: '#FFB800' }}
                >
                  KI-STRATEGIE
                </span>
              </div>
              <p className="text-sm" style={{ color: '#F0F0F5' }}>
                Empfehlung für{' '}
                <span className="font-semibold" style={{ color: '#FFB800' }}>
                  {selectedNextTire === 'S' ? 'SOFT' : selectedNextTire === 'M' ? 'MEDIUM' : 'HARD'}
                </span>
                : Pitstop in Runde{' '}
                <span className="font-semibold" style={{ color: '#FFB800' }}>
                  {currentTire === 'S' ? 12 : currentTire === 'M' ? 28 : 44}
                </span>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Right Sidebar - Leaderboard */}
        <LeaderboardTable entries={leaderboard} />
      </div>

      {/* Bottom - Lap History (Collapsible) */}
      <LapHistory laps={lapHistory} currentLap={currentLap} />
    </div>
  );
}
