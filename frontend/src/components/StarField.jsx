import { useMemo } from 'react';

export default function StarField({ count = 120 }) {
  const stars = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      duration: (Math.random() * 4 + 2).toFixed(1),
      delay: (Math.random() * 4).toFixed(1),
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <svg width="100%" height="100%" className="absolute inset-0">
        {stars.map((s) => (
          <circle
            key={s.id}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.size}
            fill="white"
            style={{
              animation: `twinkle ${s.duration}s ${s.delay}s infinite`,
            }}
          />
        ))}
      </svg>
      {/* Nebula gradients */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(79,142,247,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.2) 0%, transparent 50%)',
        }}
      />
    </div>
  );
}
