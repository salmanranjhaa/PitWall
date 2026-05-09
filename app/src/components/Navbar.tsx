import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, ChevronLeft, Gauge, Trophy, Flag, BarChart3 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/': 'RACE STRATEGY SIMULATOR',
  '/dashboard': 'AKTIVES RENNEN',
  '/results': 'ERGEBNISSE',
  '/leaderboard': 'RANGLLISTE',
};

const navLinks = [
  { to: '/', label: 'NEUE SIMULATION', icon: Flag },
  { to: '/dashboard', label: 'AKTIVES RENNEN', icon: Gauge },
  { to: '/results', label: 'ERGEBNISSE', icon: Trophy },
  { to: '/leaderboard', label: 'RANGLLISTE', icon: BarChart3 },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const pageTitle = pageTitles[currentPath] || 'SCUDERIA';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-[56px] flex items-center justify-between px-4 md:px-6"
      style={{
        backgroundColor: '#0A0A0F',
        borderBottom: '1px solid #2D2D3D',
      }}
    >
      {/* Left: F1 Logo */}
      <Link
        to="/"
        className="flex items-center gap-3 shrink-0"
      >
        <img
          src="./f1-logo.svg"
          alt="F1"
          className="h-5 w-auto"
        />
        <span
          className="hidden sm:inline text-[0.875rem] font-semibold tracking-[0.1em]"
          style={{ color: '#8B8BA0' }}
        >
          SCUDERIA
        </span>
      </Link>

      {/* Center: Dynamic page title */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span
          className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase whitespace-nowrap"
          style={{ color: '#F0F0F5' }}
        >
          {pageTitle}
        </span>
      </div>

      {/* Right: Hamburger menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[#2A2A38]"
            style={{ color: '#8B8BA0' }}
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-[280px] p-0 border-l border-[#2D2D3D]"
          style={{ backgroundColor: '#0A0A0F' }}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-[#2D2D3D]">
              <SheetTitle className="text-sm font-semibold tracking-[0.1em] uppercase" style={{ color: '#FFB800' }}>
                MENU
              </SheetTitle>
            </div>

            <nav className="flex-1 py-4">
              {navLinks.map((link) => {
                const isActive = currentPath === link.to;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200',
                      isActive
                        ? 'text-[#FFB800] bg-[rgba(255,184,0,0.08)] border border-[rgba(255,184,0,0.25)]'
                        : 'text-[#8B8BA0] hover:text-[#F0F0F5] hover:bg-[#2A2A38]'
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-semibold tracking-[0.08em] uppercase">
                      {link.label}
                    </span>
                    {isActive && (
                      <ChevronLeft className="w-4 h-4 ml-auto rotate-180" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="border-t border-[#2D2D3D] mx-4" />

            {/* Footer info */}
            <div className="p-4">
              <p className="text-xs" style={{ color: '#55556B' }}>
                Scuderia F1 Strategy Simulator
              </p>
              <p className="text-xs mt-1" style={{ color: '#55556B' }}>
                v1.0.0
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
