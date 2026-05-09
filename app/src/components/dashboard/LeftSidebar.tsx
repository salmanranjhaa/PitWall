import { motion } from 'framer-motion';
import {
  Wrench,
  Thermometer,
  Check,
  ChevronRight,
  AlertTriangle,
  Zap,
  Flag,
} from 'lucide-react';
import {
  getTireWear,
  getWearColor,
  getTireCompoundLabel,
  getTireColor,
} from './data';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ─── Tire Wear Ring ────────────────────────────────────────────

function TireWearRing({ wear, size = 48 }: { wear: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (wear / 100) * circumference;
  const color = getWearColor(wear);

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Animated fill */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: easePrimary, delay: 0.3 }}
      />
    </svg>
  );
}

// ─── Tire Selection Card ───────────────────────────────────────

function TireSelectCard({
  label,
  color,
  isSelected,
  onSelect,
  index,
}: {
  label: string;
  color: string;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <motion.div
      className="relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        border: isSelected ? '2px solid #FFB800' : `2px solid ${color}`,
        borderLeft: isSelected ? '4px solid #FFD300' : `4px solid ${color}`,
        borderColor: isSelected ? '#FFB800' : `${color}`,
        background: isSelected
          ? 'rgba(255,184,0,0.06)'
          : 'transparent',
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.4 + index * 0.08, ease: easePrimary }}
      onClick={onSelect}
      whileHover={{
        borderColor: isSelected ? '#FFB800' : `${color}B3`,
        backgroundColor: isSelected ? 'rgba(255,184,0,0.08)' : 'rgba(255,255,255,0.02)',
      }}
    >
      {/* Gold shimmer for selected */}
      {isSelected && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.08) 50%, transparent 100%)',
            animation: 'shimmer 2s infinite',
          }}
        />
      )}

      <div className="flex items-center justify-between px-4 py-3 relative z-10">
        <span
          className="text-sm font-semibold tracking-[0.1em] uppercase"
          style={{ color: isSelected ? '#FFB800' : color }}
        >
          {label}
        </span>
        {isSelected ? (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,208,132,0.15)' }}
          >
            <Check className="w-4 h-4" style={{ color: '#00D084' }} />
          </div>
        ) : (
          <span
            className="text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-md cursor-pointer transition-all duration-200 hover:border-[rgba(255,184,0,0.35)]"
            style={{
              backgroundColor: '#1E1E28',
              border: '1px solid #2D2D3D',
              color: '#F0F0F5',
            }}
          >
            Wählen
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main LeftSidebar ──────────────────────────────────────────

interface LeftSidebarProps {
  currentTire: 'S' | 'M' | 'H';
  tireAge: number;
  pitStops: number;
  airTemp: number;
  selectedNextTire: 'S' | 'M' | 'H';
  onSelectNextTire: (compound: 'S' | 'M' | 'H') => void;
  onNextLap: () => void;
  onPitNow: () => void;
  countdown: number;
}

export default function LeftSidebar({
  currentTire,
  tireAge,
  pitStops,
  airTemp,
  selectedNextTire,
  onSelectNextTire,
  onNextLap,
  onPitNow,
  countdown,
}: LeftSidebarProps) {
  const wear = getTireWear(currentTire, tireAge);
  const wearColor = getWearColor(wear);
  const tireLabel = getTireCompoundLabel(currentTire);
  const tireColor = getTireColor(currentTire);

  const tireOptions: Array<{ id: 'S' | 'M' | 'H'; label: string; color: string }> = [
    { id: 'S', label: 'SOFT', color: '#E8103A' },
    { id: 'M', label: 'MEDIUM', color: '#FFD300' },
    { id: 'H', label: 'HARD', color: '#F5F5F5' },
  ];

  return (
    <motion.div
      className="flex flex-col gap-5 p-6 border-r border-[#2D2D3D] overflow-y-auto"
      style={{
        width: 280,
        minWidth: 280,
        backgroundColor: 'transparent',
      }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: easePrimary }}
    >
      {/* ── Tire Status Card ── */}
      <div>
        <p
          className="text-xs font-semibold tracking-[0.1em] uppercase mb-2"
          style={{ color: '#55556B' }}
        >
          AKTUELLER REIFEN
        </p>
        <div className="flex items-center gap-4">
          {/* Tire compound badge + wear ring */}
          <div className="relative">
            <TireWearRing wear={wear} size={48} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[10px] font-bold tracking-wider"
                style={{ color: tireColor }}
              >
                {currentTire}
              </span>
            </div>
          </div>
          <div>
            <span
              className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider uppercase"
              style={{
                backgroundColor: `${tireColor}26`,
                border: `1px solid ${tireColor}`,
                color: tireColor,
              }}
            >
              {tireLabel}
            </span>
            <p
              className="text-sm font-mono font-medium mt-1"
              style={{ color: '#8B8BA0' }}
            >
              {tireAge} Rdn.
            </p>
          </div>
        </div>
        {/* Wear bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: '#55556B' }}>
              Verschleiß
            </span>
            <span className="text-xs font-mono font-medium" style={{ color: wearColor }}>
              {Math.round(wear)}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: wearColor }}
              initial={{ width: 0 }}
              animate={{ width: `${wear}%` }}
              transition={{ duration: 0.8, ease: easePrimary, delay: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* ── Pit Stops & Air Temp ── */}
      <div
        className="grid grid-cols-2 gap-3"
      >
        {/* Pit Stops */}
        <div
          className="rounded-lg px-4 py-3"
          style={{ backgroundColor: '#1E1E28' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Wrench className="w-3.5 h-3.5" style={{ color: '#55556B' }} />
            <span
              className="text-[11px] font-semibold tracking-wider uppercase"
              style={{ color: '#55556B' }}
            >
              Boxenstopps
            </span>
          </div>
          <span
            className="text-[2rem] font-mono font-medium tracking-[-0.02em] leading-none"
            style={{ color: '#F0F0F5' }}
          >
            {pitStops}
          </span>
        </div>
        {/* Air Temp */}
        <div
          className="rounded-lg px-4 py-3"
          style={{ backgroundColor: '#1E1E28' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Thermometer className="w-3.5 h-3.5" style={{ color: '#55556B' }} />
            <span
              className="text-[11px] font-semibold tracking-wider uppercase"
              style={{ color: '#55556B' }}
            >
              Lufttemp.
            </span>
          </div>
          <span
            className="text-[2rem] font-mono font-medium tracking-[-0.02em] leading-none"
            style={{ color: '#F0F0F5' }}
          >
            {airTemp}°C
          </span>
        </div>
      </div>

      {/* ── Auto-Advance Timer ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: '#55556B' }}
          >
            Automatisch weiter
          </span>
          <span
            className="text-sm font-mono font-medium"
            style={{ color: '#FFB800' }}
          >
            in {countdown.toFixed(1)}s
          </span>
        </div>
        <div
          className="h-0.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: '#FFB800' }}
            initial={{ width: '100%' }}
            animate={{ width: `${(countdown / 3) * 100}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
      </div>

      {/* ── Tire Selection ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" style={{ color: '#FFB800' }} />
          <span
            className="text-xs font-semibold tracking-[0.1em] uppercase"
            style={{ color: '#F0F0F5' }}
          >
            Reifenwahl Boxenstopp
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {tireOptions.map((option, i) => (
            <TireSelectCard
              key={option.id}
              label={option.label}
              color={option.color}
              isSelected={selectedNextTire === option.id}
              onSelect={() => onSelectNextTire(option.id)}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* ── AI Recommendation ── */}
      <motion.div
        className="relative rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
          border: '1px solid #2D2D3D',
          borderTop: '3px solid #FFB800',
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6, ease: easePrimary }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.08) 50%, transparent 100%)',
            animation: 'shimmer 2s infinite',
          }}
        />
        <div className="p-4 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4" style={{ color: '#FFB800' }} />
            <span
              className="text-xs font-semibold tracking-[0.1em] uppercase"
              style={{ color: '#FFB800' }}
            >
              EMPFEHLUNG
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#F0F0F5' }}>
            Empfehlung für{' '}
            <span className="font-semibold" style={{ color: '#FFB800' }}>
              MEDIUM
            </span>
            : Pitstop in Runde{' '}
            <span className="font-semibold" style={{ color: '#FFB800' }}>
              28
            </span>
          </p>
        </div>
      </motion.div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-col gap-3 mt-2">
        {/* Nächste Runde */}
        <motion.button
          className="w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-xs font-semibold tracking-[0.1em] uppercase transition-all duration-200"
          style={{
            backgroundColor: '#16161E',
            border: '1px solid #2D2D3D',
            color: '#F0F0F5',
          }}
          onClick={onNextLap}
          whileHover={{
            borderColor: 'rgba(255,184,0,0.35)',
            color: '#FFB800',
          }}
          whileTap={{ scale: 0.98 }}
        >
          NÄCHSTE RUNDE
          <ChevronRight className="w-4 h-4" />
        </motion.button>

        {/* PIT NOW */}
        <motion.button
          className="w-full flex items-center justify-center gap-2 rounded-lg px-6 py-4 text-xs font-semibold tracking-[0.1em] uppercase text-white relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #CC0000 0%, #FF1E00 50%, #CC0000 100%)',
            boxShadow: '0 4px 16px rgba(255,30,0,0.3)',
            height: 52,
          }}
          onClick={onPitNow}
          whileHover={{
            scale: 1.02,
            boxShadow: '0 8px 30px rgba(255,30,0,0.45)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.1) 50%, transparent 100%)',
              animation: 'shimmer 1.5s infinite',
            }}
          />
          <Flag className="w-4 h-4 relative z-10" />
          <span className="relative z-10">PIT NOW</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
