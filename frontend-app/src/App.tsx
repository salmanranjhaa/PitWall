import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';
import Leaderboard from './pages/Leaderboard';
import WeatherCenter from './pages/Weather';
import StrategyAnalysis from './pages/Strategy';
import Qualifying from './pages/Qualifying';

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/qualifying" element={<Qualifying />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/weather" element={<WeatherCenter />} />
          <Route path="/strategy" element={<StrategyAnalysis />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
