import { useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { CATEGORY_GROUPS } from '../utils.js';

export default function FilterBar({ filters, setFilters, total, filtered }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { search, group, funded, teamBased, openAll, openNow, sort } = filters;

  function set(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }
  function toggle(key) {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const groupKeys = Object.keys(CATEGORY_GROUPS);
  const activeCount = [funded, teamBased, openAll, openNow].filter(Boolean).length;

  const toggleButtons = [
    { key: 'funded', label: '💰 Funded Only', val: funded },
    { key: 'teamBased', label: '👥 Team-Based', val: teamBased },
    { key: 'openAll', label: '🌍 Any Field', val: openAll },
    { key: 'openNow', label: '🟢 Open Now', val: openNow },
  ];

  return (
    <div
      className="sticky z-20 border-b border-space-border bg-space-bg/95 backdrop-blur-md"
      style={{ top: 'var(--header-h, 56px)', transition: 'top 0.25s ease' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3 space-y-2 sm:space-y-3">

        {/* Row 1: Search + sort (desktop) / filters toggle (mobile) */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted pointer-events-none" />
            <input
              type="search"
              placeholder="Search opportunities, organisations, tags…"
              value={search}
              onChange={(e) => set('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-space-card border border-space-border text-sm text-space-text placeholder-space-muted focus:outline-none focus:border-space-accent transition-colors"
            />
          </div>

          {/* Desktop: sort dropdown */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
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

          {/* Mobile: filter toggle button */}
          <button
            className={`sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
              filtersOpen || activeCount > 0
                ? 'bg-space-accent/15 text-space-accent border-space-accent/40'
                : 'bg-space-card border-space-border text-slate-400'
            }`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={13} />
            <span>Filters</span>
            {activeCount > 0 ? (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-space-accent text-white text-xs leading-none font-bold">
                {activeCount}
              </span>
            ) : filtersOpen ? (
              <ChevronUp size={12} />
            ) : (
              <ChevronDown size={12} />
            )}
          </button>
        </div>

        {/* Row 2: Category pills
            Mobile: single scrollable row (no wrap)
            Desktop: wrapping flex */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {groupKeys.map((g) => (
            <button
              key={g}
              onClick={() => set('group', g === group ? 'All' : g)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                group === g
                  ? 'bg-space-accent text-white border-space-accent'
                  : 'bg-space-card border-space-border text-slate-400 hover:border-space-accent hover:text-space-text'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Row 3: Toggle filters + count
            Mobile: hidden until filtersOpen
            Desktop: always visible */}
        <div className={`${filtersOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2`}>
          {/* Sort (mobile only — inside expanded panel) */}
          <div className="sm:hidden flex items-center gap-2 w-full pb-2 mb-1 border-b border-space-border/60">
            <SlidersHorizontal size={13} className="text-space-muted shrink-0" />
            <select
              value={sort}
              onChange={(e) => set('sort', e.target.value)}
              className="flex-1 pl-2 pr-6 py-1.5 rounded-lg bg-space-card border border-space-border text-sm text-slate-300 focus:outline-none focus:border-space-accent appearance-none cursor-pointer"
            >
              <option value="deadline">Sort: Deadline ↑</option>
              <option value="alpha">Sort: A–Z</option>
              <option value="recent">Sort: Recently Updated</option>
            </select>
          </div>

          {/* Toggle buttons */}
          <div className="flex flex-wrap gap-2">
            {toggleButtons.map(({ key, label, val }) => (
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
          </div>

          <span className="sm:ml-auto text-xs text-space-muted">
            Showing <span className="text-space-text font-semibold">{filtered}</span> of{' '}
            <span className="text-space-text font-semibold">{total}</span> opportunities
          </span>
        </div>

        {/* Count — mobile only when filters panel is collapsed */}
        {!filtersOpen && (
          <div className="sm:hidden text-xs text-space-muted -mt-1">
            Showing <span className="text-space-text font-semibold">{filtered}</span> of{' '}
            <span className="text-space-text font-semibold">{total}</span>
          </div>
        )}
      </div>
    </div>
  );
}
