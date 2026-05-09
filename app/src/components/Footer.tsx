import { useLocation } from 'react-router-dom';

export default function Footer() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

  if (isDashboard) return null;

  return (
    <footer
      className="h-[48px] flex items-center justify-between px-4 md:px-6 shrink-0"
      style={{
        backgroundColor: '#0A0A0F',
        borderTop: '1px solid #2D2D3D',
      }}
    >
      <span className="text-xs tracking-[0.02em]" style={{ color: '#55556B' }}>
        Scuderia v1.0.0
      </span>
      <span className="text-xs tracking-[0.02em] text-right" style={{ color: '#55556B' }}>
        Nicht offiziell mit FIA oder F1 verbunden
      </span>
    </footer>
  );
}
