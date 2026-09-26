-- Agribid schema: replaces the mock localStorage JSON blob with real tables.
-- Run in the Supabase SQL editor, or via `supabase db push` if using the CLI.

create extension if not exists pgcrypto;

create type user_role as enum ('farmer', 'buyer', 'authority');
create type listing_status as enum ('pending', 'open', 'sold', 'cancelled');
-- Note: 'ended' (bidding time over, not yet decided) is a derived, time-based
-- state computed client-side as `now() > ends_at while status = 'open'` —
-- it is never stored here, matching the app's existing listingStatus() helper.

-- profiles: 1:1 extension of auth.users, role-discriminated like the old User type.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  phone text not null,                 -- also holds Authority's "Official ID"
  name text,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  -- farmer-only
  place text,
  state text,
  district text,
  -- buyer-only
  trader_name text,
  location text,
  license text,
  interests text[] not null default '{}',
  unique (role, phone)
);

-- payment details split into their own table so RLS can restrict them to the
-- owner only (tighter than the old blob, where every field was globally readable).
create table public.payment_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  account_holder text,
  bank_name text,
  account_number text,
  ifsc text,
  upi_id text,
  updated_at timestamptz not null default now()
);

-- lands: was profiles.lands[] embedded array.
create table public.lands (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  location text not null,
  area text,
  acres numeric not null check (acres > 0)
);
create index lands_farmer_idx on public.lands(farmer_id);

-- crop_prices: was db.prices, authority-set MSP per crop (₹ per quintal).
create table public.crop_prices (
  crop text primary key,
  price_per_quintal numeric not null check (price_per_quintal > 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  crop text not null,
  variety text not null default '',
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('Quintal', 'Tonne', 'Kg')),
  base_price numeric not null check (base_price >= 0),
  grade text check (grade in ('Grade A', 'Grade B', 'Grade C')),
  available_from timestamptz not null,
  duration_days integer not null check (duration_days > 0),
  ends_at timestamptz,                  -- null until approved
  description text not null default '',
  status listing_status not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  accepted_bid_id uuid,                 -- FK added below, after bids exists
  sold_at timestamptz,
  purchase_confirmed_at timestamptz
);
create index listings_farmer_idx on public.listings(farmer_id);
create index listings_status_idx on public.listings(status);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index bids_listing_idx on public.bids(listing_id);
create index bids_buyer_idx on public.bids(buyer_id);

alter table public.listings
  add constraint listings_accepted_bid_fk
  foreign key (accepted_bid_id) references public.bids(id);

-- Seed the authority-fixed base prices (was constants.js's MSP map).
insert into public.crop_prices (crop, price_per_quintal) values
  ('Wheat', 2275), ('Paddy (Rice)', 2183), ('Maize', 2090), ('Bajra', 2500), ('Jowar', 3180),
  ('Soybean', 4600), ('Cotton', 7121), ('Sugarcane', 315), ('Mustard', 5650), ('Groundnut', 6377),
  ('Chana (Gram)', 5440), ('Tur (Arhar)', 7000), ('Moong', 8558), ('Urad', 6950),
  ('Onion', 1200), ('Potato', 800), ('Tomato', 700)
on conflict (crop) do nothing;

-- Enable Realtime for live bid/listing updates (BuyerHome/FarmerHome/AuthorityHome).
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.bids;
