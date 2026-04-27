import { ExternalLink, Rocket, Satellite, Globe } from 'lucide-react';

const FOCUS_ICONS = {
  rockets: '🚀',
  satellites: '🛰️',
  rovers: '🤖',
  payloads: '📦',
  isru: '⛏️',
  software: '💻',
  robotics: '🦾',
};

function BvsrCard({ club }) {
  return (
    <div className="card-hover rounded-xl border border-space-border bg-space-card p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            className="w-10 h-10 rounded-lg object-contain bg-space-bg border border-space-border"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-space-bg border border-space-border flex items-center justify-center text-lg">
            🚀
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-space-text font-bold text-sm">{club.name}</h4>
            {club.correspondent_member && (
              <span className="badge bg-slate-700 text-slate-300 text-xs">Correspondent</span>
            )}
          </div>
          <p className="text-space-muted text-xs mt-0.5">{club.university}</p>
          <p className="text-slate-500 text-xs">{club.city}, {club.country}</p>
        </div>
      </div>

      {club.focus?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {club.focus.map((f) => (
            <span key={f} className="badge bg-space-bg border border-space-border text-slate-400 text-xs">
              {FOCUS_ICONS[f] || '•'} {f}
            </span>
          ))}
        </div>
      )}

      {club.description && (
        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{club.description}</p>
      )}

      <a
        href={club.website}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center gap-1.5 text-space-accent text-xs font-medium hover:underline"
      >
        Visit Website <ExternalLink size={10} />
      </a>
    </div>
  );
}

const SPEC_COLORS = {
  'Rocketeering': 'bg-red-900/40 text-red-300 border border-red-700/30',
  'Satellites': 'bg-blue-900/40 text-blue-300 border border-blue-700/30',
  'Satellites & Rocketeering': 'bg-violet-900/40 text-violet-300 border border-violet-700/30',
};

function NorstecCard({ org }) {
  return (
    <div className="card-hover rounded-xl border border-space-border bg-space-card p-5 flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h4 className="text-space-text font-bold text-sm">{org.name}</h4>
          {org.incubator && (
            <span className="badge bg-teal-900/40 text-teal-300 border border-teal-700/30 text-xs">Incubator</span>
          )}
        </div>
        <p className="text-space-muted text-xs">{org.university_abbr && `${org.university_abbr} · `}{org.city}</p>
      </div>

      <span className={`badge self-start ${SPEC_COLORS[org.specialization] || 'bg-slate-700 text-slate-300'}`}>
        {org.specialization === 'Rocketeering' ? '🚀' : org.specialization === 'Satellites' ? '🛰️' : '🚀🛰️'} {org.specialization}
      </span>

      <a
        href={org.website}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center gap-1.5 text-space-accent text-xs font-medium hover:underline"
      >
        Visit Website <ExternalLink size={10} />
      </a>
    </div>
  );
}

export default function TeamSection({ bvsr, norstec }) {
  return (
    <section id="teams" className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-space-text">Student Space Teams</h2>
          <p className="text-space-muted text-sm mt-2">Member clubs of BVSR (Germany) and NORSTEC (Norway)</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* BVSR */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-2xl">🇩🇪</span>
              <div>
                <h3 className="text-space-text font-bold text-lg">BVSR Member Clubs</h3>
                <p className="text-space-muted text-xs">{bvsr.length} clubs · Germany + Austria</p>
              </div>
              <a
                href="https://bvsr.space"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-space-accent text-xs flex items-center gap-1 hover:underline"
              >
                bvsr.space <ExternalLink size={10} />
              </a>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1 scroll-x">
              {bvsr.map((club) => <BvsrCard key={club.id} club={club} />)}
            </div>
          </div>

          {/* NORSTEC */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-2xl">🇳🇴</span>
              <div>
                <h3 className="text-space-text font-bold text-lg">NORSTEC Member Organisations</h3>
                <p className="text-space-muted text-xs">{norstec.length} orgs · Norway</p>
              </div>
              <a
                href="https://norstec.no"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-space-accent text-xs flex items-center gap-1 hover:underline"
              >
                norstec.no <ExternalLink size={10} />
              </a>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
              {norstec.map((org) => <NorstecCard key={org.id} org={org} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
