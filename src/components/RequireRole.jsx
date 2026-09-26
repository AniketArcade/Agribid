import { Navigate } from 'react-router-dom';
import { justLoggedOut, useApp } from '../lib/store';

/** Gates a page on being logged in (optionally as a given role) with a complete profile. */
export default function RequireRole({ role, allowIncomplete = false, children }) {
  const { me, loading } = useApp();
  // Session/profile fetch is async now (was instant with localStorage) — wait for
  // it to resolve before redirecting, so a logged-in user isn't briefly bounced
  // to the login page on refresh.
  if (loading) return null;
  if (!me) return <Navigate to={role && !justLoggedOut() ? `/${role}/login` : '/'} replace />;
  if (role && me.role !== role) return <Navigate to={`/${me.role}`} replace />;
  if (!allowIncomplete && me.role === 'farmer' && !me.profileComplete) {
    return <Navigate to="/farmer/onboarding" replace />;
  }
  return children;
}
