import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Field from '../components/Field';
import { login, signup, useApp } from '../lib/store';
import { CROPS, STATES } from '../lib/constants';

const COPY = {
  farmer: { icon: '👨‍🌾', name: 'Farmer' },
  buyer: { icon: '🏪', name: 'Buyer' },
  authority: { icon: '🏛️', name: 'Authority' },
};

const EMPTY_BUYER = {
  name: '', traderName: '', location: '', state: '', district: '', license: '', interests: [],
};

export default function AuthPage({ role, mode }) {
  const { me } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: '', password: '', confirm: '', place: '', ...EMPTY_BUYER });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Set once this form logs someone in, so the "already logged in" redirect below
  // doesn't race the navigate() call in submit().
  const submitted = useRef(false);

  if (me && !submitted.current) return <Navigate to={`/${me.role}`} replace />;

  const isSignup = mode === 'signup';
  const isAuthority = role === 'authority';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleInterest = (crop) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(crop) ? f.interests.filter((c) => c !== crop) : [...f.interests, crop],
    }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (!isSignup) {
        setSubmitting(true);
        await login({ role, phone: form.phone, password: form.password });
        submitted.current = true;
        navigate(`/${role}`);
        return;
      }
      if (!isAuthority && !/^[6-9]\d{9}$/.test(form.phone.trim())) {
        throw new Error('Enter a valid 10-digit mobile number.');
      }
      if (form.password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (form.password !== form.confirm) throw new Error('Passwords do not match.');

      setSubmitting(true);
      if (role === 'farmer') {
        const { phone, password, name, place, state, district } = form;
        await signup({ role, phone, password, name, place, state, district });
        submitted.current = true;
        navigate('/farmer/onboarding');
      } else {
        const { phone, password, name, traderName, location, state, district, license, interests } = form;
        await signup({ role, phone, password, name, traderName, location, state, district, license, interests });
        submitted.current = true;
        navigate('/buyer');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const { icon, name } = COPY[role];

  return (
    <div className="auth-shell">
      <header className="container landing-nav"><Logo /></header>
      <div className={`card auth-card ${(role === 'buyer' || role === 'farmer') && isSignup ? 'auth-wide' : ''}`}>
        <div className="auth-head">
          <span className="role-icon sm" aria-hidden>{icon}</span>
          <div>
            <h1>{isSignup ? `Create ${name.toLowerCase()} account` : `${name} login`}</h1>
            <p className="muted">
              {isAuthority
                ? 'Restricted to authorised officials.'
                : isSignup && role === 'farmer'
                  ? "Tell us about yourself — we'll ask for farm details next."
                  : isSignup
                    ? 'Tell us about your trading business.'
                    : 'Welcome back.'}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="form">
          {role === 'farmer' && isSignup && (
            <>
              <Field label="Full name" value={form.name} onChange={set('name')} required autoFocus />
              <Field label="Village / locality" value={form.place} onChange={set('place')} required />
              <div className="grid-2">
                <Field label="State" as="select" value={form.state} onChange={set('state')} required>
                  <option value="">Select state</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </Field>
                <Field label="District" value={form.district} onChange={set('district')} required />
              </div>
            </>
          )}
          {role === 'buyer' && isSignup && (
            <>
              <div className="grid-2">
                <Field label="Your full name" value={form.name} onChange={set('name')} required />
                <Field label="Trader / firm name" value={form.traderName} onChange={set('traderName')} required
                  placeholder="e.g. Mehta Agro Traders" />
              </div>
              <Field label="Business address / market yard" value={form.location} onChange={set('location')} required />
              <div className="grid-2">
                <Field label="State" as="select" value={form.state} onChange={set('state')} required>
                  <option value="">Select state</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </Field>
                <Field label="District" value={form.district} onChange={set('district')} required />
              </div>
              <Field label="Trade licence / GSTIN" hint="Optional — helps farmers trust you."
                value={form.license} onChange={set('license')} />
              <div className="field">
                <span className="field-label">Crops you usually buy</span>
                <div className="chips">
                  {CROPS.filter((c) => c !== 'Other').map((c) => (
                    <button type="button" key={c}
                      className={`chip ${form.interests.includes(c) ? 'chip-on' : ''}`}
                      onClick={() => toggleInterest(c)}>{c}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Field
            label={isAuthority ? 'Official ID' : 'Mobile number'}
            value={form.phone} onChange={set('phone')} required
            inputMode={isAuthority ? 'text' : 'numeric'}
            placeholder={isAuthority ? 'e.g. AUTH001' : '10-digit mobile number'}
            maxLength={isAuthority ? 20 : 10}
          />
          <div className={isSignup ? 'grid-2' : ''}>
            <Field label="Password" type="password" value={form.password} onChange={set('password')} required />
            {isSignup && (
              <Field label="Confirm password" type="password" value={form.confirm} onChange={set('confirm')} required />
            )}
          </div>

          {error && <p className="alert">{error}</p>}

          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Please wait…' : isSignup ? (role === 'farmer' ? 'Continue' : 'Create account') : 'Log in'}
          </button>
        </form>

        {!isAuthority && (
          <p className="auth-switch">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <Link to={`/${role}/${isSignup ? 'login' : 'signup'}`}>
              {isSignup ? 'Log in' : `Sign up as a ${name.toLowerCase()}`}
            </Link>
          </p>
        )}
        <p className="auth-switch"><Link to="/">← Back to home</Link></p>
      </div>
    </div>
  );
}
