import { useMemo, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { confirmPurchase, highestBid, listingStatus, minNextBid, placeBid, useApp, userById } from '../lib/store';
import { CROPS, STATES } from '../lib/constants';
import { dateStr, dateTimeStr, money, timeLeft } from '../lib/format';
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
  const wonLots = db.listings.filter((l) => {
    if (listingStatus(l, now) !== 'sold') return false;
    const accepted = l.bids.find((b) => b.id === l.acceptedBidId);
    return accepted?.buyerId === me.id;
  });
  const pendingWonLots = wonLots.filter((l) => !l.purchaseConfirmedAt);
  const purchaseHistory = wonLots.filter((l) => l.purchaseConfirmedAt);

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
        <button role="tab" aria-selected={tab === 'won'} onClick={() => setTab('won')}>
          🏆 Won lots <span className="count">{pendingWonLots.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
          🧾 Purchase history <span className="count">{purchaseHistory.length}</span>
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
      ) : tab === 'bids' ? (
        <MyBids lots={myBidLots} me={me} now={now} />
      ) : tab === 'won' ? (
        <WonLots lots={pendingWonLots} />
      ) : (
        <PurchaseHistory lots={purchaseHistory} />
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
  const [details, setDetails] = useState(false);
  const unit = l.unit.toLowerCase();
  const endingSoon = l.endsAt - now < 12 * 3600 * 1000;

  async function submit(e) {
    e.preventDefault();
    const value = Number(amount);
    const reference = top ? top.amount : Number(l.basePrice);
    // Guard against typos like an extra zero — bids are binding once the farmer accepts.
    if (value > reference * 1.5 && !confirm(
      `${money(value)}/${unit} is much higher than the current ${money(reference)}/${unit}. `
      + `Lot total would be ${money(value * l.quantity)}. Place this bid?`,
    )) return;
    try {
      await placeBid(l.id, me.id, value);
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

      <button type="button" className="link-btn" onClick={() => setDetails(true)}>View full details</button>

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

      {details && (
        <LotDetailsModal
          l={l} farmer={farmer} top={top} me={me} unit={unit} now={now}
          onClose={() => setDetails(false)}
          onBid={() => { setDetails(false); setAmount(String(min)); setBidding(true); }}
        />
      )}
    </article>
  );
}

function LotDetailsModal({ l, farmer, top, me, unit, now, onClose, onBid }) {
  const bids = [...l.bids].sort((a, b) => b.amount - a.amount);
  return (
    <Modal
      title={`${l.crop}${l.variety ? ` · ${l.variety}` : ''}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={onBid}>
            {top?.buyerId === me.id ? 'Raise my bid' : 'Place a bid'}
          </button>
        </>
      )}
    >
      <dl className="kv-grid">
        <div className="kv"><dt>Crop</dt><dd>{l.crop}</dd></div>
        <div className="kv"><dt>Variety</dt><dd>{l.variety || '—'}</dd></div>
        <div className="kv"><dt>Grade</dt><dd>{l.grade}</dd></div>
        <div className="kv"><dt>Quantity</dt><dd>{l.quantity} {unit}</dd></div>
        <div className="kv"><dt>Base price</dt><dd>{money(l.basePrice)}/{unit}</dd></div>
        <div className="kv"><dt>Highest bid</dt><dd>{top ? `${money(top.amount)}/${unit}` : 'No bids yet'}</dd></div>
        <div className="kv"><dt>Available from</dt><dd>{l.availableFrom <= now ? 'Now' : dateStr(l.availableFrom)}</dd></div>
        <div className="kv"><dt>Bidding ends</dt><dd>{dateTimeStr(l.endsAt)}</dd></div>
        <div className="kv"><dt>Listed on</dt><dd>{dateStr(l.createdAt)}</dd></div>
        <div className="kv"><dt>Farmer</dt><dd>{farmer?.name}</dd></div>
        <div className="kv"><dt>Location</dt><dd>{farmer?.place ? `${farmer.place}, ` : ''}{farmer?.district}, {farmer?.state}</dd></div>
      </dl>

      {l.description && (
        <div>
          <p className="field-label">Notes from the farmer</p>
          <p className="lot-desc">{l.description}</p>
        </div>
      )}

      <div className="bids">
        <p className="field-label">{bids.length ? `Bid history · ${bids.length} bid${bids.length > 1 ? 's' : ''}` : 'Bid history'}</p>
        {bids.length ? (
          <ul>
            {bids.map((b) => (
              <li key={b.id}>
                <span>
                  <strong>{money(b.amount)}</strong>/{unit}
                  <span className="muted"> · {b.buyerId === me.id ? 'You' : 'Another buyer'}</span>
                </span>
                <span className="muted small">{dateTimeStr(b.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No bids placed yet — be the first.</p>
        )}
      </div>
    </Modal>
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

function WonLots({ lots }) {
  if (!lots.length) {
    return <div className="card empty">No pending purchases — accepted bids will show up here so you can complete the purchase.</div>;
  }

  const rows = [...lots].sort((a, b) => (b.soldAt || 0) - (a.soldAt || 0));

  return (
    <div className="stack">
      {rows.map((l) => {
        const farmer = userById(l.farmerId);
        const accepted = l.bids.find((b) => b.id === l.acceptedBidId);
        const unit = l.unit.toLowerCase();
        return (
          <article key={l.id} className="card listing-row">
            <div className="listing-title">
              <h3>{l.crop}{l.variety && <small> · {l.variety}</small>} <span className="muted small">— {l.quantity} {unit}</span></h3>
              <StatusBadge status="purchase-pending" />
            </div>
            <p className="meta">
              Won at {money(accepted.amount)}/{unit} · Lot value <strong>{money(accepted.amount * l.quantity)}</strong> ·
              {' '}{l.grade} · Sold {dateStr(l.soldAt)}
            </p>
            <p className="highlight ok">
              🎉 Contact <strong>{farmer?.name}</strong> — 📞 {farmer?.phone} · {farmer?.place ? `${farmer.place}, ` : ''}{farmer?.district}, {farmer?.state}
            </p>
            <div className="row-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => confirm(
                  `Confirm you've completed the purchase of ${l.quantity} ${unit} of ${l.crop} from ${farmer?.name} for `
                  + `${money(accepted.amount * l.quantity)}?`,
                ) && confirmPurchase(l.id).catch((err) => alert(err.message))}
              >
                Confirm purchase
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PurchaseHistory({ lots }) {
  if (!lots.length) {
    return <div className="card empty">No completed purchases yet — confirmed purchases from "Won lots" will show up here.</div>;
  }

  const rows = [...lots].sort((a, b) => (b.purchaseConfirmedAt || 0) - (a.purchaseConfirmedAt || 0));

  return (
    <div className="stack">
      {rows.map((l) => {
        const farmer = userById(l.farmerId);
        const accepted = l.bids.find((b) => b.id === l.acceptedBidId);
        const unit = l.unit.toLowerCase();
        return (
          <article key={l.id} className="card listing-row">
            <div className="listing-title">
              <h3>{l.crop}{l.variety && <small> · {l.variety}</small>} <span className="muted small">— {l.quantity} {unit}</span></h3>
              <StatusBadge status="purchase-done" />
            </div>
            <p className="meta">
              Bought at {money(accepted.amount)}/{unit} · Lot value <strong>{money(accepted.amount * l.quantity)}</strong> ·
              {' '}{l.grade} · From <strong>{farmer?.name}</strong>, {farmer?.district}, {farmer?.state}
            </p>
            <p className="muted small">Purchase confirmed on {dateStr(l.purchaseConfirmedAt)}.</p>
          </article>
        );
      })}
    </div>
  );
}
