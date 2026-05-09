import type { RaceEntry, TeamName, SortKey, SortDirection } from './types';

export function sortData(
  data: RaceEntry[],
  key: SortKey,
  direction: SortDirection
): RaceEntry[] {
  return [...data].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      // Check if strings are dates
      if (key === 'date') {
        return direction === 'asc'
          ? new Date(aVal).getTime() - new Date(bVal).getTime()
          : new Date(bVal).getTime() - new Date(aVal).getTime();
      }
      // Check if strings are race times (e.g. "1:23:45")
      if (key === 'raceTime' || key === 'bestLap') {
        return direction === 'asc'
          ? parseTime(aVal) - parseTime(bVal)
          : parseTime(bVal) - parseTime(aVal);
      }
      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return 0;
  });
}

export function filterData(
  data: RaceEntry[],
  searchQuery: string,
  teamFilter: TeamName | 'all'
): RaceEntry[] {
  return data.filter((entry) => {
    const matchesSearch = searchQuery === '' ||
      entry.track.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.strategy.join('').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTeam = teamFilter === 'all' || entry.team === teamFilter;

    return matchesSearch && matchesTeam;
  });
}

function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}.`;
}

export function getPositionColor(position: number): string {
  if (position === 1) return '#FFB800';
  if (position === 2) return '#C0C0C0';
  if (position === 3) return '#CD7F32';
  return '#F0F0F5';
}

export function getOrdinalSuffix(pos: number): string {
  return 'P' + pos;
}
