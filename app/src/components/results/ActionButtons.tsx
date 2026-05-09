import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Trophy, RotateCcw } from 'lucide-react';

const easePrimary = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function ActionButtons() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section className="py-12 px-4 md:px-6">
      <motion.div
        ref={ref}
        className="max-w-[1000px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-4"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4 }}
      >
        {/* New Simulation - Primary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0, ease: easePrimary }}
        >
          <Link to="/">
            <button
              className="flex items-center gap-3 px-9 py-4 rounded-xl text-sm font-semibold tracking-[0.08em] uppercase text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #CC0000 0%, #FF1E00 50%, #CC0000 100%)',
                boxShadow: '0 4px 16px rgba(255,30,0,0.3)',
              }}
            >
              <Flag className="w-5 h-5" />
              NEUE SIMULATION
            </button>
          </Link>
        </motion.div>

        {/* Race Replay - Secondary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.1, ease: easePrimary }}
        >
          <button
            className="flex items-center gap-3 px-9 py-4 rounded-xl text-sm font-semibold tracking-[0.08em] uppercase transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            style={{
              backgroundColor: '#16161E',
              color: '#F0F0F5',
              border: '1px solid #2D2D3D',
            }}
            onClick={() => {}}
          >
            <RotateCcw className="w-5 h-5" />
            RENNWIEDERHOLUNG
          </button>
        </motion.div>

        {/* Leaderboard - Secondary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.2, ease: easePrimary }}
        >
          <Link to="/leaderboard">
            <button
              className="flex items-center gap-3 px-9 py-4 rounded-xl text-sm font-semibold tracking-[0.08em] uppercase transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
              style={{
                backgroundColor: '#16161E',
                color: '#F0F0F5',
                border: '1px solid #2D2D3D',
              }}
            >
              <Trophy className="w-5 h-5" />
              ZUR RANGLISTE
            </button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
