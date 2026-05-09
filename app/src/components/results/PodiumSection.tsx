import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import Confetti from './Confetti';
import { raceResults, getTeamById } from './mockData';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeDramatic = [0.87, 0, 0.13, 1] as [number, number, number, number];

/* ─── Podium Step Component ────────────────────────────── */

interface PodiumStepProps {
  position: number;
  teamId: string;
  driverCode: string;
  raceTime: string;
  gap: string;
  height: number;
  delay: number;
  medalColor: string;
  borderColor: string;
  bgGradient: string;
  iconSize: number;
  isWinner?: boolean;
}

function PodiumStep({
  position,
  teamId,
  driverCode,
  raceTime,
  gap,
  height,
  delay,
  medalColor,
  borderColor,
  bgGradient,
  iconSize,
  isWinner = false,
}: PodiumStepProps) {
  const team = getTeamById(teamId);
  const medalSrc = position === 1 ? './podium-1st.svg' : position === 2 ? './podium-2nd.svg' : './podium-3rd.svg';

  return (
    <div className="flex flex-col items-center" style={{ order: position === 1 ? 2 : position === 2 ? 1 : 3 }}>
      {/* Driver info above step */}
      <motion.div
        className="flex flex-col items-center mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: delay + 0.8, ease: easePrimary }}
      >
        {isWinner && (
          <Crown className="mb-1" style={{ width: 16, height: 16, color: '#FFB800' }} />
        )}
        <img
          src={team?.logo}
          alt={team?.shortName}
          style={{ width: iconSize, height: iconSize }}
          className="mb-1"
        />
        <span
          className="text-[0.875rem] font-semibold tracking-[0.1em] uppercase"
          style={{ color: medalColor }}
        >
          {team?.shortName}
        </span>
        <span className="text-xs" style={{ color: '#55556B' }}>
          {driverCode}
        </span>
        <span
          className="text-sm font-medium tracking-[-0.02em] mt-0.5"
          style={{ color: '#F0F0F5', fontFamily: "'Geist Mono', monospace" }}
        >
          {position === 1 ? raceTime : gap}
        </span>
      </motion.div>

      {/* Medal icon */}
      <motion.img
        src={medalSrc}
        alt={`${position}. Platz`}
        style={{
          width: position === 1 ? 48 : position === 2 ? 40 : 36,
          height: position === 1 ? 48 : position === 2 ? 40 : 36,
          marginBottom: 12,
          filter: `drop-shadow(0 0 8px ${medalColor}40)`,
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.6, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
      />

      {/* Step column */}
      <motion.div
        className="w-full min-w-[120px] sm:min-w-[160px] md:min-w-[200px] flex items-end justify-center"
        style={{
          borderRadius: '12px 12px 0 0',
          border: `1px solid ${borderColor}`,
          borderBottom: 'none',
          background: bgGradient,
          originY: 1,
        }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height, opacity: 1 }}
        transition={{
          height: { duration: 0.8, delay, ease: easeDramatic },
          opacity: { duration: 0.4, delay },
        }}
      >
        <span
          className="text-2xl font-black tracking-[-0.02em] mb-4"
          style={{ color: medalColor, opacity: 0.3 }}
        >
          {position}
        </span>
      </motion.div>
    </div>
  );
}

/* ─── Main Podium Section ──────────────────────────────── */

export default function PodiumSection() {
  const top3 = raceResults.slice(0, 3);

  return (
    <section
      className="relative min-h-[480px] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: '#0A0A0F',
      }}
    >
      {/* Background layers */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(./podium-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.4,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(255,30,0,0.08) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #141420 50%, #0A0A0F 100%)',
          opacity: 0.6,
        }}
      />

      {/* Confetti */}
      <Confetti />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-16 pb-8">
        {/* Title */}
        <motion.h1
          className="text-[2.5rem] font-black tracking-[-0.02em] uppercase text-center"
          style={{ color: '#F0F0F5' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easePrimary }}
        >
          {'RENNERGEBNIS'.split('').map((char, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: i * 0.025,
                ease: easePrimary,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mt-2 text-base"
          style={{ color: '#8B8BA0' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          Belgian Grand Prix — 44 Runden
        </motion.p>

        {/* Status badge */}
        <motion.div
          className="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold tracking-[0.1em] uppercase"
          style={{
            backgroundColor: 'rgba(255,184,0,0.15)',
            color: '#FFB800',
            border: '1px solid rgba(255,184,0,0.3)',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.7, ease: easePrimary }}
        >
          RENNEN BEENDET
        </motion.div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 mt-10">
          {/* 2nd Place */}
          <PodiumStep
            position={2}
            teamId={top3[1].teamId}
            driverCode={top3[1].driverCode}
            raceTime={top3[1].raceTime}
            gap={top3[1].gap}
            height={160}
            delay={0}
            medalColor="#C0C0C0"
            borderColor="rgba(192,192,192,0.3)"
            bgGradient="linear-gradient(180deg, rgba(192,192,192,0.1) 0%, rgba(192,192,192,0.03) 100%)"
            iconSize={32}
          />

          {/* 1st Place */}
          <PodiumStep
            position={1}
            teamId={top3[0].teamId}
            driverCode={top3[0].driverCode}
            raceTime={top3[0].raceTime}
            gap={top3[0].gap}
            height={200}
            delay={0.15}
            medalColor="#FFB800"
            borderColor="rgba(255,184,0,0.4)"
            bgGradient="linear-gradient(180deg, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0.05) 100%)"
            iconSize={36}
            isWinner
          />

          {/* 3rd Place */}
          <PodiumStep
            position={3}
            teamId={top3[2].teamId}
            driverCode={top3[2].driverCode}
            raceTime={top3[2].raceTime}
            gap={top3[2].gap}
            height={130}
            delay={0.3}
            medalColor="#CD7F32"
            borderColor="rgba(205,127,50,0.3)"
            bgGradient="linear-gradient(180deg, rgba(205,127,50,0.1) 0%, rgba(205,127,50,0.03) 100%)"
            iconSize={28}
          />
        </div>
      </div>
    </section>
  );
}
