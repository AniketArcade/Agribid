# AgriBid

Farmers list crops, buyers bid on them, farmers accept the best bid.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run `supabase/migrations/0001_schema.sql` then `supabase/migrations/0002_rls_and_functions.sql`.
3. In Authentication → Providers → Email, turn **off** "Confirm email" (accounts use synthetic emails no one can receive mail at — see `src/lib/store.js`).
4. Copy `.env.example` to `.env.local` and fill in the Project URL / anon key from Settings → API.
5. Optionally seed demo data: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs` (see the file header for the demo logins it creates).

```bash
npm install
npm run dev
```

## Deploying on Vercel

Vercel auto-detects the Vite build (`vite build` → `dist`), no `vercel.json` needed beyond the included SPA-fallback rewrite. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project's Environment Variables (Production, Preview, Development) before deploying — Vite bakes them into the build, so changing them requires a redeploy.

The anon key is meant to be public; **Row Level Security policies (in the migrations above) are the real security boundary**, not the key's secrecy. Never put the `service_role` key in a `VITE_`-prefixed variable or client code — it's for `scripts/seed.mjs` only, run locally.

## What's in the prototype

| Role | Flow |
| --- | --- |
| **Farmer** | Sign up (mobile + password) → step 1: name, village/town, state, district, phone → step 2: land location, area, size in acres (multiple plots) → dashboard with **Sell a crop** form and **My listings** (see bids, accept one, withdraw). |
| **Buyer** | Sign up with trader/firm name, address, state, district, licence/GSTIN, crops of interest → **Marketplace** of open lots (search, filter by crop/state, sort) → place/raise bids → **My bids** (leading / outbid / won / lost; farmer's phone shown once won). |
| **Authority** | Login page only; dashboard is a placeholder. |

Every role has a **Profile** page (view/edit, log out).

## Demo accounts

Created by `scripts/seed.mjs` — one farmer, one buyer and one authority login, plus a few extra farmers/buyers with sample listings and bids. See the script header for credentials.

## How data works

Backend is [Supabase](https://supabase.com) (Postgres + Auth + Realtime). [`src/lib/store.js`](src/lib/store.js) is the facade every page calls into (`signup`, `login`, `createListing`, `placeBid`, `acceptBid`, …) — pages don't talk to Supabase directly.

- Schema, Row Level Security policies, and RPC functions live in `supabase/migrations/`. RLS is the actual security boundary (see Deploying, above).
- Auth is phone-first in the UI, but backed by Supabase Auth email+password under the hood using a synthetic email derived from role+phone (`AUTH001`/mobile numbers aren't real email addresses, and the same phone can hold both a farmer and a buyer account).
- Bid/listing state changes (`placeBid`, `acceptBid`, `approveListing`, `confirmPurchase`, `cancelListing`, `setCropPrice`) go through Postgres RPC functions rather than raw table writes, so the server (not the client) enforces things like "bid must beat the current highest" and "only the authority can grade a listing".
- `BuyerHome`, `FarmerHome` and `AuthorityHome` get live updates via Supabase Realtime subscriptions on `listings`/`bids` — no manual refresh needed to see a new bid or approval.

## Layout

```
src/
  App.jsx                 routes
  lib/store.js            Supabase-backed facade + useApp() hook
  lib/supabaseClient.js   Supabase client (reads VITE_SUPABASE_* env vars)
  lib/realtime.js         live subscription helper used by store.js
  lib/constants.js        states, crops, units, grades, bid increment
  components/             layout, route guard, form field, land editor, badges
  pages/                  Landing, AuthPage, FarmerOnboarding, FarmerHome, BuyerHome, Profile, AuthorityHome
supabase/migrations/      schema, RLS policies, RPC functions (run in order)
scripts/seed.mjs          one-time dev/staging demo-data seed (needs service role key)
```
