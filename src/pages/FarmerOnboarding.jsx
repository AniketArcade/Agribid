import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Field from '../components/Field';
import LandFields, { newLand } from '../components/LandFields';
import { updateUser, useApp } from '../lib/store';
import { STATES } from '../lib/constants';

export default function FarmerOnboarding() {
  const { me } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [info, setInfo] = useState({
    name: me.name || '', place: me.place || '', state: me.state || '',
    district: me.district || '', phone: me.phone || '',
  });
  const [lands, setLands] = useState(me.lands?.length ? me.lands : [newLand()]);
  const set = (k) => (e) => setInfo((f) => ({ ...f, [k]: e.target.value }));

  function nextStep(e) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(info.phone.trim())) return setError('Enter a valid 10-digit mobile number.');
    setError('');
    setStep(2);
  }

  function finish(e) {
    e.preventDefault();
    updateUser(me.id, {
      ...info,
      phone: info.phone.trim(),
      lands: lands.map((l) => ({ ...l, acres: Number(l.acres) })),
      profileComplete: true,
    });
    navigate('/farmer');
  }

  return (
    <div className="auth-shell">
      <header className="container landing-nav"><Logo /></header>
      <div className="card auth-card auth-wide">
        <ol className="stepper">
          <li className={step >= 1 ? 'on' : ''}><span>1</span> Your details</li>
          <li className={step >= 2 ? 'on' : ''}><span>2</span> Your land</li>
        </ol>

        {step === 1 ? (
          <form className="form" onSubmit={nextStep}>
            <h1>Tell us about yourself</h1>
            <Field label="Full name" value={info.name} onChange={set('name')} required autoFocus />
            <Field label="Village / town" value={info.place} onChange={set('place')} required />
            <div className="grid-2">
              <Field label="State" as="select" value={info.state} onChange={set('state')} required>
                <option value="">Select state</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </Field>
              <Field label="District" value={info.district} onChange={set('district')} required />
            </div>
            <Field label="Phone number" inputMode="numeric" maxLength={10}
              value={info.phone} onChange={set('phone')} required
              hint="Buyers will see this only after you accept their bid." />
            {error && <p className="alert">{error}</p>}
            <button className="btn btn-primary btn-block">Next: land details →</button>
          </form>
        ) : (
          <form className="form" onSubmit={finish}>
            <h1>Your farm land</h1>
            <p className="muted">Add each piece of land you cultivate.</p>
            <LandFields lands={lands} onChange={setLands} />
            <div className="row-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary">Finish & go to dashboard</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
