# Kibuli Procurement — Deployment Guide

## Supabase project
- Project ID: `qnwudixaagutgrbwzyvb`
- Region: `ap-south-1` (Mumbai — closest to Uganda)
- URL: `https://qnwudixaagutgrbwzyvb.supabase.co`
- Schema + seed: already applied (13 votes, 63 sub-programmes, 163 budget items)

### Get your database password
1. Go to https://supabase.com/dashboard/project/qnwudixaagutgrbwzyvb/settings/database
2. Under **Connection string** → select **Transaction pooler**
3. Copy the full URI (port 6543). It looks like:
   `postgresql://postgres.qnwudixaagutgrbwzyvb:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
   (the host is `aws-1-…`; the older `aws-0-…` host answers "tenant/user not found")
4. If you need to reset the password: Settings → Database → Reset database password

---

## GitHub — push the repo

```bash
# Option A: install gh CLI then run:
gh repo create kibuli-procurement --public --source=. --remote=origin --push

# Option B: manual
# 1. Go to https://github.com/new
# 2. Create repo named "kibuli-procurement" (public or private)
# 3. Then run:
cd C:\Users\VICTUS\kibuli-procurement
git remote add origin https://github.com/dornatlord/kibuli-procurement.git
git push -u origin master
```

---

## Render — Backend Web Service

1. Go to https://render.com → New → Web Service
2. Connect GitHub repo → select `kibuli-procurement`
3. Settings:
   - **Root directory**: `backend`
   - **Runtime**: Node
   - **Build command**: `pnpm install && pnpm run build`
   - **Start command**: `pnpm run start`
   - **Node version**: 22.13+
4. Environment variables:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | (pooler URI from Supabase, port 6543) |
   | `SESSION_SECRET` | (any random 32+ char string) |
   | `FRONTEND_URL` | (your Render static site URL, e.g. `https://kibuli-procurement.onrender.com`) |
   | `NODE_ENV` | `production` |
5. Deploy → note the service URL (e.g. `https://kibuli-procurement-api.onrender.com`)

Logins are kept in the database (`user_sessions`, from `migrations/010_user_sessions.sql`),
so restarts and redeploys no longer sign everyone out. The table must exist
before this version of the backend starts.

---

## Render — Frontend Static Site

1. New → Static Site → same repo
2. Settings:
   - **Root directory**: `frontend`
   - **Build command**: `pnpm install && pnpm run build`
   - **Publish directory**: `dist`
3. Environment variables:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `/api` with the `/api/*` rewrite below, or `https://kibuli-procurement-api.onrender.com/api` without it |
4. Add the rewrite rules below, then deploy

---

## After both are deployed

- Go back to the backend service → update `FRONTEND_URL` to the static site URL → redeploy
- Sign in with the administrator account. If its password is still the one the
  seed script sets, change it straight away: this repository is public.
- UptimeRobot: monitor `https://kibuli-procurement-api.onrender.com/api/health`

### Required: rewrite rules

`frontend/public/_redirects` is a Netlify convention and **Render ignores it**.
Set the rules in the Render dashboard: Static site → **Redirects/Rewrites**.
Keep them in this order, both with Action **Rewrite** (not Redirect):

| # | Source | Destination |
|---|--------|-------------|
| 1 | `/api/*` | `https://kibuli-procurement-api.onrender.com/api/*` |
| 2 | `/*` | `/index.html` |

1. **The API on the app's own address.** The browser then treats the API as the
   same site as the app, so the login cookie is first-party. Safari (iPhone,
   iPad, Mac) blocks cross-site cookies, so without this rule signing in fails
   there. Pair it with `VITE_API_URL=/api` on the static site. The backend sends
   `Cache-Control: no-store`, so Render's CDN never keeps a copy of anyone's data.
2. **Single-page app.** Every page path returns `index.html`. Without it,
   opening or refreshing any URL other than `/` returns **Not Found** —
   `/login`, `/requests`, `/requests/1`, and so on.

Render serves a real file whenever one exists, so `/sw.js`, `/manifest.webmanifest`
and `/assets/…` are never rewritten.

Verify afterwards:

```bash
# 200 for each page
for p in /login /requests /dashboard; do curl -s -o /dev/null -w "$p %{http_code}\n" "https://kibuli-procurement.onrender.com$p"; done
# rule 1: {"status":"ok"} from the backend, through the static site
curl -s https://kibuli-procurement.onrender.com/api/health
# the offline app's files: JavaScript and a manifest, not index.html
curl -s -o /dev/null -w "sw.js %{http_code} %{content_type}\n" https://kibuli-procurement.onrender.com/sw.js
curl -s -o /dev/null -w "manifest %{http_code} %{content_type}\n" https://kibuli-procurement.onrender.com/manifest.webmanifest
```

Switching `VITE_API_URL` to `/api` moves the login cookie to the app's address,
so everyone signs in once more after that deploy.

---

## Installable app and offline use

The frontend is a Progressive Web App; there is nothing to configure beyond the steps above.

- **Install.** Chrome and Edge on a computer or Android phone show **Install the app**
  at the bottom of the sidebar (or the install icon in the address bar). On an
  iPhone or iPad: Safari → Share → **Add to Home Screen**.
- **Offline.** The build writes `sw.js` (from `frontend/sw/service-worker.js`)
  listing every file the app needs, and the browser saves them on the first visit.
  Without internet the app still opens, as the last person signed in on that
  device, and says it is offline. Loading and saving records need the connection.
- **Updates.** Each deploy changes the version inside `sw.js`. The installed app
  saves the new files in the background and uses them the next time it opens.

---

## Local development

```bash
# Backend
cd backend
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET
pnpm install --ignore-scripts
pnpm run dev

# Frontend (new terminal)
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3001/api
pnpm install --ignore-scripts
pnpm run dev
```

Visit http://localhost:5173
