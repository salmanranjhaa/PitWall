import { TIRE_COLORS } from './data';
import type { TireCompound } from './types';

interface TireDotsProps {
  strategy: TireCompound[];
}

export default function TireDots({ strategy }: TireDotsProps) {
  return (
    <div className="flex items-center gap-1">
      {strategy.map((compound, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <div
            className="w-3 h-3 rounded-full border border-[#2D2D3D]"
            style={{ backgroundColor: TIRE_COLORS[compound] || '#55556B' }}
            title={compound === 'S' ? 'Soft' : compound === 'M' ? 'Medium' : compound === 'H' ? 'Hard' : compound === 'I' ? 'Intermediate' : 'Wet'}
          />
          {idx < strategy.length - 1 && (
            <span className="text-[10px]" style={{ color: '#55556B' }}>&rarr;</span>
          )}
        </div>
      ))}
    </div>
  );
}
