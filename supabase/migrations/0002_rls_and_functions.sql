-- Row Level Security + RPC functions. RLS is the real security boundary for
-- this app (the anon key is public by design) — see README/.env.example.

alter table public.profiles enable row level security;
alter table public.payment_details enable row level security;
alter table public.lands enable row level security;
alter table public.crop_prices enable row level security;
alter table public.listings enable row level security;
alter table public.bids enable row level security;

-- Avoids recursive-RLS lookups: other tables' policies call this instead of
-- re-querying profiles directly.
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- listings_select (below) needs to know "did I bid on this listing", and
-- bids_select needs "can I see this listing" — checking both with plain
-- cross-table subqueries would make the two policies recurse into each other.
-- This SECURITY DEFINER function bypasses bids' RLS for that one check
-- (function owner is the table owner, which isn't itself subject to RLS),
-- breaking the cycle. Same technique as current_role() above.
create or replace function public.listing_has_my_bid(p_listing_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bids where listing_id = p_listing_id and buyer_id = auth.uid())
$$;

-- ---------- profiles ----------
-- Readable by any signed-in user: farmers/buyers already exchange name+phone
-- after a sale (see FarmerListing/WonLots), and authority needs to see everyone.
create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- payment_details ----------
-- Strictly owner-only — tightens privacy vs. the old blob (bank details were
-- technically globally readable there).
create policy payment_details_select on public.payment_details
  for select to authenticated using (profile_id = auth.uid());
create policy payment_details_insert on public.payment_details
  for insert to authenticated with check (profile_id = auth.uid());
create policy payment_details_update on public.payment_details
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- lands ----------
create policy lands_select on public.lands
  for select to authenticated using (farmer_id = auth.uid());
create policy lands_insert on public.lands
  for insert to authenticated with check (farmer_id = auth.uid() and public.current_role() = 'farmer');
create policy lands_update on public.lands
  for update to authenticated using (farmer_id = auth.uid()) with check (farmer_id = auth.uid());
create policy lands_delete on public.lands
  for delete to authenticated using (farmer_id = auth.uid());

-- ---------- crop_prices ----------
create policy crop_prices_select on public.crop_prices
  for select to authenticated using (true);
create policy crop_prices_write on public.crop_prices
  for all to authenticated
  using (public.current_role() = 'authority')
  with check (public.current_role() = 'authority');

-- ---------- listings ----------
-- farmer: own listings (incl. pending/cancelled). authority: everything.
-- buyer: open listings, plus any listing they've placed a bid on (so won-lots /
-- purchase-history stay visible after the lot closes).
create policy listings_select on public.listings
  for select to authenticated using (
    farmer_id = auth.uid()
    or public.current_role() = 'authority'
    or status = 'open'
    or public.listing_has_my_bid(id)
  );
create policy listings_insert on public.listings
  for insert to authenticated
  with check (public.current_role() = 'farmer' and farmer_id = auth.uid() and status = 'pending');
-- Direct updates only for a farmer editing their own still-pending listing.
-- Every other transition (approve/accept/cancel/confirm) goes through an RPC below.
create policy listings_update on public.listings
  for update to authenticated
  using (farmer_id = auth.uid() and status = 'pending')
  with check (farmer_id = auth.uid() and status = 'pending');

-- ---------- bids ----------
-- Visible to anyone who can already see the parent listing (matches the old
-- behaviour: everyone sees the full bid history on a lot they can view).
create policy bids_select on public.bids
  for select to authenticated using (
    exists (select 1 from public.listings l where l.id = bids.listing_id)
  );
-- No direct insert/update/delete — all bid writes go through place_bid().

-- ---------- RPCs (SECURITY DEFINER: do their own role/ownership checks) ----------

create or replace function public.place_bid(p_listing_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare l public.listings; v_min numeric;
begin
  if public.current_role() <> 'buyer' then raise exception 'Only buyers can bid.'; end if;
  select * into l from public.listings where id = p_listing_id for update;
  if l is null then raise exception 'Listing not found.'; end if;
  if l.status <> 'open' or now() > l.ends_at then raise exception 'Bidding has closed for this lot.'; end if;
  select coalesce(max(amount), l.base_price) + case when max(amount) is null then 0 else 10 end
    into v_min from public.bids where listing_id = p_listing_id;
  if p_amount < v_min then
    raise exception 'Your bid must be at least % per %.', v_min, lower(l.unit);
  end if;
  insert into public.bids (listing_id, buyer_id, amount) values (p_listing_id, auth.uid(), p_amount);
end $$;

create or replace function public.approve_listing(p_listing_id uuid, p_grade text)
returns void language plpgsql security definer set search_path = public as $$
declare l public.listings;
begin
  if public.current_role() <> 'authority' then raise exception 'Not authorised.'; end if;
  select * into l from public.listings where id = p_listing_id and status = 'pending';
  if l is null then raise exception 'Listing not found or already reviewed.'; end if;
  update public.listings set
    status = 'open', grade = p_grade, approved_at = now(),
    ends_at = now() + (l.duration_days || ' days')::interval
  where id = p_listing_id;
end $$;

-- Called by the farmer (while the listing is still open) or by the authority
-- (once bidding has ended) — see FarmerHome.jsx's Accept and
-- AuthorityHome.jsx's AwaitingRow "Approve winning bid".
create or replace function public.accept_bid(p_listing_id uuid, p_bid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l public.listings; r user_role := public.current_role();
begin
  select * into l from public.listings where id = p_listing_id;
  if l is null then raise exception 'Listing not found.'; end if;
  if r = 'farmer' then
    -- Farmer can accept only while bidding is genuinely still open — once the
    -- clock runs out (status still 'open' but past ends_at) it's the
    -- authority's call via the branch below (matches FarmerHome.jsx's
    -- canAccept = listingStatus(l, now) === 'open').
    if l.farmer_id <> auth.uid() or l.status <> 'open' or now() > l.ends_at then
      raise exception 'Not allowed.';
    end if;
  elsif r = 'authority' then
    if not (l.status = 'open' and now() > l.ends_at) then raise exception 'Not allowed.'; end if;
  else
    raise exception 'Not allowed.';
  end if;
  if not exists (select 1 from public.bids where id = p_bid_id and listing_id = p_listing_id) then
    raise exception 'Bid not found.';
  end if;
  update public.listings set status = 'sold', accepted_bid_id = p_bid_id, sold_at = now()
    where id = p_listing_id;
end $$;

create or replace function public.confirm_purchase(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.listings set purchase_confirmed_at = now()
    where id = p_listing_id and status = 'sold'
      and accepted_bid_id in (select id from public.bids where buyer_id = auth.uid());
  if not found then raise exception 'Not allowed.'; end if;
end $$;

create or replace function public.cancel_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l public.listings; r user_role := public.current_role();
begin
  select * into l from public.listings where id = p_listing_id;
  if l is null then raise exception 'Listing not found.'; end if;
  if not ((r = 'farmer' and l.farmer_id = auth.uid()) or r = 'authority') then
    raise exception 'Not allowed.';
  end if;
  update public.listings set status = 'cancelled' where id = p_listing_id;
end $$;

create or replace function public.set_crop_price(p_crop text, p_price numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'authority' then raise exception 'Not authorised.'; end if;
  insert into public.crop_prices (crop, price_per_quintal, updated_by, updated_at)
    values (p_crop, p_price, auth.uid(), now())
    on conflict (crop) do update set
      price_per_quintal = excluded.price_per_quintal, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- Full-replace of a farmer's land parcels (LandFields.jsx always sends the whole list).
create or replace function public.save_farmer_lands(p_lands jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'farmer' then raise exception 'Not authorised.'; end if;
  delete from public.lands where farmer_id = auth.uid();
  insert into public.lands (farmer_id, location, area, acres)
    select auth.uid(), x->>'location', x->>'area', (x->>'acres')::numeric
    from jsonb_array_elements(p_lands) x;
end $$;

grant execute on all functions in schema public to authenticated;
