import { useMemo, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { highestBid, listingStatus, minNextBid, placeBid, useApp, userById } from '../lib/store';
import { CROPS, STATES } from '../lib/constants';
import { dateStr, money, timeLeft } from '../lib/format';
import useNow from '../lib/useNow';

const SORTS = {
  ending: ['Ending soon', (a, b) => a.endsAt - b.endsAt],
  newest: ['Newest', (a, b) => b.createdAt - a.createdAt],
  qty: ['Largest quantity', (a, b) => b.quantity - a.quantity],
  price: ['Lowest base price', (a, b) => a.basePrice - b.basePrice],
};

export default function BuyerHome() {
  const { db, me } = useApp();
  const now = useNow();
  const [tab, setTab] = useState('market');
  const [q, setQ] = useState('');
  const [crop, setCrop] = useState('');
  const [state, setState] = useState('');
  const [sort, setSort] = useState('ending');

  const open = db.listings.filter((l) => listingStatus(l, now) === 'open');
  const myBidLots = db.listings.filter((l) => l.bids.some((b) => b.buyerId === me.id));

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return open
      .filter((l) => {
        const farmer = userById(l.farmerId);
        if (crop && l.crop !== crop) return false;
        if (state && farmer?.state !== state) return false;
        if (!term) return true;
        return [l.crop, l.variety, farmer?.district, farmer?.place, farmer?.state]
          .some((v) => v?.toLowerCase().includes(term));
      })
      .sort(SORTS[sort][1]);
  }, [open, q, crop, state, sort]);

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Marketplace</h1>
          <p className="muted">{me.traderName} · {me.district}, {me.state}</p>
        </div>
      </section>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'market'} onClick={() => setTab('market')}>
          🌾 Lots for sale <span className="count">{open.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'bids'} onClick={() => setTab('bids')}>
          🔨 My bids <span className="count">{myBidLots.length}</span>
        </button>
      </div>

      {tab === 'market' ? (
        <>
          <div className="filters card">
            <input type="search" placeholder="Search crop, variety, district…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={crop} onChange={(e) => setCrop(e.target.value)}>
              <option value="">All crops</option>
              {CROPS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">All states</option>
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          {results.length ? (
            <div className="lot-grid">
              {results.map((l) => <LotCard key={l.id} l={l} me={me} now={now} />)}
            </div>
          ) : (
            <div className="card empty">No open lots match your filters.</div>
          )}
        </>
      ) : (
        <MyBids lots={myBidLots} me={me} now={now} />
      )}
    </>
  );
}

function LotCard({ l, me, now }) {
  const farmer = userById(l.farmerId);
  const top = highestBid(l);
  const min = minNextBid(l);
  const leading = top?.buyerId === me.id;
  const [amount, setAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState('');
  const unit = l.unit.toLowerCase();
  const endingSoon = l.endsAt - now < 12 * 3600 * 1000;

  function submit(e) {
    e.preventDefault();
    const value = Number(amount);
    const reference = top ? top.amount : Number(l.basePrice);
    // Guard against typos like an extra zero — bids are binding once the farmer accepts.
    if (value > reference * 1.5 && !confirm(
      `${money(value)}/${unit} is much higher than the current ${money(reference)}/${unit}. `
      + `Lot total would be ${money(value * l.quantity)}. Place this bid?`,
    )) return;
    try {
      placeBid(l.id, me.id, value);
      setBidding(false);
      setAmount('');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <article className="card lot">
      <div className="lot-head">
        <div>
          <h3>{l.crop}</h3>
          <p className="muted small">{l.variety || 'Variety not specified'} · {l.grade}</p>
        </div>
        <span className={`timer ${endingSoon ? 'hot' : ''}`}>⏱ {timeLeft(l.endsAt, now)}</span>
      </div>

      <dl className="lot-facts">
        <div><dt>Quantity</dt><dd>{l.quantity} {unit}</dd></div>
        <div><dt>Base price</dt><dd>{money(l.basePrice)}/{unit}</dd></div>
        <div><dt>Location</dt><dd>{farmer?.district}, {farmer?.state}</dd></div>
        <div><dt>Available</dt><dd>{l.availableFrom <= now ? 'Now' : dateStr(l.availableFrom)}</dd></div>
      </dl>

      {l.description && <p className="lot-desc">{l.description}</p>}

      <div className={`lot-bid ${leading ? 'leading' : ''}`}>
        <div>
          <span className="small muted">{top ? `Highest of ${l.bids.length} bid${l.bids.length > 1 ? 's' : ''}` : 'No bids yet'}</span>
          <strong>{top ? money(top.amount) : '—'}<small>{top && `/${unit}`}</small></strong>
        </div>
        {leading && <StatusBadge status="leading" />}
      </div>

      {bidding ? (
        <form className="bid-form" onSubmit={submit}>
          <div className="bid-input">
            <span>₹</span>
            <input type="number" min={min} step="1" autoFocus onFocus={(e) => e.target.select()} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder={String(min)} required />
            <span className="small muted">/{unit}</span>
          </div>
          {amount > 0 && <p className="small muted">Lot total: {money(amount * l.quantity)}</p>}
          {error && <p className="alert">{error}</p>}
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setBidding(false); setError(''); }}>Cancel</button>
            <button className="btn btn-primary btn-sm">Confirm bid</button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary btn-block" onClick={() => { setAmount(String(min)); setBidding(true); }}>
          {leading ? 'Raise my bid' : `Place bid (min ${money(min)})`}
        </button>
      )}
    </article>
  );
}

function MyBids({ lots, me, now }) {
  if (!lots.length) return <div className="card empty">You haven't bid on anything yet.</div>;

  const rows = lots
    .map((l) => {
      const status = listingStatus(l, now);
      const top = highestBid(l);
      const mine = l.bids.filter((b) => b.buyerId === me.id).reduce((m, b) => Math.max(m, b.amount), 0);
      const accepted = l.bids.find((b) => b.id === l.acceptedBidId);
      const won = status === 'sold' && accepted?.buyerId === me.id;
      const outcome = won ? 'won'
        : status === 'sold' || status === 'cancelled' ? 'lost'
          : top?.buyerId === me.id ? 'leading' : 'outbid';
      return { l, status, top, mine, outcome, accepted };
    })
    .sort((a, b) => b.l.createdAt - a.l.createdAt);

  return (
    <div className="stack">
      {rows.map(({ l, status, top, mine, outcome, accepted }) => {
        const farmer = userById(l.farmerId);
        const unit = l.unit.toLowerCase();
        return (
          <article key={l.id} className="card listing-row">
            <div className="listing-title">
              <h3>{l.crop}{l.variety && <small> · {l.variety}</small>} <span className="muted small">— {l.quantity} {unit}</span></h3>
              <StatusBadge status={outcome} />
            </div>
            <p className="meta">
              Your best bid {money(mine)}/{unit} · Highest {money(top?.amount)}/{unit} ·
              {' '}{farmer?.district}, {farmer?.state} ·
              {' '}{status === 'open' ? timeLeft(l.endsAt, now) : <StatusBadge status={status} />}
            </p>
            {outcome === 'won' && (
              <p className="highlight ok">
                🎉 Farmer accepted your bid. Contact <strong>{farmer?.name}</strong> — 📞 {farmer?.phone}
                {' '}· Lot value {money(accepted.amount * l.quantity)}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
