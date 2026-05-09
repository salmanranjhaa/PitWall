import { memo } from 'react';
import { motion } from 'framer-motion';

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
  color: string;
  shape: 'rect' | 'circle';
}

const COLORS = ['#FFB800', '#FFD700', '#C0C0C0', '#FF1E00'];
const SHAPES: Array<'rect' | 'circle'> = ['rect', 'circle', 'rect', 'circle'];

function generatePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 2,
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  }));
}

const pieces = generatePieces(50);

const Confetti = memo(function Confetti() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 5 }}>
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          className={piece.shape === 'circle' ? 'rounded-full' : 'rounded-sm'}
          style={{
            position: 'absolute',
            left: `${piece.x}%`,
            top: -20,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            opacity: 0.6,
          }}
          initial={{ y: -20, rotate: 0, opacity: 0 }}
          animate={{
            y: ['0vh', '110vh'],
            rotate: [0, piece.rotation + 720],
            opacity: [0, 0.7, 0.7, 0],
          }}
          transition={{
            y: {
              duration: piece.duration,
              delay: piece.delay + 1.5,
              repeat: Infinity,
              ease: 'linear',
            },
            rotate: {
              duration: piece.duration,
              delay: piece.delay + 1.5,
              repeat: Infinity,
              ease: 'linear',
            },
            opacity: {
              duration: piece.duration,
              delay: piece.delay + 1.5,
              repeat: Infinity,
              times: [0, 0.1, 0.8, 1],
            },
          }}
        />
      ))}
    </div>
  );
});

export default Confetti;
