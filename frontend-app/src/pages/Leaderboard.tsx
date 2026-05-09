import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Clock,
  Zap,
  Target,
  TrendingUp,
  Filter,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { LEADERBOARD_DATA, TEAMS, DRIVER_STANDINGS } from "@/data/mockData";

const teamColorMap: Record<string, string> = {};
TEAMS.forEach((t) => (teamColorMap[t.name] = t.color));

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const filterOptions = ["All", "S-M-H", "S-H", "M-H"];

const teamPerformance = TEAMS.slice(0, 6).map((team) => ({
  name: team.code,
  fullName: team.name,
  color: team.color,
  wins: Math.floor(Math.random() * 8) + 1,
  podiums: Math.floor(Math.random() * 12) + 4,
  points: Math.floor(Math.random() * 300) + 200,
}));

export default function Leaderboard() {
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"date" | "points" | "position">("date");

  const filtered = LEADERBOARD_DATA.filter((row) =>
    filter === "All" ? true : row.strategy === filter
  ).sort((a, b) => {
    if (sortBy === "points") return b.points - a.points;
    if (sortBy === "position") return a.position - b.position;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const totalRaces = LEADERBOARD_DATA.length;
  const wins = LEADERBOARD_DATA.filter((r) => r.position === 1).length;
  const fastestLaps = LEADERBOARD_DATA.filter((r) => r.fastestLap).length;
  const winRate = Math.round((wins / totalRaces) * 100);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">
          Leaderboard
        </h1>
        <p className="text-text-secondary text-sm">
          Your complete racing history and performance analytics
        </p>
      </div>

      {/* Stats Row */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <motion.div
          variants={itemVariants}
          className="bg-surface rounded-lg border border-border-subtle p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-ferrari-gold" />
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
              Total Races
            </span>
          </div>
          <p className="text-3xl font-black text-text-primary">{totalRaces}</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-surface rounded-lg border border-border-subtle p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-success-green" />
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
              Win Rate
            </span>
          </div>
          <p className="text-3xl font-black text-success-green">{winRate}%</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-surface rounded-lg border border-border-subtle p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-neural-cyan" />
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
              Fastest Laps
            </span>
          </div>
          <p className="text-3xl font-black text-neural-cyan">{fastestLaps}</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-surface rounded-lg border border-border-subtle p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-rosso" />
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
              Best Strategy
            </span>
          </div>
          <p className="text-3xl font-black text-rosso">S-M-H</p>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-ghost" />
          <span className="text-xs text-text-ghost font-semibold uppercase tracking-wider">
            Strategy
          </span>
        </div>
        {filterOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filter === opt
                ? "bg-rosso text-white"
                : "bg-surface text-text-secondary border border-border-subtle hover:text-text-primary"
            }`}
          >
            {opt}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-ghost font-semibold uppercase tracking-wider">
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "date" | "points" | "position")
            }
            className="bg-surface border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary"
          >
            <option value="date">Date</option>
            <option value="points">Points</option>
            <option value="position">Position</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-ghost text-xs uppercase border-b border-border-subtle">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Track</th>
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-center">Pos</th>
                <th className="px-4 py-3 text-left">Race Time</th>
                <th className="px-4 py-3 text-left">Best Lap</th>
                <th className="px-4 py-3 text-center">Strategy</th>
                <th className="px-4 py-3 text-right">Pts</th>
                <th className="px-4 py-3 text-center">FL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-t border-border-subtle/50 hover:bg-surface-inner/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-text-secondary text-xs">
                    {row.date}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary text-xs truncate max-w-[180px]">
                    {row.track}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: teamColorMap[row.team] ?? "#8B8BA0",
                        }}
                      />
                      <span className="text-text-secondary text-xs">
                        {row.team}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`text-xs font-mono font-bold ${
                        row.position === 1
                          ? "text-ferrari-gold"
                          : row.position === 2
                            ? "text-gray-400"
                            : row.position === 3
                              ? "text-amber-600"
                              : "text-text-primary"
                      }`}
                    >
                      P{row.position}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-secondary text-xs">
                    {row.raceTime}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-neural-cyan text-xs">
                    {row.bestLap}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-carbon text-text-secondary border border-border-subtle">
                      {row.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-ferrari-gold text-xs">
                    {row.points}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.fastestLap && (
                      <Zap className="w-3.5 h-3.5 text-neural-cyan mx-auto" />
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Performance Chart */}
      <div className="bg-surface rounded-lg border border-border-subtle p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-rosso" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Team Performance
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={teamPerformance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D2D3D" />
            <XAxis dataKey="name" stroke="#55556B" fontSize={11} />
            <YAxis stroke="#55556B" fontSize={11} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#16161E",
                border: "1px solid #2D2D3D",
                borderRadius: 8,
                color: "#F0F0F5",
              }}
            />
            <Bar dataKey="points" radius={[4, 4, 0, 0]}>
              {teamPerformance.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Driver Standings */}
      <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
          <Clock className="w-4 h-4 text-neural-cyan" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            2024 Driver Standings
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-ghost text-xs uppercase">
                <th className="px-4 py-2 text-left">Pos</th>
                <th className="px-4 py-2 text-left">Driver</th>
                <th className="px-4 py-2 text-left">Team</th>
                <th className="px-4 py-2 text-right">Points</th>
                <th className="px-4 py-2 text-center">Wins</th>
                <th className="px-4 py-2 text-center">Podiums</th>
              </tr>
            </thead>
            <tbody>
              {DRIVER_STANDINGS.map((driver) => (
                <tr
                  key={driver.position}
                  className="border-t border-border-subtle/50 hover:bg-surface-inner/50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono font-bold text-text-primary">
                    {driver.position}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary font-semibold text-xs">
                    {driver.driver}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            teamColorMap[driver.team] ?? "#8B8BA0",
                        }}
                      />
                      <span className="text-text-secondary text-xs">
                        {driver.team}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-ferrari-gold text-xs">
                    {driver.points}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-text-secondary text-xs">
                    {driver.wins}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-text-secondary text-xs">
                    {driver.podiums}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Personal Bests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-neural-cyan" />
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
              Best Race Time
            </span>
          </div>
          <p className="text-xl font-mono font-black text-text-primary">
            1:32:45.123
          </p>
          <p className="text-xs text-text-ghost mt-1">Belgian Grand Prix</p>
        </div>
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-ferrari-gold" />
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
              Best Lap
            </span>
          </div>
          <p className="text-xl font-mono font-black text-ferrari-gold">
            1:42.831
          </p>
          <p className="text-xs text-text-ghost mt-1">Silverstone, Lap 38</p>
        </div>
        <div className="bg-surface rounded-lg border border-border-subtle p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-success-green" />
            <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
              Most Points (Race)
            </span>
          </div>
          <p className="text-xl font-mono font-black text-success-green">26</p>
          <p className="text-xs text-text-ghost mt-1">
            P1 + Fastest Lap (x2)
          </p>
        </div>
      </div>
    </div>
  );
}
