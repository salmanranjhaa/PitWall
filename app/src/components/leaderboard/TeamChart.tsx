import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { raceData, TEAM_COLORS } from './data';
import type { TeamName } from './types';

const teamNames: TeamName[] = ['Ferrari', 'Red Bull', 'Mercedes', 'McLaren', 'Williams'];

interface ChartDataPoint {
  team: TeamName;
  wins: number;
  color: string;
}

export default function TeamChart() {
  const chartData: ChartDataPoint[] = useMemo(() => {
    return teamNames.map((team) => ({
      team,
      wins: raceData.filter((r) => r.team === team && r.position === 1).length,
      color: TEAM_COLORS[team].bar,
    }));
  }, []);

  const maxWins = Math.max(...chartData.map((d) => d.wins), 1);

  return (
    <section className="px-6 md:px-page py-section">
      <motion.div
        className="max-w-[800px] mx-auto rounded-xl border p-6"
        style={{ backgroundColor: '#1E1E28', borderColor: '#2D2D3D' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        {/* Header */}
        <div className="mb-6">
          <h3
            className="text-xs font-semibold tracking-[0.1em] uppercase"
            style={{ color: '#55556B' }}
          >
            TEAM-LEISTUNG
          </h3>
          <p className="mt-1 text-xs" style={{ color: '#55556B' }}>
            Siege pro Team
          </p>
        </div>

        {/* Chart */}
        <div className="w-full" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={true}
                horizontal={false}
              />
              <XAxis
                dataKey="team"
                tick={{ fill: '#55556B', fontSize: 12, fontFamily: 'Geist, sans-serif' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, maxWins + 1]}
                tick={{ fill: '#55556B', fontSize: 12, fontFamily: 'Geist Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#16161E',
                  border: '1px solid #2D2D3D',
                  borderRadius: '8px',
                  color: '#F0F0F5',
                  fontSize: '13px',
                  fontFamily: 'Geist, sans-serif',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                formatter={(value: number) => [`${value} Siege`, '']}
                labelFormatter={(label: string) => label}
              />
              <Bar
                dataKey="wins"
                radius={[4, 4, 0, 0]}
                maxBarSize={56}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </section>
  );
}
