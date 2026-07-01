import cron from 'node-cron';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './scraper.js';
import {
  scrapeEsaAcademy,
  scrapeEsaTlpPortfolio,
  scrapeLearnEsaCourseDeadline,
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
import { sendDeadlineReminders, sendNewOpportunityAlert, sendDeadlineUpdateAlert } from './notifier.js';

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
        opp.status = 'open';
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
        // Notify subscribers that this programme has reopened
        await sendNewOpportunityAlert(opp, store).catch((e) =>
          logger.error('Email alert error', { error: e.message })
        );
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
  if (!deadlineDates.length) {
    // No upcoming deadline found — still stamp last_verified so the scraper
    // run is recorded and "Open Now" / stale-flagging work correctly.
    opp.last_verified = new Date().toISOString().slice(0, 10);
    await deps.saveOpportunities();
    return { id, changed: false };
  }

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
    // Email subscribers when a recurring opportunity opens a new year's sign-up
    await sendDeadlineUpdateAlert(id, old, store).catch((e) =>
      logger.error('Email alert error', { error: e.message })
    );
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
      store.discovered = store.discovered || [];
      store.discovered.push({
        id: `${Date.now()}-${slug}`,
        type: 'bvsr_member',
        name: member.name,
        provider: 'BVSR',
        source_url: 'https://bvsr.space/',
        details: member.description || '',
        discovered_at: new Date().toISOString(),
        seen: false,
      });
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
    await deps.saveDiscovered?.();
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
      store.discovered = store.discovered || [];
      store.discovered.push({
        id: `${Date.now()}-${slug}`,
        type: 'norstec_member',
        name: member.name,
        provider: 'NORSTEC',
        source_url: 'https://norstec.no/',
        details: member.specialization || '',
        discovered_at: new Date().toISOString(),
        seen: false,
      });
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
    await deps.saveDiscovered?.();
    await fireWebhook({
      event: 'new_discovered',
      timestamp: new Date().toISOString(),
      data: { items: newDiscovered },
    });
  }
  return newDiscovered;
}

// ── Space Training Catalogue API sync ────────────────────────────
// Queries the free Space Training UK catalogue monthly for new free
// workshops / short courses not yet in our database.
const SPACE_TRAINING_API = 'https://training.spaceskills.org/api/v2/opportunities';
const SPACE_TRAINING_TYPES = 'Workshop;Short course;Seminar';

async function syncSpaceTrainingCatalogue(store, deps) {
  logger.info('Space Training Catalogue sync starting');
  const url =
    `${SPACE_TRAINING_API}?q[price_gbp_lteq]=0` +
    `&q[training_types_name_eq_any]=${encodeURIComponent(SPACE_TRAINING_TYPES)}` +
    `&page[size]=100`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Space Training API responded ${res.status}`);
  const json = await res.json();
  const items = json.data || [];

  // Normalise our existing titles for fuzzy matching
  const knownTitles = store.opportunities.map((o) =>
    (o.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  );

  const newDiscovered = [];
  for (const item of items) {
    const attrs = item.attributes || item;
    const title = (attrs.title || '').trim();
    if (!title) continue;

    const normTitle = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const firstWords = normTitle.split(' ').slice(0, 5).join(' ');

    const alreadyKnown = knownTitles.some(
      (t) => t === normTitle || t.includes(firstWords) || normTitle.includes(t.split(' ').slice(0, 5).join(' '))
    );
    if (alreadyKnown) continue;

    const provider = Array.isArray(attrs.providers)
      ? attrs.providers.map((p) => p.name).join(', ')
      : (attrs.provider || '');
    const trainingType = Array.isArray(attrs.training_types)
      ? attrs.training_types.map((t) => t.name).join(', ')
      : '';
    const topics = Array.isArray(attrs.topics)
      ? attrs.topics.map((t) => t.name).join(', ')
      : '';

    newDiscovered.push({
      type: 'opportunity',
      name: title,
      provider,
      training_type: trainingType,
      topics,
      source_url: `https://spacetraining.uk/opportunities/${item.id}`,
    });
    logger.info(`Space Training: new free item found — ${title}`);
  }

  logger.info(`Space Training sync complete: ${items.length} free items checked, ${newDiscovered.length} new`);

  if (newDiscovered.length > 0) {
    store.discovered = store.discovered || [];
    for (const item of newDiscovered) {
      const slug = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40);
      store.discovered.push({
        id: `${Date.now()}-${slug}`,
        type: item.type,
        name: item.name,
        provider: item.provider || '',
        source_url: item.source_url || '',
        details: [item.training_type, item.topics].filter(Boolean).join(' · '),
        discovered_at: new Date().toISOString(),
        seen: false,
      });
    }
    await deps?.saveDiscovered?.();
  }

  return newDiscovered;
}

export async function syncEsaTlpStatus(store, deps) {
  logger.info('ESA TLP portfolio status sync starting');
  const result = await scrapeEsaTlpPortfolio();
  if (result.blocked) {
    logger.warn('TLP portfolio scrape blocked');
    return { changed: 0, blocked: true };
  }

  const normalize = (s) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const esaWorkshops = store.opportunities.filter(
    (o) => ['esa_academy_workshop', 'esa_academy_project', 'esa_academy_scholarship', 'esa_academy_sponsorship'].includes(o.category)
  );

  const statusChanges = [];
  for (const session of result.sessions) {
    const normSession = normalize(session.title);
    const sessionWords = normSession.split(' ').slice(0, 6).join(' ');

    const matched = esaWorkshops.find((o) => {
      const normTitle = normalize(o.title);
      const titleWords = normTitle.split(' ').slice(0, 6).join(' ');
      return normTitle === normSession || normTitle.startsWith(sessionWords) || normSession.startsWith(titleWords);
    });

    if (!matched) continue;

    const newStatus = session.status === 'open' ? 'open'
      : session.status === 'closed' ? 'closed'
      : 'pending';

    const oldStatus = matched.status || null;
    const statusChanged = matched.status !== newStatus;

    // Always update scrape_url if the TLP page gave us an individual course URL
    if (session.url && matched.scrape_url !== session.url) {
      matched.scrape_url = session.url;
    }

    if (statusChanged) {
      matched.status = newStatus;
      matched.last_verified = new Date().toISOString().slice(0, 10);
      statusChanges.push({ id: matched.id, title: matched.title, old: oldStatus, new: newStatus });
      logger.info(`TLP status: ${matched.id} ${oldStatus} → ${newStatus}`);
    }

    // For open courses, scrape the individual page for the registration deadline
    if (newStatus === 'open' && session.url) {
      try {
        const deadline = await scrapeLearnEsaCourseDeadline(session.url);
        if (deadline && deadline !== matched.deadline) {
          logger.info(`TLP deadline: ${matched.id} → ${deadline}`);
          matched.deadline = deadline;
          if (!statusChanged) matched.last_verified = new Date().toISOString().slice(0, 10);
          if (!statusChanges.find(c => c.id === matched.id)) {
            statusChanges.push({ id: matched.id, title: matched.title, old: oldStatus, new: newStatus });
          }
        }
      } catch (e) {
        logger.warn(`TLP deadline scrape failed for ${matched.id}: ${e.message}`);
      }
    }

    if (!statusChanged) continue;

    if (newStatus === 'open' && oldStatus !== 'open') {
      store.discovered = store.discovered || [];
      store.discovered.push({
        id: `${Date.now()}-${matched.id}`,
        type: 'status_open',
        name: matched.title,
        provider: 'ESA Academy',
        source_url: session.url || matched.url || '',
        details: `Status changed from ${oldStatus || 'unknown'} to open`,
        discovered_at: new Date().toISOString(),
        seen: false,
      });
      await fireWebhook({
        event: 'programme_status_changed',
        timestamp: new Date().toISOString(),
        data: { id: matched.id, title: matched.title, message: 'ESA Academy course is now open for applications', old: oldStatus, new: newStatus },
      });
      await sendNewOpportunityAlert(matched, store).catch((e) =>
        logger.error('Email alert error', { error: e.message })
      );
    }
  }

  if (statusChanges.length > 0) {
    await deps.saveOpportunities();
    if (statusChanges.some((c) => c.new === 'open')) {
      await deps.saveDiscovered?.();
    }
    logger.info(`TLP sync complete: ${statusChanges.length} statuses updated`);
  } else {
    logger.info('TLP sync complete: no status changes');
  }
  return { changed: statusChanges.length, updates: statusChanges };
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
      const tlpResult = await syncEsaTlpStatus(store, deps);
      if (tlpResult.updates?.length) changed.push(...tlpResult.updates.map((u) => ({ id: u.id, field: 'status', old_value: u.old, new_value: u.new })));
    } catch (e) { errors.push({ id: 'esa_tlp_status', error: e.message }); }

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
      total_scraped: COMPETITION_SCRAPERS.length + 5,
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

    // Send deadline reminders to subscribers based on their 7/14/30 day preference
    await sendDeadlineReminders(store).catch((e) =>
      logger.error('Deadline reminder error', { error: e.message })
    );
    if (deps?.saveNotificationsSent) await deps.saveNotificationsSent();

    store.config.scraper_last_run = new Date().toISOString();
    await fs.writeJson(path.join(DATA_DIR, 'config.json'), store.config, { spaces: 2 });
    logger.info('Daily cron complete');
  });

  // ── Monthly: 1st 07:00 UTC ──
  cron.schedule('0 7 1 * *', async () => {
    logger.info('Monthly cron starting');
    const errors = [];

    const bvsrNew = await syncBvsrMembers(store, deps).catch((e) => {
      logger.error('BVSR sync error', { error: e.message });
      errors.push({ id: 'bvsr_sync', error: e.message });
      return [];
    });
    const norstecNew = await syncNorstecMembers(store, deps).catch((e) => {
      logger.error('NORSTEC sync error', { error: e.message });
      errors.push({ id: 'norstec_sync', error: e.message });
      return [];
    });
    const spaceTrainingNew = await syncSpaceTrainingCatalogue(store, deps).catch((e) => {
      logger.error('Space Training sync error', { error: e.message });
      errors.push({ id: 'space_training_sync', error: e.message });
      return [];
    });
    const stale_flagged = await flagStaleOpportunities(store, deps);

    const newDiscovered = [...bvsrNew, ...norstecNew, ...spaceTrainingNew];

    await fireWebhook({
      event: 'cron_summary',
      run_at: new Date().toISOString(),
      schedule: 'monthly',
      total_scraped: 3,
      changed: [],
      new_discovered: newDiscovered,
      errors,
      stale_flagged,
    });
    logger.info('Monthly cron complete', {
      stale_flagged: stale_flagged.length,
      space_training_new: spaceTrainingNew.length,
    });
  });

  logger.info('Cron jobs scheduled: weekly Mon 06:00, daily 08:00, monthly 1st 07:00 UTC');
}
