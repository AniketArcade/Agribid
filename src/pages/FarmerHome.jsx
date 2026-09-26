import { useState } from 'react';
import Field from '../components/Field';
import StatusBadge from '../components/StatusBadge';
import {
  acceptBid, cancelListing, createListing, highestBid, listingStatus, useApp, userById,
} from '../lib/store';
import { CROPS, UNIT_FACTOR, UNITS } from '../lib/constants';
import { dateStr, money, timeLeft } from '../lib/format';
import useNow from '../lib/useNow';

// yyyy-mm-dd in the user's local timezone (toISOString would give the UTC date).
const today = () => new Date().toLocaleDateString('en-CA');

const EMPTY = {
  crop: '', customCrop: '', variety: '', quantity: '', unit: 'Quintal',
  availableFrom: today(), durationDays: '3', description: '',
};

export default function FarmerHome() {
  const { db, me } = useApp();
  const now = useNow();
  const [tab, setTab] = useState('sell');
  const [flash, setFlash] = useState('');

  const mine = db.listings.filter((l) => l.farmerId === me.id);
  const pending = mine.filter((l) => l.status === 'pending');
  const listed = mine.filter((l) => l.status !== 'pending');
  const active = mine.filter((l) => ['open', 'ended'].includes(listingStatus(l, now)));
  const totalBids = active.reduce((n, l) => n + l.bids.length, 0);
  const sold = mine.filter((l) => l.status === 'sold');
  const earned = sold.reduce((sum, l) => {
    const b = l.bids.find((x) => x.id === l.acceptedBidId);
    return sum + (b ? b.amount * l.quantity : 0);
  }, 0);

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Namaste, {me.name?.split(' ')[0]} 👋</h1>
          <p className="muted">{me.place}, {me.district}, {me.state}</p>
        </div>
      </section>

      <section className="stats">
        <Stat label="Active lots" value={active.length} />
        <Stat label="Bids on active lots" value={totalBids} />
        <Stat label="Lots sold" value={sold.length} />
        <Stat label="Total sale value" value={money(earned)} />
      </section>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'sell'} onClick={() => setTab('sell')}>🌱 Sell a crop</button>
        <button role="tab" aria-selected={tab === 'pending'} onClick={() => setTab('pending')}>
          ⏳ Pending <span className="count">{pending.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'lots'} onClick={() => setTab('lots')}>
          📦 My listings <span className="count">{listed.length}</span>
        </button>
      </div>

      {flash && <p className="alert alert-ok">{flash}</p>}

      {tab === 'sell' ? (
        <SellForm
          farmer={me}
          prices={db.prices}
          onCreated={() => {
            setFlash('Your crop has been submitted for authority approval — it will show up here once approved.');
            setTab('pending');
          }}
        />
      ) : tab === 'pending' ? (
        <PendingListings listings={pending} />
      ) : (
        <MyListings listings={listed} now={now} />
      )}
    </>
  );
}

function Stat({ label, value }) {
  return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>;
}

function SellForm({ farmer, prices, onCreated }) {
  const [f, setF] = useState(EMPTY);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const pricePerQuintal = f.crop && f.crop !== 'Other' ? prices[f.crop] : null;
  const basePrice = pricePerQuintal ? Math.round(pricePerQuintal * UNIT_FACTOR[f.unit]) : 0;
  const total = Number(f.quantity) * basePrice;

  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    const start = new Date(`${f.availableFrom}T00:00`).getTime();
    try {
      await createListing(farmer.id, {
        crop: f.crop === 'Other' ? f.customCrop.trim() : f.crop,
        variety: f.variety.trim(),
        quantity: Number(f.quantity),
        unit: f.unit,
        basePrice,
        availableFrom: start,
        durationDays: Number(f.durationDays),
        description: f.description.trim(),
      });
      setF(EMPTY);
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card form sell-form" onSubmit={submit}>
      <h2>What do you want to sell?</h2>
      <div className="grid-2">
        <Field label="Crop" as="select" value={f.crop} onChange={set('crop')} required>
          <option value="">Select crop</option>
          {CROPS.map((c) => <option key={c}>{c}</option>)}
        </Field>
        {f.crop === 'Other' ? (
          <Field label="Crop name" value={f.customCrop} onChange={set('customCrop')} required />
        ) : (
          <Field label="Variety" placeholder="e.g. HD-2967 (optional)" value={f.variety} onChange={set('variety')} />
        )}
      </div>
      <div className="grid-3">
        <Field label="Quantity" type="number" min="0.1" step="0.1" value={f.quantity} onChange={set('quantity')} required />
        <Field label="Unit" as="select" value={f.unit} onChange={set('unit')}>
          {UNITS.map((u) => <option key={u}>{u}</option>)}
        </Field>
        <Field
          label={`Base price (₹ / ${f.unit.toLowerCase()})`}
          value={pricePerQuintal ? money(basePrice) : 'Set by authority'}
          disabled
          hint="Fixed by the authority for this crop — not set by you."
        />
      </div>
      <div className="grid-2">
        <Field label="Available from" type="date" value={f.availableFrom} onChange={set('availableFrom')} required />
        <Field label="Bidding open for" as="select" value={f.durationDays} onChange={set('durationDays')}>
          {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
        </Field>
      </div>
      <p className="muted small">Quality grade is assigned by the authority after inspection — it'll show up on your listing once set.</p>
      <Field label="Notes for buyers" as="textarea" rows={3} value={f.description} onChange={set('description')}
        placeholder="Moisture, storage, packing, pickup details…" />

      {error && <p className="alert">{error}</p>}
      <div className="sell-foot">
        <span className="muted">
          {total > 0 ? <>Minimum lot value: <strong>{money(total)}</strong></> : 'Select a crop and quantity to see lot value.'}
        </span>
        <button className="btn btn-primary">Submit for approval</button>
      </div>
    </form>
  );
}

function PendingListings({ listings }) {
  if (!listings.length) {
    return <div className="card empty">Nothing waiting on approval. Use “Sell a crop” to list one.</div>;
  }
  return <div className="stack">{listings.map((l) => <PendingListing key={l.id} l={l} />)}</div>;
}

function PendingListing({ l }) {
  return (
    <article className="card listing-row">
      <div className="listing-main">
        <div className="listing-title">
          <h3>{l.crop}{l.variety && <small> · {l.variety}</small>}</h3>
          <StatusBadge status="pending" />
        </div>
        <p className="meta">
          {l.quantity} {l.unit.toLowerCase()} · Base {money(l.basePrice)}/{l.unit.toLowerCase()} · Submitted {dateStr(l.createdAt)}
        </p>
        <p className="muted small">Waiting for the authority to review and grade this lot before it goes live.</p>
      </div>
      <button
        className="link-btn danger"
        onClick={() => confirm('Withdraw this listing?') && cancelListing(l.id).catch((err) => alert(err.message))}
      >
        Withdraw listing
      </button>
    </article>
  );
}

function MyListings({ listings, now }) {
  if (!listings.length) {
    return <div className="card empty">You haven't listed any crops yet. Use “Sell a crop” to start.</div>;
  }
  return <div className="stack">{listings.map((l) => <FarmerListing key={l.id} l={l} now={now} />)}</div>;
}

function FarmerListing({ l, now }) {
  const status = listingStatus(l, now);
  const top = highestBid(l);
  const bids = [...l.bids].sort((a, b) => b.amount - a.amount);
  const accepted = l.bids.find((b) => b.id === l.acceptedBidId);
  const winner = accepted && userById(accepted.buyerId);
  const decidable = status === 'open' || status === 'ended';
  const canAccept = status === 'open';

  return (
    <article className="card listing-row">
      <div className="listing-main">
        <div className="listing-title">
          <h3>{l.crop}{l.variety && <small> · {l.variety}</small>}</h3>
          <StatusBadge status={status} />
        </div>
        <p className="meta">
          {l.quantity} {l.unit.toLowerCase()} · {l.grade} · Base {money(l.basePrice)}/{l.unit.toLowerCase()} ·
          {' '}{status === 'open' ? timeLeft(l.endsAt, now) : `Listed ${dateStr(l.createdAt)}`}
        </p>
        {top && decidable && (
          <p className="highlight">
            Highest bid <strong>{money(top.amount)}</strong>/{l.unit.toLowerCase()}
            {' '}= {money(top.amount * l.quantity)} total
          </p>
        )}
        {winner && (
          <p className="highlight ok">
            Sold to <strong>{winner.traderName}</strong> ({winner.name}, 📞 {winner.phone}) for
            {' '}<strong>{money(accepted.amount * l.quantity)}</strong>
          </p>
        )}
      </div>

      {bids.length > 0 && decidable && (
        <details className="bids" open={status === 'ended'}>
          <summary>{bids.length} bid{bids.length > 1 ? 's' : ''}</summary>
          <ul>
            {bids.map((b, i) => {
              const buyer = userById(b.buyerId);
              return (
                <li key={b.id}>
                  <span>
                    <strong>{money(b.amount)}</strong>/{l.unit.toLowerCase()}
                    <span className="muted"> · {buyer?.traderName} · {buyer?.district}</span>
                  </span>
                  {canAccept && (
                    <button
                      className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => {
                        if (confirm(`Accept ${money(b.amount)}/${l.unit.toLowerCase()} from ${buyer?.traderName}? This closes bidding.`)) {
                          acceptBid(l.id, b.id).catch((err) => alert(err.message));
                        }
                      }}
                    >
                      Accept
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {!bids.length && decidable && <p className="muted small">{status === 'ended' ? 'No bids were received.' : 'No bids yet.'}</p>}
      {status === 'ended' && bids.length > 0 && (
        <p className="muted small">Bidding has closed — the authority will approve the winning bid.</p>
      )}

      {decidable && (
        <button
          className="link-btn danger"
          onClick={() => confirm('Withdraw this listing?') && cancelListing(l.id).catch((err) => alert(err.message))}
        >
          Withdraw listing
        </button>
      )}
    </article>
  );
}
