import React, { useEffect, useState } from 'react';

interface HitCounterProps {
  initialCount?: number;
}

export const HitCounter: React.FC<HitCounterProps> = ({ initialCount = 142095 }) => {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // Increment visitor count slightly in localStorage to feel authentic
    const stored = localStorage.getItem('df95_hit_count');
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        const next = parsed + 1;
        setCount(next);
        localStorage.setItem('df95_hit_count', String(next));
        return;
      }
    }
    localStorage.setItem('df95_hit_count', String(initialCount + 1));
    setCount(initialCount + 1);
  }, [initialCount]);

  const formatted = String(count).padStart(6, '0');

  return (
    <div className="inline-flex items-center gap-1.5 p-1 bg-[#c0c0c0] bevel-inset select-none">
      <span className="text-[10px] font-bold tracking-tight text-[#404040]">VISITOR NO:</span>
      <div className="hit-counter font-mono">
        {formatted.split('').map((digit, idx) => (
          <span
            key={idx}
            className="px-0.5 border-r border-[#333333] last:border-r-0 text-[#00ff00] bg-black"
          >
            {digit}
          </span>
        ))}
      </div>
    </div>
  );
};
