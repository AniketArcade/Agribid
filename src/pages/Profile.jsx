import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Field from '../components/Field';
import LandFields from '../components/LandFields';
import { logout, resetDemo, updateUser, useApp } from '../lib/store';
import { CROPS, STATES } from '../lib/constants';
import { dateStr, initials } from '../lib/format';

export default function Profile() {
  const { me } = useApp();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  return (
    <div className="profile">
      <section className="card profile-head">
        <span className="avatar lg">{initials(me.name || me.traderName)}</span>
        <div>
          <h1>{me.name}</h1>
          <p className="muted">
            {me.role === 'buyer' ? me.traderName : me.role[0].toUpperCase() + me.role.slice(1)}
            {' '}· Member since {dateStr(me.createdAt)}
          </p>
        </div>
        {me.role !== 'authority' && !editing && (
          <button className="btn btn-outline btn-sm push-right" onClick={() => setEditing(true)}>Edit profile</button>
        )}
      </section>

      {editing ? (
        <EditForm me={me} onDone={() => setEditing(false)} />
      ) : (
        <ProfileView me={me} />
      )}

      <section className="card danger-zone">
        <button className="btn btn-ghost" onClick={() => { logout(); navigate('/'); }}>Log out</button>
        <button
          className="link-btn muted"
          onClick={() => {
            if (confirm('Reset all prototype data (users, listings, bids) to the demo seed?')) {
              resetDemo();
              navigate('/');
            }
          }}
        >
          Reset demo data
        </button>
      </section>
    </div>
  );
}

function Row({ label, children }) {
  return <div className="kv"><dt>{label}</dt><dd>{children || '—'}</dd></div>;
}

function ProfileView({ me }) {
  if (me.role === 'farmer') {
    const total = (me.lands || []).reduce((s, l) => s + Number(l.acres || 0), 0);
    return (
      <>
        <section className="card">
          <h2>Personal details</h2>
          <dl className="kv-grid">
            <Row label="Name">{me.name}</Row>
            <Row label="Phone">{me.phone}</Row>
            <Row label="Village / town">{me.place}</Row>
            <Row label="District">{me.district}</Row>
            <Row label="State">{me.state}</Row>
          </dl>
        </section>
        <section className="card">
          <h2>Land <span className="muted small">· {total} acres total</span></h2>
          <div className="land-cards">
            {(me.lands || []).map((l, i) => (
              <div key={l.id} className="land-card">
                <strong>Land {i + 1} · {l.acres} acres</strong>
                <span>{l.location}</span>
                <span className="muted small">{l.area}</span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }
  if (me.role === 'buyer') {
    return (
      <section className="card">
        <h2>Business details</h2>
        <dl className="kv-grid">
          <Row label="Trader / firm">{me.traderName}</Row>
          <Row label="Contact person">{me.name}</Row>
          <Row label="Phone">{me.phone}</Row>
          <Row label="Address">{me.location}</Row>
          <Row label="District">{me.district}</Row>
          <Row label="State">{me.state}</Row>
          <Row label="Licence / GSTIN">{me.license}</Row>
          <Row label="Buys">{me.interests?.join(', ')}</Row>
        </dl>
      </section>
    );
  }
  return (
    <section className="card">
      <dl className="kv-grid"><Row label="Official ID">{me.phone}</Row></dl>
    </section>
  );
}

function EditForm({ me, onDone }) {
  const [f, setF] = useState({ ...me, interests: me.interests || [], lands: me.lands || [] });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  function save(e) {
    e.preventDefault();
    const { id, role, password, createdAt, ...patch } = f;
    if (role === 'farmer') patch.lands = f.lands.map((l) => ({ ...l, acres: Number(l.acres) }));
    updateUser(me.id, patch);
    onDone();
  }

  return (
    <form className="card form" onSubmit={save}>
      <h2>Edit profile</h2>
      <div className="grid-2">
        <Field label="Full name" value={f.name || ''} onChange={set('name')} required />
        {me.role === 'buyer'
          ? <Field label="Trader / firm name" value={f.traderName || ''} onChange={set('traderName')} required />
          : <Field label="Village / town" value={f.place || ''} onChange={set('place')} required />}
      </div>
      {me.role === 'buyer' && (
        <Field label="Business address / market yard" value={f.location || ''} onChange={set('location')} required />
      )}
      <div className="grid-2">
        <Field label="State" as="select" value={f.state || ''} onChange={set('state')} required>
          <option value="">Select state</option>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </Field>
        <Field label="District" value={f.district || ''} onChange={set('district')} required />
      </div>
      {me.role === 'buyer' && (
        <>
          <Field label="Trade licence / GSTIN" value={f.license || ''} onChange={set('license')} />
          <div className="field">
            <span className="field-label">Crops you usually buy</span>
            <div className="chips">
              {CROPS.filter((c) => c !== 'Other').map((c) => (
                <button type="button" key={c}
                  className={`chip ${f.interests.includes(c) ? 'chip-on' : ''}`}
                  onClick={() => setF((s) => ({
                    ...s,
                    interests: s.interests.includes(c) ? s.interests.filter((x) => x !== c) : [...s.interests, c],
                  }))}>{c}</button>
              ))}
            </div>
          </div>
        </>
      )}
      {me.role === 'farmer' && (
        <>
          <h2>Land</h2>
          <LandFields lands={f.lands} onChange={(lands) => setF((s) => ({ ...s, lands }))} />
        </>
      )}
      <div className="row-actions">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary">Save changes</button>
      </div>
    </form>
  );
}
