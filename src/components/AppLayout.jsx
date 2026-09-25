import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { logout, useApp } from '../lib/store';
import { initials } from '../lib/format';

const ROLE_LABEL = { farmer: 'Farmer', buyer: 'Buyer', authority: 'Authority' };

export default function AppLayout() {
  const { me } = useApp();
  const navigate = useNavigate();
  const home = me ? `/${me.role}` : '/';

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <Logo to={home} />
          {me && (
            <nav className="topnav">
              <NavLink to={home} end>
                {me.role === 'buyer' ? 'Marketplace' : 'Dashboard'}
              </NavLink>
              <NavLink to="/profile" className="profile-btn" title="Profile">
                <span className="avatar">{initials(me.name || me.traderName)}</span>
                <span className="profile-text">
                  <span>{me.name || 'Profile'}</span>
                  <small>{ROLE_LABEL[me.role]}</small>
                </span>
              </NavLink>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { logout(); navigate('/'); }}
              >
                Log out
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className="container page">
        <Outlet />
      </main>
    </div>
  );
}
