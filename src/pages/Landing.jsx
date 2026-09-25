import { Link, Navigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useApp } from '../lib/store';

const ROLES = [
  {
    key: 'farmer', icon: '👨‍🌾', title: 'I am a Farmer',
    text: 'List your harvest, let verified buyers compete, and accept the best price.',
    points: ['Free to list crops', 'See every bid live', 'You choose who to sell to'],
  },
  {
    key: 'buyer', icon: '🏪', title: 'I am a Buyer',
    text: 'Traders, mills and exporters — source directly from farms through open bidding.',
    points: ['Browse lots across states', 'Transparent bid history', 'Buy direct from farmers'],
  },
];

const STEPS = [
  ['Farmer lists a lot', 'Crop, quantity, grade and a base price.'],
  ['Buyers place bids', 'Each bid must beat the current highest.'],
  ['Farmer accepts', 'Pick the winning bid; both sides get contact details.'],
];

export default function Landing() {
  const { me } = useApp();
  if (me) return <Navigate to={`/${me.role}`} replace />;

  return (
    <div className="landing">
      <header className="container landing-nav">
        <Logo />
        <Link to="/authority/login" className="btn btn-ghost btn-sm">🏛️ Authority login</Link>
      </header>

      <section className="container hero">
        <span className="eyebrow">Direct farm-to-buyer crop auctions</span>
        <h1>Fair prices for every harvest, <em>decided by open bidding.</em></h1>
        <p className="lead">
          AgriBid connects farmers directly with traders and buyers. No middlemen,
          no hidden margins — just transparent bids on real produce.
        </p>
      </section>

      <section className="container role-grid">
        {ROLES.map((r) => (
          <article key={r.key} className={`card role-card role-${r.key}`}>
            <div className="role-icon" aria-hidden>{r.icon}</div>
            <h2>{r.title}</h2>
            <p>{r.text}</p>
            <ul className="checks">{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
            <div className="role-actions">
              <Link to={`/${r.key}/signup`} className="btn btn-primary">Sign up</Link>
              <Link to={`/${r.key}/login`} className="btn btn-outline">Log in</Link>
            </div>
          </article>
        ))}
        <article className="card role-card role-authority">
          <div className="role-icon" aria-hidden>🏛️</div>
          <h2>Authority</h2>
          <p>For APMC / agriculture department officials to oversee trades and verify participants.</p>
          <div className="role-actions">
            <Link to="/authority/login" className="btn btn-outline">Authority login</Link>
          </div>
        </article>
      </section>

      <section className="container how">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <span className="step-num">{i + 1}</span>
              <div><strong>{t}</strong><p>{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="container footer">© {new Date().getFullYear()} AgriBid · Prototype</footer>
    </div>
  );
}
