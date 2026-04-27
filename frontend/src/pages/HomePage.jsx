import { useState, useEffect, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '../api.js';
import { CATEGORY_GROUPS, daysUntil } from '../utils.js';
import StarField from '../components/StarField.jsx';
import StatCounter from '../components/StatCounter.jsx';
import DeadlineStrip from '../components/DeadlineStrip.jsx';
import FilterBar from '../components/FilterBar.jsx';
import OpportunityCard from '../components/OpportunityCard.jsx';
import OpportunityModal from '../components/OpportunityModal.jsx';
import TeamSection from '../components/TeamSection.jsx';
import SubscribePanel from '../components/SubscribePanel.jsx';

const NETWORKS = [
  { id: 'sgac', name: 'SGAC', full: 'Space Generation Advisory Council', url: 'https://spacegeneration.org', desc: 'Global network representing students to UN, ESA & industry. Chapters in every ESA member state.', icon: '🌐' },
  { id: 'euroavia', name: 'EUROAVIA', full: 'European Association of Aerospace Students', url: 'https://euroavia.eu', desc: 'Founded 1959 · 32+ local groups · 16+ countries · 1,300+ members. Events across Europe.', icon: '✈️' },
  { id: 'seds', name: 'SEDS Europe', full: 'Students for Exploration & Development of Space', url: 'https://seds.org', desc: 'European chapters of the global SEDS organisation. UKSEDS is the active UK chapter.', icon: '🛸' },
  { id: 'wia-e', name: 'WIA-Europe', full: 'Women in Aerospace Europe', url: 'https://www.wia-europe.org', desc: 'Pan-European network for women in aerospace. Mentoring, networking, and annual conference.', icon: '👩‍🚀' },
];

export default function HomePage() {
  const [opportunities, setOpportunities] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [stats, setStats] = useState(null);
  const [bvsr, setBvsr] = useState([]);
  const [norstec, setNorstec] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    group: 'All',
    funded: false,
    teamBased: false,
    openAll: false,
    openNow: false,
    sort: 'deadline',
  });

  useEffect(() => {
    Promise.all([
      api.getOpportunities(),
      api.getDeadlines(30),
      api.getStats(),
      api.getMembersBvsr(),
      api.getMembersNorstec(),
    ])
      .then(([opps, dls, st, b, n]) => {
        setOpportunities(opps);
        setDeadlines(dls);
        setStats(st);
        setBvsr(b);
        setNorstec(n);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let res = [...opportunities];
    const { search, group, funded, teamBased, openAll, openNow, sort } = filters;

    if (group && group !== 'All' && CATEGORY_GROUPS[group]) {
      res = res.filter((o) => CATEGORY_GROUPS[group].includes(o.category));
    }
    if (funded) res = res.filter((o) => o.funding_available);
    if (teamBased) res = res.filter((o) => o.team_based);
    if (openAll) res = res.filter((o) => o.open_to_non_engineers);
    if (openNow) res = res.filter((o) => o.deadline && daysUntil(o.deadline) >= 0);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(
        (o) =>
          o.title?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          o.organisation?.toLowerCase().includes(q) ||
          o.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (sort === 'deadline') {
      res.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (sort === 'alpha') {
      res.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sort === 'recent') {
      res.sort((a, b) => new Date(b.last_verified || 0) - new Date(a.last_verified || 0));
    }
    return res;
  }, [opportunities, filters]);

  const esaAcademy = useMemo(
    () => filtered.filter((o) => o.category?.startsWith('esa_academy')),
    [filtered]
  );
  const workshops = useMemo(
    () => filtered.filter((o) => o.category === 'workshop_external'),
    [filtered]
  );
  const competitions = useMemo(
    () => filtered.filter((o) => o.category?.startsWith('competition') || o.category === 'hackathon'),
    [filtered]
  );

  const scholarshipStatus = opportunities.find((o) => o.id === 'esa-academy-academic-scholarship');

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28 text-center">
        <StarField count={150} />
        <div className="relative z-10 max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-space-accent/30 bg-space-accent/10 text-space-accent text-xs font-medium mb-6">
            🛸 Europe's Space Opportunity Directory
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-space-text leading-tight mb-4">
            Every opportunity for<br />
            <span className="text-space-accent">space students</span> in Europe
          </h1>
          <p className="text-space-muted text-base sm:text-lg max-w-2xl mx-auto mb-10">
            ESA Academy workshops, competitions, summer schools, hackathons, scholarships — all in one place, with live deadline tracking.
          </p>
          {stats && <StatCounter stats={stats} />}
        </div>
      </section>

      {/* Deadline alert strip */}
      <DeadlineStrip deadlines={deadlines} onClickOpp={setSelectedOpp} />

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        total={opportunities.length}
        filtered={filtered.length}
      />

      {/* Main opportunities grid */}
      <section id="opportunities" className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-space-border bg-space-card h-64 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-space-muted">
              <div className="text-4xl mb-4">🔭</div>
              <p className="text-lg font-medium">No opportunities match your filters</p>
              <button
                onClick={() => setFilters({ search: '', group: 'All', funded: false, teamBased: false, openAll: false, openNow: false, sort: 'deadline' })}
                className="mt-4 text-space-accent text-sm hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} onClick={setSelectedOpp} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ESA Academy Section */}
      {(filters.group === 'All' || filters.group === 'ESA Academy') && (
        <section id="workshops" className="py-14 border-t border-space-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-space-text">ESA Academy</h2>
                <p className="text-space-muted text-sm mt-1">
                  Training sessions, projects, scholarships, and sponsorships from ESA Academy
                </p>
              </div>
              <a
                href="https://www.esa.int/Education/ESA_Academy"
                target="_blank"
                rel="noopener noreferrer"
                className="sm:ml-auto flex items-center gap-1.5 text-space-accent text-sm hover:underline"
              >
                ESA Academy <ExternalLink size={12} />
              </a>
            </div>

            {scholarshipStatus?.status === 'on_hold' && (
              <div className="mb-6 rounded-xl border border-amber-700/40 bg-amber-900/20 px-5 py-4 text-amber-300 text-sm">
                ℹ️ <strong>Note:</strong> The ESA Academic Scholarship programme is currently{' '}
                <strong>on hold</strong> and under evaluation. Check back for updates.
              </div>
            )}

            {esaAcademy.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {esaAcademy.map((opp) => (
                  <OpportunityCard key={opp.id} opp={opp} onClick={setSelectedOpp} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Competitions & Hackathons */}
      {(filters.group === 'All' || filters.group === 'Competitions' || filters.group === 'Hackathons') && competitions.length > 0 && (
        <section id="competitions" className="py-14 border-t border-space-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-extrabold text-space-text mb-2">Competitions & Hackathons</h2>
            <p className="text-space-muted text-sm mb-8">EuRoC, ERC, hackathons across Europe</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {competitions.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} onClick={setSelectedOpp} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Networks */}
      <section id="networks" className="py-14 border-t border-space-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold text-space-text mb-2">Networks & Organisations</h2>
          <p className="text-space-muted text-sm mb-8">Pan-European student space associations</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {NETWORKS.map((n) => (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card-hover rounded-xl border border-space-border bg-space-card p-5 flex flex-col gap-3 group"
              >
                <span className="text-3xl">{n.icon}</span>
                <div>
                  <h3 className="text-space-text font-bold text-base group-hover:text-space-accent transition-colors">{n.name}</h3>
                  <p className="text-space-muted text-xs">{n.full}</p>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{n.desc}</p>
                <span className="mt-auto text-space-accent text-xs flex items-center gap-1">
                  Visit <ExternalLink size={10} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Teams */}
      <div className="border-t border-space-border">
        <TeamSection bvsr={bvsr} norstec={norstec} />
      </div>

      {/* Subscribe */}
      <section id="about" className="py-14 border-t border-space-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-space-text mb-2">Deadline Alerts</h2>
            <p className="text-space-muted text-sm">Get email reminders before applications close</p>
          </div>
          <SubscribePanel />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-space-border bg-space-card py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap justify-between items-start gap-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🛸</span>
                <span className="font-bold text-space-text">EuroSpace Student Hub</span>
              </div>
              <p className="text-space-muted text-xs max-w-xs">
                Community-maintained directory of opportunities for European aerospace and space students.
              </p>
              {stats?.last_updated && (
                <p className="text-slate-600 text-xs mt-2">
                  Data last updated: {new Date(stats.last_updated).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-xs font-semibold text-space-muted mb-2 uppercase tracking-wider">Quick Links</p>
                <div className="space-y-1">
                  {[
                    { href: 'https://www.esa.int/Education/ESA_Academy', label: 'ESA Academy' },
                    { href: 'https://norstec.no', label: 'NORSTEC' },
                    { href: 'https://bvsr.space', label: 'BVSR' },
                    { href: 'https://spacegeneration.org', label: 'SGAC' },
                  ].map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="block text-xs text-slate-400 hover:text-space-accent">
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-space-muted mb-2 uppercase tracking-wider">Contribute</p>
                <div className="space-y-1">
                  <a href="mailto:suggest@eurospacehub.eu" className="block text-xs text-slate-400 hover:text-space-accent">
                    Suggest an opportunity
                  </a>
                  <a href="https://github.com/eurospacehub" target="_blank" rel="noopener noreferrer" className="block text-xs text-slate-400 hover:text-space-accent">
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Detail modal */}
      {selectedOpp && (
        <OpportunityModal opp={selectedOpp} onClose={() => setSelectedOpp(null)} />
      )}
    </>
  );
}
