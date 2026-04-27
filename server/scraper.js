import puppeteer from 'puppeteer';
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) =>
      `${timestamp} [${level.toUpperCase()}] ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(__dirname, 'scraper.log'), maxsize: 5 * 1024 * 1024, maxFiles: 3 })
  ]
});

// Rate limiting: track last request per domain
const domainLastRequest = new Map();
const RATE_LIMIT_MS = 5000;

async function rateLimit(url) {
  const domain = new URL(url).hostname;
  const last = domainLastRequest.get(domain) || 0;
  const wait = RATE_LIMIT_MS - (Date.now() - last);
  if (wait > 0) {
    logger.info(`Rate limit applied, waiting ${(wait / 1000).toFixed(1)}s for ${domain}`);
    await new Promise(r => setTimeout(r, wait));
  }
  domainLastRequest.set(domain, Date.now());
}

const CHROME_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

async function getBrowser() {
  const opts = { args: CHROME_ARGS, headless: true };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return puppeteer.launch(opts);
}

const DATE_PATTERNS = [
  /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi,
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi,
  /(\d{4})-(\d{2})-(\d{2})/g,
  /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
  /Q([1-4])\s+(\d{4})/gi,
  /(Summer|Spring|Autumn|Fall|Winter)\s+(\d{4})/gi,
];

const DEADLINE_KEYWORDS = ['deadline', 'apply by', 'closes', 'open until', 'applications close', 'register by', 'submission'];

function extractDatesFromText(text) {
  const dates = [];
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchStart = match.index;
      const context = text.slice(Math.max(0, matchStart - 150), matchStart + match[0].length + 20).toLowerCase();
      const nearDeadline = DEADLINE_KEYWORDS.some(kw => context.includes(kw));
      try {
        let dateObj;
        const raw = match[0];
        if (/Q\d/i.test(raw)) {
          const q = parseInt(raw.match(/Q(\d)/i)[1]);
          const y = parseInt(raw.match(/(\d{4})/)[1]);
          dateObj = new Date(y, (q - 1) * 3, 1);
        } else if (/(Summer|Spring|Autumn|Fall|Winter)/i.test(raw)) {
          const season = raw.match(/(Summer|Spring|Autumn|Fall|Winter)/i)[1].toLowerCase();
          const y = parseInt(raw.match(/(\d{4})/)[1]);
          const monthMap = { spring: 3, summer: 6, autumn: 9, fall: 9, winter: 0 };
          dateObj = new Date(y, monthMap[season], 1);
        } else {
          dateObj = new Date(raw);
        }
        if (!isNaN(dateObj.getTime())) {
          dates.push({ date: dateObj.toISOString().slice(0, 10), raw, near_deadline: nearDeadline });
        }
      } catch {}
    }
  }
  return dates;
}

async function scrapePage(url, waitSelector = 'body', timeout = 15000) {
  await rateLimit(url);
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; EuroSpaceHub/1.0; +https://eurospacehub.eu)');
    await page.setDefaultTimeout(timeout);

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    if (response && (response.status() === 403 || response.status() === 429)) {
      return { blocked: true, error: `HTTP ${response.status()}`, text: '' };
    }

    try {
      await page.waitForSelector(waitSelector, { timeout: 10000 });
    } catch {
      logger.warn(`Selector "${waitSelector}" not found on ${url}`);
    }

    const text = await page.evaluate(() => document.body?.innerText || '');
    const html = await page.content();

    if (!text || text.length < 100) {
      return { blocked: true, error: 'Empty or very short page content', text: '', html: '' };
    }

    return { blocked: false, text, html, status: response?.status() };
  } catch (e) {
    logger.error(`Scrape error for ${url}`, { error: e.message });
    return { blocked: true, error: e.message, text: '', html: '' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ── SOURCE A: ESA Academy ──
export async function scrapeEsaAcademy() {
  logger.info('Scraping ESA Academy main page');
  const result = await scrapePage(
    'https://www.esa.int/Education/ESA_Academy/ESA_Academy_opportunities3',
    'article, .wysiwyg, main',
    15000
  );
  if (result.blocked) return { source: 'esa_academy', blocked: true, error: result.error, changes: [] };

  const dates = extractDatesFromText(result.text);
  logger.info(`ESA Academy: extracted ${dates.length} dates`);

  // Also scrape current opportunities page
  await rateLimit('https://www.esa.int/Education/ESA_Academy/Training_Current_Opportunities');
  const current = await scrapePage(
    'https://www.esa.int/Education/ESA_Academy/Training_Current_Opportunities',
    'article, .wysiwyg, main',
    15000
  );

  const projectsData = parseEsaProjectsTable(result.html || '');
  const currentDates = current.blocked ? [] : extractDatesFromText(current.text);

  return {
    source: 'esa_academy',
    blocked: false,
    dates: [...dates, ...currentDates],
    projects_table: projectsData,
    text: result.text,
    current_text: current.text
  };
}

function parseEsaProjectsTable(html) {
  const rows = [];
  const tableRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const rowHtml = tableMatch[1];
    const cells = [];
    let cellMatch;
    const cellRe = new RegExp(cellRegex.source, 'gi');
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

// ── SOURCE B: Short Course Scholarship ──
export async function scrapeShortCourseScholarship() {
  logger.info('Scraping ESA Short Course Scholarship page');
  const result = await scrapePage('https://www.esa.int/Education/Engagement/Short_Course_Scholarship_programme', 'article, .wysiwyg', 15000);
  if (result.blocked) return { source: 'short_course_scholarship', blocked: true, error: result.error, courses: [] };

  // Extract course list items
  const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const courses = [];
  let m;
  while ((m = listItemRegex.exec(result.html || '')) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 5 && text.length < 200) courses.push(text);
  }

  return { source: 'short_course_scholarship', blocked: false, courses, text: result.text };
}

// ── SOURCE C: Academic Scholarship ──
export async function scrapeAcademicScholarship() {
  logger.info('Scraping ESA Academic Scholarship page');
  const result = await scrapePage('https://www.esa.int/Education/Engagement/Academic_Scholarship_programme', 'article, .wysiwyg', 15000);
  if (result.blocked) return { source: 'academic_scholarship', blocked: true, error: result.error };

  const textLower = (result.text || '').toLowerCase();
  const isOnHold = textLower.includes('on hold') || textLower.includes('on-hold') || textLower.includes('programme on-hold');

  // Extract listed programmes
  const programmes = [];
  const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = listItemRegex.exec(result.html || '')) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 5 && text.length < 200) programmes.push(text);
  }

  return { source: 'academic_scholarship', blocked: false, is_on_hold: isOnHold, programmes, text: result.text };
}

// ── SOURCE D: Conference Sponsorship ──
export async function scrapeConferenceSponsorshipPage() {
  logger.info('Scraping ESA Conference Sponsorship page');
  const result = await scrapePage('https://www.esa.int/Education/Engagement/Conference_Student_Sponsorship_programme', 'article, .wysiwyg', 15000);
  if (result.blocked) return { source: 'conference_sponsorship', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { source: 'conference_sponsorship', blocked: false, dates, text: result.text };
}

// ── SOURCE E: EuRoC ──
export async function scrapeEuRoC() {
  logger.info('Scraping EuRoC');
  const result = await scrapePage('https://euroc.pt/competition-rules/', 'body', 15000);
  if (result.blocked) return { id: 'euroc', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { id: 'euroc', blocked: false, dates, text: result.text.slice(0, 3000) };
}

// ── SOURCE F: ERC ──
export async function scrapeERC() {
  logger.info('Scraping ERC');
  const result = await scrapePage('https://roverchallenge.eu/competitor-zone/', 'body', 15000);
  if (result.blocked) return { id: 'erc-european-rover-challenge', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { id: 'erc-european-rover-challenge', blocked: false, dates, text: result.text.slice(0, 3000) };
}

// ── SOURCE G: REXUS/BEXUS ──
export async function scrapeRexusBexus() {
  logger.info('Scraping REXUS/BEXUS');
  const result = await scrapePage('https://rexusbexus.net', 'body', 15000);
  if (result.blocked) return { id: 'rexus-bexus', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { id: 'rexus-bexus', blocked: false, dates, text: result.text.slice(0, 3000) };
}

// ── SOURCE H: Alpbach ──
export async function scrapeAlpbach() {
  logger.info('Scraping Alpbach Summer School');
  const result = await scrapePage('https://www.summerschoolalpbach.at', 'body', 15000);
  if (result.blocked) return { id: 'alpbach-summer-school', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { id: 'alpbach-summer-school', blocked: false, dates, text: result.text.slice(0, 3000) };
}

// ── SOURCE I: ActInSpace ──
export async function scrapeActInSpace() {
  logger.info('Scraping ActInSpace');
  const result = await scrapePage('https://actinspace.org', 'body', 15000);
  if (result.blocked) return { id: 'actinspace', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { id: 'actinspace', blocked: false, dates, text: result.text.slice(0, 3000) };
}

// ── SOURCE J: NORSTEC Summit ──
export async function scrapeNorstecSummit() {
  logger.info('Scraping NORSTEC Summit');
  const result = await scrapePage('https://norstec.no/summit', 'body', 15000);
  if (result.blocked) return { id: 'norstec-summit', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { id: 'norstec-summit', blocked: false, dates, text: result.text.slice(0, 3000) };
}

// ── SOURCE K: CASSINI ──
export async function scrapeCASSINI() {
  logger.info('Scraping CASSINI Hackathon');
  const result = await scrapePage('https://www.cassini.eu/hackathons', 'body', 15000);
  if (result.blocked) return { id: 'cassini-hackathon', blocked: true, error: result.error };
  const dates = extractDatesFromText(result.text);
  return { id: 'cassini-hackathon', blocked: false, dates, text: result.text.slice(0, 3000) };
}

// ── SOURCE L: BVSR Members ──
export async function scrapeBvsrMembers() {
  logger.info('Scraping BVSR members');
  const result = await scrapePage('https://bvsr.space/', 'body', 20000);
  if (result.blocked) return { source: 'bvsr_members', blocked: true, error: result.error, members: [] };

  let browser;
  const members = [];
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; EuroSpaceHub/1.0)');
    await page.goto('https://bvsr.space/', { waitUntil: 'networkidle2', timeout: 20000 });

    const cards = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('.member-card, .team-card, article, .entry, [class*="member"]');
      cards.forEach(card => {
        const name = card.querySelector('h2, h3, h4, .name, .title')?.textContent?.trim();
        const desc = card.querySelector('p, .description, .content')?.textContent?.trim();
        const link = card.querySelector('a[href]')?.href;
        const img = card.querySelector('img')?.src;
        if (name) items.push({ name, description: desc || '', website: link || '', logo_url: img || '' });
      });
      return items;
    });
    members.push(...cards);
  } catch (e) {
    logger.error('BVSR member scrape error', { error: e.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return { source: 'bvsr_members', blocked: false, members };
}

// ── SOURCE M: NORSTEC Members ──
export async function scrapeNorstecMembers() {
  logger.info('Scraping NORSTEC members');
  const result = await scrapePage('https://norstec.no/', 'body', 15000);
  if (result.blocked) return { source: 'norstec_members', blocked: true, error: result.error, members: [] };

  let browser;
  const members = [];
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; EuroSpaceHub/1.0)');
    await page.goto('https://norstec.no/', { waitUntil: 'networkidle2', timeout: 15000 });

    const rows = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('table tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.textContent.trim());
        const link = row.querySelector('a[href]')?.href;
        if (cells.length >= 2) items.push({ cells, website: link || '' });
      });
      return items;
    });
    for (const row of rows) {
      if (row.cells[0] && row.cells[0].length > 1) {
        members.push({ name: row.cells[0], city: row.cells[1] || '', specialization: row.cells[2] || '', website: row.website });
      }
    }
  } catch (e) {
    logger.error('NORSTEC member scrape error', { error: e.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return { source: 'norstec_members', blocked: false, members };
}

// ── Apply scrape result to an opportunity ──
async function applyDeadlineDates(opp, dates, sourceUrl, { saveOpportunities, logChange }) {
  const deadlineDates = dates.filter(d => d.near_deadline && new Date(d.date) > new Date());
  if (deadlineDates.length === 0) return { changed: false };

  deadlineDates.sort((a, b) => new Date(a.date) - new Date(b.date));
  const best = deadlineDates[0].date;

  if (opp.deadline !== best) {
    const oldDeadline = opp.deadline;
    opp.deadline = best;
    opp.last_verified = new Date().toISOString().slice(0, 10);
    await saveOpportunities();
    await logChange({ id: opp.id, title: opp.title, field: 'deadline', old_value: oldDeadline || 'null', new_value: best, source_url: sourceUrl });
    logger.info(`Updated deadline for ${opp.id}: ${oldDeadline} → ${best}`);
    return { changed: true, old_deadline: oldDeadline, new_deadline: best };
  }

  opp.last_verified = new Date().toISOString().slice(0, 10);
  return { changed: false, old_deadline: opp.deadline, new_deadline: opp.deadline };
}

// ── Public: scrape single opportunity by id ──
export async function scrapeById(opp, store, deps) {
  if (!opp.scrape_url) return { id: opp.id, changed: false, error: 'No scrape_url' };

  const scrapers = {
    'euroc': scrapeEuRoC,
    'erc-european-rover-challenge': scrapeERC,
    'rexus-bexus': scrapeRexusBexus,
    'alpbach-summer-school': scrapeAlpbach,
    'actinspace': scrapeActInSpace,
    'norstec-summit': scrapeNorstecSummit,
    'cassini-hackathon': scrapeCASSINI,
  };

  let result;
  if (scrapers[opp.id]) {
    result = await scrapers[opp.id]();
  } else {
    const page = await scrapePage(opp.scrape_url, 'body', 15000);
    result = { ...page, dates: page.blocked ? [] : extractDatesFromText(page.text) };
  }

  if (result.blocked) return { id: opp.id, blocked: true, error: result.error };

  const applyResult = await applyDeadlineDates(opp, result.dates || [], opp.scrape_url, deps);
  return { id: opp.id, ...applyResult, extracted_dates: result.dates, blocked: false };
}

// ── Public: batch scrape ──
export async function scrapeBatch(filter, store, deps) {
  const now = new Date();
  let opps = store.opportunities;

  if (filter === 'recurring') {
    opps = opps.filter(o => o.deadline_recurring && o.scrape_url);
  } else if (filter === 'stale') {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    opps = opps.filter(o => o.scrape_url && (!o.last_verified || o.last_verified < cutoff));
  } else {
    opps = opps.filter(o => o.scrape_url);
  }

  logger.info(`Batch scrape: ${opps.length} opportunities (filter: ${filter})`);
  const results = [];
  for (const opp of opps) {
    try {
      const r = await scrapeById(opp, store, deps);
      results.push(r);
    } catch (e) {
      results.push({ id: opp.id, error: e.message, blocked: false });
    }
  }
  return results;
}

// ── CLI entry point ──
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const DATA_DIR_CLI = path.join(__dirname, '..', 'data');

  async function loadStoreCli() {
    return {
      opportunities: await fs.readJson(path.join(DATA_DIR_CLI, 'opportunities.json')).catch(() => []),
      members_bvsr: await fs.readJson(path.join(DATA_DIR_CLI, 'members_bvsr.json')).catch(() => []),
      members_norstec: await fs.readJson(path.join(DATA_DIR_CLI, 'members_norstec.json')).catch(() => []),
    };
  }

  async function saveOpportunitiesCli(store) {
    await fs.writeJson(path.join(DATA_DIR_CLI, 'opportunities.json'), store.opportunities, { spaces: 2 });
  }

  async function logChangeCli(entry) {
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    await fs.appendFile(path.join(DATA_DIR_CLI, 'changes.log'), line);
  }

  if (args.includes('--run-once')) {
    const store = await loadStoreCli();
    const results = await scrapeBatch('all', store, { saveOpportunities: () => saveOpportunitiesCli(store), logChange: logChangeCli });
    console.log(JSON.stringify(results, null, 2));
  } else if (args.includes('--sync-members')) {
    const [bvsr, norstec] = await Promise.all([scrapeBvsrMembers(), scrapeNorstecMembers()]);
    console.log('BVSR:', JSON.stringify(bvsr, null, 2));
    console.log('NORSTEC:', JSON.stringify(norstec, null, 2));
  }
  process.exit(0);
}
