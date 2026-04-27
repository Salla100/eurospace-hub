const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Static fallback base — served from /public/data/ at build time
const STATIC = import.meta.env.BASE_URL + 'data';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function staticFetch(file) {
  const res = await fetch(`${STATIC}/${file}`);
  if (!res.ok) throw new Error(`Static ${res.status}: ${file}`);
  return res.json();
}

// Try live API, fall back to bundled static JSON
async function withFallback(apiCall, staticFile, transform) {
  try {
    return await apiCall();
  } catch {
    const data = await staticFetch(staticFile);
    return transform ? transform(data) : data;
  }
}

function computeStats(opps, bvsr, norstec) {
  const categories = {};
  for (const o of opps) categories[o.category] = (categories[o.category] || 0) + 1;
  return {
    total: opps.length,
    funded_count: opps.filter((o) => o.funding_available).length,
    team_based_count: opps.filter((o) => o.team_based).length,
    esa_academy_count: opps.filter((o) => o.category?.startsWith('esa_academy')).length,
    categories,
    last_updated: new Date().toISOString(),
    stale_count: 0,
    bvsr_member_count: bvsr.length,
    norstec_member_count: norstec.length,
  };
}

export const api = {
  getOpportunities: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return withFallback(
      () => request(`/api/opportunities${q ? '?' + q : ''}`),
      'opportunities.json'
    );
  },
  getOpportunity: (id) =>
    withFallback(
      () => request(`/api/opportunities/${id}`),
      'opportunities.json',
      (data) => data.find((o) => o.id === id)
    ),
  patchOpportunity: (id, body, secret) =>
    request(`/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify(body),
    }),
  getDeadlines: (days = 30) =>
    withFallback(
      () => request(`/api/deadlines?days=${days}`),
      'opportunities.json',
      (data) => {
        const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        return data
          .filter((o) => o.deadline && o.deadline >= new Date().toISOString().slice(0, 10) && o.deadline <= cutoff)
          .sort((a, b) => a.deadline.localeCompare(b.deadline));
      }
    ),
  getStats: () =>
    withFallback(
      () => request('/api/stats'),
      'opportunities.json',
      async (opps) => {
        const bvsr = await staticFetch('members_bvsr.json').catch(() => []);
        const norstec = await staticFetch('members_norstec.json').catch(() => []);
        return computeStats(opps, bvsr, norstec);
      }
    ),
  getMembersBvsr: () =>
    withFallback(() => request('/api/members/bvsr'), 'members_bvsr.json'),
  getMembersNorstec: () =>
    withFallback(() => request('/api/members/norstec'), 'members_norstec.json'),
  getChanges: (limit = 100) => request(`/api/changes?limit=${limit}`),
  getLogs: (lines = 200, secret) =>
    request(`/api/logs?lines=${lines}`, { headers: { 'x-admin-secret': secret } }),
  scrapeById: (id, secret) =>
    request(`/api/scrape/${id}`, { method: 'POST', headers: { 'x-admin-secret': secret } }),
  scrapeBatch: (filter, secret) =>
    request('/api/scrape/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ filter }),
    }),
  subscribe: (body) =>
    request('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  unsubscribe: (email) =>
    request('/api/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  auth: (secret) =>
    request('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    }),
  getSubscribers: (secret) =>
    request('/api/subscribers', { headers: { 'x-admin-secret': secret } }),
  getConfig: (secret) =>
    request('/api/config', { headers: { 'x-admin-secret': secret } }),
  saveConfig: (body, secret) =>
    request('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify(body),
    }),
  testWebhook: (secret) =>
    request('/api/test-webhook', { method: 'POST', headers: { 'x-admin-secret': secret } }),
  testEmail: (email, secret) =>
    request('/api/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ email }),
    }),
  health: () => request('/health'),
};
