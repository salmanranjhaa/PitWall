import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import { raceData, TEAM_COLORS, GRADE_COLORS } from './data';
import { sortData, filterData, formatDate, getPositionColor } from './utils';
import TireDots from './TireDots';
import type { TeamName, SortKey, SortDirection } from './types';

const columns: { key: SortKey; label: string; width: string }[] = [
  { key: 'date', label: 'DATUM', width: '90px' },
  { key: 'track', label: 'STRECKE', width: '150px' },
  { key: 'team', label: 'TEAM', width: '130px' },
  { key: 'position', label: 'POS', width: '56px' },
  { key: 'raceTime', label: 'RENNZEIT', width: '100px' },
  { key: 'bestLap', label: 'BESTE RUNDE', width: '110px' },
  { key: 'strategy', label: 'STRATEGIE', width: '100px' },
  { key: 'points', label: 'PUNKTE', width: '70px' },
];

const teams: TeamName[] = ['Ferrari', 'Red Bull', 'Mercedes', 'McLaren', 'Williams'];

export default function SortableTable() {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<TeamName | 'all'>('all');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(
    () => filterData(raceData, searchQuery, teamFilter),
    [searchQuery, teamFilter]
  );

  const sorted = useMemo(
    () => sortData(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronUp className="w-3 h-3 opacity-20" style={{ color: '#55556B' }} />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3" style={{ color: '#FFB800' }} />
    ) : (
      <ChevronDown className="w-3 h-3" style={{ color: '#FFB800' }} />
    );
  };

  return (
    <section className="px-6 md:px-page py-section">
      <div className="max-w-[1200px] mx-auto">
        {/* Section Header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        >
          <h2
            className="text-[1.5rem] font-semibold tracking-[0.05em] uppercase"
            style={{ color: '#F0F0F5' }}
          >
            SIMULATIONSHISTORIE
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#8B8BA0' }}>
            Alle deine abgeschlossenen Rennen
          </p>
        </motion.div>

        {/* Controls */}
        <motion.div
          className="flex flex-col sm:flex-row gap-3 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#55556B' }} />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg text-sm border transition-colors focus:outline-none focus:ring-1"
              style={{
                backgroundColor: '#1E1E28',
                borderColor: '#2D2D3D',
                color: '#F0F0F5',
              }}
            />
          </div>

          {/* Team Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTeamFilter('all')}
              className="h-10 px-4 rounded-lg text-sm font-semibold tracking-[0.08em] uppercase border transition-all"
              style={{
                backgroundColor: teamFilter === 'all' ? 'rgba(255,184,0,0.08)' : '#1E1E28',
                borderColor: teamFilter === 'all' ? 'rgba(255,184,0,0.35)' : '#2D2D3D',
                color: teamFilter === 'all' ? '#FFB800' : '#55556B',
              }}
            >
              Alle
            </button>
            {teams.map((team) => (
              <button
                key={team}
                onClick={() => setTeamFilter(team)}
                className="h-10 px-4 rounded-lg text-sm font-semibold tracking-[0.08em] uppercase border transition-all"
                style={{
                  backgroundColor: teamFilter === team ? TEAM_COLORS[team].bg : '#1E1E28',
                  borderColor: teamFilter === team ? TEAM_COLORS[team].text + '40' : '#2D2D3D',
                  color: teamFilter === team ? TEAM_COLORS[team].text : '#55556B',
                }}
              >
                {team}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          className="rounded-xl overflow-hidden border"
          style={{ backgroundColor: '#1E1E28', borderColor: '#2D2D3D' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        >
          {/* Header */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #2D2D3D' }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="cursor-pointer select-none px-4 py-3 text-left"
                      style={{ width: col.width }}
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className="text-xs font-semibold tracking-[0.1em] uppercase"
                          style={{ color: '#55556B' }}
                        >
                          {col.label}
                        </span>
                        <SortIcon column={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => {
                  const teamColor = TEAM_COLORS[row.team];
                  const gradeColor = GRADE_COLORS[row.grade];
                  const isWinner = row.position === 1;

                  return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: idx * 0.04,
                        duration: 0.3,
                        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                      }}
                      className="transition-colors duration-150"
                      style={{
                        borderBottom: '1px solid rgba(45,45,61,0.4)',
                        backgroundColor: isWinner ? 'rgba(255,184,0,0.03)' : 'transparent',
                        borderLeft: isWinner ? '2px solid #FFB800' : '2px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#2A2A38';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = isWinner
                          ? 'rgba(255,184,0,0.03)'
                          : 'transparent';
                      }}
                    >
                      {/* Date */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs" style={{ color: '#8B8BA0' }}>
                          {formatDate(row.date)}
                        </span>
                      </td>

                      {/* Track */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.trackFlag}</span>
                          <span className="text-sm" style={{ color: '#F0F0F5' }}>
                            {row.track}
                          </span>
                        </div>
                      </td>

                      {/* Team */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: teamColor.bg,
                            color: teamColor.text,
                          }}
                        >
                          {row.team}
                        </span>
                      </td>

                      {/* Position */}
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-sm font-medium"
                          style={{
                            color: getPositionColor(row.position),
                          }}
                        >
                          P{row.position}
                        </span>
                      </td>

                      {/* Race Time */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm" style={{ color: '#F0F0F5' }}>
                          {row.raceTime}
                        </span>
                      </td>

                      {/* Best Lap */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm" style={{ color: row.fastestLap ? '#FFB800' : '#F0F0F5' }}>
                            {row.bestLap}
                          </span>
                          {row.fastestLap && (
                            <span title="Fastest Lap">
                              <ZapIcon />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Strategy */}
                      <td className="px-4 py-3">
                        <TireDots strategy={row.strategy} />
                      </td>

                      {/* Points */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium" style={{ color: '#F0F0F5' }}>
                            {row.points}
                          </span>
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold"
                            style={{
                              backgroundColor: gradeColor.bg,
                              color: gradeColor.color,
                            }}
                          >
                            {row.grade}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sorted.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: '#55556B' }}>
                Keine Ergebnisse gefunden
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function ZapIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFB800"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
