import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { createRequire } from 'module';
import { startCron } from './cron.js';
import { scrapeById, scrapeBatch } from './scraper.js';
import { sendTestEmail } from './notifier.js';
import winston from 'winston';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: path.join(__dirname, 'scraper.log') })
  ]
});

// ── In-memory store ──
let store = {
  opportunities: [],
  members_bvsr: [],
  members_norstec: [],
  subscribers: [],
  notifications_sent: [],
  config: {},
  loaded_at: null
};

async function loadData() {
  store.opportunities = await fs.readJson(path.join(DATA_DIR, 'opportunities.json')).catch(() => []);
  store.members_bvsr = await fs.readJson(path.join(DATA_DIR, 'members_bvsr.json')).catch(() => []);
  store.members_norstec = await fs.readJson(path.join(DATA_DIR, 'members_norstec.json')).catch(() => []);
  store.subscribers = await fs.readJson(path.join(DATA_DIR, 'subscribers.json')).catch(() => []);
  store.notifications_sent = await fs.readJson(path.join(DATA_DIR, 'notifications_sent.json')).catch(() => []);
  store.config = await fs.readJson(path.join(DATA_DIR, 'config.json')).catch(() => ({}));
  store.loaded_at = new Date().toISOString();
  logger.info(`Data loaded: ${store.opportunities.length} opportunities, ${store.members_bvsr.length} BVSR, ${store.members_norstec.length} NORSTEC`);
}

export async function saveOpportunities() {
  await fs.writeJson(path.join(DATA_DIR, 'opportunities.json'), store.opportunities, { spaces: 2 });
}

export async function saveMembersBvsr() {
  await fs.writeJson(path.join(DATA_DIR, 'members_bvsr.json'), store.members_bvsr, { spaces: 2 });
}

export async function saveMembersNorstec() {
  await fs.writeJson(path.join(DATA_DIR, 'members_norstec.json'), store.members_norstec, { spaces: 2 });
}

export async function saveSubscribers() {
  await fs.writeJson(path.join(DATA_DIR, 'subscribers.json'), store.subscribers, { spaces: 2 });
}

export async function saveNotificationsSent() {
  await fs.writeJson(path.join(DATA_DIR, 'notifications_sent.json'), store.notifications_sent, { spaces: 2 });
}

export async function logChange(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  await fs.appendFile(path.join(DATA_DIR, 'changes.log'), line);
}

export function getStore() { return store; }

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware
function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── GET /api/opportunities ──
app.get('/api/opportunities', (req, res) => {
  let results = [...store.opportunities];
  const { category, funded, team_based, open_to_all, search, sort } = req.query;

  if (category) {
    const cats = category.split(',').map(c => c.trim().toLowerCase());
    results = results.filter(o => cats.includes(o.category?.toLowerCase()));
  }
  if (funded === 'true') results = results.filter(o => o.funding_available);
  if (team_based === 'true') results = results.filter(o => o.team_based);
  if (open_to_all === 'true') results = results.filter(o => o.open_to_non_engineers);
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(o =>
      o.title?.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.organisation?.toLowerCase().includes(q) ||
      o.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  const now = new Date();
  if (sort === 'deadline') {
    results.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
  } else if (sort === 'alpha') {
    results.sort((a, b) => a.title?.localeCompare(b.title));
  } else if (sort === 'recent') {
    results.sort((a, b) => new Date(b.last_verified || 0) - new Date(a.last_verified || 0));
  }

  res.json(results);
});

// ── GET /api/opportunities/:id ──
app.get('/api/opportunities/:id', (req, res) => {
  const opp = store.opportunities.find(o => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: 'Not found' });
  res.json(opp);
});

// ── PATCH /api/opportunities/:id ──
app.patch('/api/opportunities/:id', requireAdmin, async (req, res) => {
  const idx = store.opportunities.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const old = { ...store.opportunities[idx] };
  store.opportunities[idx] = { ...store.opportunities[idx], ...req.body };
  await saveOpportunities();
  for (const [field, newVal] of Object.entries(req.body)) {
    if (old[field] !== newVal) {
      await logChange({ id: req.params.id, title: store.opportunities[idx].title, field, old_value: String(old[field] ?? ''), new_value: String(newVal), source_url: 'admin-edit' });
    }
  }
  res.json(store.opportunities[idx]);
});

// ── GET /api/deadlines ──
app.get('/api/deadlines', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 86400000);
  const results = store.opportunities
    .filter(o => o.deadline && new Date(o.deadline) >= now && new Date(o.deadline) <= cutoff)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  res.json(results);
});

// ── GET /api/stats ──
app.get('/api/stats', (req, res) => {
  const opps = store.opportunities;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const categories = {};
  for (const o of opps) {
    categories[o.category] = (categories[o.category] || 0) + 1;
  }
  res.json({
    total: opps.length,
    funded_count: opps.filter(o => o.funding_available).length,
    team_based_count: opps.filter(o => o.team_based).length,
    esa_academy_count: opps.filter(o => o.category?.startsWith('esa_academy')).length,
    categories,
    last_updated: store.loaded_at,
    stale_count: opps.filter(o => o.last_verified && o.last_verified < ninetyDaysAgo).length,
    bvsr_member_count: store.members_bvsr.length,
    norstec_member_count: store.members_norstec.length
  });
});

// ── GET /api/members/bvsr ──
app.get('/api/members/bvsr', (req, res) => res.json(store.members_bvsr));

// ── GET /api/members/norstec ──
app.get('/api/members/norstec', (req, res) => res.json(store.members_norstec));

// ── GET /api/changes ──
app.get('/api/changes', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logPath = path.join(DATA_DIR, 'changes.log');
  try {
    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.json(entries.reverse());
  } catch {
    res.json([]);
  }
});

// ── GET /api/logs ──
app.get('/api/logs', requireAdmin, async (req, res) => {
  const lines = parseInt(req.query.lines) || 200;
  const logPath = path.join(__dirname, 'scraper.log');
  try {
    const content = await fs.readFile(logPath, 'utf8');
    const allLines = content.trim().split('\n');
    res.json({ lines: allLines.slice(-lines) });
  } catch {
    res.json({ lines: [] });
  }
});

// ── POST /api/scrape/:id ──
app.post('/api/scrape/:id', requireAdmin, async (req, res) => {
  const opp = store.opportunities.find(o => o.id === req.params.id);
  if (!opp) return res.status(404).json({ error: 'Not found' });
  try {
    const result = await scrapeById(opp, store, { saveOpportunities, logChange });
    res.json(result);
  } catch (e) {
    res.json({ id: req.params.id, error: e.message, blocked: false });
  }
});

// ── POST /api/scrape/batch ──
app.post('/api/scrape/batch', requireAdmin, (req, res) => {
  const { filter } = req.body;
  res.status(202).json({ message: 'Batch scrape started', filter });
  scrapeBatch(filter || 'all', store, { saveOpportunities, logChange }).catch(e => logger.error('Batch scrape error', { error: e.message }));
});

// ── POST /api/subscribe ──
app.post('/api/subscribe', async (req, res) => {
  const { name, email, categories, notify_days_before } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'name and email required' });
  const existing = store.subscribers.find(s => s.email === email);
  if (existing) {
    Object.assign(existing, { name, categories: categories || [], notify_days_before: notify_days_before || 14, updated_at: new Date().toISOString() });
  } else {
    store.subscribers.push({ email, name, categories: categories || [], notify_days_before: notify_days_before || 14, subscribed_at: new Date().toISOString() });
  }
  await saveSubscribers();
  res.json({ success: true, message: 'Subscribed successfully' });
});

// ── DELETE /api/subscribe ──
app.delete('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  store.subscribers = store.subscribers.filter(s => s.email !== email);
  await saveSubscribers();
  res.json({ success: true });
});

// ── POST /api/auth ──
app.post('/api/auth', (req, res) => {
  const { secret } = req.body;
  res.json({ valid: secret === process.env.ADMIN_SECRET });
});

// ── POST /api/config (admin) ──
app.post('/api/config', requireAdmin, async (req, res) => {
  const configPath = path.join(DATA_DIR, 'config.json');
  store.config = { ...store.config, ...req.body };
  await fs.writeJson(configPath, store.config, { spaces: 2 });
  if (req.body.webhook_url !== undefined) {
    process.env.WEBHOOK_URL = req.body.webhook_url;
  }
  res.json({ success: true, config: store.config });
});

// ── GET /api/config (admin) ──
app.get('/api/config', requireAdmin, (req, res) => {
  res.json(store.config);
});

// ── POST /api/test-webhook (admin) ──
app.post('/api/test-webhook', requireAdmin, async (req, res) => {
  const webhookUrl = process.env.WEBHOOK_URL || store.config.webhook_url;
  if (!webhookUrl) return res.status(400).json({ error: 'No webhook URL configured' });
  try {
    const payload = { event: 'test', timestamp: new Date().toISOString(), message: 'EuroSpace Hub webhook test' };
    const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    res.json({ success: response.ok, status: response.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/test-email (admin) ──
app.post('/api/test-email', requireAdmin, async (req, res) => {
  try {
    await sendTestEmail(req.body.email || process.env.SMTP_USER);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/subscribers (admin) ──
app.get('/api/subscribers', requireAdmin, (req, res) => {
  const masked = store.subscribers.map(s => ({
    ...s,
    email: s.email.replace(/(.{1})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(2, b.length)) + c)
  }));
  res.json({ total: store.subscribers.length, subscribers: masked });
});

// ── GET /health ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), scraper_last_run: store.config.scraper_last_run });
});

const PORT = process.env.PORT || 3001;

async function main() {
  await loadData();
  startCron(store, { saveOpportunities, saveMembersBvsr, saveMembersNorstec, logChange });
  app.listen(PORT, () => logger.info(`EuroSpace API running on port ${PORT}`));
}

main().catch(e => { console.error(e); process.exit(1); });
