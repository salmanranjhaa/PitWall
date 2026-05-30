import { motion } from 'framer-motion';
import type { BDIState } from './data';

interface Props {
  bdiStates?: Record<number, BDIState>;
}

export default function BDIDebugPanel({ bdiStates }: Props) {
  if (!bdiStates || Object.keys(bdiStates).length === 0) {
    return null;
  }

  const entries = Object.values(bdiStates).sort(
    (a, b) => a.driver_number - b.driver_number
  );

  return (
    <motion.div
      className="rounded-lg overflow-hidden mb-4"
      style={{
        background: 'linear-gradient(160deg, #16161E 0%, #13131A 100%)',
        border: '1px solid #2D2D3D',
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="p-3">
        <h4
          className="text-xs font-semibold tracking-[0.1em] uppercase mb-2"
          style={{ color: '#00F5D4' }}
        >
          BDI Debug
        </h4>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {entries.map((state) => (
            <div
              key={state.driver_number}
              className="text-[10px] p-2 rounded"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="font-semibold" style={{ color: '#F0F0F5' }}>
                #{state.driver_number}
              </span>{' '}
              <span style={{ color: '#FFB800' }}>
                {state.top_desire ?? '—'}
              </span>
              <div style={{ color: '#8888A0' }}>
                {state.current_plan ?? 'NO_PLAN'} | step {state.plan_step}
              </div>
              {state.tire_degrading_faster && (
                <div style={{ color: '#FF2D2D' }}>deg+</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
