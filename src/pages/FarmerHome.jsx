import { useState } from 'react';
import Field from '../components/Field';
import StatusBadge from '../components/StatusBadge';
import {
  acceptBid, cancelListing, createListing, highestBid, listingStatus, useApp, userById,
} from '../lib/store';
import { CROPS, GRADES, UNITS } from '../lib/constants';
import { dateStr, money, timeLeft } from '../lib/format';
import useNow from '../lib/useNow';

// yyyy-mm-dd in the user's local timezone (toISOString would give the UTC date).
const today = () => new Date().toLocaleDateString('en-CA');

const EMPTY = {
  crop: '', customCrop: '', variety: '', quantity: '', unit: 'Quintal', basePrice: '',
  grade: GRADES[1], availableFrom: today(), durationDays: '3', description: '',
};

export default function FarmerHome() {
  const { db, me } = useApp();
  const now = useNow();
  const [tab, setTab] = useState('sell');
  const [flash, setFlash] = useState('');

  const mine = db.listings.filter((l) => l.farmerId === me.id);
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
        <button role="tab" aria-selected={tab === 'lots'} onClick={() => setTab('lots')}>
          📦 My listings <span className="count">{mine.length}</span>
        </button>
      </div>

      {flash && <p className="alert alert-ok">{flash}</p>}

      {tab === 'sell' ? (
        <SellForm
          farmer={me}
          onCreated={() => { setFlash('Your crop is live — buyers can bid on it now.'); setTab('lots'); }}
        />
      ) : (
        <MyListings listings={mine} now={now} />
      )}
    </>
  );
}

function Stat({ label, value }) {
  return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>;
}

function SellForm({ farmer, onCreated }) {
  const [f, setF] = useState(EMPTY);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const total = Number(f.quantity) * Number(f.basePrice);

  function submit(e) {
    e.preventDefault();
    const start = new Date(`${f.availableFrom}T00:00`).getTime();
    createListing(farmer.id, {
      crop: f.crop === 'Other' ? f.customCrop.trim() : f.crop,
      variety: f.variety.trim(),
      quantity: Number(f.quantity),
      unit: f.unit,
      basePrice: Number(f.basePrice),
      grade: f.grade,
      availableFrom: start,
      endsAt: Date.now() + Number(f.durationDays) * 24 * 3600 * 1000,
      description: f.description.trim(),
    });
    setF(EMPTY);
    onCreated();
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
        <Field label={`Base price (₹ / ${f.unit.toLowerCase()})`} type="number" min="1" value={f.basePrice}
          onChange={set('basePrice')} required hint="Lowest price you will accept." />
      </div>
      <div className="grid-3">
        <Field label="Quality grade" as="select" value={f.grade} onChange={set('grade')}>
          {GRADES.map((g) => <option key={g}>{g}</option>)}
        </Field>
        <Field label="Available from" type="date" value={f.availableFrom} onChange={set('availableFrom')} required />
        <Field label="Bidding open for" as="select" value={f.durationDays} onChange={set('durationDays')}>
          {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
        </Field>
      </div>
      <Field label="Notes for buyers" as="textarea" rows={3} value={f.description} onChange={set('description')}
        placeholder="Moisture, storage, packing, pickup details…" />

      <div className="sell-foot">
        <span className="muted">
          {total > 0 ? <>Minimum lot value: <strong>{money(total)}</strong></> : 'Fill in quantity and price to see lot value.'}
        </span>
        <button className="btn btn-primary">Put up for bidding</button>
      </div>
    </form>
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
                  <button
                    className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      if (confirm(`Accept ${money(b.amount)}/${l.unit.toLowerCase()} from ${buyer?.traderName}? This closes bidding.`)) {
                        acceptBid(l.id, b.id);
                      }
                    }}
                  >
                    Accept
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {!bids.length && decidable && <p className="muted small">No bids yet.</p>}

      {decidable && (
        <button className="link-btn danger" onClick={() => confirm('Withdraw this listing?') && cancelListing(l.id)}>
          Withdraw listing
        </button>
      )}
    </article>
  );
}
