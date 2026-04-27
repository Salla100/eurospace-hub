import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download, CheckCircle, AlertCircle, Lock, Eye, EyeOff, Settings, Users, FileText, Server, Database } from 'lucide-react';
import { api } from '../api.js';
import { formatDate, daysUntil } from '../utils.js';

// ─── Login ───────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { valid } = await api.auth(val);
      if (valid) onLogin(val);
      else setError('Invalid secret');
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Lock size={32} className="text-space-accent mx-auto mb-3" />
          <h1 className="text-xl font-bold text-space-text">Admin Access</h1>
          <p className="text-space-muted text-sm mt-1">Enter your admin secret to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Admin secret"
              className="w-full px-4 py-3 rounded-xl bg-space-card border border-space-border text-space-text placeholder-space-muted focus:outline-none focus:border-space-accent pr-10"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-space-muted">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-space-danger text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-space-accent text-white font-semibold hover:bg-blue-500 transition-colors disabled:opacity-60"
          >
            {loading ? 'Checking…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type = 'info' }) {
  if (!msg) return null;
  const color = type === 'error' ? 'bg-red-900 border-red-700 text-red-300' : type === 'success' ? 'bg-green-900 border-green-700 text-green-300' : 'bg-blue-900 border-blue-700 text-blue-300';
  return (
    <div className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm fade-in ${color}`}>
      {msg}
    </div>
  );
}

// ─── Tab 1: Opportunities ─────────────────────────────────────────────────────
function OpportunitiesTab({ opportunities, secret, onToast }) {
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [scraping, setScraping] = useState(null);

  const now = new Date().toISOString().slice(0, 10);
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const d90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  function rowColor(opp) {
    if (opp.needs_review) return 'border-l-4 border-l-purple-500';
    if (!opp.last_verified || opp.last_verified < d90) return 'border-l-4 border-l-red-500';
    if (opp.last_verified < d30) return 'border-l-4 border-l-yellow-500';
    return 'border-l-4 border-l-green-500';
  }

  async function handleScrape(opp) {
    setScraping(opp.id);
    try {
      const r = await api.scrapeById(opp.id, secret);
      onToast(r.changed ? `✅ ${opp.title}: deadline updated to ${r.new_deadline}` : `ℹ️ ${opp.title}: no changes`, r.changed ? 'success' : 'info');
    } catch (e) { onToast(`Error: ${e.message}`, 'error'); }
    finally { setScraping(null); }
  }

  async function handleSave() {
    try {
      await api.patchOpportunity(editing, editForm, secret);
      onToast('Saved', 'success');
      setEditing(null);
    } catch (e) { onToast(`Error: ${e.message}`, 'error'); }
  }

  async function handleBatch(filter) {
    onToast(`Starting batch scrape: ${filter}…`, 'info');
    try { await api.scrapeBatch(filter, secret); onToast('Batch scrape started in background', 'success'); }
    catch (e) { onToast(`Error: ${e.message}`, 'error'); }
  }

  async function handleExport() {
    const data = JSON.stringify(opportunities, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'opportunities.json'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Batch buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => handleBatch('all')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-space-accent/20 text-space-accent border border-space-accent/30 text-xs hover:bg-space-accent hover:text-white transition-colors">
          <RefreshCw size={13} /> Scrape All
        </button>
        <button onClick={() => handleBatch('stale')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-900/20 text-yellow-400 border border-yellow-700/30 text-xs hover:bg-yellow-900/40 transition-colors">
          <RefreshCw size={13} /> Scrape Stale
        </button>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-space-card border border-space-border text-slate-400 text-xs hover:border-space-accent hover:text-space-accent transition-colors">
          <Download size={13} /> Export JSON
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-space-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-sm" /> &lt;30 days fresh</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-yellow-500 rounded-sm" /> 30-90 days</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500 rounded-sm" /> &gt;90 days stale</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-purple-500 rounded-sm" /> needs review</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-space-border text-space-muted text-left">
              <th className="pb-2 pr-4 font-medium">Title</th>
              <th className="pb-2 pr-4 font-medium">Category</th>
              <th className="pb-2 pr-4 font-medium">Deadline</th>
              <th className="pb-2 pr-4 font-medium">Last Verified</th>
              <th className="pb-2 pr-4 font-medium">Stale</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opp) => (
              <>
                <tr key={opp.id} className={`border-b border-space-border/50 hover:bg-space-card/50 ${rowColor(opp)}`}>
                  <td className="py-2 pr-4 max-w-[200px]">
                    <span className="text-space-text font-medium truncate block">{opp.title}</span>
                    {opp.needs_review && <span className="text-purple-400 text-xs">⚠️ needs review</span>}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{opp.category}</td>
                  <td className="py-2 pr-4">{opp.deadline ? <span className={daysUntil(opp.deadline) < 14 ? 'text-space-danger font-semibold' : 'text-slate-300'}>{formatDate(opp.deadline)}</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-2 pr-4 text-slate-400">{opp.last_verified ? formatDate(opp.last_verified) : '—'}</td>
                  <td className="py-2 pr-4">{opp.last_verified ? <span className={opp.last_verified < d90 ? 'text-space-danger' : opp.last_verified < d30 ? 'text-space-warn' : 'text-space-funded'}>{Math.floor((Date.now() - new Date(opp.last_verified)) / 86400000)}d</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(editing === opp.id ? null : opp.id); setEditForm({ deadline: opp.deadline || '', deadline_notes: opp.deadline_notes || '', needs_review: opp.needs_review }); }} className="px-2 py-1 rounded bg-space-bg border border-space-border text-slate-400 hover:border-space-accent hover:text-space-accent transition-colors">
                        ✏️
                      </button>
                      <button onClick={() => handleScrape(opp)} disabled={scraping === opp.id} className="px-2 py-1 rounded bg-space-bg border border-space-border text-slate-400 hover:border-space-accent hover:text-space-accent transition-colors disabled:opacity-40">
                        {scraping === opp.id ? <RefreshCw size={11} className="animate-spin" /> : '🔄'}
                      </button>
                    </div>
                  </td>
                </tr>
                {editing === opp.id && (
                  <tr key={opp.id + '-edit'} className="border-b border-space-border bg-space-card">
                    <td colSpan={6} className="py-3 px-4">
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="block text-xs text-space-muted mb-1">Deadline</label>
                          <input type="date" value={editForm.deadline || ''} onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))} className="px-3 py-1.5 rounded bg-space-bg border border-space-border text-sm text-space-text focus:outline-none focus:border-space-accent" />
                        </div>
                        <div className="flex-1 min-w-48">
                          <label className="block text-xs text-space-muted mb-1">Notes</label>
                          <input value={editForm.deadline_notes || ''} onChange={(e) => setEditForm((f) => ({ ...f, deadline_notes: e.target.value }))} className="w-full px-3 py-1.5 rounded bg-space-bg border border-space-border text-sm text-space-text focus:outline-none focus:border-space-accent" />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input type="checkbox" checked={!!editForm.needs_review} onChange={(e) => setEditForm((f) => ({ ...f, needs_review: e.target.checked }))} className="rounded" />
                          Needs Review
                        </label>
                        <button onClick={handleSave} className="px-4 py-1.5 rounded bg-space-accent text-white text-xs font-semibold hover:bg-blue-500 transition-colors">Save</button>
                        <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded border border-space-border text-slate-400 text-xs hover:text-white transition-colors">Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 2: Changes Log ───────────────────────────────────────────────────────
function ChangesTab() {
  const [entries, setEntries] = useState([]);
  useEffect(() => { api.getChanges(100).then(setEntries).catch(console.error); }, []);

  if (!entries.length) return <p className="text-space-muted text-sm">No changes logged yet.</p>;

  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={i} className="rounded-lg border border-space-border bg-space-card px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className="text-space-muted">{new Date(e.timestamp).toLocaleString()}</span>
            <span className="text-space-accent font-medium">{e.title}</span>
            <span className="badge bg-slate-700 text-slate-300">{e.field}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="line-through text-space-danger">{e.old_value || '—'}</span>
            <span>→</span>
            <span className="text-space-funded">{e.new_value}</span>
          </div>
          {e.source_url && <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-space-accent mt-1 block truncate">{e.source_url}</a>}
        </div>
      ))}
    </div>
  );
}

// ─── Tab 3: Scraper Log ───────────────────────────────────────────────────────
function ScraperLogTab({ secret }) {
  const [lines, setLines] = useState([]);
  const [auto, setAuto] = useState(true);
  const bottomRef = useRef(null);

  async function fetchLogs() {
    try {
      const { lines: l } = await api.getLogs(200, secret);
      setLines(l);
    } catch {}
  }

  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(fetchLogs, 30000);
    return () => clearInterval(id);
  }, [auto]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={fetchLogs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-space-card border border-space-border text-xs text-slate-400 hover:border-space-accent hover:text-space-accent transition-colors">
          <RefreshCw size={11} /> Refresh
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="rounded" />
          Auto-refresh (30s)
        </label>
      </div>
      <div className="rounded-xl bg-space-bg border border-space-border p-4 max-h-96 overflow-y-auto font-mono text-xs">
        {lines.map((l, i) => (
          <div key={i} className={`py-0.5 ${l.includes('ERROR') ? 'text-space-danger' : l.includes('WARN') ? 'text-space-warn' : 'text-slate-400'}`}>
            {l}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Tab 4: Members ───────────────────────────────────────────────────────────
function MembersTab({ secret, onToast }) {
  const [bvsr, setBvsr] = useState([]);
  const [norstec, setNorstec] = useState([]);
  const [syncing, setSyncing] = useState(null);

  useEffect(() => {
    Promise.all([api.getMembersBvsr(), api.getMembersNorstec()])
      .then(([b, n]) => { setBvsr(b); setNorstec(n); });
  }, []);

  async function handleSync(type) {
    setSyncing(type);
    try {
      await api.scrapeBatch(type === 'bvsr' ? 'all' : 'all', secret);
      onToast(`${type.toUpperCase()} sync started`, 'success');
    } catch (e) { onToast(e.message, 'error'); }
    finally { setSyncing(null); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-space-text font-bold">🇩🇪 BVSR ({bvsr.length})</h3>
          <button onClick={() => handleSync('bvsr')} disabled={!!syncing} className="flex items-center gap-1.5 px-3 py-1 rounded border border-space-border text-xs text-slate-400 hover:border-space-accent hover:text-space-accent transition-colors disabled:opacity-40">
            {syncing === 'bvsr' ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />} Sync Now
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {bvsr.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-space-border bg-space-card px-3 py-2 text-xs">
              <div>
                <span className="text-space-text font-medium">{m.name}</span>
                <span className="text-space-muted ml-2">{m.city}</span>
                {m.correspondent_member && <span className="ml-2 badge bg-slate-700 text-slate-400">Correspondent</span>}
              </div>
              <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-space-accent hover:underline">↗</a>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-space-text font-bold">🇳🇴 NORSTEC ({norstec.length})</h3>
          <button onClick={() => handleSync('norstec')} disabled={!!syncing} className="flex items-center gap-1.5 px-3 py-1 rounded border border-space-border text-xs text-slate-400 hover:border-space-accent hover:text-space-accent transition-colors disabled:opacity-40">
            {syncing === 'norstec' ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />} Sync Now
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {norstec.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-space-border bg-space-card px-3 py-2 text-xs">
              <div>
                <span className="text-space-text font-medium">{m.name}</span>
                <span className="text-space-muted ml-2">{m.city}</span>
                <span className="ml-2 badge bg-space-card border border-space-border text-slate-400">{m.specialization}</span>
              </div>
              <a href={m.website} target="_blank" rel="noopener noreferrer" className="text-space-accent hover:underline">↗</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Subscribers ───────────────────────────────────────────────────────
function SubscribersTab({ secret, onToast }) {
  const [data, setData] = useState(null);

  useEffect(() => { api.getSubscribers(secret).then(setData).catch(console.error); }, []);

  async function handleTestEmail() {
    try { await api.testEmail('', secret); onToast('Test email sent', 'success'); }
    catch (e) { onToast(e.message, 'error'); }
  }

  if (!data) return <p className="text-space-muted text-sm">Loading…</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="text-3xl font-bold text-space-text">{data.total}</div>
        <div className="text-space-muted text-sm">total subscribers</div>
        <button onClick={handleTestEmail} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-space-card border border-space-border text-xs text-slate-400 hover:border-space-accent hover:text-space-accent transition-colors">
          📧 Send Test Email
        </button>
      </div>
      <div className="space-y-2">
        {data.subscribers.map((s, i) => (
          <div key={i} className="rounded-lg border border-space-border bg-space-card px-4 py-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-space-text font-medium">{s.name}</span>
              <span className="text-space-muted">{s.email}</span>
              <span className="text-slate-600">Notify {s.notify_days_before}d before</span>
            </div>
            {s.categories?.length > 0 && <p className="text-slate-500 mt-1">{s.categories.join(', ')}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 6: Settings ──────────────────────────────────────────────────────────
function SettingsTab({ secret, onToast }) {
  const [config, setConfig] = useState({ webhook_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getConfig(secret).then((c) => setConfig(c || {})).catch(console.error); }, []);

  async function handleSave() {
    setSaving(true);
    try { await api.saveConfig(config, secret); onToast('Settings saved', 'success'); }
    catch (e) { onToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleTestWebhook() {
    try { const r = await api.testWebhook(secret); onToast(r.success ? `Webhook OK (${r.status})` : `Webhook failed (${r.status})`, r.success ? 'success' : 'error'); }
    catch (e) { onToast(e.message, 'error'); }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <label className="block text-sm text-space-muted mb-2 font-medium">Webhook URL</label>
        <div className="flex gap-3">
          <input
            type="url"
            value={config.webhook_url || ''}
            onChange={(e) => setConfig((c) => ({ ...c, webhook_url: e.target.value }))}
            placeholder="https://hooks.slack.com/…"
            className="flex-1 px-4 py-2.5 rounded-lg bg-space-card border border-space-border text-sm text-space-text placeholder-space-muted focus:outline-none focus:border-space-accent"
          />
          <button onClick={handleTestWebhook} className="px-4 py-2.5 rounded-lg border border-space-border text-xs text-slate-400 hover:border-space-accent hover:text-space-accent transition-colors whitespace-nowrap">
            Test
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-1.5">Discord, Slack, or any webhook endpoint</p>
      </div>
      <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-space-accent text-white text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-60">
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [tab, setTab] = useState('opportunities');
  const [opportunities, setOpportunities] = useState([]);
  const [toast, setToast] = useState({ msg: '', type: 'info' });

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'info' }), 4000);
  }

  useEffect(() => {
    if (!secret) return;
    api.getOpportunities().then(setOpportunities).catch(console.error);
  }, [secret]);

  if (!secret) return <LoginScreen onLogin={setSecret} />;

  const TABS = [
    { id: 'opportunities', label: 'Opportunities', icon: <Database size={14} /> },
    { id: 'changes', label: 'Changes', icon: <FileText size={14} /> },
    { id: 'logs', label: 'Scraper Log', icon: <Server size={14} /> },
    { id: 'members', label: 'Members', icon: <Users size={14} /> },
    { id: 'subscribers', label: 'Subscribers', icon: <Users size={14} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={14} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-space-text mb-1">Admin Dashboard</h1>
        <p className="text-space-muted text-sm">{opportunities.length} opportunities loaded</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-space-border mb-6 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-space-card border border-space-border border-b-transparent text-space-text'
                : 'text-space-muted hover:text-space-text'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'opportunities' && <OpportunitiesTab opportunities={opportunities} secret={secret} onToast={showToast} />}
        {tab === 'changes' && <ChangesTab />}
        {tab === 'logs' && <ScraperLogTab secret={secret} />}
        {tab === 'members' && <MembersTab secret={secret} onToast={showToast} />}
        {tab === 'subscribers' && <SubscribersTab secret={secret} onToast={showToast} />}
        {tab === 'settings' && <SettingsTab secret={secret} onToast={showToast} />}
      </div>

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
