import type { RaceEntry, TeamName } from './types';

export const TEAM_COLORS: Record<TeamName, { bg: string; text: string; bar: string }> = {
  Ferrari:   { bg: 'rgba(255,30,0,0.15)',  text: '#FF1E00', bar: '#FF1E00' },
  'Red Bull':{ bg: 'rgba(0,51,160,0.2)',   text: '#4A7BFF', bar: '#0033A0' },
  Mercedes:  { bg: 'rgba(0,245,212,0.12)', text: '#00F5D4', bar: '#00F5D4' },
  McLaren:   { bg: 'rgba(255,135,0,0.15)', text: '#FF8700', bar: '#FF8700' },
  Williams:  { bg: 'rgba(0,160,222,0.15)', text: '#00A0DE', bar: '#00A0DE' },
};

export const TIRE_COLORS: Record<string, string> = {
  S: '#E8103A',
  M: '#FFD300',
  H: '#F5F5F5',
  I: '#0057B7',
  W: '#004E8C',
};

export const GRADE_COLORS: Record<string, { color: string; bg: string }> = {
  S: { color: '#FFB800', bg: 'rgba(255,184,0,0.08)' },
  A: { color: '#00D084', bg: 'rgba(0,208,132,0.05)' },
  B: { color: '#00A0DE', bg: 'rgba(0,160,222,0.05)' },
  C: { color: '#F5F5F5', bg: 'transparent' },
  D: { color: '#FF8700', bg: 'rgba(255,135,0,0.05)' },
  F: { color: '#FF2D2D', bg: 'rgba(255,45,45,0.05)' },
};

export const TRACK_FLAGS: Record<string, string> = {
  'Belgian GP': '\uD83C\uDDE7\uD83C\uDDEA',
  'Italian GP': '\uD83C\uDDEE\uD83C\uDDF9',
  'British GP': '\uD83C\uDDEC\uD83C\uDDE7',
  'Japanese GP': '\uD83C\uDDEF\uD83C\uDDF5',
  'Monaco GP': '\uD83C\uDDF2\uD83C\uDDE8',
  'Spanish GP': '\uD83C\uDDEA\uD83C\uDDF8',
  'Austrian GP': '\uD83C\uDDE6\uD83C\uDDF9',
  'Canadian GP': '\uD83C\uDDE8\uD83C\uDDE6',
  'Brazilian GP': '\uD83C\uDDE7\uD83C\uDDF7',
  'Abu Dhabi GP': '\uD83C\uDDE6\uD83C\uDDEA',
};

export const raceData: RaceEntry[] = [
  {
    id: 1,
    date: '2025-03-23',
    track: 'Italian GP',
    trackFlag: TRACK_FLAGS['Italian GP'],
    team: 'Ferrari',
    position: 1,
    raceTime: '1:23:45',
    bestLap: '1:21.890',
    fastestLap: true,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 26,
    grade: 'S',
  },
  {
    id: 2,
    date: '2025-04-06',
    track: 'Belgian GP',
    trackFlag: TRACK_FLAGS['Belgian GP'],
    team: 'Ferrari',
    position: 1,
    raceTime: '1:25:12',
    bestLap: '1:45.231',
    fastestLap: true,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 26,
    grade: 'A',
  },
  {
    id: 3,
    date: '2025-04-20',
    track: 'Japanese GP',
    trackFlag: TRACK_FLAGS['Japanese GP'],
    team: 'Red Bull',
    position: 1,
    raceTime: '1:28:33',
    bestLap: '1:32.145',
    fastestLap: false,
    strategy: ['S', 'H'],
    pitStops: 1,
    points: 25,
    grade: 'A',
  },
  {
    id: 4,
    date: '2025-05-04',
    track: 'British GP',
    trackFlag: TRACK_FLAGS['British GP'],
    team: 'Mercedes',
    position: 1,
    raceTime: '1:24:18',
    bestLap: '1:27.654',
    fastestLap: false,
    strategy: ['M', 'H'],
    pitStops: 1,
    points: 25,
    grade: 'A',
  },
  {
    id: 5,
    date: '2025-05-18',
    track: 'Monaco GP',
    trackFlag: TRACK_FLAGS['Monaco GP'],
    team: 'Ferrari',
    position: 1,
    raceTime: '1:32:07',
    bestLap: '1:12.456',
    fastestLap: true,
    strategy: ['S', 'M'],
    pitStops: 1,
    points: 26,
    grade: 'S',
  },
  {
    id: 6,
    date: '2025-06-01',
    track: 'Spanish GP',
    trackFlag: TRACK_FLAGS['Spanish GP'],
    team: 'Red Bull',
    position: 1,
    raceTime: '1:26:42',
    bestLap: '1:18.923',
    fastestLap: false,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 25,
    grade: 'B',
  },
  {
    id: 7,
    date: '2025-06-15',
    track: 'Austrian GP',
    trackFlag: TRACK_FLAGS['Austrian GP'],
    team: 'Ferrari',
    position: 2,
    raceTime: '1:25:55',
    bestLap: '1:06.789',
    fastestLap: true,
    strategy: ['S', 'H'],
    pitStops: 1,
    points: 19,
    grade: 'A',
  },
  {
    id: 8,
    date: '2025-06-29',
    track: 'Canadian GP',
    trackFlag: TRACK_FLAGS['Canadian GP'],
    team: 'Mercedes',
    position: 2,
    raceTime: '1:27:33',
    bestLap: '1:14.567',
    fastestLap: false,
    strategy: ['M', 'H'],
    pitStops: 1,
    points: 18,
    grade: 'B',
  },
  {
    id: 9,
    date: '2025-07-13',
    track: 'British GP',
    trackFlag: TRACK_FLAGS['British GP'],
    team: 'Ferrari',
    position: 1,
    raceTime: '1:23:56',
    bestLap: '1:27.123',
    fastestLap: true,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 26,
    grade: 'S',
  },
  {
    id: 10,
    date: '2025-07-27',
    track: 'Belgian GP',
    trackFlag: TRACK_FLAGS['Belgian GP'],
    team: 'Red Bull',
    position: 2,
    raceTime: '1:26:18',
    bestLap: '1:44.890',
    fastestLap: false,
    strategy: ['S', 'M'],
    pitStops: 1,
    points: 18,
    grade: 'B',
  },
  {
    id: 11,
    date: '2025-08-10',
    track: 'Italian GP',
    trackFlag: TRACK_FLAGS['Italian GP'],
    team: 'McLaren',
    position: 1,
    raceTime: '1:24:22',
    bestLap: '1:22.105',
    fastestLap: false,
    strategy: ['S', 'H'],
    pitStops: 1,
    points: 25,
    grade: 'A',
  },
  {
    id: 12,
    date: '2025-08-24',
    track: 'Japanese GP',
    trackFlag: TRACK_FLAGS['Japanese GP'],
    team: 'Ferrari',
    position: 1,
    raceTime: '1:29:45',
    bestLap: '1:31.678',
    fastestLap: true,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 26,
    grade: 'A',
  },
  {
    id: 13,
    date: '2025-09-07',
    track: 'Monaco GP',
    trackFlag: TRACK_FLAGS['Monaco GP'],
    team: 'Williams',
    position: 1,
    raceTime: '1:33:21',
    bestLap: '1:13.012',
    fastestLap: false,
    strategy: ['S', 'M'],
    pitStops: 1,
    points: 25,
    grade: 'B',
  },
  {
    id: 14,
    date: '2025-09-21',
    track: 'Singapore GP',
    trackFlag: '\uD83C\uDDF8\uD83C\uDDEC',
    team: 'Red Bull',
    position: 1,
    raceTime: '1:34:08',
    bestLap: '1:36.445',
    fastestLap: false,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 25,
    grade: 'A',
  },
  {
    id: 15,
    date: '2025-10-05',
    track: 'Brazilian GP',
    trackFlag: TRACK_FLAGS['Brazilian GP'],
    team: 'Mercedes',
    position: 1,
    raceTime: '1:26:44',
    bestLap: '1:09.234',
    fastestLap: true,
    strategy: ['M', 'H'],
    pitStops: 1,
    points: 26,
    grade: 'S',
  },
  {
    id: 16,
    date: '2025-10-19',
    track: 'Abu Dhabi GP',
    trackFlag: TRACK_FLAGS['Abu Dhabi GP'],
    team: 'Ferrari',
    position: 2,
    raceTime: '1:28:19',
    bestLap: '1:37.890',
    fastestLap: false,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 19,
    grade: 'B',
  },
  {
    id: 17,
    date: '2025-11-02',
    track: 'Italian GP',
    trackFlag: TRACK_FLAGS['Italian GP'],
    team: 'Ferrari',
    position: 1,
    raceTime: '1:22:58',
    bestLap: '1:21.345',
    fastestLap: true,
    strategy: ['S', 'H'],
    pitStops: 1,
    points: 26,
    grade: 'S',
  },
  {
    id: 18,
    date: '2025-11-16',
    track: 'Belgian GP',
    trackFlag: TRACK_FLAGS['Belgian GP'],
    team: 'McLaren',
    position: 3,
    raceTime: '1:27:33',
    bestLap: '1:46.123',
    fastestLap: false,
    strategy: ['M', 'H'],
    pitStops: 1,
    points: 15,
    grade: 'C',
  },
  {
    id: 19,
    date: '2025-11-30',
    track: 'British GP',
    trackFlag: TRACK_FLAGS['British GP'],
    team: 'Williams',
    position: 4,
    raceTime: '1:28:45',
    bestLap: '1:29.567',
    fastestLap: false,
    strategy: ['S', 'M'],
    pitStops: 1,
    points: 12,
    grade: 'C',
  },
  {
    id: 20,
    date: '2025-12-07',
    track: 'Monaco GP',
    trackFlag: TRACK_FLAGS['Monaco GP'],
    team: 'Red Bull',
    position: 3,
    raceTime: '1:34:56',
    bestLap: '1:14.789',
    fastestLap: false,
    strategy: ['S', 'M', 'H'],
    pitStops: 2,
    points: 15,
    grade: 'B',
  },
];

export function getWinsByTeam(data: RaceEntry[]): { team: TeamName; wins: number }[] {
  const teams: TeamName[] = ['Ferrari', 'Red Bull', 'Mercedes', 'McLaren', 'Williams'];
  return teams.map((team) => ({
    team,
    wins: data.filter((r) => r.team === team && r.position === 1).length,
  }));
}

export function getPersonalBests(data: RaceEntry[]) {
  const bestFinish = data.reduce((best, race) =>
    race.position < best.position ? race : best
  );

  const fastestLapRace = data.reduce((fastest, race) => {
    const fastestTime = parseLapTime(fastest.bestLap);
    const currentTime = parseLapTime(race.bestLap);
    return currentTime < fastestTime ? race : fastest;
  });

  const strategyWins = new Map<string, { wins: number; total: number }>();
  data.forEach((race) => {
    const strat = race.strategy.join('\u2192');
    const entry = strategyWins.get(strat) || { wins: 0, total: 0 };
    entry.total++;
    if (race.position === 1) entry.wins++;
    strategyWins.set(strat, entry);
  });

  let bestStrategy = '';
  let bestRate = -1;
  strategyWins.forEach((val, key) => {
    const rate = val.wins / val.total;
    if (rate > bestRate && val.total >= 2) {
      bestRate = rate;
      bestStrategy = key;
    }
  });

  return {
    bestFinish,
    fastestLapRace,
    bestStrategy: bestStrategy || 'S\u2192M\u2192H',
    bestStrategyRate: Math.round(bestRate * 100),
  };
}

function parseLapTime(time: string): number {
  const parts = time.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}
