// Mock backend: everything lives in localStorage so the prototype works with no server.
// The logged-in user is kept in sessionStorage, so you can be a farmer in one tab and a
// buyer in another; listings/bids sync between tabs via the `storage` event.
import { useSyncExternalStore } from 'react';
import { seed } from './seed';
import { MIN_BID_INCREMENT, MSP } from './constants';

const DB_KEY = 'agribid:db:v1';
const SESSION_KEY = 'agribid:session';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    // `prices` backfill covers data saved before crop pricing existed.
    if (raw) return { prices: { ...MSP }, ...JSON.parse(raw) };
  } catch { /* fall through to seed */ }
  const fresh = seed();
  saveDb(fresh);
  return fresh;
}

function saveDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* storage unavailable */ }
}

function loadSession() {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}

let db = loadDb();
let sessionId = loadSession();
// True after an explicit logout in this tab, so guards send the user home, not to a login page.
let loggedOut = false;
let snapshot = { db, sessionId };
const listeners = new Set();

function publish() {
  snapshot = { db, sessionId };
  listeners.forEach((l) => l());
}

function commit(update) {
  db = update(db);
  saveDb(db);
  publish();
}

function setSession(id) {
  sessionId = id;
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
  publish();
}

window.addEventListener('storage', (e) => {
  if (e.key === DB_KEY) { db = loadDb(); publish(); }
});

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

/** Returns { db, me } and re-renders on any change. */
export function useApp() {
  const snap = useSyncExternalStore(subscribe, () => snapshot);
  const me = snap.db.users.find((u) => u.id === snap.sessionId) || null;
  return { db: snap.db, me };
}

// ---------- derived helpers ----------

export const userById = (id) => db.users.find((u) => u.id === id);

export function highestBid(listing) {
  return listing.bids.reduce((top, b) => (!top || b.amount > top.amount ? b : top), null);
}

/** 'open' | 'ended' (time over, not yet decided) | 'sold' | 'cancelled' */
export function listingStatus(listing, now = Date.now()) {
  if (listing.status !== 'open') return listing.status;
  return now > listing.endsAt ? 'ended' : 'open';
}

export function minNextBid(listing) {
  const top = highestBid(listing);
  return top ? top.amount + MIN_BID_INCREMENT : Number(listing.basePrice);
}

// ---------- auth ----------

export function signup({ role, phone, password, ...profile }) {
  phone = phone.trim();
  if (db.users.some((u) => u.role === role && u.phone === phone)) {
    throw new Error(`A ${role} account with this phone number already exists. Please log in.`);
  }
  const user = {
    id: uid(), role, phone, password, createdAt: Date.now(),
    profileComplete: role === 'buyer', // farmers finish onboarding after signup
    ...profile,
  };
  commit((d) => ({ ...d, users: [...d.users, user] }));
  loggedOut = false;
  setSession(user.id);
  return user;
}

export function login({ role, phone, password }) {
  const user = db.users.find((u) => u.role === role && u.phone === phone.trim());
  const label = role === 'authority' ? 'Official ID' : 'phone number';
  if (!user || user.password !== password) throw new Error(`Incorrect ${label} or password.`);
  loggedOut = false;
  setSession(user.id);
  return user;
}

export function logout() {
  loggedOut = true;
  setSession(null);
}

export const justLoggedOut = () => loggedOut;

export function updateUser(id, patch) {
  commit((d) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
}

// ---------- crop pricing ----------

/** Authority-set base price (₹ per quintal) for a crop. */
export function setCropPrice(crop, pricePerQuintal) {
  commit((d) => ({ ...d, prices: { ...d.prices, [crop]: Number(pricePerQuintal) } }));
}

// ---------- listings & bids ----------

function updateListing(id, fn) {
  commit((d) => ({ ...d, listings: d.listings.map((l) => (l.id === id ? fn(l) : l)) }));
}

export function createListing(farmerId, data) {
  const listing = {
    id: uid(), farmerId, status: 'pending', createdAt: Date.now(), bids: [], ...data,
  };
  commit((d) => ({ ...d, listings: [listing, ...d.listings] }));
  return listing;
}

/** Authority approves a pending listing, assigns its grade, and starts the bidding clock. */
export function approveListing(listingId, grade) {
  updateListing(listingId, (l) => ({
    ...l, status: 'open', grade, approvedAt: Date.now(),
    endsAt: Date.now() + Number(l.durationDays) * 24 * 3600 * 1000,
  }));
}

export function placeBid(listingId, buyerId, amount) {
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) throw new Error('Listing not found.');
  if (listingStatus(listing) !== 'open') throw new Error('Bidding has closed for this lot.');
  const min = minNextBid(listing);
  if (!(amount >= min)) throw new Error(`Your bid must be at least ${min} per ${listing.unit.toLowerCase()}.`);
  updateListing(listingId, (l) => ({
    ...l, bids: [...l.bids, { id: uid(), buyerId, amount, at: Date.now() }],
  }));
}

export function acceptBid(listingId, bidId) {
  updateListing(listingId, (l) => ({ ...l, status: 'sold', acceptedBidId: bidId, soldAt: Date.now() }));
}

/** Buyer confirms they've completed the purchase for a lot they won. */
export function confirmPurchase(listingId) {
  updateListing(listingId, (l) => ({ ...l, purchaseConfirmedAt: Date.now() }));
}

export function cancelListing(listingId) {
  updateListing(listingId, (l) => ({ ...l, status: 'cancelled' }));
}

export function resetDemo() {
  db = seed();
  saveDb(db);
  logout();
}
