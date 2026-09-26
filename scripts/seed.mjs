// One-time dev/staging seed script — replaces the old runtime src/lib/seed.js.
// Creates the same demo accounts + sample listings/bids the prototype used to
// ship with, against a real Supabase project.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/seed.mjs
//
// Never commit the service role key or run this against a production project
// with real user data — it uses admin auth APIs that bypass RLS.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Must match src/lib/store.js's authEmail() — same project hostname, so
// Supabase's DNS-based email validation always accepts it.
const authDomain = new URL(url).hostname;
const authEmail = (role, phone) => `${role}-${phone.toLowerCase().replace(/[^a-z0-9]/g, '')}@${authDomain}`;

const DEMO_ACCOUNTS = {
  farmer: { phone: '9000000001', password: 'farmer123' },
  buyer: { phone: '9000000002', password: 'buyer123' },
  authority: { phone: 'AUTH001', password: 'authority123' },
};

const FARMERS = [
  { ...DEMO_ACCOUNTS.farmer, name: 'Ramesh Patel', place: 'Sanand', state: 'Gujarat', district: 'Ahmedabad',
    lands: [{ location: 'Survey No. 112, Sanand', area: 'Near canal road', acres: 6.5 }] },
  { phone: '9000000003', password: 'farmer123', name: 'Gurpreet Singh', place: 'Khanna', state: 'Punjab', district: 'Ludhiana',
    lands: [{ location: 'Village Khanna Kalan', area: 'Plot 4', acres: 12 }] },
  { phone: '9000000004', password: 'farmer123', name: 'Sunita Pawar', place: 'Lasalgaon', state: 'Maharashtra', district: 'Nashik',
    lands: [{ location: 'Gat No. 58, Lasalgaon', area: 'East field', acres: 4 }] },
];

const BUYERS = [
  { ...DEMO_ACCOUNTS.buyer, name: 'Anil Mehta', traderName: 'Mehta Agro Traders', location: 'APMC Market Yard',
    state: 'Gujarat', district: 'Rajkot', license: 'GJ-APMC-44821', interests: ['Wheat', 'Groundnut', 'Cotton'] },
  { phone: '9000000005', password: 'buyer123', name: 'Kavita Rao', traderName: 'Rao Foods Pvt Ltd', location: 'Industrial Area',
    state: 'Maharashtra', district: 'Pune', license: '', interests: ['Onion', 'Potato'] },
];

async function createAccount(role, account) {
  const email = authEmail(role, account.phone);
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: account.password, email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;

  const { lands, password, ...profile } = account;
  const { error: profileError } = await supabase.from('profiles').insert({
    id, role, phone: profile.phone, name: profile.name,
    place: profile.place, state: profile.state, district: profile.district,
    trader_name: profile.traderName, location: profile.location, license: profile.license,
    interests: profile.interests || [], profile_complete: true,
  });
  if (profileError) throw profileError;

  if (lands?.length) {
    const { error: landsError } = await supabase.from('lands')
      .insert(lands.map((l) => ({ farmer_id: id, ...l })));
    if (landsError) throw landsError;
  }
  return id;
}

async function main() {
  console.log('Creating authority...');
  await createAccount('authority', { ...DEMO_ACCOUNTS.authority, name: 'District Agriculture Office' });

  console.log('Creating farmers...');
  const farmerIds = [];
  for (const f of FARMERS) farmerIds.push(await createAccount('farmer', f));

  console.log('Creating buyers...');
  const buyerIds = [];
  for (const b of BUYERS) buyerIds.push(await createAccount('buyer', b));

  console.log('Creating sample listings + bids...');
  const [f1, f2, f3] = farmerIds;
  const [b1, b2] = buyerIds;
  const now = Date.now();
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const iso = (ms) => new Date(ms).toISOString();

  const listings = [
    { farmer_id: f2, crop: 'Wheat', variety: 'HD-2967', quantity: 80, unit: 'Quintal', base_price: 2275,
      grade: 'Grade A', available_from: iso(now), duration_days: 2, ends_at: iso(now + 2 * DAY),
      description: 'Freshly harvested, cleaned and sun-dried. Moisture under 12%.', status: 'open',
      bids: [[b2, 2300], [b1, 2340]] },
    { farmer_id: f3, crop: 'Onion', variety: 'Red Nashik', quantity: 45, unit: 'Quintal', base_price: 1800,
      grade: 'Grade B', available_from: iso(now), duration_days: 1, ends_at: iso(now + 9 * HOUR),
      description: 'Medium size bulbs, stored in ventilated chawl.', status: 'open', bids: [[b2, 1850]] },
    { farmer_id: f1, crop: 'Groundnut', variety: 'GG-20', quantity: 30, unit: 'Quintal', base_price: 6300,
      grade: 'Grade A', available_from: iso(now + 3 * DAY), duration_days: 1, ends_at: iso(now + 4 * DAY),
      description: 'Bold kernels, bagged in 40 kg jute bags.', status: 'open', bids: [] },
    { farmer_id: f2, crop: 'Paddy (Rice)', variety: 'PR-126', quantity: 120, unit: 'Quintal', base_price: 2183,
      grade: 'Grade B', available_from: iso(now), duration_days: 3, ends_at: iso(now + 3 * DAY),
      description: 'Pickup from farm gate, loading labour available.', status: 'open', bids: [] },
    { farmer_id: f1, crop: 'Cotton', variety: 'Shankar-6', quantity: 25, unit: 'Quintal', base_price: 7020,
      grade: 'Grade A', available_from: iso(now - 6 * DAY), duration_days: 4, ends_at: iso(now - 2 * DAY),
      description: 'Long staple, clean pick.', status: 'sold', bids: [[b1, 7100], [b1, 7250]], acceptLast: true },
  ];

  for (const l of listings) {
    const { bids, acceptLast, ...row } = l;
    const { data: inserted, error } = await supabase.from('listings').insert(row).select().single();
    if (error) throw error;

    let lastBidId = null;
    for (const [buyerId, amount] of bids) {
      const { data: bidRow, error: bidError } = await supabase.from('bids')
        .insert({ listing_id: inserted.id, buyer_id: buyerId, amount }).select().single();
      if (bidError) throw bidError;
      lastBidId = bidRow.id;
    }
    if (acceptLast && lastBidId) {
      const { error: soldError } = await supabase.from('listings')
        .update({ accepted_bid_id: lastBidId, sold_at: new Date().toISOString() })
        .eq('id', inserted.id);
      if (soldError) throw soldError;
    }
  }

  console.log('Done. Demo logins:');
  console.log('  Farmer:    9000000001 / farmer123');
  console.log('  Buyer:     9000000002 / buyer123');
  console.log('  Authority: AUTH001 / authority123');
}

main().catch((err) => { console.error(err); process.exit(1); });
