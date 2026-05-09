import { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';
import { formatLapTime } from './data';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

interface LapChartProps {
  data: { lap: number; time: number }[];
  teamColor: string;
  totalLaps: number;
}

// Custom tooltip for the chart
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: number }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        backgroundColor: '#16161E',
        border: '1px solid #2D2D3D',
      }}
    >
      <p
        className="text-xs font-semibold tracking-wider uppercase mb-1"
        style={{ color: '#55556B' }}
      >
        Runde {label}
      </p>
      <p
        className="text-sm font-mono font-medium"
        style={{ color: '#F0F0F5' }}
      >
        {formatLapTime(payload[0].value)}
      </p>
    </div>
  );
}

// Y-axis formatter: 117.5 -> "1:57.5"
function formatYAxis(value: number): string {
  const mins = Math.floor(value / 60);
  const secs = (value % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
}

export default function LapChart({ data, teamColor, totalLaps }: LapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find min and max for domain with padding
  const times = data.map((d) => d.time);
  const minTime = Math.floor(Math.min(...times)) - 1;
  const maxTime = Math.ceil(Math.max(...times)) + 1;

  return (
    <motion.div
      ref={containerRef}
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        backgroundColor: '#1E1E28',
        padding: 24,
      }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.4, ease: easePrimary }}
    >
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ color: '#55556B' }}
        >
          RUNDENZEITEN&shy;ENTWICKLUNG
        </h3>
        <span
          className="text-xs"
          style={{ color: '#55556B' }}
        >
          Runde 1-{data.length} von {totalLaps}
        </span>
      </div>

      {/* Recharts Area Chart */}
      <div style={{ width: '100%', minHeight: 320 }}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={teamColor}
                  stopOpacity={0.12}
                />
                <stop
                  offset="100%"
                  stopColor={teamColor}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={teamColor} />
                <stop offset="100%" stopColor={teamColor} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
              verticalCoordinatesGenerator={(props: { width: number; height: number; xAxis: { scale: (v: number) => number } }) => {
                // Generate grid lines every 5 laps
                const ticks: number[] = [];
                for (let i = 5; i <= totalLaps; i += 5) {
                  if (props.xAxis) {
                    ticks.push(props.xAxis.scale(i));
                  }
                }
                return ticks;
              }}
            />
            <XAxis
              dataKey="lap"
              tick={{ fill: '#55556B', fontSize: 12, fontFamily: 'Geist Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
              tickLine={false}
              interval={4}
              label={{
                value: 'Runde',
                position: 'insideBottomRight',
                offset: -4,
                style: { fill: '#55556B', fontSize: 11, fontFamily: 'Geist' },
              }}
            />
            <YAxis
              domain={[minTime, maxTime]}
              tick={{ fill: '#55556B', fontSize: 12, fontFamily: 'Geist Mono' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
              tickLine={false}
              tickFormatter={formatYAxis}
              width={64}
              label={{
                value: 'Zeit (min)',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { fill: '#55556B', fontSize: 11, fontFamily: 'Geist' },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="time"
              stroke="none"
              fill="url(#areaGradient)"
              animationDuration={1500}
              animationEasing="ease-out"
              animationBegin={200}
            />
            <Line
              type="monotone"
              dataKey="time"
              stroke={teamColor}
              strokeWidth={2}
              dot={{ r: 3, fill: teamColor, stroke: '#0F0F14', strokeWidth: 2 }}
              activeDot={{
                r: 5,
                fill: teamColor,
                stroke: '#F0F0F5',
                strokeWidth: 2,
              }}
              animationDuration={1500}
              animationEasing="ease-out"
              animationBegin={200}
              style={{
                filter: `drop-shadow(0 0 4px ${teamColor}33)`,
              }}
            />
            {/* Reference line for pit stops */}
            <ReferenceLine
              x={13}
              stroke="#FF2D2D"
              strokeDasharray="6 4"
              strokeOpacity={0.4}
              label={{
                value: 'PIT',
                position: 'top',
                fill: '#FF2D2D',
                fontSize: 10,
                fontFamily: 'Geist',
                opacity: 0.6,
              }}
            />
            <ReferenceLine
              x={29}
              stroke="#FF2D2D"
              strokeDasharray="6 4"
              strokeOpacity={0.4}
              label={{
                value: 'PIT',
                position: 'top',
                fill: '#FF2D2D',
                fontSize: 10,
                fontFamily: 'Geist',
                opacity: 0.6,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
