import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';
import Leaderboard from './pages/Leaderboard';
import WeatherCenter from './pages/Weather';
import StrategyAnalysis from './pages/Strategy';
import Qualifying from './pages/Qualifying';
import Profile, { AuthForm } from './pages/Profile';
import { isLoggedIn, AUTH_CHANGED_EVENT } from './services/auth';

/**
 * Login-first gate: the app is only reachable with a driver profile.
 * Shows the sign-in / register screen until a session exists, and drops
 * back to it when the user signs out (via the AUTH_CHANGED_EVENT).
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(isLoggedIn());

  useEffect(() => {
    const sync = () => setAuthed(isLoggedIn());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!authed) {
    return (
      <div className="min-h-screen bg-nero px-4 pb-16">
        <div className="pt-14 text-center">
          <h1 className="text-4xl font-black uppercase tracking-tight text-rosso">PitWall</h1>
          <p className="text-text-secondary text-sm mt-2">
            F1 race strategy simulator — sign in to take your seat on the pit wall.
          </p>
        </div>
        <AuthForm onAuthed={() => setAuthed(true)} />
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <AuthGate>
        <Layout>
          <Routes>
            <Route path="/" element={<Setup />} />
            <Route path="/qualifying" element={<Qualifying />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/results" element={<Results />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/weather" element={<WeatherCenter />} />
            <Route path="/strategy" element={<StrategyAnalysis />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Layout>
      </AuthGate>
    </HashRouter>
  );
}
