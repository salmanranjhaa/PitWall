export interface DriverEntry {
  name: string;
  number: number;
}

export interface TeamEntry {
  name: string;
  color: string;
  code: string;
  drivers: DriverEntry[];
}

export const TEAMS: TeamEntry[] = [
  { name: "Red Bull Racing", color: "#1E41FF", code: "RBR", drivers: [
    { name: "Max Verstappen", number: 1 },
    { name: "Liam Lawson", number: 30 },
  ]},
  { name: "Mercedes", color: "#00D2BE", code: "MER", drivers: [
    { name: "George Russell", number: 63 },
    { name: "Kimi Antonelli", number: 12 },
  ]},
  { name: "Ferrari", color: "#FF1E00", code: "FER", drivers: [
    { name: "Charles Leclerc", number: 16 },
    { name: "Lewis Hamilton", number: 44 },
  ]},
  { name: "McLaren", color: "#FF8700", code: "MCL", drivers: [
    { name: "Lando Norris", number: 4 },
    { name: "Oscar Piastri", number: 81 },
  ]},
  { name: "Aston Martin", color: "#006F62", code: "AST", drivers: [
    { name: "Fernando Alonso", number: 14 },
    { name: "Lance Stroll", number: 18 },
  ]},
  { name: "Alpine", color: "#0090FF", code: "ALP", drivers: [
    { name: "Pierre Gasly", number: 10 },
    { name: "Jack Doohan", number: 7 },
  ]},
  { name: "Williams", color: "#00A0DE", code: "WIL", drivers: [
    { name: "Alexander Albon", number: 23 },
    { name: "Carlos Sainz", number: 55 },
  ]},
  { name: "RB", color: "#1434CB", code: "RB", drivers: [
    { name: "Yuki Tsunoda", number: 22 },
    { name: "Isack Hadjar", number: 6 },
  ]},
  { name: "Kick Sauber", color: "#A3A3A3", code: "KCK", drivers: [
    { name: "Nico Hulkenberg", number: 27 },
    { name: "Gabriel Bortoleto", number: 5 },
  ]},
  { name: "Haas", color: "#B6BABD", code: "HAA", drivers: [
    { name: "Esteban Ocon", number: 31 },
    { name: "Oliver Bearman", number: 87 },
  ]},
];

export const TRACKS = [
  { name: "Bahrain Grand Prix", country: "Bahrain", flag: "BH", laps: 57 },
  { name: "Saudi Arabian Grand Prix", country: "Saudi Arabia", flag: "SA", laps: 50 },
  { name: "Australian Grand Prix", country: "Australia", flag: "AU", laps: 58 },
  { name: "Japanese Grand Prix", country: "Japan", flag: "JP", laps: 53 },
  { name: "Chinese Grand Prix", country: "China", flag: "CN", laps: 56 },
  { name: "Miami Grand Prix", country: "USA", flag: "US", laps: 57 },
  { name: "Emilia Romagna Grand Prix", country: "Italy", flag: "IT", laps: 63 },
  { name: "Monaco Grand Prix", country: "Monaco", flag: "MC", laps: 78 },
  { name: "Canadian Grand Prix", country: "Canada", flag: "CA", laps: 70 },
  { name: "Spanish Grand Prix", country: "Spain", flag: "ES", laps: 66 },
  { name: "Austrian Grand Prix", country: "Austria", flag: "AT", laps: 71 },
  { name: "British Grand Prix", country: "UK", flag: "GB", laps: 52 },
  { name: "Hungarian Grand Prix", country: "Hungary", flag: "HU", laps: 70 },
  { name: "Belgian Grand Prix", country: "Belgium", flag: "BE", laps: 44 },
  { name: "Dutch Grand Prix", country: "Netherlands", flag: "NL", laps: 72 },
  { name: "Italian Grand Prix", country: "Italy", flag: "IT", laps: 53 },
  { name: "Azerbaijan Grand Prix", country: "Azerbaijan", flag: "AZ", laps: 51 },
  { name: "Singapore Grand Prix", country: "Singapore", flag: "SG", laps: 62 },
  { name: "United States Grand Prix", country: "USA", flag: "US", laps: 56 },
  { name: "Mexico City Grand Prix", country: "Mexico", flag: "MX", laps: 71 },
  { name: "Sao Paulo Grand Prix", country: "Brazil", flag: "BR", laps: 71 },
  { name: "Las Vegas Grand Prix", country: "USA", flag: "US", laps: 50 },
  { name: "Qatar Grand Prix", country: "Qatar", flag: "QA", laps: 57 },
  { name: "Abu Dhabi Grand Prix", country: "UAE", flag: "AE", laps: 58 },
];

export const LEADERBOARD_DATA = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  date: new Date(2024, 2 + Math.floor(i / 2), 15 + (i % 3) * 7).toISOString().split('T')[0],
  track: TRACKS[i % TRACKS.length].name,
  team: TEAMS[i % TEAMS.length].name,
  position: (i % 5) + 1,
  raceTime: `${Math.floor(85 + i)}:${String(Math.floor(10 + Math.random() * 50)).padStart(2, '0')}.${String(Math.floor(100 + Math.random() * 900)).padStart(3, '0')}`,
  bestLap: `1:${String(Math.floor(20 + Math.random() * 15)).padStart(2, '0')}.${String(Math.floor(100 + Math.random() * 900)).padStart(3, '0')}`,
  strategy: i % 3 === 0 ? "S-M-H" : i % 3 === 1 ? "S-H" : "M-H",
  points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][Math.min(i % 10, 9)],
  fastestLap: i % 4 === 0,
}));

// Lap times for 5 teams over 44 laps (Belgian GP)
export const LAP_DATA = Array.from({ length: 44 }, (_, lap) => {
  const baseTimes = [107.5, 108.0, 108.3, 108.8, 109.2];
  const teamNames = ["Mercedes", "Ferrari", "Red Bull", "McLaren", "Aston Martin"];
  const compounds = ["SOFT", "MEDIUM", "SOFT", "HARD", "MEDIUM"];
  return {
    lap: lap + 1,
    times: baseTimes.map((base, i) => {
      const tireAge = lap % 16;
      const deg = compounds[i] === "SOFT" ? 0.065 : compounds[i] === "MEDIUM" ? 0.04 : 0.025;
      const fuel = 0.03 * (44 - lap);
      return base + deg * Math.pow(tireAge, 1.3) * 0.5 + fuel * 0.3 + (Math.random() - 0.5) * 0.3;
    }),
    teams: teamNames,
    compounds,
  };
});

export const WEATHER_FORECAST = Array.from({ length: 20 }, (_, i) => ({
  lap: 5 + i,
  rainProbability: Math.max(0, Math.min(1, 0.05 + (i > 8 ? (i - 8) * 0.08 : 0))),
  condition: i < 8 ? "DRY" : i < 14 ? "DRIZZLE" : "LIGHT_RAIN",
  trackDampness: i < 8 ? 0 : i < 14 ? (i - 8) * 0.08 : 0.5 + (i - 14) * 0.05,
  airTemp: 28 - (i > 10 ? (i - 10) * 0.5 : 0),
}));

export const STRATEGY_MESSAGES = [
  { lap: 4, type: "INFO" as const, text: "Tire degradation within normal parameters — 8 laps remaining", confidence: 0.88 },
  { lap: 8, type: "WARNING" as const, text: "P2 Verstappen closing gap — now +1.2s (was +2.1s 3 laps ago)", confidence: 0.92 },
  { lap: 12, type: "OPPORTUNITY" as const, text: "Undercut window opening — pit now to gain track position", confidence: 0.78 },
  { lap: 16, type: "WARNING" as const, text: "Rain expected in 6 laps — consider Intermediate tires", confidence: 0.72 },
  { lap: 20, type: "URGENT" as const, text: "Light rain starting — pit for Inters immediately", confidence: 0.91 },
  { lap: 25, type: "INFO" as const, text: "Track drying — racing line improving, stay on Inters", confidence: 0.85 },
  { lap: 32, type: "OPPORTUNITY" as const, text: "Drying conditions — switch to Softs for pace advantage", confidence: 0.74 },
];

export const TIRE_DEGRADATION = {
  SOFT: Array.from({ length: 25 }, (_, i) => ({ lap: i, time: i <= 3 ? 0.065 * 0.3 * i : 0.065 * Math.pow(i, 1.3) })),
  MEDIUM: Array.from({ length: 35 }, (_, i) => ({ lap: i, time: i <= 3 ? 0.04 * 0.3 * i : 0.04 * Math.pow(i, 1.3) })),
  HARD: Array.from({ length: 45 }, (_, i) => ({ lap: i, time: i <= 3 ? 0.025 * 0.3 * i : 0.025 * Math.pow(i, 1.3) })),
  INTERMEDIATE: Array.from({ length: 20 }, (_, i) => ({ lap: i, time: 0.015 * i })),
  WET: Array.from({ length: 20 }, (_, i) => ({ lap: i, time: 0.01 * i })),
};

export const WIN_PROBABILITY = Array.from({ length: 44 }, (_, i) => ({
  lap: i + 1,
  probability: 0.35 + 0.4 * (i / 43) + Math.sin(i * 0.3) * 0.08,
}));

export const POSITION_HISTORY = Array.from({ length: 44 }, (_, lap) => ({
  lap: lap + 1,
  Mercedes: 1 + (lap > 15 && lap < 20 ? 1 : 0) + (Math.random() * 0.1),
  Ferrari: 2 - (lap > 15 && lap < 20 ? 1 : 0) + (Math.random() * 0.1),
  RedBull: 3 + (lap > 25 ? -0.5 : 0) + (Math.random() * 0.1),
  McLaren: 4 + (Math.random() * 0.2),
  Williams: 5 + (Math.random() * 0.2),
}));

export const DRIVER_STANDINGS = [
  { position: 1, driver: "Max Verstappen", team: "Red Bull Racing", points: 437, wins: 8, podiums: 14 },
  { position: 2, driver: "Lando Norris", team: "McLaren", points: 374, wins: 5, podiums: 13 },
  { position: 3, driver: "Charles Leclerc", team: "Ferrari", points: 356, wins: 4, podiums: 11 },
  { position: 4, driver: "Oscar Piastri", team: "McLaren", points: 290, wins: 3, podiums: 9 },
  { position: 5, driver: "Carlos Sainz", team: "Williams", points: 240, wins: 1, podiums: 7 },
  { position: 6, driver: "George Russell", team: "Mercedes", points: 211, wins: 1, podiums: 6 },
  { position: 7, driver: "Lewis Hamilton", team: "Ferrari", points: 198, wins: 1, podiums: 6 },
  { position: 8, driver: "Fernando Alonso", team: "Aston Martin", points: 162, wins: 0, podiums: 4 },
];

export const CONSTRUCTOR_STANDINGS = [
  { position: 1, team: "Red Bull Racing", points: 860, wins: 21 },
  { position: 2, team: "Mercedes", points: 657, wins: 4 },
  { position: 3, team: "Ferrari", points: 646, wins: 3 },
  { position: 4, team: "McLaren", points: 532, wins: 1 },
  { position: 5, team: "Aston Martin", points: 289, wins: 0 },
];
