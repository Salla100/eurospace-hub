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

function buildEmailHtml({ subscriber, opportunities, isUpdate = false, oldDeadline = null }) {
  const bg = '#060b18';
  const cardBg = '#0d1526';
  const border = '#1e2d4a';
  const accent = '#4f8ef7';

  const oppCards = opportunities
    .map((opp) => {
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
    ${isUpdate && oldDeadline ? `<p style="color:#f59e0b;font-size:13px;margin:0 0 6px 0;font-weight:600;">⚠️ Deadline changed: ${oldDeadline} → ${opp.deadline}</p>` : ''}
    <span style="color:${color};font-weight:700;font-size:15px;">📅 Apply by ${deadlineDisplay}</span>
    ${label ? `<span style="color:${color};font-size:13px;"> · ${label}</span>` : ''}
  </div>` : ''}
  <a href="${applyUrl}" style="display:inline-block;background:${accent};color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">Apply Now →</a>
</div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EuroSpace Student Hub</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:28px 16px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:36px;margin-bottom:6px;">🛸</div>
    <h1 style="color:#f1f5f9;font-size:22px;margin:0;font-weight:800;letter-spacing:-0.5px;">EuroSpace Student Hub</h1>
    <p style="color:#64748b;font-size:13px;margin:4px 0 0 0;">Every opportunity for space students in Europe</p>
  </div>

  <!-- Intro -->
  <div style="background:${cardBg};border:1px solid ${border};border-radius:10px;padding:18px 20px;margin-bottom:20px;">
    <h2 style="color:#f1f5f9;font-size:17px;margin:0 0 6px 0;">
      ${isUpdate ? '⚠️ Deadline Update Alert' : `📅 ${opportunities.length} Upcoming Deadline${opportunities.length > 1 ? 's' : ''}`}
    </h2>
    <p style="color:#94a3b8;font-size:14px;margin:0;">
      Hi ${subscriber.name}, here ${opportunities.length > 1 ? 'are' : 'is'} your personalised space opportunity alert${opportunities.length > 1 ? 's' : ''}.
    </p>
  </div>

  ${oppCards}

  <!-- Footer -->
  <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid ${border};">
    <p style="color:#475569;font-size:12px;margin:0 0 6px 0;">
      EuroSpace Student Hub · <a href="https://eurospacehub.eu" style="color:#475569;">eurospacehub.eu</a>
    </p>
    <p style="color:#475569;font-size:12px;margin:0;">
      <a href="https://eurospacehub.eu/unsubscribe?email=${encodeURIComponent(subscriber.email)}" style="color:#475569;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

export async function sendDeadlineReminders(store, deps) {
  if (!process.env.SMTP_USER) {
    logger.warn('SMTP not configured — skipping email notifications');
    return;
  }
  const transporter = createTransporter();
  const thisYear = new Date().getFullYear();

  for (const subscriber of store.subscribers) {
    const { email, name, categories = [], notify_days_before = 14 } = subscriber;
    const cutoff = new Date(Date.now() + notify_days_before * 86400000);

    const opps = store.opportunities.filter((opp) => {
      if (!opp.deadline) return false;
      const dl = new Date(opp.deadline);
      if (dl < new Date() || dl > cutoff) return false;
      if (categories.length > 0 && !categories.includes(opp.category)) return false;
      // Check not already sent this year
      const alreadySent = store.notifications_sent.find(
        (n) =>
          n.subscriber_email === email &&
          n.opportunity_id === opp.id &&
          new Date(n.sent_at).getFullYear() === thisYear
      );
      return !alreadySent;
    });

    if (!opps.length) continue;

    try {
      await transporter.sendMail({
        from: `"EuroSpace Student Hub" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: `📅 ${opps.length} space opportunit${opps.length > 1 ? 'ies have' : 'y has'} an upcoming deadline`,
        html: buildEmailHtml({ subscriber: { name, email }, opportunities: opps }),
      });
      for (const opp of opps) {
        store.notifications_sent.push({
          subscriber_email: email,
          opportunity_id: opp.id,
          sent_at: new Date().toISOString(),
        });
      }
      if (deps?.saveNotificationsSent) await deps.saveNotificationsSent();
      logger.info(`Sent deadline reminder to ${email} for ${opps.length} opportunities`);
    } catch (e) {
      logger.error(`Email error for ${email}`, { error: e.message });
    }
  }
}

export async function sendDeadlineUpdateAlert(opportunityId, oldDeadline, store, deps) {
  if (!process.env.SMTP_USER) return;
  const opp = store.opportunities.find((o) => o.id === opportunityId);
  if (!opp) return;
  const transporter = createTransporter();

  const subscribers = store.subscribers.filter(
    (s) => !s.categories?.length || s.categories.includes(opp.category)
  );
  for (const subscriber of subscribers) {
    try {
      await transporter.sendMail({
        from: `"EuroSpace Student Hub" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: subscriber.email,
        subject: `⚠️ Deadline Updated: ${opp.title}`,
        html: buildEmailHtml({
          subscriber,
          opportunities: [opp],
          isUpdate: true,
          oldDeadline,
        }),
      });
      logger.info(`Sent deadline update alert to ${subscriber.email} for ${opp.id}`);
    } catch (e) {
      logger.error(`Email alert error for ${subscriber.email}`, { error: e.message });
    }
  }
}

export async function sendTestEmail(to) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"EuroSpace Student Hub" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject: '✅ EuroSpace Student Hub — Test Email',
    html: `<div style="background:#060b18;color:#f1f5f9;font-family:Arial;padding:32px;border-radius:8px;">
      <h2 style="margin:0 0 12px 0;">🛸 Test Email</h2>
      <p>Your EuroSpace Student Hub email configuration is working correctly!</p>
      <p style="color:#64748b;font-size:13px;">Sent at ${new Date().toISOString()}</p>
    </div>`,
  });
}
