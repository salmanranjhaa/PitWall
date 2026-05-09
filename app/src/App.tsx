import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';
import Leaderboard from './pages/Leaderboard';

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
