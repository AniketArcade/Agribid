# AgriBid (prototype)

Farmers list crops, buyers bid on them, farmers accept the best bid.

```bash
npm install
npm run dev
```

## What's in the prototype

| Role | Flow |
| --- | --- |
| **Farmer** | Sign up (mobile + password) → step 1: name, village/town, state, district, phone → step 2: land location, area, size in acres (multiple plots) → dashboard with **Sell a crop** form and **My listings** (see bids, accept one, withdraw). |
| **Buyer** | Sign up with trader/firm name, address, state, district, licence/GSTIN, crops of interest → **Marketplace** of open lots (search, filter by crop/state, sort) → place/raise bids → **My bids** (leading / outbid / won / lost; farmer's phone shown once won). |
| **Authority** | Login page only; dashboard is a placeholder. |

Every role has a **Profile** page (view/edit, log out, reset demo data).

## Demo accounts

Seeded in [`src/lib/seed.js`](src/lib/seed.js) (`DEMO_ACCOUNTS`) — one farmer, one buyer and one authority login, plus a few extra farmers/buyers with sample listings and bids.

## How data works

There is no backend yet. [`src/lib/store.js`](src/lib/store.js) is a mock API over `localStorage`:

- Users, listings and bids are shared across tabs of the same browser.
- The logged-in user is per tab (`sessionStorage`), so you can be a farmer in one tab and a buyer in another and watch bids arrive live.
- Passwords are stored in plain text — **mock only**. Replace the functions in `store.js` (`signup`, `login`, `createListing`, `placeBid`, `acceptBid`, …) with real API calls when a backend exists; the pages only call those functions.

## Layout

```
src/
  App.jsx                 routes
  lib/store.js            mock backend + useApp() hook
  lib/seed.js             demo data
  lib/constants.js        states, crops, units, grades, bid increment
  components/             layout, route guard, form field, land editor, badges
  pages/                  Landing, AuthPage, FarmerOnboarding, FarmerHome, BuyerHome, Profile, AuthorityHome
```
