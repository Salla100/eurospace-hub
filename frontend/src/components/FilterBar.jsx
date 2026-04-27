import { Search, SlidersHorizontal } from 'lucide-react';
import { CATEGORY_GROUPS } from '../utils.js';

export default function FilterBar({ filters, setFilters, total, filtered }) {
  const { search, group, funded, teamBased, openAll, openNow, sort } = filters;

  function set(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }

  function toggle(key) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const groupKeys = Object.keys(CATEGORY_GROUPS);

  return (
    <div
      className="sticky z-20 border-b border-space-border bg-space-bg/95 backdrop-blur-md py-3"
      style={{ top: '56px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3">
        {/* Search + sort row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted" />
            <input
              type="search"
              placeholder="Search opportunities, organisations, tags…"
              value={search}
              onChange={(e) => set('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-space-card border border-space-border text-sm text-space-text placeholder-space-muted focus:outline-none focus:border-space-accent transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-space-muted shrink-0" />
            <select
              value={sort}
              onChange={(e) => set('sort', e.target.value)}
              className="pl-2 pr-6 py-2 rounded-lg bg-space-card border border-space-border text-sm text-slate-300 focus:outline-none focus:border-space-accent appearance-none cursor-pointer"
            >
              <option value="deadline">Sort: Deadline ↑</option>
              <option value="alpha">Sort: A–Z</option>
              <option value="recent">Sort: Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {groupKeys.map((g) => (
            <button
              key={g}
              onClick={() => set('group', g === group ? 'All' : g)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                group === g
                  ? 'bg-space-accent text-white border-space-accent'
                  : 'bg-space-card border-space-border text-slate-400 hover:border-space-accent hover:text-space-text'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Toggle filters + count */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'funded', label: '💰 Funded Only', val: funded },
            { key: 'teamBased', label: '👥 Team-Based', val: teamBased },
            { key: 'openAll', label: '🌍 Any Field', val: openAll },
            { key: 'openNow', label: '⚠️ Has Deadline', val: openNow },
          ].map(({ key, label, val }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                val
                  ? 'bg-space-accent/20 text-space-accent border-space-accent/50'
                  : 'bg-space-card text-slate-400 border-space-border hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}

          <span className="ml-auto text-xs text-space-muted">
            Showing <span className="text-space-text font-semibold">{filtered}</span> of{' '}
            <span className="text-space-text font-semibold">{total}</span> opportunities
          </span>
        </div>
      </div>
    </div>
  );
}
