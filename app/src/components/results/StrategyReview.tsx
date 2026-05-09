import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Check, Zap } from 'lucide-react';
import {
  strategyEvents, lapTimes, performanceMetrics, getTireById,
} from './mockData';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeBounce = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

/* ─── Animated Counter ─────────────────────────────────── */

function AnimatedScore({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start: number | null = null;
    let raf: number;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Number((progress * target).toFixed(1)));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isInView, target, duration]);

  return <span ref={ref}>{count.toFixed(1)}</span>;
}

function AnimatedPercent({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start: number | null = null;
    let raf: number;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setCount(Math.round(progress * target));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isInView, target, duration]);

  return <span ref={ref}>{count}%</span>;
}

/* ─── Lap Time Tooltip ─────────────────────────────────── */

function LapTimeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: number }) {
  if (!active || !payload) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{ backgroundColor: '#16161E', border: '1px solid #2D2D3D' }}
    >
      <p className="font-medium mb-1" style={{ color: '#F0F0F5' }}>Runde {label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color, fontFamily: "'Geist Mono', monospace" }}>
          {entry.name}: {entry.value.toFixed(3)}s
        </p>
      ))}
    </div>
  );
}

/* ─── Strategy Timeline ────────────────────────────────── */

function StrategyTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-25% 0px' });

  return (
    <motion.div
      ref={ref}
      className="rounded-xl p-6"
      style={{ backgroundColor: '#1E1E28' }}
      initial={{ opacity: 0, x: -30 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.4, ease: easePrimary }}
    >
      <h3
        className="text-sm font-semibold tracking-[0.1em] uppercase mb-6"
        style={{ color: '#F0F0F5' }}
      >
        Strategie-Timeline
      </h3>

      <div className="relative pl-6">
        {/* Vertical line */}
        <div
          className="absolute left-[5px] top-0 bottom-0 w-0.5"
          style={{
            background: 'linear-gradient(180deg, #FFB800 0%, #2D2D3D 100%)',
          }}
        />

        {strategyEvents.map((event, i) => {
          const tireFrom = event.tireFrom ? getTireById(event.tireFrom) : null;
          const tireTo = event.tireTo ? getTireById(event.tireTo) : null;

          return (
            <motion.div
              key={i}
              className="relative mb-6 last:mb-0"
              initial={{ opacity: 0, scale: 0 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{
                duration: 0.4,
                delay: 0.1 + i * 0.1,
                ease: easeBounce,
              }}
            >
              {/* Node */}
              <div
                className="absolute -left-6 top-0.5 w-3 h-3 rounded-full border-2"
                style={{
                  backgroundColor: event.nodeColor,
                  borderColor: '#1E1E28',
                  boxShadow: `0 0 8px ${event.nodeColor}40`,
                }}
              />

              {/* Content */}
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#55556B', fontFamily: "'Geist Mono', monospace" }}>
                  {event.type === 'start' ? 'Start' : event.type === 'finish' ? 'Ziel' : `Runde ${event.lap}`}
                </p>
                <p
                  className="text-sm font-medium"
                  style={{ color: event.type === 'finish' ? '#FFB800' : '#F0F0F5' }}
                >
                  {event.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#8B8BA0' }}>
                  {event.detail}
                </p>
                {event.aiRecommendation && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {event.isOptimal ? (
                      <Check className="w-3 h-3" style={{ color: '#00D084' }} />
                    ) : (
                      <Zap className="w-3 h-3" style={{ color: '#FF2D2D' }} />
                    )}
                    <span
                      className="text-xs"
                      style={{ color: event.isOptimal ? '#00D084' : '#FF2D2D' }}
                    >
                      {event.aiRecommendation}
                    </span>
                  </div>
                )}
                {event.aiDelta && (
                  <p
                    className="text-xs mt-0.5 pl-5"
                    style={{ color: event.isOptimal ? '#00D084' : '#FF2D2D' }}
                  >
                    {event.aiDelta}
                  </p>
                )}

                {/* Tire transition indicator */}
                {tireFrom && tireTo && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tireFrom.color }}
                    />
                    <span className="text-xs" style={{ color: '#55556B' }}>→</span>
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tireTo.color }}
                    />
                    <span className="text-xs ml-1" style={{ color: '#8B8BA0' }}>
                      {tireFrom.label} → {tireTo.label}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── Lap Time Chart ───────────────────────────────────── */

function LapTimeChart() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-25% 0px' });

  return (
    <motion.div
      ref={ref}
      className="rounded-xl p-6"
      style={{ backgroundColor: '#1E1E28' }}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: 0.2, ease: easePrimary }}
    >
      <h3
        className="text-sm font-semibold tracking-[0.1em] uppercase mb-1"
        style={{ color: '#F0F0F5' }}
      >
        Rundenzeiten
      </h3>
      <p className="text-xs mb-4" style={{ color: '#8B8BA0' }}>
        Tatsächlich vs. Optimal
      </p>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={lapTimes} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF1E00" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#FF1E00" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="optimalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFB800" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#FFB800" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="lap"
            tick={{ fontSize: 11, fill: '#55556B' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            interval={9}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#55556B' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<LapTimeTooltip />} />
          {/* Pit stop reference lines */}
          <ReferenceLine x={12} stroke="#FFB800" strokeDasharray="4 4" strokeOpacity={0.4} />
          <ReferenceLine x={28} stroke="#FFB800" strokeDasharray="4 4" strokeOpacity={0.4} />
          <Area
            type="monotone"
            dataKey="actual"
            name="Tatsächlich"
            stroke="#FF1E00"
            strokeWidth={2}
            fill="url(#actualGrad)"
            animationDuration={1500}
            animationBegin={isInView ? 0 : 99999}
          />
          <Area
            type="monotone"
            dataKey="optimal"
            name="Optimal"
            stroke="#FFB800"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            fill="url(#optimalGrad)"
            animationDuration={1500}
            animationBegin={isInView ? 200 : 99999}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-[#FF1E00]" />
          <span className="text-xs" style={{ color: '#8B8BA0' }}>Tatsächlich</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-[#FFB800]" style={{ background: 'repeating-linear-gradient(90deg, #FFB800, #FFB800 4px, transparent 4px, transparent 8px)' }} />
          <span className="text-xs" style={{ color: '#8B8BA0' }}>Optimal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-[#FFB800]" style={{ opacity: 0.4 }} />
          <span className="text-xs" style={{ color: '#8B8BA0' }}>Boxenstopp</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Performance Metric Card ──────────────────────────── */

function MetricCard({ metric, index }: { metric: typeof performanceMetrics[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-25% 0px' });

  return (
    <motion.div
      ref={ref}
      className="rounded-xl p-5"
      style={{
        background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
        border: '1px solid #2D2D3D',
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, delay: index * 0.1, ease: easePrimary }}
    >
      <p className="text-xs font-semibold tracking-[0.1em] uppercase" style={{ color: '#55556B' }}>
        {metric.label}
      </p>
      <p
        className="text-4xl font-medium mt-1 tracking-[-0.03em]"
        style={{ color: metric.color, fontFamily: "'Geist Mono', monospace" }}
      >
        {metric.label === 'GESAMTNOTE' ? (
          <AnimatedScore target={8.5} />
        ) : (
          <AnimatedPercent target={metric.percent} />
        )}
        {metric.label === 'GESAMTNOTE' && (
          <span className="text-lg ml-1" style={{ color: '#8B8BA0' }}>/10</span>
        )}
      </p>
      <p className="text-xs mt-1" style={{ color: '#8B8BA0' }}>
        {metric.description}
      </p>

      {/* Progress bar */}
      <div
        className="mt-3 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: metric.color }}
          initial={{ width: 0 }}
          animate={isInView ? { width: `${metric.percent}%` } : { width: 0 }}
          transition={{ duration: 1, delay: index * 0.1 + 0.3, ease: easePrimary }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Main Strategy Review Section ─────────────────────── */

export default function StrategyReview() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-20% 0px' });

  return (
    <section className="py-8 px-4 md:px-6">
      <div className="max-w-[1000px] mx-auto" ref={sectionRef}>
        {/* Section header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, x: -30 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.4, ease: easePrimary }}
        >
          <h2
            className="text-2xl font-semibold tracking-[0.05em] uppercase"
            style={{ color: '#F0F0F5' }}
          >
            STRATEGIEANALYSE
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#8B8BA0' }}>
            Deine Entscheidungen im Vergleich zur KI-Empfehlung
          </p>
        </motion.div>

        {/* Grid: Timeline left, Chart + Metrics right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Strategy Timeline */}
          <div className="space-y-6">
            <StrategyTimeline />
          </div>

          {/* Right: Chart + Metrics */}
          <div className="space-y-6">
            <LapTimeChart />

            {/* Performance metrics */}
            <div className="space-y-3">
              {performanceMetrics.map((metric, i) => (
                <MetricCard key={metric.label} metric={metric} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
