// ─── Belgian Grand Prix Mock Data ──────────────────────────────

export const TOTAL_LAPS = 44;

// Team definitions
export const teams = [
  { id: 'mercedes', name: 'Mercedes', color: '#00F5D4', short: 'MER' },
  { id: 'ferrari', name: 'Ferrari', color: '#FF1E00', short: 'FER' },
  { id: 'redbull', name: 'Red Bull', color: '#0033A0', short: 'RBR' },
  { id: 'mclaren', name: 'McLaren', color: '#FF8700', short: 'MCL' },
  { id: 'williams', name: 'Williams', color: '#00A0DE', short: 'WIL' },
];

// Tire compounds
export const tireCompounds = {
  soft: { label: 'SOFT', color: '#E8103A', bg: 'rgba(232,16,58,0.15)' },
  medium: { label: 'MEDIUM', color: '#FFD300', bg: 'rgba(255,211,0,0.15)' },
  hard: { label: 'HARD', color: '#F5F5F5', bg: 'rgba(245,245,245,0.15)' },
};

// Lap times for laps 1-4 (Belgian GP, ~1:57-2:03 range)
export const lapTimeData = [
  { lap: 1, time: 125.891 },  // 2:05.891 - start lap, slower
  { lap: 2, time: 118.120 },  // 1:58.120
  { lap: 3, time: 117.454 },  // 1:57.454
  { lap: 4, time: 117.041 },  // 1:57.041 - fastest so far
];

// Full projected lap times for chart (laps 1-44)
export const generateFullLapData = () => {
  const data: { lap: number; time: number }[] = [];
  // Laps 1-4: actual data
  data.push({ lap: 1, time: 125.891 });
  data.push({ lap: 2, time: 118.120 });
  data.push({ lap: 3, time: 117.454 });
  data.push({ lap: 4, time: 117.041 });
  // Laps 5-12: soft tire degradation (gradual slowing)
  for (let i = 5; i <= 12; i++) {
    const base = 117.2 + (i - 4) * 0.15;
    data.push({ lap: i, time: base + Math.random() * 0.3 });
  }
  // Laps 13-28: medium tire (slightly slower, stable)
  for (let i = 13; i <= 28; i++) {
    const base = 118.0 + (i - 13) * 0.08;
    data.push({ lap: i, time: base + Math.random() * 0.2 });
  }
  // Laps 29-44: hard tire (slowest but most stable)
  for (let i = 29; i <= 44; i++) {
    const base = 118.8 + (i - 29) * 0.05;
    data.push({ lap: i, time: base + Math.random() * 0.15 });
  }
  return data;
};

export const fullLapData = generateFullLapData();

// Format seconds to mm:ss.mmm
export function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${mins}:${secs}`;
}

// Leaderboard data
export interface LeaderboardEntry {
  position: number;
  team: string;
  teamColor: string;
  tire: 'S' | 'M' | 'H';
  tireAge: number;
  lastLap: number; // in seconds
  stops: number;
  gap: string;
  isPlayer?: boolean;
}

export const initialLeaderboard: LeaderboardEntry[] = [
  {
    position: 1,
    team: 'Mercedes',
    teamColor: '#00F5D4',
    tire: 'S',
    tireAge: 3,
    lastLap: 117.041,
    stops: 0,
    gap: '\u2014',
    isPlayer: true,
  },
  {
    position: 2,
    team: 'Ferrari',
    teamColor: '#FF1E00',
    tire: 'M',
    tireAge: 2,
    lastLap: 117.454,
    stops: 0,
    gap: '+0.413',
  },
  {
    position: 3,
    team: 'Red Bull',
    teamColor: '#0033A0',
    tire: 'S',
    tireAge: 3,
    lastLap: 117.891,
    stops: 0,
    gap: '+0.850',
  },
  {
    position: 4,
    team: 'McLaren',
    teamColor: '#FF8700',
    tire: 'H',
    tireAge: 4,
    lastLap: 118.120,
    stops: 0,
    gap: '+1.079',
  },
  {
    position: 5,
    team: 'Williams',
    teamColor: '#00A0DE',
    tire: 'M',
    tireAge: 3,
    lastLap: 118.445,
    stops: 0,
    gap: '+1.404',
  },
];

// Lap history data
export interface LapHistoryEntry {
  lap: number;
  time: number;
  tire: 'S' | 'M' | 'H';
  tireAge: number;
  comment: string;
}

export const lapHistoryData: LapHistoryEntry[] = [
  { lap: 4, time: 117.041, tire: 'S', tireAge: 3, comment: '\u2014' },
  { lap: 3, time: 117.454, tire: 'S', tireAge: 2, comment: '\u2014' },
  { lap: 2, time: 118.120, tire: 'S', tireAge: 1, comment: 'Boxengasse verlassen' },
  { lap: 1, time: 125.891, tire: 'S', tireAge: 0, comment: 'Start \u2014 Grid P1' },
];

// Tire wear calculation: 0% = fresh, 100% = worn out
// Soft tires last ~12 laps, Medium ~16 laps, Hard ~16 laps
export function getTireWear(compound: 'S' | 'M' | 'H', age: number): number {
  const maxLaps = compound === 'S' ? 12 : compound === 'M' ? 16 : 16;
  return Math.min((age / maxLaps) * 100, 100);
}

export function getWearColor(wearPercent: number): string {
  if (wearPercent < 40) return '#00D084';
  if (wearPercent < 70) return '#FFB800';
  return '#FF2D2D';
}

export function getTireCompoundLabel(compound: 'S' | 'M' | 'H'): string {
  return compound === 'S' ? 'SOFT' : compound === 'M' ? 'MEDIUM' : 'HARD';
}

export function getTireColor(compound: 'S' | 'M' | 'H'): string {
  return compound === 'S' ? '#E8103A' : compound === 'M' ? '#FFD300' : '#F5F5F5';
}
