# Telegram Mini App (Nuxt 3)

Telegram WebApp frontend for staking, referrals, and wallet actions.

## Setup
1. Copy env:
   - `cp .env.example .env`
2. Install deps:
   - `npm install`
3. Run:
   - `npm run dev`

## Scripts
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview build

## Env checklist
- `NUXT_PUBLIC_API_URL`
- `NUXT_PUBLIC_ADMIN_TELEGRAM_ID`

## Telegram WebApp
- Uses `initData` from Telegram WebApp for backend auth
- Haptics + toasts + modal confirmations

## Notes
- SPA mode (`ssr: false`) for WebView stability
- Devtools disabled for Telegram WebView
