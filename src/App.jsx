import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import FarmerOnboarding from './pages/FarmerOnboarding';
import FarmerHome from './pages/FarmerHome';
import BuyerHome from './pages/BuyerHome';
import Profile from './pages/Profile';
import AuthorityHome from './pages/AuthorityHome';
import AuthorityPricing from './pages/AuthorityPricing';
import RequireRole from './components/RequireRole';
import AppLayout from './components/AppLayout';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/farmer/login" element={<AuthPage role="farmer" mode="login" />} />
      <Route path="/farmer/signup" element={<AuthPage role="farmer" mode="signup" />} />
      <Route path="/buyer/login" element={<AuthPage role="buyer" mode="login" />} />
      <Route path="/buyer/signup" element={<AuthPage role="buyer" mode="signup" />} />
      <Route path="/authority/login" element={<AuthPage role="authority" mode="login" />} />

      <Route
        path="/farmer/onboarding"
        element={<RequireRole role="farmer" allowIncomplete><FarmerOnboarding /></RequireRole>}
      />

      <Route element={<AppLayout />}>
        <Route path="/farmer" element={<RequireRole role="farmer"><FarmerHome /></RequireRole>} />
        <Route path="/buyer" element={<RequireRole role="buyer"><BuyerHome /></RequireRole>} />
        <Route path="/authority" element={<RequireRole role="authority"><AuthorityHome /></RequireRole>} />
        <Route path="/authority/pricing" element={<RequireRole role="authority"><AuthorityPricing /></RequireRole>} />
        <Route path="/profile" element={<RequireRole><Profile /></RequireRole>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
