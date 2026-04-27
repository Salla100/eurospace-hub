import { MapPin, Clock, GraduationCap, Calendar } from 'lucide-react';
import { categoryLabel, categoryColor, deadlineLabel, deadlineColorHex, formatDate, levelPill, daysUntil } from '../utils.js';

export default function OpportunityCard({ opp, onClick }) {
  const dl = daysUntil(opp.deadline);
  const dlColor = deadlineColorHex(opp.deadline);
  const dlLabel = deadlineLabel(opp.deadline);

  return (
    <article
      className="card-hover cursor-pointer rounded-xl border border-space-border bg-space-card flex flex-col h-full fade-in"
      onClick={() => onClick(opp)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(opp)}
      aria-label={`View details for ${opp.title}`}
    >
      <div className="p-5 flex flex-col flex-1">
        {/* Top row: category + badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`badge text-xs ${categoryColor(opp.category)}`}>
            {categoryLabel(opp.category)}
          </span>
          {opp.funding_available && (
            <span className="badge bg-space-funded/20 text-space-funded border border-space-funded/30 text-xs">
              💰 Funded
            </span>
          )}
          {opp.team_based && (
            <span className="badge bg-violet-900/40 text-violet-300 border border-violet-700/30 text-xs">
              👥 Team
            </span>
          )}
          {opp.featured && (
            <span className="badge bg-yellow-900/40 text-yellow-300 border border-yellow-700/30 text-xs">
              ⭐ Featured
            </span>
          )}
          {opp.needs_review && (
            <span className="badge bg-red-900/40 text-red-300 border border-red-700/30 text-xs">
              ⚠️ Review
            </span>
          )}
          {opp.status === 'on_hold' && (
            <span className="badge bg-slate-700 text-slate-300 border border-slate-600 text-xs">
              ⏸ On Hold
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-space-text font-bold text-base leading-snug mb-1 line-clamp-2">
          {opp.title}
        </h3>
        <p className="text-space-muted text-xs mb-3">{opp.organisation}</p>

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-2 mb-4 flex-1">
          {opp.description}
        </p>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
          {opp.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} className="shrink-0" />
              {opp.location.length > 30 ? opp.location.slice(0, 28) + '…' : opp.location}
            </span>
          )}
          {opp.duration && (
            <span className="flex items-center gap-1">
              <Clock size={11} className="shrink-0" />
              {opp.duration}
            </span>
          )}
        </div>

        {/* Level pills */}
        {opp.eligibility_level?.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            <GraduationCap size={11} className="text-slate-500 mt-0.5 shrink-0" />
            {opp.eligibility_level.map((lvl) => (
              <span key={lvl} className={`badge text-xs ${levelPill(lvl)}`}>
                {lvl}
              </span>
            ))}
          </div>
        )}

        {/* Divider + deadline */}
        <div className="border-t border-space-border pt-3 mt-auto flex items-end justify-between gap-2">
          <div className="flex-1 min-w-0">
            {opp.deadline ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Calendar size={12} style={{ color: dlColor }} className="shrink-0" />
                <span className="text-xs" style={{ color: dlColor }}>
                  Apply by {formatDate(opp.deadline)}
                </span>
                {dlLabel && dl >= 0 && (
                  <span
                    className="badge text-xs"
                    style={{ background: `${dlColor}22`, color: dlColor, border: `1px solid ${dlColor}44` }}
                  >
                    {dlLabel}
                  </span>
                )}
              </div>
            ) : opp.deadline_month_typical ? (
              <span className="text-xs text-slate-500">Typically {opp.deadline_month_typical}</span>
            ) : (
              <span className="text-xs text-slate-600">No deadline set</span>
            )}
            {opp.last_verified && (
              <p className="text-slate-600 text-xs mt-1">Verified {formatDate(opp.last_verified)}</p>
            )}
          </div>
          <a
            href={opp.application_url || opp.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-space-accent/20 text-space-accent border border-space-accent/30 text-xs font-semibold hover:bg-space-accent hover:text-white transition-colors"
          >
            Apply →
          </a>
        </div>
      </div>
    </article>
  );
}
