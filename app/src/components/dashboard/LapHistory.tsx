import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, History } from 'lucide-react';
import type { LapHistoryEntry } from './data';
import { formatLapTime, getTireColor } from './data';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

interface LapHistoryProps {
  laps: LapHistoryEntry[];
  currentLap: number;
}

export default function LapHistory({ laps, currentLap }: LapHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="w-full border-t border-[#2D2D3D]"
    >
      {/* Accordion Trigger */}
      <motion.button
        className="w-full flex items-center justify-between px-6 py-3.5 transition-colors duration-200"
        style={{ backgroundColor: 'transparent' }}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" style={{ color: '#55556B' }} />
          <span
            className="text-xs font-semibold tracking-[0.1em] uppercase"
            style={{ color: '#F0F0F5' }}
          >
            RUNDENVERLAUF
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: easePrimary }}
        >
          <ChevronDown className="w-4 h-4" style={{ color: '#55556B' }} />
        </motion.div>
      </motion.button>

      {/* Collapsible Table */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: easePrimary }}
            className="overflow-hidden"
          >
            <div
              className="mx-6 mb-4 rounded-b-xl overflow-hidden"
              style={{
                backgroundColor: '#1E1E28',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {/* Table Header */}
              <div
                className="grid gap-2 px-4 py-3 sticky top-0 z-10"
                style={{
                  gridTemplateColumns: '60px 110px 80px 80px 1fr',
                  borderBottom: '1px solid #2D2D3D',
                  backgroundColor: '#1E1E28',
                }}
              >
                {['Runde', 'Rundenzeit', 'Reifen', 'Reifenalter', 'Notiz'].map(
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
              {laps.map((lap, i) => {
                const tireColor = getTireColor(lap.tire);
                const isCurrentLap = lap.lap === currentLap;
                return (
                  <motion.div
                    key={lap.lap}
                    className="grid gap-2 px-4 py-2.5 items-center transition-colors duration-150"
                    style={{
                      gridTemplateColumns: '60px 110px 80px 80px 1fr',
                      borderBottom: '1px solid rgba(45,45,61,0.35)',
                      backgroundColor: isCurrentLap
                        ? 'rgba(255,184,0,0.04)'
                        : 'transparent',
                      borderLeft: isCurrentLap
                        ? '2px solid #FFB800'
                        : '2px solid transparent',
                    }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: i * 0.04,
                      ease: easePrimary,
                    }}
                    whileHover={{ backgroundColor: '#2A2A38' }}
                  >
                    {/* Lap */}
                    <span
                      className="text-sm font-mono font-medium"
                      style={{ color: '#F0F0F5' }}
                    >
                      {lap.lap}
                    </span>

                    {/* Lap Time */}
                    <span
                      className="text-sm font-mono font-medium"
                      style={{ color: '#F0F0F5' }}
                    >
                      {formatLapTime(lap.time)}
                    </span>

                    {/* Tire */}
                    <span
                      className="inline-flex items-center justify-center rounded-full text-xs font-bold tracking-wider self-start mt-0.5"
                      style={{
                        backgroundColor: `${tireColor}26`,
                        border: `1px solid ${tireColor}66`,
                        color: tireColor,
                        minWidth: 40,
                        height: 22,
                        padding: '0 10px',
                      }}
                    >
                      {lap.tire === 'S'
                        ? 'SOFT'
                        : lap.tire === 'M'
                          ? 'MED'
                          : 'HARD'}
                    </span>

                    {/* Tire Age */}
                    <span
                      className="text-sm font-mono font-medium"
                      style={{ color: '#8B8BA0' }}
                    >
                      {lap.tireAge} Rdn.
                    </span>

                    {/* Comment */}
                    <span
                      className="text-xs italic"
                      style={{
                        color: lap.comment === '\u2014' ? '#55556B' : '#8B8BA0',
                      }}
                    >
                      {lap.comment}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
