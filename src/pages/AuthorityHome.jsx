import { useApp } from '../lib/store';

export default function AuthorityHome() {
  const { db } = useApp();
  const count = (role) => db.users.filter((u) => u.role === role).length;

  return (
    <>
      <section className="page-head">
        <div>
          <h1>Authority dashboard</h1>
          <p className="muted">Oversight tools are coming soon.</p>
        </div>
      </section>
      <section className="stats">
        <div className="card stat"><span>Farmers</span><strong>{count('farmer')}</strong></div>
        <div className="card stat"><span>Buyers</span><strong>{count('buyer')}</strong></div>
        <div className="card stat"><span>Listings</span><strong>{db.listings.length}</strong></div>
      </section>
      <div className="card empty">🚧 Verification, trade monitoring and dispute handling will live here.</div>
    </>
  );
}
