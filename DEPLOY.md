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
   `postgresql://postgres.qnwudixaagutgrbwzyvb:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
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
   | `VITE_API_URL` | `https://kibuli-procurement-api.onrender.com/api` |
4. Deploy

---

## After both are deployed

- Go back to the backend service → update `FRONTEND_URL` to the static site URL → redeploy
- Test login: `admin@kibulisss.local` / `admin1234`
- UptimeRobot: monitor `https://kibuli-procurement-api.onrender.com/api/health`

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
