import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isHome = location.pathname === '/';
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navClass = [
    'navbar',
    isHome ? 'navbar-home' : '',
    scrolled ? 'scrolled' : '',
  ].join(' ').trim();

  return (
    <nav className={navClass}>
      <div className="navbar-inner">
        <Link to={user ? '/dashboard' : '/'} className="navbar-logo" aria-label="DrFahm home">
          <span className="logo-dr">Dr</span>
          <span className="logo-fahm">Fahm</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {!user || isHome ? (
            <>
              <Link
                to="/schools"
                className={`nav-link ${isActive('/schools') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                For Schools
              </Link>

              <Link
                to="/pricing"
                className={`nav-link ${isActive('/pricing') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>

              {user ? (
                <Link
                  to="/dashboard"
                  className="btn btn-green btn-sm navbar-try-btn"
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="nav-link nav-link-login"
                    onClick={() => setMenuOpen(false)}
                  >
                    Log In
                  </Link>

                  <Link
                    to="/register"
                    className="btn btn-green btn-sm navbar-try-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    Start Free
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <Link
                to="/dashboard"
                className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>

              {user.role === 'drfahm_admin' && (
                <Link
                  to="/admin"
                  className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </Link>
              )}

              <span className="nav-username">{user.username}</span>

              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>

        <button
          className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}