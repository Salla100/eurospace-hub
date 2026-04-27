# 🛸 EuroSpace Student Hub

> Every opportunity for space students in Europe — internships, ESA workshops, competitions, hackathons, summer schools, scholarships, and more. With live deadline tracking.

## Quick Start (one command)

```bash
cp .env.example .env   # edit ADMIN_SECRET at minimum
npm run docker:up      # builds + starts backend + frontend
```

Frontend: http://localhost  
API: http://localhost:3001  
Admin: http://localhost/admin  

For local dev (requires Node 20+):

```bash
cp .env.example .env
npm install && cd frontend && npm install && cd ..
npm run dev            # starts both server (3001) + Vite (5173)
```

---

## Scraper Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CRON SCHEDULE                           │
│  Weekly Mon 06:00 UTC ──► Full ESA pages + competitions     │
│  Daily    08:00 UTC ──► ESA Academy + upcoming (<60d)       │
│  Monthly  1st 07:00 UTC ──► Member sync + stale check       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   server/cron.js    │
                    │  (node-cron jobs)   │
                    └──────────┬──────────┘
                               │  calls
                    ┌──────────▼──────────┐
                    │  server/scraper.js  │
                    │  (Puppeteer)        │
                    │                     │
                    │  Source A: ESA Acad │──► deadline_notes
                    │  Source B: Short    │──► new courses
                    │  Source C: Academic │──► on-hold status
                    │  Source D: Conf.    │──► conference dates
                    │  Source E: EuRoC    │──► deadline
                    │  Source F: ERC      │──► deadline
                    │  Source G: REXUS    │──► deadline
                    │  Source H: Alpbach  │──► deadline
                    │  Source I: ActInSpc │──► deadline
                    │  Source J: NORSTEC  │──► deadline
                    │  Source K: CASSINI  │──► deadline
                    │  Source L: BVSR     │──► member sync
                    │  Source M: NORSTEC  │──► member sync
                    └──────────┬──────────┘
                               │  writes
              ┌────────────────┼───────────────────┐
              ▼                ▼                   ▼
    data/opportunities  data/changes.log    WEBHOOK_URL
         .json           (NDJSON)           (if set)
```

### Rate limiting
All scrapers enforce a **5-second minimum delay** between requests to the same domain. Logged as:
```
2025-11-01T08:00:00Z [INFO] Rate limit applied, waiting 3.2s for esa.int
```

---

## Live-Scraped URLs

| Source | URL | Data extracted |
|--------|-----|----------------|
| ESA Academy main | `https://www.esa.int/Education/ESA_Academy/ESA_Academy_opportunities3` | Projects table cycle text, deadline dates |
| ESA Current Opportunities | `https://www.esa.int/Education/ESA_Academy/Training_Current_Opportunities` | Open training session deadlines |
| ESA Short Course Scholarship | `https://www.esa.int/Education/Engagement/Short_Course_Scholarship_programme` | Sponsored course list |
| ESA Academic Scholarship | `https://www.esa.int/Education/Engagement/Academic_Scholarship_programme` | On-hold status, programme list |
| EuRoC | `https://euroc.pt/competition-rules/` | Application deadline, event date |
| ERC | `https://roverchallenge.eu/competitor-zone/` | Registration period, finals date |
| REXUS/BEXUS | `https://rexusbexus.net` | Call opening, proposal deadline |
| Alpbach | `https://www.summerschoolalpbach.at` | Application deadline, event date |
| ActInSpace | `https://actinspace.org` | Event date, registration |
| NORSTEC Summit | `https://norstec.no/summit` | Event date |
| CASSINI Hackathon | `https://www.cassini.eu/hackathons` | Event dates |
| BVSR Members | `https://bvsr.space/` | Member club cards (monthly) |
| NORSTEC Members | `https://norstec.no/` | Member org table (monthly) |

---

## Webhook Payload Examples

### Discord Webhook (deadline_changed)
```json
{
  "embeds": [{
    "title": "📅 Deadline Updated",
    "description": "**Alpbach Summer School** deadline changed",
    "fields": [
      { "name": "Old deadline", "value": "2026-03-15", "inline": true },
      { "name": "New deadline", "value": "2026-03-22", "inline": true }
    ],
    "color": 5145560
  }]
}
```
*(The hub sends raw JSON — wrap in `"embeds"` at your Discord webhook middleware if needed)*

### Slack Webhook (cron_summary)
```json
{
  "text": "🛸 EuroSpace Weekly Scrape",
  "blocks": [{
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Weekly scrape complete*\n✅ 3 deadlines updated\n🆕 0 new opportunities\n⚠️ 2 errors"
    }
  }]
}
```

### Raw payload (all events)
```json
{
  "event": "deadline_changed | new_discovered | programme_status_changed | cron_summary",
  "timestamp": "2026-01-06T08:00:00.000Z",
  "data": {
    "id": "alpbach-summer-school",
    "title": "Alpbach Summer School",
    "old_deadline": "2026-03-15",
    "new_deadline": "2026-03-22"
  }
}
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/opportunities` | List opportunities. Params: `category`, `funded`, `team_based`, `open_to_all`, `search`, `sort` |
| GET | `/api/opportunities/:id` | Single opportunity |
| PATCH | `/api/opportunities/:id` | Update opportunity (requires `x-admin-secret`) |
| GET | `/api/deadlines?days=30` | Upcoming deadlines |
| GET | `/api/stats` | Aggregate stats |
| GET | `/api/members/bvsr` | BVSR member clubs |
| GET | `/api/members/norstec` | NORSTEC members |
| GET | `/api/changes` | Change log |
| POST | `/api/scrape/:id` | Trigger scrape (admin) |
| POST | `/api/scrape/batch` | Batch scrape (admin) |
| POST | `/api/subscribe` | Subscribe to alerts |
| GET | `/health` | Health check |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `ADMIN_SECRET` | Admin password | **required** |
| `WEBHOOK_URL` | Discord/Slack webhook | optional |
| `SMTP_HOST` | SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | optional |
| `SMTP_PASS` | SMTP password / app password | optional |
| `FROM_EMAIL` | From address | `SMTP_USER` |
| `VITE_API_URL` | API base URL for frontend | `http://localhost:3001` |

---

## Data

All data lives in `/data/`. The volume mount in docker-compose persists it across container restarts.

- `opportunities.json` — 64 opportunities with full schema
- `members_bvsr.json` — 19 BVSR member clubs
- `members_norstec.json` — 10 NORSTEC member orgs
- `changes.log` — NDJSON append-only change log
- `subscribers.json` — Email subscriber list
- `notifications_sent.json` — Deduplication log
- `config.json` — Runtime config (webhook URL, last sync times)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS 3 |
| Backend | Node.js 20 + Express |
| Scraper | Puppeteer (headless Chromium) |
| Scheduler | node-cron |
| Email | Nodemailer |
| Logging | Winston |
| Container | Docker + nginx |

---

*Built for the European student space community. Suggest missing opportunities: [suggest@eurospacehub.eu](mailto:suggest@eurospacehub.eu)*
