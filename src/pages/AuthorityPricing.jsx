import { useState } from 'react';
import { Link } from 'react-router-dom';
import { setCropPrice, useApp } from '../lib/store';
import { CROPS } from '../lib/constants';
import { money } from '../lib/format';

export default function AuthorityPricing() {
  const { db } = useApp();
  const crops = CROPS.filter((c) => c !== 'Other');

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Crop pricing</h1>
          <p className="muted">Set the base price (₹ per quintal) farmers see when they list each crop.</p>
        </div>
        <Link to="/authority" className="btn btn-ghost btn-sm">← Back to dashboard</Link>
      </section>

      <section className="card">
        <div className="stack">
          {crops.map((crop) => <PriceRow key={crop} crop={crop} price={db.prices[crop]} />)}
        </div>
      </section>
    </>
  );
}

function PriceRow({ crop, price }) {
  const [value, setValue] = useState(price ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = Number(value) !== Number(price || 0);

  async function save(e) {
    e.preventDefault();
    if (!(Number(value) > 0)) return;
    setSaving(true);
    try {
      await setCropPrice(crop, value);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="listing-row" onSubmit={save}>
      <div className="listing-title">
        <h3>{crop}</h3>
        <span className="muted small">
          {price ? `Current: ${money(price)}/quintal` : 'No price set yet'}
        </span>
      </div>
      <div className="row-actions">
        <input
          type="number" min="1" step="1" value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="₹ per quintal"
        />
        <button className="btn btn-primary btn-sm" disabled={saving || !dirty || !(Number(value) > 0)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
