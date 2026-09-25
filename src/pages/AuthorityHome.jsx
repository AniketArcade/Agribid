import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  acceptBid, approveListing, cancelListing, highestBid, listingStatus, useApp, userById,
} from '../lib/store';
import { GRADES } from '../lib/constants';
import { dateTimeStr, money } from '../lib/format';
import useNow from '../lib/useNow';

export default function AuthorityHome() {
  const { db } = useApp();
  const now = useNow();
  const count = (role) => db.users.filter((u) => u.role === role).length;
  const pending = db.listings.filter((l) => l.status === 'pending');
  const ended = (l) => l.grade && l.status === 'open' && listingStatus(l, now) === 'ended';
  const awaiting = db.listings.filter(ended).sort((a, b) => a.endsAt - b.endsAt);
  const approved = db.listings
    .filter((l) => l.grade && l.status !== 'pending' && !ended(l))
    .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0));

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Authority dashboard</h1>
          <p className="muted">Review new listings and assign quality grades before they go live.</p>
        </div>
        <Link to="/authority/pricing" className="btn btn-outline">Set crop prices</Link>
      </section>
      <section className="stats">
        <div className="card stat"><span>Farmers</span><strong>{count('farmer')}</strong></div>
        <div className="card stat"><span>Buyers</span><strong>{count('buyer')}</strong></div>
        <div className="card stat"><span>Listings</span><strong>{db.listings.length}</strong></div>
        <div className="card stat"><span>Pending approval</span><strong>{pending.length}</strong></div>
        <div className="card stat"><span>Awaiting decision</span><strong>{awaiting.length}</strong></div>
      </section>

      <section className="card">
        <h2>Awaiting decision</h2>
        <p className="muted small">Bidding has closed on these lots — approve the highest bid to mark them sold.</p>
        {awaiting.length ? (
          <div className="stack">
            {awaiting.map((l) => <AwaitingRow key={l.id} l={l} />)}
          </div>
        ) : (
          <div className="empty">No lots awaiting a decision right now.</div>
        )}
      </section>

      <div className="approval-columns">
        <section className="card">
          <h2>Pending approval</h2>
          {pending.length ? (
            <div className="stack">
              {pending.map((l) => <PendingRow key={l.id} l={l} />)}
            </div>
          ) : (
            <div className="empty">No listings waiting for approval.</div>
          )}
        </section>

        <section className="card">
          <h2>Approved listings</h2>
          {approved.length ? (
            <div className="stack">
              {approved.map((l) => {
                const farmer = userById(l.farmerId);
                return (
                  <div key={l.id} className="listing-title">
                    <h3>
                      {l.crop}{l.variety && <small> · {l.variety}</small>}
                      <span className="muted small"> — {farmer?.name}</span>
                    </h3>
                    <span className="muted small">{l.grade}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">No listings approved yet.</div>
          )}
        </section>
      </div>
    </>
  );
}

function AwaitingRow({ l }) {
  const farmer = userById(l.farmerId);
  const top = highestBid(l);
  const unit = l.unit.toLowerCase();

  return (
    <div className="card listing-row">
      <div className="listing-title">
        <h3>
          {l.crop}{l.variety && <small> · {l.variety}</small>}
          <span className="muted small"> — {farmer?.name}, {farmer?.district}</span>
        </h3>
      </div>
      <p className="meta">
        {l.quantity} {unit} · {l.grade} · Base {money(l.basePrice)}/{unit} · Bidding ended {dateTimeStr(l.endsAt)}
      </p>
      {top ? (
        <>
          <p className="highlight">
            Highest bid <strong>{money(top.amount)}</strong>/{unit} = {money(top.amount * l.quantity)} total
            {' '}· {l.bids.length} bid{l.bids.length > 1 ? 's' : ''}
          </p>
          <div className="row-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => confirm(
                `Approve the highest bid of ${money(top.amount)}/${unit} (${money(top.amount * l.quantity)} total) and mark this lot sold?`,
              ) && acceptBid(l.id, top.id)}
            >
              Approve winning bid
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">No bids were received before bidding closed.</p>
          <div className="row-actions">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => confirm('Withdraw this listing since no bids were received?') && cancelListing(l.id)}
            >
              Withdraw
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PendingRow({ l }) {
  const farmer = userById(l.farmerId);
  const [grade, setGrade] = useState('');

  return (
    <div className="card listing-row">
      <div className="listing-title">
        <h3>
          {l.crop}{l.variety && <small> · {l.variety}</small>}
          <span className="muted small"> — {farmer?.name}, {farmer?.district}</span>
        </h3>
      </div>
      <p className="meta">
        {l.quantity} {l.unit.toLowerCase()} · Base {money(l.basePrice)}/{l.unit.toLowerCase()} ·
        {' '}Bidding runs {l.durationDays} day{l.durationDays > 1 ? 's' : ''} once approved
      </p>
      <div className="row-actions">
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Select grade</option>
          {GRADES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => confirm('Reject and withdraw this listing?') && cancelListing(l.id)}
        >
          Reject
        </button>
        <button className="btn btn-primary btn-sm" disabled={!grade} onClick={() => approveListing(l.id, grade)}>
          Approve & go live
        </button>
      </div>
    </div>
  );
}
