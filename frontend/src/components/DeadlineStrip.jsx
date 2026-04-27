import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { deadlineColorHex, deadlineLabel, formatDate, daysUntil } from '../utils.js';

export default function DeadlineStrip({ deadlines = [], onClickOpp }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!deadlines.length) return null;

  return (
    <div className="sticky top-14 z-30 border-b border-space-warn/30 bg-amber-950/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <button
          className="w-full flex items-center justify-between py-2 text-left"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          <div className="flex items-center gap-2 text-space-warn text-xs font-semibold">
            <AlertCircle size={13} />
            ⚠️ {deadlines.length} deadline{deadlines.length > 1 ? 's' : ''} within 30 days
          </div>
          {collapsed ? <ChevronDown size={14} className="text-space-warn" /> : <ChevronUp size={14} className="text-space-warn" />}
        </button>

        {!collapsed && (
          <div className="pb-3 flex flex-wrap gap-2">
            {deadlines.map((opp) => {
              const d = daysUntil(opp.deadline);
              const color = deadlineColorHex(opp.deadline);
              const label = deadlineLabel(opp.deadline);
              return (
                <button
                  key={opp.id}
                  onClick={() => onClickOpp(opp)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs hover:opacity-80 transition-opacity"
                  style={{ borderColor: `${color}44`, background: `${color}12`, color }}
                >
                  <span className="font-medium truncate max-w-[160px]">{opp.title}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
                    style={{ background: `${color}30`, color }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
