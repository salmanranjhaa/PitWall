/* ─── Team Definitions ─────────────────────────────────── */

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo: string;
  driver: string;
  driverCode: string;
}

export const teams: Team[] = [
  {
    id: 'ferrari',
    name: 'Scuderia Ferrari',
    shortName: 'FERRARI',
    color: '#FF1E00',
    logo: './ferrari-badge.svg',
    driver: 'Charles Leclerc',
    driverCode: 'C. Leclerc',
  },
  {
    id: 'mercedes',
    name: 'Mercedes-AMG Petronas',
    shortName: 'MERCEDES',
    color: '#00F5D4',
    logo: './team-mercedes.svg',
    driver: 'Lewis Hamilton',
    driverCode: 'L. Hamilton',
  },
  {
    id: 'redbull',
    name: 'Red Bull Racing',
    shortName: 'RED BULL',
    color: '#0033A0',
    logo: './team-redbull.svg',
    driver: 'Max Verstappen',
    driverCode: 'M. Verstappen',
  },
  {
    id: 'mclaren',
    name: 'McLaren F1 Team',
    shortName: 'MCLAREN',
    color: '#FF8700',
    logo: './team-mclaren.svg',
    driver: 'Lando Norris',
    driverCode: 'L. Norris',
  },
  {
    id: 'williams',
    name: 'Williams Racing',
    shortName: 'WILLIAMS',
    color: '#00A0DE',
    logo: './team-williams.svg',
    driver: 'Alexander Albon',
    driverCode: 'A. Albon',
  },
];

/* ─── Tire Definitions ─────────────────────────────────── */

export interface TireOption {
  id: string;
  label: string;
  color: string;
  shortcut: string;
}

export const tireOptions: TireOption[] = [
  { id: 'soft', label: 'SOFT', color: '#E8103A', shortcut: 'S' },
  { id: 'medium', label: 'MEDIUM', color: '#FFD300', shortcut: 'M' },
  { id: 'hard', label: 'HARD', color: '#F5F5F5', shortcut: 'H' },
];

/* ─── Race Results ─────────────────────────────────────── */

export interface RaceResult {
  position: number;
  teamId: string;
  driver: string;
  driverCode: string;
  raceTime: string;
  gap: string;
  bestLap: string;
  bestLapNumber: number;
  pitStops: number;
  tireStrategy: string[];
  isFastestLap: boolean;
}

export const raceResults: RaceResult[] = [
  {
    position: 1,
    teamId: 'ferrari',
    driver: 'Charles Leclerc',
    driverCode: 'C. Leclerc',
    raceTime: '1:27:15.432',
    gap: '-',
    bestLap: '1:46.326',
    bestLapNumber: 38,
    pitStops: 2,
    tireStrategy: ['soft', 'medium', 'hard'],
    isFastestLap: true,
  },
  {
    position: 2,
    teamId: 'mercedes',
    driver: 'Lewis Hamilton',
    driverCode: 'L. Hamilton',
    raceTime: '1:27:18.832',
    gap: '+3.400',
    bestLap: '1:46.891',
    bestLapNumber: 36,
    pitStops: 2,
    tireStrategy: ['soft', 'medium', 'hard'],
    isFastestLap: false,
  },
  {
    position: 3,
    teamId: 'redbull',
    driver: 'Max Verstappen',
    driverCode: 'M. Verstappen',
    raceTime: '1:27:28.232',
    gap: '+12.800',
    bestLap: '1:47.105',
    bestLapNumber: 35,
    pitStops: 2,
    tireStrategy: ['medium', 'hard'],
    isFastestLap: false,
  },
  {
    position: 4,
    teamId: 'mclaren',
    driver: 'Lando Norris',
    driverCode: 'L. Norris',
    raceTime: '1:27:33.632',
    gap: '+18.200',
    bestLap: '1:47.342',
    bestLapNumber: 37,
    pitStops: 2,
    tireStrategy: ['soft', 'hard'],
    isFastestLap: false,
  },
  {
    position: 5,
    teamId: 'williams',
    driver: 'Alexander Albon',
    driverCode: 'A. Albon',
    raceTime: '1:27:40.032',
    gap: '+24.600',
    bestLap: '1:48.012',
    bestLapNumber: 34,
    pitStops: 1,
    tireStrategy: ['medium', 'hard'],
    isFastestLap: false,
  },
];

/* ─── Lap-by-Lap Position Data ─────────────────────────── */

export interface LapPosition {
  lap: number;
  ferrari: number;
  mercedes: number;
  redbull: number;
  mclaren: number;
  williams: number;
}

export const lapPositions: LapPosition[] = Array.from({ length: 44 }, (_, i) => {
  const lap = i + 1;
  // Simulate realistic position changes with pit stops
  let ferrari = 1;
  let mercedes = 2;
  let redbull = 3;
  let mclaren = 4;
  let williams = 5;

  // Ferrari pit lap 12: drops to 3rd, recovers by lap 15
  if (lap >= 12 && lap <= 14) {
    ferrari = 3;
    mercedes = 1;
    redbull = 2;
  }
  // Ferrari pit lap 28: drops to 3rd, recovers by lap 32
  if (lap >= 28 && lap <= 31) {
    ferrari = 3;
    mercedes = 1;
    redbull = 2;
  }
  // Mercedes pits laps 14 and 30
  if (lap >= 14 && lap <= 16 && !(lap >= 12 && lap <= 14)) {
    mercedes = 3;
  }
  if (lap >= 30 && lap <= 33 && !(lap >= 28 && lap <= 31)) {
    mercedes = 3;
    ferrari = 1;
    redbull = 2;
  }
  // Red Bull pits laps 16 and 32
  if (lap >= 16 && lap <= 18 && !(lap >= 14 && lap <= 16) && !(lap >= 12 && lap <= 14)) {
    redbull = 4;
  }
  if (lap >= 32 && lap <= 35 && !(lap >= 28 && lap <= 33)) {
    redbull = 4;
    ferrari = 1;
    mercedes = 2;
    mclaren = 3;
  }
  // McLaren pit laps 15 and 33
  if (lap >= 15 && lap <= 17 && !(lap >= 14 && lap <= 18) && !(lap >= 12 && lap <= 14)) {
    mclaren = 5;
    williams = 4;
  }
  if (lap >= 33 && lap <= 36 && !(lap >= 32 && lap <= 35) && !(lap >= 28 && lap <= 33)) {
    mclaren = 5;
    williams = 4;
  }
  // Williams pit lap 20
  if (lap >= 20 && lap <= 23) {
    williams = 5;
  }

  return { lap, ferrari, mercedes, redbull, mclaren, williams };
});

/* ─── Lap Time Data (for strategy chart) ───────────────── */

export interface LapTime {
  lap: number;
  actual: number;
  optimal: number;
  isPitLap: boolean;
}

function generateLapTimes(): LapTime[] {
  const laps: LapTime[] = [];
  for (let i = 1; i <= 44; i++) {
    const baseTime = 108.0 + Math.random() * 4.0;
    const tireDeg = i * 0.03;
    const pitPenalty = (i === 12 || i === 28) ? 18.0 : 0;
    const actual = baseTime + tireDeg + pitPenalty + (Math.random() - 0.5) * 0.8;
    const optimal = baseTime + tireDeg * 0.6;
    laps.push({
      lap: i,
      actual: Math.round(actual * 1000) / 1000,
      optimal: Math.round(optimal * 1000) / 1000,
      isPitLap: i === 12 || i === 28,
    });
  }
  return laps;
}

export const lapTimes = generateLapTimes();

/* ─── Strategy Timeline Events ─────────────────────────── */

export interface StrategyEvent {
  lap: number;
  type: 'start' | 'pit' | 'finish';
  title: string;
  detail: string;
  aiRecommendation?: string;
  aiDelta?: string;
  isOptimal: boolean;
  tireFrom?: string;
  tireTo?: string;
  nodeColor: string;
}

export const strategyEvents: StrategyEvent[] = [
  {
    lap: 1,
    type: 'start',
    title: 'Start auf SOFT',
    detail: 'Grid-Position P1',
    isOptimal: true,
    nodeColor: '#00D084',
  },
  {
    lap: 12,
    type: 'pit',
    title: 'Boxenstopp: SOFT → MEDIUM',
    detail: 'Reifenwechsel nach 11 Runden',
    aiRecommendation: 'KI-Empfohlung: Runde 14-16',
    aiDelta: 'Delta: -2 Runden (fruh)',
    isOptimal: true,
    tireFrom: 'soft',
    tireTo: 'medium',
    nodeColor: '#FFB800',
  },
  {
    lap: 28,
    type: 'pit',
    title: 'Boxenstopp: MEDIUM → HARD',
    detail: 'Reifenwechsel nach 16 Runden',
    aiRecommendation: 'KI-Empfohlung: Runde 30-35',
    aiDelta: 'Delta: -2 Runden (fruh)',
    isOptimal: true,
    tireFrom: 'medium',
    tireTo: 'hard',
    nodeColor: '#FFB800',
  },
  {
    lap: 44,
    type: 'finish',
    title: 'ZIEL — P1',
    detail: 'Gesamtzeit: 1:27:15.432',
    isOptimal: true,
    nodeColor: '#FFB800',
  },
];

/* ─── Performance Metrics ──────────────────────────────── */

export interface PerformanceMetric {
  label: string;
  value: string;
  description: string;
  percent: number;
  color: string;
}

export const performanceMetrics: PerformanceMetric[] = [
  {
    label: 'GESAMTNOTE',
    value: '8.5',
    description: 'Ausgezeichnete Strategie!',
    percent: 85,
    color: '#00D084',
  },
  {
    label: 'BOXENSTOPP-TIMING',
    value: '72%',
    description: '1 von 2 Stopps optimal',
    percent: 72,
    color: '#FFB800',
  },
  {
    label: 'REIFENMANAGEMENT',
    value: '91%',
    description: 'Reifen effizient genutzt',
    percent: 91,
    color: '#00D084',
  },
];

/* ─── Helpers ──────────────────────────────────────────── */

export function getTeamById(id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

export function getTireById(id: string): TireOption | undefined {
  return tireOptions.find((t) => t.id === id);
}

export function formatGap(gap: string): string {
  return gap;
}
