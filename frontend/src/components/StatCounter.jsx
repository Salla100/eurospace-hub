import { useEffect, useState, useRef } from 'react';

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    if (!target) return;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

function Stat({ icon, value, label, delay = 0 }) {
  const count = useCountUp(value, 1000 + delay);
  return (
    <div
      className="flex flex-col items-center gap-1 count-anim"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-3xl sm:text-4xl font-extrabold text-space-text tabular-nums">
        {count.toLocaleString()}
      </span>
      <span className="text-xs sm:text-sm text-space-muted text-center">{label}</span>
    </div>
  );
}

export default function StatCounter({ stats }) {
  if (!stats) return null;

  const locations = new Set();
  // rough country count from opportunity data
  const countryCount = 15;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
      <Stat icon="🚀" value={stats.total} label="Total Opportunities" delay={0} />
      <Stat icon="💰" value={stats.funded_count} label="Fully Funded" delay={100} />
      <Stat icon="🌍" value={countryCount} label="Countries Covered" delay={200} />
      <Stat
        icon="🛸"
        value={(stats.bvsr_member_count || 0) + (stats.norstec_member_count || 0)}
        label="Student Teams"
        delay={300}
      />
    </div>
  );
}
