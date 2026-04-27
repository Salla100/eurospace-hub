import cron from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './scraper.js';
import {
  scrapeEsaAcademy,
  scrapeShortCourseScholarship,
  scrapeAcademicScholarship,
  scrapeConferenceSponsorshipPage,
  scrapeEuRoC,
  scrapeERC,
  scrapeRexusBexus,
  scrapeAlpbach,
  scrapeActInSpace,
  scrapeNorstecSummit,
  scrapeCASSINI,
  scrapeBvsrMembers,
  scrapeNorstecMembers,
} from './scraper.js';
import { sendDeadlineReminders } from './notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

async function fireWebhook(payload) {
  const url = process.env.WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    logger.info('Webhook fired', { event: payload.event });
  } catch (e) {
    logger.error('Webhook error', { error: e.message });
  }
}

// ── ESA Projects table → opportunity updates ──
const ESA_PROJECT_ID_MAP = {
  'REXUS': 'rexus-bexus',
  'BEXUS': 'rexus-bexus',
  'Fly Your Satellite!': 'fly-your-satellite',
  'Design Booster': 'fly-your-satellite-design-booster',
  'Test Opportunities': 'esa-test-opportunities',
  'Experiments': 'esa-academy-experiments-programme',
  'Rocketry Training': 'esa-rocketry-training-programme',
};

async function handleEsaAcademyResult(result, store, deps) {
  if (result.blocked) return [];
  const changes = [];

  for (const row of (result.projects_table || [])) {
    const programName = (row[0] || '').trim();
    const cycleText = (row[1] || '').trim();
    if (!programName || !cycleText) continue;

    let matchedId = null;
    for (const [keyword, id] of Object.entries(ESA_PROJECT_ID_MAP)) {
      if (programName.toLowerCase().includes(keyword.toLowerCase())) {
        matchedId = id;
        break;
      }
    }
    if (!matchedId) continue;

    const opp = store.opportunities.find((o) => o.id === matchedId);
    if (!opp) continue;

    const oldNotes = opp.deadline_notes;
    if (oldNotes !== cycleText) {
      opp.deadline_notes = cycleText;
      opp.last_verified = new Date().toISOString().slice(0, 10);

      const nowClosed = cycleText.toLowerCase().includes('currently closed');
      const wasClosed = (oldNotes || '').toLowerCase().includes('currently closed');
      if (!nowClosed && wasClosed) {
        opp.needs_review = true;
        await fireWebhook({
          event: 'programme_status_changed',
          timestamp: new Date().toISOString(),
          data: {
            id: matchedId,
            title: opp.title,
            message: 'Programme may have reopened — please verify',
            old: oldNotes,
            new: cycleText,
          },
        });
      } else if (nowClosed) {
        opp.status = 'closed';
      }

      await deps.saveOpportunities();
      await deps.logChange({
        id: matchedId,
        title: opp.title,
        field: 'deadline_notes',
        old_value: oldNotes || '',
        new_value: cycleText,
        source_url: 'https://www.esa.int/Education/ESA_Academy/ESA_Academy_opportunities3',
      });
      changes.push({ id: matchedId, field: 'deadline_notes', old_value: oldNotes, new_value: cycleText });
    }
  }
  return changes;
}

async function handleAcademicScholarshipResult(result, store, deps) {
  if (result.blocked) return;
  const opp = store.opportunities.find((o) => o.id === 'esa-academy-academic-scholarship');
  if (!opp) return;

  const newStatus = result.is_on_hold ? 'on_hold' : 'open';
  if (opp.status !== newStatus && newStatus === 'open') {
    opp.needs_review = true;
    opp.status = 'open';
    await deps.saveOpportunities();
    await fireWebhook({
      event: 'programme_status_changed',
      timestamp: new Date().toISOString(),
      data: {
        id: opp.id,
        title: opp.title,
        message: 'ESA Academic Scholarship programme may have reopened — please verify',
      },
    });
    logger.info('ESA Academic Scholarship status changed to open — flagged for review');
  }

  if (result.programmes && result.programmes.length > 0) {
    const programmeData = result.programmes.map((p) => ({
      name: p,
      discovered_at: new Date().toISOString(),
    }));
    await fs.writeJson(
      path.join(DATA_DIR, 'esa_scholarship_programmes.json'),
      programmeData,
      { spaces: 2 }
    );
  }
}

async function updateOpportunityFromScrape(id, scrapeResult, store, deps) {
  const opp = store.opportunities.find((o) => o.id === id);
  if (!opp) return null;
  if (scrapeResult.blocked || !scrapeResult.dates) return { id, blocked: true };

  const deadlineDates = (scrapeResult.dates || []).filter(
    (d) => d.near_deadline && new Date(d.date) > new Date()
  );
  if (!deadlineDates.length) return { id, changed: false };

  deadlineDates.sort((a, b) => new Date(a.date) - new Date(b.date));
  const best = deadlineDates[0].date;

  if (opp.deadline !== best) {
    const old = opp.deadline;
    opp.deadline = best;
    opp.last_verified = new Date().toISOString().slice(0, 10);
    await deps.saveOpportunities();
    await deps.logChange({
      id,
      title: opp.title,
      field: 'deadline',
      old_value: old || 'null',
      new_value: best,
      source_url: opp.scrape_url,
    });
    await fireWebhook({
      event: 'deadline_changed',
      timestamp: new Date().toISOString(),
      data: { id, title: opp.title, old_deadline: old, new_deadline: best },
    });
    return { id, changed: true, old_deadline: old, new_deadline: best };
  }
  opp.last_verified = new Date().toISOString().slice(0, 10);
  return { id, changed: false };
}

async function syncBvsrMembers(store, deps) {
  logger.info('Monthly BVSR member sync');
  const result = await scrapeBvsrMembers();
  if (result.blocked) return [];

  const newDiscovered = [];
  for (const member of result.members) {
    const slug = member.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const existing = store.members_bvsr.find(
      (m) => m.id === slug || m.name.toLowerCase() === member.name.toLowerCase()
    );
    if (!existing) {
      store.members_bvsr.push({
        id: slug,
        name: member.name,
        university: '',
        city: '',
        country: 'Germany',
        focus: [],
        website: member.website,
        logo_url: member.logo_url,
        description: member.description,
        bvsr_member: true,
        correspondent_member: false,
        needs_review: true,
        discovered_at: new Date().toISOString(),
      });
      newDiscovered.push({ type: 'bvsr_member', name: member.name, source_url: 'https://bvsr.space/' });
      logger.info(`New BVSR member discovered: ${member.name}`);
    } else {
      // Update logo/website if changed
      if (member.logo_url && !existing.logo_url) existing.logo_url = member.logo_url;
    }
  }

  if (newDiscovered.length > 0 || result.members.length > 0) {
    await deps.saveMembersBvsr();
  }
  store.config = store.config || {};
  store.config.last_bvsr_sync = new Date().toISOString();
  await fs.writeJson(path.join(DATA_DIR, 'config.json'), store.config, { spaces: 2 });

  if (newDiscovered.length > 0) {
    await fireWebhook({
      event: 'new_discovered',
      timestamp: new Date().toISOString(),
      data: { items: newDiscovered },
    });
  }
  return newDiscovered;
}

async function syncNorstecMembers(store, deps) {
  logger.info('Monthly NORSTEC member sync');
  const result = await scrapeNorstecMembers();
  if (result.blocked) return [];

  const newDiscovered = [];
  for (const member of result.members) {
    const slug = member.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const existing = store.members_norstec.find(
      (m) => m.id === slug || m.name.toLowerCase() === member.name.toLowerCase()
    );
    if (!existing) {
      store.members_norstec.push({
        id: slug,
        name: member.name,
        university_abbr: '',
        city: member.city,
        country: 'Norway',
        specialization: member.specialization || 'Rocketeering',
        website: member.website,
        norstec_member: true,
        incubator: false,
        needs_review: true,
        discovered_at: new Date().toISOString(),
      });
      newDiscovered.push({ type: 'norstec_member', name: member.name, source_url: 'https://norstec.no/' });
      logger.info(`New NORSTEC member discovered: ${member.name}`);
    }
  }

  if (newDiscovered.length > 0 || result.members.length > 0) {
    await deps.saveMembersNorstec();
  }
  store.config = store.config || {};
  store.config.last_norstec_sync = new Date().toISOString();
  await fs.writeJson(path.join(DATA_DIR, 'config.json'), store.config, { spaces: 2 });

  if (newDiscovered.length > 0) {
    await fireWebhook({
      event: 'new_discovered',
      timestamp: new Date().toISOString(),
      data: { items: newDiscovered },
    });
  }
  return newDiscovered;
}

async function flagStaleOpportunities(store, deps) {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const staled = [];
  for (const opp of store.opportunities) {
    if (opp.last_verified && opp.last_verified < cutoff && !opp.needs_review) {
      opp.needs_review = true;
      staled.push({ id: opp.id, title: opp.title, last_verified: opp.last_verified });
    }
  }
  if (staled.length > 0) {
    await deps.saveOpportunities();
    logger.info(`Flagged ${staled.length} stale opportunities`);
  }
  return staled;
}

const COMPETITION_SCRAPERS = [
  { fn: scrapeEuRoC, id: 'euroc' },
  { fn: scrapeERC, id: 'erc-european-rover-challenge' },
  { fn: scrapeRexusBexus, id: 'rexus-bexus' },
  { fn: scrapeAlpbach, id: 'alpbach-summer-school' },
  { fn: scrapeActInSpace, id: 'actinspace' },
  { fn: scrapeNorstecSummit, id: 'norstec-summit' },
  { fn: scrapeCASSINI, id: 'cassini-hackathon' },
];

export function startCron(store, deps) {
  // ── Weekly: Monday 06:00 UTC ──
  cron.schedule('0 6 * * 1', async () => {
    logger.info('Weekly cron starting');
    const changed = [];
    const errors = [];
    const newDiscovered = [];

    // ESA pages
    try {
      const esaResult = await scrapeEsaAcademy();
      const c = await handleEsaAcademyResult(esaResult, store, deps);
      changed.push(...c);
    } catch (e) { errors.push({ id: 'esa_academy', error: e.message }); }

    try {
      const scResult = await scrapeShortCourseScholarship();
      if (!scResult.blocked) {
        const knownTags = store.opportunities
          .filter((o) => o.category === 'esa_academy_scholarship')
          .flatMap((o) => o.tags || []);
        for (const course of scResult.courses || []) {
          const known = knownTags.some((t) => course.toLowerCase().includes(t.toLowerCase()));
          if (!known && course.length > 10) {
            newDiscovered.push({
              type: 'opportunity',
              name: course,
              source_url: 'https://www.esa.int/Education/Engagement/Short_Course_Scholarship_programme',
            });
          }
        }
      }
    } catch (e) { errors.push({ id: 'short_course_scholarship', error: e.message }); }

    try {
      const acResult = await scrapeAcademicScholarship();
      await handleAcademicScholarshipResult(acResult, store, deps);
    } catch (e) { errors.push({ id: 'academic_scholarship', error: e.message }); }

    try { await scrapeConferenceSponsorshipPage(); } catch (e) { errors.push({ id: 'conference_sponsorship', error: e.message }); }

    // Competition scrapes
    for (const { fn, id } of COMPETITION_SCRAPERS) {
      try {
        const r = await fn();
        const c = await updateOpportunityFromScrape(id, r, store, deps);
        if (c?.changed) changed.push(c);
      } catch (e) { errors.push({ id, error: e.message }); }
    }

    store.config.scraper_last_run = new Date().toISOString();
    await fs.writeJson(path.join(DATA_DIR, 'config.json'), store.config, { spaces: 2 });

    await fireWebhook({
      event: 'cron_summary',
      run_at: new Date().toISOString(),
      schedule: 'weekly',
      total_scraped: COMPETITION_SCRAPERS.length + 4,
      changed,
      new_discovered: newDiscovered,
      errors,
      stale_flagged: [],
    });
    logger.info('Weekly cron complete', { changed: changed.length, errors: errors.length });
  });

  // ── Daily: 08:00 UTC ──
  cron.schedule('0 8 * * *', async () => {
    logger.info('Daily cron starting');
    try {
      const esaResult = await scrapeEsaAcademy();
      await handleEsaAcademyResult(esaResult, store, deps);
    } catch (e) { logger.error('Daily ESA scrape error', { error: e.message }); }

    const sixtyDays = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const compIds = new Set(COMPETITION_SCRAPERS.map((s) => s.id));
    const scraperFnMap = Object.fromEntries(COMPETITION_SCRAPERS.map((s) => [s.id, s.fn]));

    const upcoming = store.opportunities.filter(
      (o) => o.deadline && o.deadline <= sixtyDays && o.scrape_url && compIds.has(o.id)
    );
    for (const opp of upcoming) {
      try {
        const r = await scraperFnMap[opp.id]();
        await updateOpportunityFromScrape(opp.id, r, store, deps);
      } catch (e) { logger.error(`Daily scrape error for ${opp.id}`, { error: e.message }); }
    }

    store.config.scraper_last_run = new Date().toISOString();
    await fs.writeJson(path.join(DATA_DIR, 'config.json'), store.config, { spaces: 2 });
    logger.info('Daily cron complete');
  });

  // ── Monthly: 1st 07:00 UTC ──
  cron.schedule('0 7 1 * *', async () => {
    logger.info('Monthly cron starting');
    const bvsrNew = await syncBvsrMembers(store, deps).catch((e) => {
      logger.error('BVSR sync error', { error: e.message });
      return [];
    });
    const norstecNew = await syncNorstecMembers(store, deps).catch((e) => {
      logger.error('NORSTEC sync error', { error: e.message });
      return [];
    });
    const stale_flagged = await flagStaleOpportunities(store, deps);

    await fireWebhook({
      event: 'cron_summary',
      run_at: new Date().toISOString(),
      schedule: 'monthly',
      total_scraped: 2,
      changed: [],
      new_discovered: [...bvsrNew, ...norstecNew],
      errors: [],
      stale_flagged,
    });
    logger.info('Monthly cron complete', { stale_flagged: stale_flagged.length });
  });

  logger.info('Cron jobs scheduled: weekly Mon 06:00, daily 08:00, monthly 1st 07:00 UTC');
}
