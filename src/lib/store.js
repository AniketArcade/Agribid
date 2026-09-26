// Backend: Supabase (Postgres + Auth + Realtime). This file is the single facade
// every page imports from — only its internals talk to Supabase; call sites and
// the shape of `db`/`me` are unchanged from the old localStorage mock so pages
// didn't need to be rewritten. See supabase/migrations/ for schema + RLS + RPCs.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabaseClient';
import { subscribeRealtime } from './realtime';
import { MIN_BID_INCREMENT } from './constants';

// ---------- auth email (phone-first UI, email+password under the hood) ----------
// Supabase Auth needs a unique email per account. The app's UI stays phone-first
// (and Authority logs in with a non-phone "Official ID"), and the same phone
// number can hold both a farmer and a buyer account — so the email is derived
// deterministically from role+phone rather than being a real address.
//
// The domain is your own Supabase project's hostname, not a made-up one:
// Supabase's signup validation checks that the email's domain has real DNS
// records before accepting it (so a fictional domain like "agribid.app"
// gets rejected as "invalid" even though no mail is ever actually sent).
// Your project's own hostname always resolves, so this always passes.
const AUTH_EMAIL_DOMAIN = new URL(import.meta.env.VITE_SUPABASE_URL).hostname;

function authEmail(role, phone) {
  const clean = phone.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${role}-${clean}@${AUTH_EMAIL_DOMAIN}`;
}

// ---------- camelCase <-> snake_case mapping ----------

const toMs = (ts) => (ts ? new Date(ts).getTime() : null);

const PROFILE_COLUMNS = {
  name: 'name', place: 'place', state: 'state', district: 'district',
  traderName: 'trader_name', location: 'location', license: 'license',
  interests: 'interests', profileComplete: 'profile_complete', phone: 'phone',
};

function toProfileColumns(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    const col = PROFILE_COLUMNS[k];
    if (col) out[col] = v;
  }
  return out;
}

function mapBid(b) {
  return { id: b.id, buyerId: b.buyer_id, amount: Number(b.amount), at: toMs(b.created_at) };
}

function mapListing(l, bids) {
  return {
    id: l.id, farmerId: l.farmer_id, crop: l.crop, variety: l.variety,
    quantity: Number(l.quantity), unit: l.unit, basePrice: Number(l.base_price), grade: l.grade,
    availableFrom: toMs(l.available_from), durationDays: l.duration_days, endsAt: toMs(l.ends_at),
    description: l.description, status: l.status, createdAt: toMs(l.created_at),
    approvedAt: toMs(l.approved_at), acceptedBidId: l.accepted_bid_id, soldAt: toMs(l.sold_at),
    purchaseConfirmedAt: toMs(l.purchase_confirmed_at), bids,
  };
}

function mapProfile(p, { lands, payment } = {}) {
  const user = {
    id: p.id, role: p.role, phone: p.phone, name: p.name,
    profileComplete: p.profile_complete, createdAt: toMs(p.created_at),
    place: p.place, state: p.state, district: p.district,
    traderName: p.trader_name, location: p.location, license: p.license,
    interests: p.interests || [],
  };
  if (lands) {
    user.lands = lands.map((l) => ({ id: l.id, location: l.location, area: l.area, acres: Number(l.acres) }));
  }
  if (payment) {
    user.accountHolder = payment.account_holder;
    user.bankName = payment.bank_name;
    user.accountNumber = payment.account_number;
    user.ifsc = payment.ifsc;
    user.upiId = payment.upi_id;
  }
  return user;
}

// ---------- module-level store (external to React, like the old mock) ----------

let loggedOut = false;
let currentUserId = null;
let stopRealtime = null;

let snapshot = { session: undefined, me: null, db: { users: [], listings: [], prices: {} }, loading: true };
const listeners = new Set();
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
function publish(patch) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

/** Returns { db, me, loading } and re-renders on any change (auth or realtime). */
export function useApp() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

async function refreshData(session) {
  if (!session) {
    publish({ me: null, db: { users: [], listings: [], prices: {} }, loading: false });
    return;
  }
  const uid = session.user.id;
  const [{ data: profiles }, { data: prices }, { data: listings }, { data: bids }] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('crop_prices').select('*'),
    supabase.from('listings').select('*'),
    supabase.from('bids').select('*'),
  ]);

  const myRole = profiles?.find((p) => p.id === uid)?.role;
  const [{ data: lands }, { data: payment }] = await Promise.all([
    myRole === 'farmer'
      ? supabase.from('lands').select('*').eq('farmer_id', uid)
      : Promise.resolve({ data: [] }),
    supabase.from('payment_details').select('*').eq('profile_id', uid).maybeSingle(),
  ]);

  const bidsByListing = new Map();
  (bids || []).forEach((b) => {
    const arr = bidsByListing.get(b.listing_id) || [];
    arr.push(mapBid(b));
    bidsByListing.set(b.listing_id, arr);
  });

  const users = (profiles || []).map((p) =>
    mapProfile(p, p.id === uid ? { lands, payment } : {}));
  const listingsMapped = (listings || []).map((l) => mapListing(l, bidsByListing.get(l.id) || []));
  const priceMap = {};
  (prices || []).forEach((row) => { priceMap[row.crop] = Number(row.price_per_quintal); });

  const me = users.find((u) => u.id === uid) || null;
  publish({ me, db: { users, listings: listingsMapped, prices: priceMap }, loading: false });
}

supabase.auth.onAuthStateChange((_event, session) => {
  const uid = session?.user?.id || null;
  publish({ session, loading: true });
  if (uid !== currentUserId) {
    currentUserId = uid;
    if (stopRealtime) { stopRealtime(); stopRealtime = null; }
    if (uid) stopRealtime = subscribeRealtime(() => refreshData(session));
  }
  refreshData(session);
});

// ---------- derived helpers (pure — unchanged from the old mock) ----------

export const userById = (id) => snapshot.db.users.find((u) => u.id === id);

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

export async function signup({ role, phone, password, ...profile }) {
  phone = phone.trim();
  const email = authEmail(role, phone);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (/registered/i.test(error.message)) {
      throw new Error(`A ${role} account with this phone number already exists. Please log in.`);
    }
    throw new Error(error.message);
  }
  if (!data.user) throw new Error('Sign up failed — please try again.');

  // Must have a session *before* inserting the profile row — the insert's RLS
  // policy checks `id = auth.uid()`, which is only set once we're actually
  // authenticated. signUp() doesn't always hand back a session synchronously,
  // so sign in explicitly first when it doesn't.
  let { session } = data;
  if (!session) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(signInError.message);
    session = signInData.session;
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id, role, phone, profile_complete: role === 'buyer',
    ...toProfileColumns(profile),
  });
  if (profileError) throw new Error(profileError.message);
  // The SIGNED_IN auth event above may have already fired refreshData() before
  // the profile insert just above landed — refresh once more so `me` reflects
  // the newly created profile immediately rather than on the next change event.
  await refreshData(session);
}

export async function login({ role, phone, password }) {
  const email = authEmail(role, phone.trim());
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const label = role === 'authority' ? 'Official ID' : 'phone number';
    throw new Error(`Incorrect ${label} or password.`);
  }
  loggedOut = false;
}

export async function logout() {
  loggedOut = true;
  await supabase.auth.signOut();
}

export const justLoggedOut = () => loggedOut;

export async function updateUser(id, patch) {
  const { lands, accountHolder, bankName, accountNumber, ifsc, upiId, ...rest } = patch;

  const profilePatch = toProfileColumns(rest);
  if (Object.keys(profilePatch).length) {
    const { error } = await supabase.from('profiles').update(profilePatch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  if (Array.isArray(lands) && snapshot.me?.role === 'farmer') {
    const { error } = await supabase.rpc('save_farmer_lands', { p_lands: lands });
    if (error) throw new Error(error.message);
  }

  const paymentPatch = {};
  if ('accountHolder' in patch) paymentPatch.account_holder = accountHolder;
  if ('bankName' in patch) paymentPatch.bank_name = bankName;
  if ('accountNumber' in patch) paymentPatch.account_number = accountNumber;
  if ('ifsc' in patch) paymentPatch.ifsc = ifsc;
  if ('upiId' in patch) paymentPatch.upi_id = upiId;
  if (Object.keys(paymentPatch).length) {
    const { error } = await supabase.from('payment_details')
      .upsert({ profile_id: id, ...paymentPatch, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  await refreshData(snapshot.session);
}

// ---------- crop pricing ----------

/** Authority-set base price (₹ per quintal) for a crop. */
export async function setCropPrice(crop, pricePerQuintal) {
  const { error } = await supabase.rpc('set_crop_price', { p_crop: crop, p_price: Number(pricePerQuintal) });
  if (error) throw new Error(error.message);
  await refreshData(snapshot.session);
}

// ---------- listings & bids ----------

export async function createListing(farmerId, data) {
  const payload = {
    farmer_id: farmerId, crop: data.crop, variety: data.variety, quantity: data.quantity,
    unit: data.unit, base_price: data.basePrice, status: 'pending',
    available_from: new Date(data.availableFrom).toISOString(),
    duration_days: data.durationDays, description: data.description,
  };
  const { data: row, error } = await supabase.from('listings').insert(payload).select().single();
  if (error) throw new Error(error.message);
  await refreshData(snapshot.session);
  return mapListing(row, []);
}

/** Authority approves a pending listing, assigns its grade, and starts the bidding clock. */
export async function approveListing(listingId, grade) {
  const { error } = await supabase.rpc('approve_listing', { p_listing_id: listingId, p_grade: grade });
  if (error) throw new Error(error.message);
  await refreshData(snapshot.session);
}

export async function placeBid(listingId, _buyerId, amount) {
  const { error } = await supabase.rpc('place_bid', { p_listing_id: listingId, p_amount: Number(amount) });
  if (error) throw new Error(error.message);
  await refreshData(snapshot.session);
}

/** Called by the farmer (while open) or the authority (once bidding has ended). */
export async function acceptBid(listingId, bidId) {
  const { error } = await supabase.rpc('accept_bid', { p_listing_id: listingId, p_bid_id: bidId });
  if (error) throw new Error(error.message);
  await refreshData(snapshot.session);
}

/** Buyer confirms they've completed the purchase for a lot they won. */
export async function confirmPurchase(listingId) {
  const { error } = await supabase.rpc('confirm_purchase', { p_listing_id: listingId });
  if (error) throw new Error(error.message);
  await refreshData(snapshot.session);
}

export async function cancelListing(listingId) {
  const { error } = await supabase.rpc('cancel_listing', { p_listing_id: listingId });
  if (error) throw new Error(error.message);
  await refreshData(snapshot.session);
}
