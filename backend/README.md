# Backend (NestJS)

Core API, staking logic, referrals, and payouts.

## Requirements
- Node.js LTS
- PostgreSQL
- Redis

## Setup
1. Copy env:
   - `cp .env.example .env`
2. Install deps:
   - `npm install`
3. Init DB:
   - `npx prisma generate`
   - `npx prisma migrate dev`
4. Start:
   - `npm run start:dev`

## Scripts
- `npm run start:dev` — dev server (watch)
- `npm run build` — production build
- `npm run start:prod` — production server
- `npx prisma studio` — DB UI

## Key modules
- `deposits/` — stake activation, emergency unstake
- `accruals/` — daily profit accruals + dedupe
- `referrals/` — multi‑level bonus logic
- `withdrawals/` — profit‑only withdrawals
- `tron/` — on‑chain scanning & deposits
- `notifications/` — Telegram bot messages

## Cron jobs
- Daily accruals for active deposits
- Maturity processing (auto‑reinvest or return principal)
- Turnover recalculation

## Env checklist
- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET`, `ADMIN_TOKEN`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `ADMIN_TELEGRAM_ID`
- `TRON_*` variables for RPC and keys

## Notes
- TRON integration is wired via `TronService` and `TronScanner`.
- Daily accruals are scheduled via BullMQ jobs.
- Admin endpoints are minimal and intended for internal use.
