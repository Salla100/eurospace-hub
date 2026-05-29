import nodemailer from 'nodemailer';
import { logger } from './scraper.js';

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function daysLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - Date.now()) / 86400000);
}

function deadlineLabel(deadline) {
  const d = daysLeft(deadline);
  if (d === null || d < 0) return null;
  if (d === 0) return 'Today!';
  if (d === 1) return 'Tomorrow!';
  return `${d} days left`;
}

function deadlineColor(deadline) {
  const d = daysLeft(deadline);
  if (d === null) return '#4f8ef7';
  if (d < 7) return '#ef4444';
  if (d < 14) return '#f59e0b';
  return '#4f8ef7';
}

function buildOppCard(opp, { isUpdate = false, oldDeadline = null } = {}) {
  const accent = '#4f8ef7';
  const cardBg = '#0d1526';
  const border = '#1e2d4a';
  const label = deadlineLabel(opp.deadline);
  const color = deadlineColor(opp.deadline);
  const fundedBadge = opp.funding_available
    ? `<span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;font-weight:600;">💰 Funded</span>`
    : '';
  const teamBadge = opp.team_based
    ? `<span style="background:#7c3aed;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;">👥 Team</span>`
    : '';
  const catLabel = (opp.category || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const applyUrl = opp.application_url || opp.url || '#';
  const deadlineDisplay = opp.deadline
    ? new Date(opp.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return `
<div style="background:${cardBg};border:1px solid ${border};border-radius:10px;padding:20px;margin-bottom:16px;">
  <div style="margin-bottom:10px;">
    <span style="background:${accent};color:#fff;padding:2px 10px;border-radius:4px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${catLabel}</span>
    ${fundedBadge}${teamBadge}
  </div>
  <h2 style="color:#f1f5f9;font-size:19px;margin:0 0 4px 0;font-family:'Segoe UI',Arial,sans-serif;">${opp.title}</h2>
  <p style="color:#64748b;font-size:13px;margin:0 0 10px 0;">${opp.organisation}</p>
  <p style="color:#cbd5e1;font-size:14px;line-height:1.5;margin:0 0 14px 0;">${(opp.description || '').slice(0, 200)}${(opp.description || '').length > 200 ? '…' : ''}</p>
  <div style="color:#94a3b8;font-size:13px;margin-bottom:14px;">
    📍 ${opp.location || 'Various'}&nbsp;&nbsp;|&nbsp;&nbsp;⏱ ${opp.duration || 'TBA'}
  </div>
  ${deadlineDisplay ? `
  <div style="background:#0a1020;border-radius:6px;padding:12px;margin-bottom:16px;">
    ${isUpdate && oldDeadline ? `<p style="color:#f59e0b;font-size:13px;margin:0 0 6px 0;font-weight:600;">⚠️ Applications now open — new deadline: ${deadlineDisplay}</p>` : ''}
    <span style="color:${color};font-weight:700;font-size:15px;">📅 Apply by ${deadlineDisplay}</span>
    ${label ? `<span style="color:${color};font-size:13px;"> · ${label}</span>` : ''}
  </div>` : ''}
  <a href="${applyUrl}" style="display:inline-block;background:${accent};color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Apply Now →</a>
</div>`;
}

function buildEmailWrapper({ title, subtitle, recipientName, cards, unsubscribeEmail }) {
  const bg = '#060b18';
  const cardBg = '#0d1526';
  const border = '#1e2d4a';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EuroSpace Student Hub</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:28px 16px;">

  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:36px;margin-bottom:6px;">🛸</div>
    <h1 style="color:#f1f5f9;font-size:22px;margin:0;font-weight:800;letter-spacing:-0.5px;">EuroSpace Student Hub</h1>
    <p style="color:#64748b;font-size:13px;margin:4px 0 0 0;">Every opportunity for space students in Europe</p>
  </div>

  <div style="background:${cardBg};border:1px solid ${border};border-radius:10px;padding:18px 20px;margin-bottom:20px;">
    <h2 style="color:#f1f5f9;font-size:17px;margin:0 0 6px 0;">${title}</h2>
    <p style="color:#94a3b8;font-size:14px;margin:0;">Hi ${recipientName}, ${subtitle}</p>
  </div>

  ${cards}

  <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid ${border};">
    <p style="color:#475569;font-size:12px;margin:0 0 6px 0;">
      EuroSpace Student Hub · <a href="https://space.svenamberg.com" style="color:#475569;">space.svenamberg.com</a>
    </p>
    <p style="color:#475569;font-size:12px;margin:0;">
      <a href="https://space.svenamberg.com/unsubscribe?email=${encodeURIComponent(unsubscribeEmail)}" style="color:#475569;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

// ── Send alert when a new opportunity is published ──
export async function sendNewOpportunityAlert(opp, store) {
  if (!process.env.SMTP_USER) {
    logger.warn('SMTP not configured — skipping new opportunity alert');
    return;
  }

  // Only notify subscribers whose category filter matches (or those with no filter)
  const subscribers = store.subscribers.filter(
    (s) => !s.categories?.length || s.categories.includes(opp.category)
  );
  if (!subscribers.length) return;

  const transporter = createTransporter();
  const card = buildOppCard(opp);

  for (const subscriber of subscribers) {
    try {
      await transporter.sendMail({
        from: `"EuroSpace Student Hub" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: subscriber.email,
        subject: `🚀 New opportunity: ${opp.title}`,
        html: buildEmailWrapper({
          title: '🚀 New Opportunity Published',
          subtitle: `a new space opportunity has just been added to the hub.`,
          recipientName: subscriber.name,
          cards: card,
          unsubscribeEmail: subscriber.email,
        }),
      });
      logger.info(`Sent new opportunity alert to ${subscriber.email} for ${opp.id}`);
    } catch (e) {
      logger.error(`Email error for ${subscriber.email}`, { error: e.message });
    }
  }
}

// ── Send alert when a recurring opportunity opens a new year's sign-up ──
// Only fires when the deadline advances by 180+ days (new yearly cycle, not minor corrections)
export async function sendDeadlineUpdateAlert(opportunityId, oldDeadline, store) {
  if (!process.env.SMTP_USER) return;

  const opp = store.opportunities.find((o) => o.id === opportunityId);
  if (!opp || !opp.deadline) return;

  // Only notify for meaningful advances — new yearly cycle (180+ days forward)
  // Avoids spamming for minor date corrections
  const newDate = new Date(opp.deadline);
  const oldDate = oldDeadline ? new Date(oldDeadline) : null;
  const daysDiff = oldDate ? (newDate - oldDate) / 86400000 : 999;

  if (daysDiff < 180 && oldDate !== null) {
    logger.info(`Deadline change for ${opportunityId} is only ${Math.round(daysDiff)} days — skipping email`);
    return;
  }

  // New deadline must be in the future
  if (newDate < new Date()) return;

  const subscribers = store.subscribers.filter(
    (s) => !s.categories?.length || s.categories.includes(opp.category)
  );
  if (!subscribers.length) return;

  const transporter = createTransporter();
  const card = buildOppCard(opp, { isUpdate: true, oldDeadline });

  for (const subscriber of subscribers) {
    try {
      await transporter.sendMail({
        from: `"EuroSpace Student Hub" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: subscriber.email,
        subject: `📅 Applications now open: ${opp.title}`,
        html: buildEmailWrapper({
          title: '📅 Applications Now Open',
          subtitle: `sign-ups have opened for a recurring opportunity you follow.`,
          recipientName: subscriber.name,
          cards: card,
          unsubscribeEmail: subscriber.email,
        }),
      });
      logger.info(`Sent reopening alert to ${subscriber.email} for ${opportunityId}`);
    } catch (e) {
      logger.error(`Email alert error for ${subscriber.email}`, { error: e.message });
    }
  }
}

// ── Test email ──
export async function sendTestEmail(to) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"EuroSpace Student Hub" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: '✅ EuroSpace Student Hub — Test Email',
    html: `<div style="background:#060b18;color:#f1f5f9;font-family:Arial;padding:32px;border-radius:8px;">
      <h2 style="margin:0 0 12px 0;">🛸 Test Email</h2>
      <p>Your EuroSpace Student Hub email configuration is working correctly!</p>
      <p style="color:#64748b;font-size:13px;">Sent at ${new Date().toISOString()}</p>
    </div>`,
  });
}
