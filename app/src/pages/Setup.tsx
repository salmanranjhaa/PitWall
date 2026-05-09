import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

/* ─── Data ────────────────────────────────────────────── */

const teams = [
  {
    id: 'ferrari',
    name: 'SCUDERIA FERRARI',
    color: '#FF1E00',
    logo: './ferrari-badge.svg',
    car: './car-ferrari.png',
  },
  {
    id: 'mercedes',
    name: 'MERCEDES-AMG PETRONAS',
    color: '#00F5D4',
    logo: './team-mercedes.svg',
    car: './car-mercedes.png',
  },
  {
    id: 'redbull',
    name: 'RED BULL RACING',
    color: '#0033A0',
    logo: './team-redbull.svg',
    car: './car-redbull.png',
  },
  {
    id: 'mclaren',
    name: 'MCLAREN F1 TEAM',
    color: '#FF8700',
    logo: './team-mclaren.svg',
    car: './car-mclaren.png',
  },
  {
    id: 'williams',
    name: 'WILLIAMS RACING',
    color: '#00A0DE',
    logo: './team-williams.svg',
    car: './car-williams.png',
  },
];

const tracks = [
  { id: 'belgium', name: 'Belgian Grand Prix', laps: 44, image: './track-belgium.png' },
  { id: 'monza', name: 'Italian Grand Prix', laps: 53, image: './track-monza.png' },
  { id: 'silverstone', name: 'British Grand Prix', laps: 52, image: './track-silverstone.png' },
  { id: 'suzuka', name: 'Japanese Grand Prix', laps: 53, image: './track-suzuka.png' },
  { id: 'spa', name: 'Spa-Francorchamps', laps: 44, image: './track-spa.png' },
];

const tireOptions = [
  {
    id: 'soft',
    label: 'SOFT',
    color: '#E8103A',
    description: 'Schnell, aber geringe Haltbarkeit',
    image: './tire-soft.png',
  },
  {
    id: 'medium',
    label: 'MEDIUM',
    color: '#FFD300',
    description: 'Ausgewogenes Profil',
    image: './tire-medium.png',
  },
  {
    id: 'hard',
    label: 'HARD',
    color: '#F5F5F5',
    description: 'Langlebig, langsamer',
    image: './tire-hard.png',
  },
];

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeBounce = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

/* ─── Hero Section ────────────────────────────────────── */

function HeroSection() {
  const titleChars = 'NEUE SIMULATION'.split('');

  return (
    <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 red-flare pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
          opacity: 0.3,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        {/* F1 Logo */}
        <motion.img
          src="./f1-logo.svg"
          alt="F1"
          className="w-12 h-auto mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: easePrimary }}
        />

        {/* Hero Label */}
        <motion.p
          className="text-sm font-semibold tracking-[0.2em] uppercase mb-4"
          style={{ color: '#FFB800' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3, ease: easePrimary }}
        >
          RACE STRATEGY SIMULATOR
        </motion.p>

        {/* Hero Title with kinetic typography */}
        <h1 className="overflow-hidden">
          {titleChars.map((char, i) => (
            <motion.span
              key={i}
              className="inline-block text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-black tracking-[-0.02em] uppercase"
              style={{
                color: '#F0F0F5',
                textShadow: '0 0 80px rgba(255,30,0,0.15)',
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.5 + i * 0.03,
                ease: easePrimary,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </h1>

        {/* Hero Subtitle */}
        <motion.p
          className="mt-5 text-base max-w-[520px] leading-relaxed"
          style={{ color: '#8B8BA0' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0, ease: easePrimary }}
        >
          Triff die richtigen Entscheidungen. Schlage die Konkurrenz. Fuhre dein Team zum Sieg.
        </motion.p>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <motion.div
          className="w-px h-10 bg-[#FFB800]"
          style={{ opacity: 0.4 }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-transparent"
          style={{ borderTopColor: 'rgba(255,184,0,0.4)' }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </section>
  );
}

/* ─── Team Card ───────────────────────────────────────── */

function TeamCard({
  team,
  isSelected,
  onSelect,
  index,
}: {
  team: (typeof teams)[number];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: easePrimary,
      }}
      onClick={onSelect}
      className={cn(
        'relative cursor-pointer rounded-xl overflow-hidden transition-all duration-250',
        'bg-gradient-to-br from-[#16161E] to-[#13131A]'
      )}
      style={{
        border: isSelected
          ? `2px solid ${team.color}`
          : `2px solid ${team.color}66`,
        boxShadow: isSelected
          ? `0 0 24px ${team.color}33`
          : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      whileHover={{
        y: -4,
        boxShadow: `0 8px 24px ${team.color}1a`,
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-[3px] w-full"
        style={{ backgroundColor: team.color }}
      />

      {/* Gold shimmer for selected state */}
      {isSelected && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.12) 50%, transparent 100%)',
              animation: 'shimmer 2s infinite',
            }}
          />
        </div>
      )}

      <div className="p-6 flex flex-col items-center text-center gap-4">
        {/* Team Logo */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            boxShadow: `0 0 24px ${team.color}33`,
          }}
        >
          <img
            src={team.logo}
            alt={team.name}
            className="w-10 h-10 object-contain"
          />
        </div>

        {/* Team Name */}
        <h3
          className="text-sm font-semibold tracking-[0.08em] uppercase"
          style={{ color: team.color }}
        >
          {team.name}
        </h3>

        {/* Car Image */}
        <div className="relative w-full flex justify-center">
          <img
            src={team.car}
            alt={`${team.name} car`}
            className="w-[200px] h-auto object-contain"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Reflection */}
          <div
            className="absolute top-full w-[200px] h-[40px] overflow-hidden pointer-events-none"
            style={{ opacity: 0.1 }}
          >
            <img
              src={team.car}
              alt=""
              className="w-[200px] h-auto object-contain"
              style={{ transform: 'scaleX(-1) scaleY(-1)' }}
            />
          </div>
        </div>

        {/* Select Button / Checkmark */}
        <div className="mt-2 w-full">
          {isSelected ? (
            <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-[rgba(0,208,132,0.15)] border border-[#00D084]">
              <Check className="w-4 h-4 text-[#00D084]" />
              <span className="text-sm font-semibold tracking-[0.08em] uppercase text-[#00D084]">
                AUSGEWAHLT
              </span>
            </div>
          ) : (
            <div
              className="py-2 rounded-lg text-center transition-all duration-200 hover:border-[rgba(255,184,0,0.35)] hover:bg-[rgba(255,184,0,0.06)]"
              style={{
                backgroundColor: '#16161E',
                border: '1px solid #2D2D3D',
              }}
            >
              <span className="text-sm font-semibold tracking-[0.08em] uppercase text-[#F0F0F5]">
                WAHLEN
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Tire Card ───────────────────────────────────────── */

function TireCard({
  tire,
  isSelected,
  onSelect,
  index,
}: {
  tire: (typeof tireOptions)[number];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.4,
        delay: index * 0.08,
        ease: easePrimary,
      }}
      onClick={onSelect}
      className={cn(
        'relative cursor-pointer rounded-[10px] p-4 transition-all duration-200',
        'flex flex-col items-center text-center gap-2'
      )}
      style={{
        backgroundColor: '#1E1E28',
        border: isSelected
          ? `2px solid ${tire.color}`
          : `2px solid ${tire.color}66`,
      }}
      whileHover={{
        borderColor: `${tire.color}b3`,
      }}
    >
      {/* Selected checkmark */}
      {isSelected && (
        <motion.div
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00D084] flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2, ease: easeBounce }}
        >
          <Check className="w-3 h-3 text-white" />
        </motion.div>
      )}

      {/* Tire Image */}
      <img src={tire.image} alt={tire.label} className="w-12 h-12 object-contain" />

      {/* Label */}
      <span
        className="text-sm font-semibold tracking-[0.1em] uppercase"
        style={{ color: tire.color }}
      >
        {tire.label}
      </span>

      {/* Description */}
      <span className="text-xs" style={{ color: '#55556B' }}>
        {tire.description}
      </span>
    </motion.div>
  );
}

/* ─── Main Setup Page ─────────────────────────────────── */

export default function Setup() {
  const navigate = useNavigate();
  const paramsRef = useRef(null);
  const isParamsInView = useInView(paramsRef, { once: true, amount: 0.25 });
  const briefingRef = useRef(null);
  const isBriefingInView = useInView(briefingRef, { once: true, amount: 0.3 });

  // State
  const [selectedTeam, setSelectedTeam] = useState('mercedes');
  const [selectedTrack, setSelectedTrack] = useState('belgium');
  const [selectedTire, setSelectedTire] = useState('soft');
  const [temperature, setTemperature] = useState([16]);
  const [isStarting, setIsStarting] = useState(false);

  const currentTrack = tracks.find((t) => t.id === selectedTrack) || tracks[0];

  const handleStartSimulation = () => {
    setIsStarting(true);
    setTimeout(() => {
      navigate('/dashboard');
    }, 1200);
  };

  // Temperature value
  const tempValue = temperature[0];

  return (
    <div>
      {/* ─── HERO ────────────────────────────── */}
      <HeroSection />

      <div className="px-4 sm:px-6 lg:px-12 py-8" style={{ backgroundColor: '#0F0F14' }}>
        {/* ─── TEAM SELECTION ──────────────────── */}
        <section className="mb-8">
          {/* Section Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, ease: easePrimary }}
          >
            <p className="text-sm font-semibold tracking-[0.1em] uppercase mb-2" style={{ color: '#55556B' }}>
              02 / KONFIGURATION
            </p>
            <h2 className="text-2xl font-semibold tracking-[0.05em] uppercase text-[#F0F0F5]">
              TEAM WAHLEN
            </h2>
            <p className="mt-1 text-sm" style={{ color: '#8B8BA0' }}>
              Wahle dein Team fur die kommende Saison.
            </p>
          </motion.div>

          {/* Team Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {teams.map((team, i) => (
              <TeamCard
                key={team.id}
                team={team}
                isSelected={selectedTeam === team.id}
                onSelect={() => setSelectedTeam(team.id)}
                index={i}
              />
            ))}
          </div>
        </section>

        {/* ─── RACE PARAMETERS ─────────────────── */}
        <section className="mb-8" ref={paramsRef}>
          {/* Section Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, x: -20 }}
            animate={isParamsInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.4, ease: easePrimary }}
          >
            <p className="text-sm font-semibold tracking-[0.1em] uppercase mb-2" style={{ color: '#55556B' }}>
              02 / RENNPARAMETER
            </p>
            <h2 className="text-2xl font-semibold tracking-[0.05em] uppercase text-[#F0F0F5]">
              RENNPARAMETER
            </h2>
          </motion.div>

          {/* Parameters Container */}
          <motion.div
            className="rounded-2xl p-6 md:p-8"
            style={{
              backgroundColor: '#16161E',
              border: '1px solid #2D2D3D',
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={isParamsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: easePrimary }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Track Selection */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={isParamsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.1, ease: easePrimary }}
              >
                <label
                  className="block text-sm font-semibold tracking-[0.1em] uppercase mb-2"
                  style={{ color: '#55556B' }}
                >
                  STRECKE
                </label>
                <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                  <SelectTrigger
                    className="w-full h-auto py-3 px-4 rounded-lg text-[#F0F0F5] text-sm"
                    style={{
                      backgroundColor: '#1E1E28',
                      border: '1px solid #2D2D3D',
                    }}
                  >
                    <SelectValue placeholder="Strecke wahlen" />
                  </SelectTrigger>
                  <SelectContent
                    className="rounded-lg border-[#2D2D3D]"
                    style={{
                      backgroundColor: '#16161E',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                  >
                    {tracks.map((track) => (
                      <SelectItem
                        key={track.id}
                        value={track.id}
                        className="py-3 px-4 text-[#F0F0F5] text-sm cursor-pointer hover:bg-[#2A2A38] focus:bg-[#2A2A38] focus:text-[#F0F0F5]"
                      >
                        <div className="flex items-center justify-between w-full gap-8">
                          <span>{track.name}</span>
                          <span className="text-xs" style={{ color: '#55556B' }}>
                            {track.laps} Runden
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Track Preview */}
                <div className="mt-4">
                  <img
                    src={currentTrack.image}
                    alt={currentTrack.name}
                    className="w-full max-w-[160px] h-auto rounded-lg object-contain"
                    style={{ opacity: 0.6 }}
                  />
                </div>
              </motion.div>

              {/* Starting Tire Selection */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={isParamsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.2, ease: easePrimary }}
              >
                <label
                  className="block text-sm font-semibold tracking-[0.1em] uppercase mb-3"
                  style={{ color: '#55556B' }}
                >
                  STARTREIFEN
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {tireOptions.map((tire, i) => (
                    <TireCard
                      key={tire.id}
                      tire={tire}
                      isSelected={selectedTire === tire.id}
                      onSelect={() => setSelectedTire(tire.id)}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Air Temperature Slider */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={isParamsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3, ease: easePrimary }}
              >
                <div className="flex items-center justify-between mb-4">
                  <label
                    className="text-sm font-semibold tracking-[0.1em] uppercase"
                    style={{ color: '#55556B' }}
                  >
                    LUFTTEMPERATUR
                  </label>
                  <span
                    className="text-2xl font-medium tracking-[-0.02em] font-mono"
                    style={{ color: '#F0F0F5' }}
                  >
                    {tempValue}
                    <span className="text-lg">°C</span>
                  </span>
                </div>

                <div className="pt-2">
                  <Slider
                    value={temperature}
                    onValueChange={setTemperature}
                    min={10}
                    max={45}
                    step={1}
                    className="w-full"
                  />
                  {/* Custom slider styling */}
                  <style>{`
                    [data-slot="slider-track"] {
                      height: 4px !important;
                      background: rgba(255,255,255,0.08) !important;
                      border-radius: 2px !important;
                    }
                    [data-slot="slider-range"] {
                      background: linear-gradient(90deg, #0057B7 0%, #FFD300 50%, #FF1E00 100%) !important;
                      border-radius: 2px !important;
                    }
                    [data-slot="slider-thumb"] {
                      width: 20px !important;
                      height: 20px !important;
                      background-color: #16161E !important;
                      border: 2px solid #FFB800 !important;
                      box-shadow: 0 0 8px rgba(255,184,0,0.3) !important;
                    }
                    [data-slot="slider-thumb"]:hover {
                      transform: scale(1.2) !important;
                    }
                  `}</style>
                </div>

                {/* Temperature color indicator */}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs" style={{ color: '#55556B' }}>
                    10°C
                  </span>
                  <span className="text-xs" style={{ color: '#55556B' }}>
                    45°C
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ─── AI STRATEGY BRIEFING ────────────── */}
        <section className="mb-8" ref={briefingRef}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isBriefingInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, ease: easePrimary }}
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem
                value="strategy"
                className="rounded-[10px] overflow-hidden border-[#2D2D3D]"
                style={{ border: '1px solid #2D2D3D' }}
              >
                <div
                  className="h-[3px] w-full"
                  style={{ backgroundColor: '#FFB800' }}
                />
                <AccordionTrigger
                  className="px-5 py-4 hover:no-underline text-[#FFB800] text-sm font-semibold tracking-[0.1em] uppercase"
                  style={{
                    backgroundColor: '#16161E',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src="./ai-sparkle.svg"
                      alt="AI"
                      className="w-5 h-5"
                    />
                    <span>KI: Smarte Strategie-Vorhersage</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent
                  className="px-6 py-5"
                  style={{
                    backgroundColor: '#1E1E28',
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10,
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <p className="text-base mb-4 text-[#F0F0F5]">
                      Basierend auf den gewahlten Parametern empfiehlt die KI folgende Strategie:
                    </p>

                    {/* Key metrics */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      {[
                        { label: 'Optimaler Reifen:', value: 'MEDIUM', color: '#FFD300' },
                        { label: 'Erster Stopp:', value: 'Runde 18-22', color: '#FFB800' },
                        { label: 'Geschatzte Rennzeit:', value: '1:23:45', color: '#FFB800' },
                      ].map((chip) => (
                        <div
                          key={chip.label}
                          className="px-3 py-1.5 rounded-md text-sm"
                          style={{
                            backgroundColor: '#16161E',
                            border: '1px solid #2D2D3D',
                          }}
                        >
                          <span className="text-[#8B8BA0]">{chip.label} </span>
                          <span className="font-mono font-medium" style={{ color: chip.color }}>
                            {chip.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <ul className="space-y-2 mb-4">
                      <li className="flex items-start gap-2 text-sm text-[#8B8BA0]">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-[#FFB800] shrink-0" />
                        Bei Temperaturen uber 30°C: Fruherer Stopp empfohlen
                      </li>
                      <li className="flex items-start gap-2 text-sm text-[#8B8BA0]">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-[#FFB800] shrink-0" />
                        Soft-Reifen verschleissen schneller bei hoher Temperatur
                      </li>
                    </ul>

                    {/* Confidence bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: '#55556B' }}>
                          KI Konfidenz
                        </span>
                        <span className="text-xs font-mono" style={{ color: '#55556B' }}>
                          87%
                        </span>
                      </div>
                      <div
                        className="h-1 rounded-full overflow-hidden"
                        style={{ backgroundColor: '#2D2D3D' }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: '#FFB800' }}
                          initial={{ width: 0 }}
                          animate={{ width: '87%' }}
                          transition={{ duration: 0.8, delay: 0.3, ease: easePrimary }}
                        />
                      </div>
                    </div>
                  </motion.div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </section>

        {/* ─── LAUNCH ACTION ───────────────────── */}
        <section className="flex justify-center py-8">
          <motion.button
            onClick={handleStartSimulation}
            disabled={isStarting}
            className="relative overflow-hidden flex items-center justify-center gap-3 rounded-xl px-12 py-5 min-w-[360px] transition-all duration-250 disabled:opacity-90 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #CC0000 0%, #FF1E00 50%, #DC0000 100%)',
              boxShadow: isStarting
                ? '0 4px 16px rgba(255,30,0,0.2)'
                : '0 8px 32px rgba(255,30,0,0.35), 0 0 60px rgba(255,30,0,0.1)',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: easeBounce }}
            whileHover={
              isStarting
                ? {}
                : {
                    scale: 1.04,
                    boxShadow:
                      '0 12px 40px rgba(255,30,0,0.45), 0 0 80px rgba(255,30,0,0.15)',
                  }
            }
            whileTap={isStarting ? {} : { scale: 0.97 }}
          >
            {/* Shimmer overlay */}
            {!isStarting && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.15) 50%, transparent 100%)',
                  animation: 'shimmer 2.5s infinite',
                }}
              />
            )}

            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 text-white animate-spin" />
                <span className="text-xl font-semibold tracking-[0.08em] uppercase text-white">
                  STARTE SIMULATION...
                </span>
              </>
            ) : (
              <>
                <img
                  src="./checkered-flag.svg"
                  alt=""
                  className="w-7 h-7"
                />
                <span className="text-xl sm:text-2xl font-semibold tracking-[0.08em] uppercase text-white">
                  SIMULATION STARTEN
                </span>
              </>
            )}
          </motion.button>
        </section>
      </div>
    </div>
  );
}
