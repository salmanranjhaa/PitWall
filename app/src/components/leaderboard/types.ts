export type TeamName = 'Ferrari' | 'Red Bull' | 'Mercedes' | 'McLaren' | 'Williams';

export interface RaceEntry {
  id: number;
  date: string;
  track: string;
  trackFlag: string;
  team: TeamName;
  position: number;
  raceTime: string;
  bestLap: string;
  fastestLap: boolean;
  strategy: TireCompound[];
  pitStops: number;
  points: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

export type TireCompound = 'S' | 'M' | 'H' | 'I' | 'W';

export interface TeamColors {
  bg: string;
  text: string;
  border: string;
  bar: string;
}

export interface StatCardData {
  label: string;
  value: string | number;
  suffix?: string;
  icon: string;
  accentColor: string;
  trend?: string;
  trendColor?: string;
}

export interface PersonalBest {
  label: string;
  value: string;
  detail: string;
  icon: string;
  borderColor: string;
  valueColor: string;
}

export type SortKey = keyof RaceEntry;
export type SortDirection = 'asc' | 'desc';
