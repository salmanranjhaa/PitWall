import {
  TEAMS,
  TRACKS,
  LEADERBOARD_DATA,
  LAP_DATA,
  WEATHER_FORECAST,
  STRATEGY_MESSAGES,
  TIRE_DEGRADATION,
  WIN_PROBABILITY,
  POSITION_HISTORY,
  DRIVER_STANDINGS,
  CONSTRUCTOR_STANDINGS,
} from "@/data/mockData";

const delay = (ms: number = 300) => new Promise((r) => setTimeout(r, ms));

export async function getTeams() {
  await delay();
  return [...TEAMS];
}

export async function getTracks() {
  await delay();
  return [...TRACKS];
}

export async function getLeaderboard() {
  await delay();
  return [...LEADERBOARD_DATA];
}

export async function getLapData() {
  await delay();
  return [...LAP_DATA];
}

export async function getWeatherForecast() {
  await delay();
  return [...WEATHER_FORECAST];
}

export async function getStrategyMessages() {
  await delay();
  return [...STRATEGY_MESSAGES];
}

export async function getTireDegradation() {
  await delay();
  return { ...TIRE_DEGRADATION };
}

export async function getWinProbability() {
  await delay();
  return [...WIN_PROBABILITY];
}

export async function getPositionHistory() {
  await delay();
  return [...POSITION_HISTORY];
}

export async function getDriverStandings() {
  await delay();
  return [...DRIVER_STANDINGS];
}

export async function getConstructorStandings() {
  await delay();
  return [...CONSTRUCTOR_STANDINGS];
}

export async function startSimulation(config: {
  team: string;
  track: string;
  startingTire: string;
  temperature: number;
}) {
  await delay(800);
  return {
    id: `sim-${Date.now()}`,
    status: "active" as const,
    config,
    currentLap: 1,
    totalLaps: TRACKS.find((t) => t.name === config.track)?.laps ?? 44,
  };
}

export async function advanceLap(simId: string) {
  await delay(400);
  return {
    simId,
    currentLap: Math.floor(Math.random() * 20) + 5,
    status: "active" as const,
  };
}
