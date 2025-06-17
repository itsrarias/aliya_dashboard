import { Link, useLocation } from 'react-router-dom';
import '../styles/NavBar.css';               // optional; see sample styles below

const navItems = [
  { to: '/',           label: 'Home' },
  { to: '/table',      label: 'Summary' },
  { to: '/series',     label: 'Series View' },
  { to: '/investors',  label: 'Investor View' },
  { to: '/aliyagpt',   label: 'AliyaGPT' },
];

export default function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <ul>
        {navItems.map(({ to, label }) => (
          <li key={to} className={pathname === to ? 'active' : undefined}>
            <Link to={to}>{label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
