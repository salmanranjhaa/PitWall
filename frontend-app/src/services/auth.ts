/**
 * Auth + player profile API client.
 * Token is kept in localStorage under "pitwall_token".
 */

const BASE = "/api";

const TOKEN_KEY = "pitwall_token";
const USER_KEY = "pitwall_user";

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
}

export interface ProfileStats {
  races: number;
  points: number;
  wins: number;
  podiums: number;
  dnfs: number;
  best_finish: number | null;
  avg_points: number;
  tier: string;
}

export interface RaceHistoryEntry {
  track: string;
  team: string;
  position: number;
  total_laps: number;
  pits: number;
  dnf: number;
  points: number;
  created_at: string;
}

export interface ProfileResponse {
  user: AuthUser & { created_at?: string };
  stats: ProfileStats;
  history: RaceHistoryEntry[];
}

export interface StandingEntry {
  rank: number;
  username: string;
  display_name: string;
  races: number;
  points: number;
  wins: number;
  podiums: number;
}

export interface RaceResultResponse {
  recorded: boolean;
  position: number;
  dnf: boolean;
  points: number;
  is_win: boolean;
  is_podium: boolean;
}

// ── token storage ────────────────────────────────────────────────────────────

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const getStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const isLoggedIn = (): boolean => getToken() !== null;

function storeSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── fetch helpers ────────────────────────────────────────────────────────────

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch { /* non-JSON error body */ }
    throw new Error(detail);
  }
  return res.json();
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function register(username: string, password: string, displayName?: string) {
  const data = await req<{ token: string; user: AuthUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, display_name: displayName || undefined }),
  });
  storeSession(data.token, data.user);
  return data.user;
}

export async function login(username: string, password: string) {
  const data = await req<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  storeSession(data.token, data.user);
  return data.user;
}

export async function logout() {
  try {
    await req("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}

export const fetchProfile = () => req<ProfileResponse>("/profile");

export const fetchStandings = (limit = 20) =>
  req<{ standings: StandingEntry[] }>(`/profile/leaderboard?limit=${limit}`);

export const submitRaceResult = (sessionId: string) =>
  req<RaceResultResponse>("/profile/race-result", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
