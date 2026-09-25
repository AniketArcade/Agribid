import { useState } from 'react';
import { approveListing, cancelListing, useApp, userById } from '../lib/store';
import { GRADES } from '../lib/constants';
import { money } from '../lib/format';

export default function AuthorityHome() {
  const { db } = useApp();
  const count = (role) => db.users.filter((u) => u.role === role).length;
  const pending = db.listings.filter((l) => l.status === 'pending');
  const approved = db.listings.filter((l) => l.grade && l.status !== 'pending');

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Authority dashboard</h1>
          <p className="muted">Review new listings and assign quality grades before they go live.</p>
        </div>
      </section>
      <section className="stats">
        <div className="card stat"><span>Farmers</span><strong>{count('farmer')}</strong></div>
        <div className="card stat"><span>Buyers</span><strong>{count('buyer')}</strong></div>
        <div className="card stat"><span>Listings</span><strong>{db.listings.length}</strong></div>
        <div className="card stat"><span>Pending approval</span><strong>{pending.length}</strong></div>
      </section>

      <section className="card">
        <h2>Pending approval</h2>
        {pending.length ? (
          <div className="stack">
            {pending.map((l) => <PendingRow key={l.id} l={l} />)}
          </div>
        ) : (
          <p className="muted small">No listings waiting for approval.</p>
        )}
      </section>

      {approved.length > 0 && (
        <section className="card">
          <h2>Recently approved</h2>
          <div className="stack">
            {approved.slice(0, 10).map((l) => {
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
        </section>
      )}
    </>
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
