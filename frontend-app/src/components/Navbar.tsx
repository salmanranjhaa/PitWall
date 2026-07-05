import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Flag,
  Gauge,
  Trophy,
  BarChart3,
  CloudRain,
  Brain,
  Menu,
  User,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const routeTitles: Record<string, string> = {
  "/": "NEW SIMULATION",
  "/qualifying": "QUALIFYING SESSION",
  "/dashboard": "ACTIVE RACE",
  "/results": "RACE RESULTS",
  "/leaderboard": "LEADERBOARD",
  "/weather": "WEATHER CENTER",
  "/strategy": "STRATEGY ANALYSIS",
  "/profile": "DRIVER PROFILE",
};

const navLinks = [
  { path: "/", label: "New Simulation", icon: Flag },
  { path: "/dashboard", label: "Active Race", icon: Gauge },
  { path: "/results", label: "Results", icon: Trophy },
  { path: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { path: "/weather", label: "Weather Center", icon: CloudRain },
  { path: "/strategy", label: "Strategy Analysis", icon: Brain },
  { path: "/profile", label: "Driver Profile", icon: User },
];

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const title = routeTitles[location.pathname] || "";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-nero/90 backdrop-blur-md border-b border-border-subtle">
      <div className="flex items-center justify-between h-full px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-rosso"
          >
            <path
              d="M4 16L12 4L20 16H4Z"
              fill="currentColor"
              fillOpacity="0.9"
            />
            <path
              d="M6 16L12 8L18 16"
              stroke="#FFB800"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M8 16L12 11L16 16"
              stroke="white"
              strokeWidth="1"
              fill="none"
            />
          </svg>
          <span className="text-rosso font-black text-lg tracking-tight">
            SCUDERIA
          </span>
        </div>

        {/* Dynamic Title */}
        <motion.div
          key={title}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 } as { duration: number }}
          className="absolute left-1/2 -translate-x-1/2 hidden md:block"
        >
          <span className="text-xs uppercase tracking-[0.25em] text-text-secondary font-semibold">
            {title}
          </span>
        </motion.div>

        {/* Menu Button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="p-2 rounded-md hover:bg-surface transition-colors">
              <Menu className="w-5 h-5 text-text-secondary" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-72 bg-nero border-l border-border-subtle p-0"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <span className="text-rosso font-black text-lg tracking-tight">
                  SCUDERIA
                </span>
              </div>
              <nav className="flex flex-col p-2 gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <a
                      key={link.path}
                      href={`#${link.path}`}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-rosso/10 text-rosso border border-rosso/20"
                          : "text-text-secondary hover:text-text-primary hover:bg-surface"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
