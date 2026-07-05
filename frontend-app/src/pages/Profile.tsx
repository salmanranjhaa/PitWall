import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Medal, Flag, LogOut, User, Star, TrendingUp, AlertTriangle,
} from "lucide-react";
import {
  isLoggedIn, login, register, logout, fetchProfile, fetchStandings,
  type ProfileResponse, type StandingEntry,
} from "@/services/auth";

// ── auth form ─────────────────────────────────────────────────────────────────

function AuthForm({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(username, password);
      else await register(username, password, displayName);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto mt-16 bg-carbon border border-border-subtle rounded-2xl p-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-rosso/20 flex items-center justify-center">
          <User className="w-5 h-5 text-rosso" />
        </div>
        <div>
          <h2 className="text-lg font-black uppercase tracking-wider text-text-primary">
            {mode === "login" ? "Driver Sign-In" : "Create Driver Profile"}
          </h2>
          <p className="text-[11px] text-text-ghost">
            Track your races, points and career tier
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-6 p-1 bg-nero rounded-lg">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); }}
            className={`py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
              mode === m ? "bg-rosso text-white" : "text-text-ghost hover:text-text-secondary"
            }`}
          >
            {m === "login" ? "Sign In" : "Register"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-text-ghost mb-1.5">
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_\-]+"
            title="Letters, numbers, underscores and dashes only"
            className="w-full px-3 py-2.5 rounded-lg bg-nero border border-border-subtle text-sm text-text-primary focus:border-rosso focus:outline-none"
            placeholder="max_verstappen"
          />
        </div>

        {mode === "register" && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-ghost mb-1.5">
              Display Name <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className="w-full px-3 py-2.5 rounded-lg bg-nero border border-border-subtle text-sm text-text-primary focus:border-rosso focus:outline-none"
              placeholder="Max Verstappen"
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-text-ghost mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2.5 rounded-lg bg-nero border border-border-subtle text-sm text-text-primary focus:border-rosso focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-lg bg-rosso text-white text-[12px] font-black uppercase tracking-widest hover:bg-rosso/85 transition-colors disabled:opacity-50"
        >
          {busy ? "…" : mode === "login" ? "Sign In" : "Create Profile"}
        </button>
      </form>
    </motion.div>
  );
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="bg-carbon border border-border-subtle rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "#6B6B8A" }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-ghost">{label}</span>
      </div>
      <div className="text-2xl font-black text-text-primary tabular-nums">{value}</div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([fetchProfile(), fetchStandings(20)]);
      setProfile(p);
      setStandings(s.standings);
    } catch {
      // token expired or backend unreachable — force re-auth
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const handleLogout = async () => {
    await logout();
    setAuthed(false);
    setProfile(null);
  };

  if (!authed) {
    return (
      <div className="min-h-screen px-4 pb-16">
        <AuthForm onAuthed={() => setAuthed(true)} />
      </div>
    );
  }

  const stats = profile?.stats;

  return (
    <div className="min-h-screen px-4 md:px-8 pb-16 pt-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rosso/20 border border-rosso/40 flex items-center justify-center">
            <User className="w-7 h-7 text-rosso" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-text-primary">
              {profile?.user.display_name ?? "…"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                {stats?.tier ?? ""}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-carbon border border-border-subtle text-[11px] font-bold uppercase tracking-wider text-text-ghost hover:text-text-secondary transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {loading && !profile ? (
        <div className="text-text-ghost text-sm">Loading profile…</div>
      ) : (
        <>
          {/* Career stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-10">
            <StatCard label="Races" value={stats?.races ?? 0} icon={Flag} />
            <StatCard label="Points" value={stats?.points ?? 0} icon={TrendingUp} accent="#FFB800" />
            <StatCard label="Wins" value={stats?.wins ?? 0} icon={Trophy} accent="#FFD700" />
            <StatCard label="Podiums" value={stats?.podiums ?? 0} icon={Medal} accent="#CD7F32" />
            <StatCard label="Best Finish" value={stats?.best_finish ? `P${stats.best_finish}` : "—"} icon={Star} />
            <StatCard label="Avg Points" value={stats?.avg_points ?? 0} icon={TrendingUp} />
            <StatCard label="DNFs" value={stats?.dnfs ?? 0} icon={AlertTriangle} accent="#FF2D2D" />
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Race history */}
            <section>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-secondary mb-4">
                Race History
              </h2>
              <div className="bg-carbon border border-border-subtle rounded-xl overflow-hidden">
                {profile?.history.length ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-ghost">
                        <th className="px-4 py-2.5">Track</th>
                        <th className="px-2 py-2.5">Team</th>
                        <th className="px-2 py-2.5 text-center">Pos</th>
                        <th className="px-2 py-2.5 text-center">Pits</th>
                        <th className="px-4 py-2.5 text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.history.map((r, i) => (
                        <tr key={i} className="border-b border-border-subtle/50 text-[12px] text-text-secondary">
                          <td className="px-4 py-2.5 font-semibold">{r.track}</td>
                          <td className="px-2 py-2.5">{r.team}</td>
                          <td className="px-2 py-2.5 text-center font-bold tabular-nums">
                            {r.dnf ? <span className="text-red-400">DNF</span> : `P${r.position}`}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums">{r.pits}</td>
                          <td className="px-4 py-2.5 text-right font-black tabular-nums text-amber-400">
                            {r.points > 0 ? `+${r.points}` : "0"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-[12px] text-text-ghost">
                    No races yet — start a simulation and finish a race to earn points.
                  </div>
                )}
              </div>
            </section>

            {/* Global standings */}
            <section>
              <h2 className="text-sm font-black uppercase tracking-widest text-text-secondary mb-4">
                Global Standings
              </h2>
              <div className="bg-carbon border border-border-subtle rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-ghost">
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-2 py-2.5">Driver</th>
                      <th className="px-2 py-2.5 text-center">Races</th>
                      <th className="px-2 py-2.5 text-center">Wins</th>
                      <th className="px-4 py-2.5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s) => {
                      const isMe = s.username === profile?.user.username;
                      return (
                        <tr
                          key={s.username}
                          className={`border-b border-border-subtle/50 text-[12px] ${
                            isMe ? "bg-rosso/10 text-text-primary" : "text-text-secondary"
                          }`}
                        >
                          <td className="px-4 py-2.5 font-black tabular-nums">
                            {s.rank <= 3 ? ["🥇", "🥈", "🥉"][s.rank - 1] : s.rank}
                          </td>
                          <td className="px-2 py-2.5 font-semibold">
                            {s.display_name}
                            {isMe && <span className="ml-1.5 text-[9px] uppercase text-rosso font-black">you</span>}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums">{s.races}</td>
                          <td className="px-2 py-2.5 text-center tabular-nums">{s.wins}</td>
                          <td className="px-4 py-2.5 text-right font-black tabular-nums text-amber-400">{s.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
