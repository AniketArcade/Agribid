import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo">
      <span className="logo-mark" aria-hidden>🌾</span>
      <span>Agri<b>Bid</b></span>
    </Link>
  );
}
