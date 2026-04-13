import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''} ${isHome ? 'navbar-home' : ''}`}>
      <div className="navbar-inner">
        <Link to={user ? '/dashboard' : '/'} className="navbar-logo" aria-label="DrFahm home">
          <span className="navbar-logo-mark">
            <span className="logo-dr">Dr</span>
            <span className="logo-fahm">Fahm</span>
          </span>
          <span className="navbar-logo-tag">Saudi exam prep</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {!user || isHome ? (
            <>
              <Link
                to="/schools"
                className={`nav-link ${isActive('/schools') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Schools
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
                    className="nav-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    Log in
                  </Link>

                  <Link
                    to="/register"
                    className="btn btn-green btn-sm navbar-try-btn navbar-primary-cta"
                    onClick={() => setMenuOpen(false)}
                  >
                    Start free
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