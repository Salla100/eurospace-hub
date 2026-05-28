# EuroSpace Hub — Home Server Setup Guide

Frontend is on GitHub Pages. This guide sets up the backend API + scraper on your own machine.

**End result:** `https://api.svenamberg.com` → your server → Node.js API + Puppeteer scraper

---

## What you need before starting
- A machine running **Ubuntu Server 24.04 LTS** (fresh install)
- SSH access to it from your main computer
- Your domain (`svenamberg.com`) managed on Cloudflare (already the case)
- A Cloudflare account (same one managing the domain)

---

## Step 1 — First boot: update & set up SSH

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw
```

Lock down the firewall (only SSH + local API access):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 3001/tcp   # optional: local network access for testing
sudo ufw enable
```

---

## Step 2 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Verify:
```bash
docker --version
docker compose version
```

---

## Step 3 — Clone the repo

```bash
git clone https://github.com/Salla100/eurospace-hub.git
cd eurospace-hub
```

---

## Step 4 — Create your .env file

```bash
cp .env.example .env
nano .env
```

Fill in:

| Variable | What to put |
|---|---|
| `ADMIN_SECRET` | Run `openssl rand -hex 32` and paste the result |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Gmail App Password (see note below) |
| `SMTP_FROM` | e.g. `EuroSpace Hub <your@gmail.com>` |
| `WEBHOOK_URL` | Discord webhook URL (optional) |
| `CLOUDFLARE_TUNNEL_TOKEN` | From Step 5 below |

**Gmail App Password:** Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create one called "EuroSpace", paste the 16-char password into `SMTP_PASS`.

---

## Step 5 — Create Cloudflare Tunnel

This gives your server a public HTTPS URL without port forwarding.

1. Go to [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks → Tunnels**
2. Click **Create a tunnel** → choose **Cloudflared** → name it `eurospace-api`
3. Copy the **tunnel token** — paste it into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`
4. Click **Next** → add a public hostname:
   - **Subdomain:** `api`
   - **Domain:** `svenamberg.com`
   - **Service:** `http://api:3001`
5. Save the tunnel

> `api` here is the Docker service name — cloudflared reaches it over the internal Docker network.

---

## Step 6 — Start the containers

```bash
docker compose up -d --build
```

This will:
- Build the Node.js API image with Chromium (~3 min first time)
- Start the API container
- Start the cloudflared tunnel container

Check everything is running:
```bash
docker compose ps
docker compose logs -f api
```

You should see: `Data loaded: 64 opportunities, 19 BVSR, 10 NORSTEC`

Test the API locally:
```bash
curl http://localhost:3001/health
```

Test via the tunnel (give it 30 seconds to connect):
```bash
curl https://api.svenamberg.com/health
```

Both should return `{"status":"ok"}`.

---

## Step 7 — Wire the frontend to the live API

1. Go to [github.com/Salla100/eurospace-hub/settings/secrets/actions](https://github.com/Salla100/eurospace-hub/settings/secrets/actions)
2. Click **New repository secret**
3. Name: `VITE_API_URL` — Value: `https://api.svenamberg.com`
4. Go to the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**

After the deploy (~30s), `space.svenamberg.com` will hit your live API instead of the static JSON fallback.

---

## Step 8 — Verify everything end to end

1. Open `https://space.svenamberg.com`
2. Open browser DevTools → Network tab
3. Reload — you should see requests going to `api.svenamberg.com/api/opportunities`
4. Try subscribing with your email → you should receive a confirmation

---

## Maintenance

**Update the app after a git push:**
```bash
git pull
docker compose up -d --build
```

**View live logs:**
```bash
docker compose logs -f api
```

**Restart the API:**
```bash
docker compose restart api
```

**Trigger a manual scrape** (from your main computer):
```bash
curl -X POST https://api.svenamberg.com/api/scrape/batch \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"filter":"esa"}'
```

**Auto-start on reboot:**
Docker is already configured with `restart: unless-stopped` — containers come back automatically after a reboot.

---

## Automatic scraping schedule

Already configured in `server/cron.js`:

| Schedule | What runs |
|---|---|
| Every Monday 06:00 UTC | Full scrape: ESA Academy + all competitions |
| Every day 08:00 UTC | ESA Academy + opportunities with upcoming deadlines |
| 1st of every month 07:00 UTC | BVSR + NORSTEC member sync, stale opportunity check |
