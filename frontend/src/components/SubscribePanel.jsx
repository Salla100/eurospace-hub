import { useState } from 'react';
import { Mail, Bell, CheckCircle } from 'lucide-react';
import { api } from '../api.js';

const CATEGORIES = [
  { id: 'esa_academy_workshop', label: 'ESA Academy Workshops' },
  { id: 'esa_academy_project', label: 'ESA Academy Projects' },
  { id: 'esa_academy_scholarship', label: 'Scholarships' },
  { id: 'summer_school', label: 'Summer Schools' },
  { id: 'competition_rocketry', label: 'Rocketry Competitions' },
  { id: 'competition_rover', label: 'Rover Competitions' },
  { id: 'hackathon', label: 'Hackathons' },
  { id: 'bip', label: 'BIPs (Erasmus+)' },
  { id: 'workshop_external', label: 'External Workshops' },
];

export default function SubscribePanel() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    categories: [],
    notify_days_before: 14,
  });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  function toggleCat(id) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(id)
        ? f.categories.filter((c) => c !== id)
        : [...f.categories, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setStatus('loading');
    try {
      const res = await api.subscribe(form);
      setStatus('success');
      setMessage(res.message || 'You\'re subscribed!');
    } catch (err) {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-xl mx-auto text-center py-8">
        <CheckCircle size={40} className="text-space-funded mx-auto mb-4" />
        <h3 className="text-space-text text-xl font-bold mb-2">You're subscribed!</h3>
        <p className="text-space-muted text-sm">{message}</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-space-accent text-sm hover:underline"
        >
          Subscribe another email
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-space-muted mb-1.5 font-medium">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
              className="w-full px-4 py-2.5 rounded-lg bg-space-card border border-space-border text-sm text-space-text placeholder-space-muted focus:outline-none focus:border-space-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-space-muted mb-1.5 font-medium">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@university.edu"
              className="w-full px-4 py-2.5 rounded-lg bg-space-card border border-space-border text-sm text-space-text placeholder-space-muted focus:outline-none focus:border-space-accent transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-space-muted mb-2 font-medium">
            Categories to watch (leave blank for all)
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCat(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  form.categories.includes(cat.id)
                    ? 'bg-space-accent/20 text-space-accent border-space-accent/50'
                    : 'bg-space-card text-slate-400 border-space-border hover:border-slate-500'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-space-muted mb-1.5 font-medium">
            Notify me when deadline is within
          </label>
          <div className="flex gap-3">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm((f) => ({ ...f, notify_days_before: d }))}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  form.notify_days_before === d
                    ? 'bg-space-accent text-white border-space-accent'
                    : 'bg-space-card text-slate-400 border-space-border hover:border-slate-500'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {status === 'error' && (
          <p className="text-space-danger text-sm">{message}</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-space-accent text-white font-semibold text-sm hover:bg-blue-500 transition-colors disabled:opacity-60"
        >
          <Bell size={15} />
          {status === 'loading' ? 'Subscribing…' : 'Subscribe to Deadline Alerts'}
          <Mail size={14} />
        </button>
      </form>
    </div>
  );
}
