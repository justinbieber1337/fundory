# Fundory — Telegram Mini App Investment Platform

Monorepo with backend + Telegram Mini App frontend. Built for fast staking UX, referral growth, and Telegram‑native flows.

## What’s inside
- `backend/` — NestJS, Prisma, PostgreSQL, Redis (BullMQ), TRON (tronweb)
- `telegram-app/` — Nuxt 3 Telegram Mini App (SPA)

## Key features
- Tiered staking with activation, timers, and profit tracking
- Profit‑only withdrawals with minimum thresholds
- Multi‑level referrals with turnover tracking
- Daily accruals with deduplication + notifications
- Telegram WebApp integration (haptics, toasts, modals)

## Screenshots
Add screenshots to `docs/screenshots/` and update the links below.
- `Home` — `docs/screenshots/home.png`
- `Tariffs` — `docs/screenshots/tariffs.png`
- `Staking` — `docs/screenshots/staking.png`
- `Referrals` — `docs/screenshots/referrals.png`

## Architecture
```text
Telegram WebApp (Nuxt 3 SPA)
  -> Backend API (NestJS)
    -> PostgreSQL (Prisma)
    -> Redis / BullMQ
    -> TRON (tronweb)
    -> Telegram Bot notifications
```

## Quick start (local)
1. Create env files:
   - `backend/.env.example` → `backend/.env`
   - `telegram-app/.env.example` → `telegram-app/.env`
2. Install deps:
   - `cd backend && npm install`
   - `cd telegram-app && npm install`
3. Start services (Postgres + Redis).
4. Run backend:
   - `cd backend`
   - `npx prisma migrate deploy`
   - `npm run start:dev`
5. Run frontend:
   - `cd telegram-app`
   - `npm run dev`

## Production build
- Backend: `cd backend && npm run build && npm run start:prod`
- Frontend: `cd telegram-app && npm run build`

## Telegram Mini App
- Use the public URL (domain or tunnel) in BotFather → Web App settings
- Ensure headers allow Telegram origins:
  - `X-Frame-Options: ALLOWALL`
  - `Content-Security-Policy: frame-ancestors https://t.me https://*.t.me https://web.telegram.org https://webk.telegram.org`

## Env checklist
Set these before deploying:
- `DATABASE_URL`, `REDIS_URL`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `ADMIN_TELEGRAM_ID`
- TRON keys and RPCs

## Security
- Never commit real secrets to GitHub
- Rotate tokens before production
- Use separate prod and dev databases
- Telegram TMA auth: validate `initData` signature server‑side to prevent forgery

## Roadmap
- Admin dashboard for payouts and audits
- Enhanced activity feed + analytics
- More tiers and flexible boost rules

## Problems solved
- Telegram WebView embedding: fixed `X-Frame-Options`, CSP and WebApp loading issues
- Devtools crashes in WebView: disabled Vue/Nuxt/Router devtools and SSR to avoid `__vrv_devtools` errors
- CORS: dynamic origin whitelist for Telegram + local dev, reduced blocked API calls
- Accrual duplicates: unique index per deposit/day + dedupe checks + safe concurrency handling
- Referral bonus mismatch: unified percent tiers and turnover updates across scanner and deposits
- Profit‑only withdrawals: separate locked principal vs. withdrawable profit
- Staking timing: payouts count from activation time, not deposit time
- UI/UX glitches: consistent progress bars, timers, empty states, and modals
- Performance: cached API responses and reduced animation/timer overhead
- Environment stability: handled `EADDRINUSE` and process restarts

## More docs
- `backend/README.md`
- `telegram-app/README.md`
