// src/components/NavBar.tsx
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import '../styles/NavBar.css';

const navItems = [
  { to: '/',           label: 'Home' },
  { to: '/table',      label: 'Summary' },
  { to: '/series',     label: 'Series View' },
  { to: '/investors',  label: 'Investor View' },
  { to: '/aliyagpt',   label: 'AliyaGPT' },
  {to: '/chat', label: 'ChatGPT'},
];

export default function NavBar() {
  const { pathname } = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  // track scroll to toggle “scrolled” class
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // split nav items for left/right sections
  const mid = Math.ceil(navItems.length / 2);
  const leftNav = navItems.slice(0, mid);
  const rightNav = navItems.slice(mid);

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="container">
        {/* Left links */}
        <div className="nav-left">
          {leftNav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${pathname === to ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Center logo */}
        <div className="logo">
          <Link to="/">
            <img src="/logo-aliya.png" alt="Aliya Capital Partners" />
          </Link>
        </div>

        {/* Right links */}
        <div className="nav-right">
          {rightNav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${pathname === to ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Mobile menu button */}
        <button type="button" className="mobile-menu-btn">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </nav>
  );
}
