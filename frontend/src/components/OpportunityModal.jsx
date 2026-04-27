import { X, ExternalLink, Copy, MapPin, Clock, Globe, Tag, CheckCircle } from 'lucide-react';
import { categoryLabel, categoryColor, deadlineLabel, deadlineColorHex, formatDate, levelPill } from '../utils.js';

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-space-muted mb-3 border-b border-space-border pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm mb-2">
      <span className="text-space-muted w-36 shrink-0">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

export default function OpportunityModal({ opp, onClose }) {
  if (!opp) return null;

  const dlColor = deadlineColorHex(opp.deadline);
  const dlLabel = deadlineLabel(opp.deadline);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/?opp=' + opp.id).catch(() => {});
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-space-border bg-space-card shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-space-card border-b border-space-border px-6 py-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
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
              {opp.status === 'on_hold' && (
                <span className="badge bg-amber-900/40 text-amber-300 border border-amber-700/30 text-xs">
                  ⏸ On Hold
                </span>
              )}
            </div>
            <h2 className="text-space-text font-bold text-xl leading-snug">{opp.title}</h2>
            <p className="text-space-muted text-sm mt-1">{opp.organisation}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-space-border transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Status banner */}
          {opp.status === 'on_hold' && (
            <div className="mb-5 rounded-lg bg-amber-900/30 border border-amber-700/40 p-4 text-amber-300 text-sm">
              ⏸ This programme is currently <strong>on hold</strong> and not accepting applications.
              {opp.deadline_notes && ` ${opp.deadline_notes}`}
            </div>
          )}

          {/* Overview */}
          <Section title="Overview">
            <p className="text-slate-300 text-sm leading-relaxed">{opp.description}</p>
            {opp.subcategory && (
              <p className="text-slate-500 text-xs mt-2">Subcategory: {opp.subcategory}</p>
            )}
          </Section>

          {/* Funding */}
          {opp.funding_available && (
            <Section title="Funding Details">
              <div className="rounded-lg bg-green-900/20 border border-green-700/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-space-funded" />
                  <span className="text-space-funded font-semibold text-sm">Fully / Partially Funded</span>
                </div>
                {opp.funding_details && (
                  <p className="text-green-200 text-sm">{opp.funding_details}</p>
                )}
                {opp.funding_amount_eur && (
                  <p className="text-green-300 text-sm font-semibold mt-1">
                    Up to €{opp.funding_amount_eur.toLocaleString()}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Dates */}
          <Section title="Dates & Deadlines">
            {opp.deadline && (
              <div className="rounded-lg border p-3 mb-3" style={{ borderColor: `${dlColor}44`, background: `${dlColor}11` }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: dlColor }}>
                    📅 Deadline: {formatDate(opp.deadline)}
                  </span>
                  {dlLabel && (
                    <span className="badge text-xs" style={{ background: `${dlColor}22`, color: dlColor, border: `1px solid ${dlColor}44` }}>
                      {dlLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Row label="Typical Deadline" value={opp.deadline_month_typical} />
            <Row label="Deadline Notes" value={opp.deadline_notes} />
            <Row label="Event Date" value={opp.event_date ? formatDate(opp.event_date) : opp.event_month_typical} />
            <Row label="Recurring" value={opp.deadline_recurring ? 'Yes — annual / recurring' : null} />
            <Row label="Last Verified" value={opp.last_verified ? formatDate(opp.last_verified) : null} />
          </Section>

          {/* Eligibility */}
          <Section title="Eligibility">
            {opp.eligibility_level?.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {opp.eligibility_level.map((lvl) => (
                  <span key={lvl} className={`badge ${levelPill(lvl)}`}>{lvl}</span>
                ))}
              </div>
            )}
            <Row label="Countries" value={opp.eligibility_countries} />
            <Row label="Fields" value={opp.eligibility_fields?.join(', ')} />
            {opp.open_to_non_engineers && (
              <p className="text-teal-400 text-sm flex items-center gap-1.5 mt-1">
                <CheckCircle size={13} /> Open to non-engineers / any field
              </p>
            )}
            {opp.team_based && (
              <p className="text-violet-400 text-sm flex items-center gap-1.5 mt-1">
                <CheckCircle size={13} /> Team-based application
              </p>
            )}
          </Section>

          {/* Location & Duration */}
          <Section title="Location & Duration">
            <div className="flex flex-wrap gap-6">
              {opp.location && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MapPin size={14} className="text-space-muted" />
                  {opp.location}
                </div>
              )}
              {opp.duration && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Clock size={14} className="text-space-muted" />
                  {opp.duration}
                </div>
              )}
            </div>
          </Section>

          {/* Tags */}
          {opp.tags?.length > 0 && (
            <Section title="Tags">
              <div className="flex flex-wrap gap-2">
                {opp.tags.map((tag) => (
                  <span key={tag} className="badge bg-space-bg border border-space-border text-slate-400 text-xs">
                    <Tag size={10} className="mr-1" />{tag}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer buttons */}
        <div className="sticky bottom-0 bg-space-card border-t border-space-border px-6 py-4 flex flex-wrap gap-3">
          <a
            href={opp.application_url || opp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-space-accent text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
          >
            <Globe size={14} />
            Open Official Page
            <ExternalLink size={12} />
          </a>
          {opp.application_url && opp.application_url !== opp.url && (
            <a
              href={opp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-space-border text-slate-300 text-sm hover:border-space-accent hover:text-space-accent transition-colors"
            >
              Info Page <ExternalLink size={12} />
            </a>
          )}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-space-border text-slate-300 text-sm hover:border-space-accent hover:text-space-accent transition-colors"
          >
            <Copy size={13} /> Copy Link
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2.5 rounded-xl border border-space-border text-slate-400 text-sm hover:text-white transition-colors"
          >
            Close ✕
          </button>
        </div>
      </div>
    </div>
  );
}
