import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Sign out → home page, not login
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  // On the homepage, always show the public (marketing) nav.
  // Logged-in users on / get a single "Dashboard →" button instead of
  // the full internal nav — avoids destroying homepage trust signals.
  const isHome = location.pathname === '/';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to={user ? '/dashboard' : '/'} className="navbar-logo">
          <span className="logo-dr">Dr</span>
          <span className="logo-fahm">Fahm</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {!user || isHome ? (
            /* ── Public / homepage nav ── */
            <>
              <Link
                to="/schools"
                className={`nav-link ${isActive('/schools') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                We are a School
              </Link>
              <Link
                to="/pricing"
                className={`nav-link ${isActive('/pricing') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>

              {user ? (
                /* Logged-in user visiting homepage: one clean button */
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
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-green btn-sm navbar-try-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    Try Now
                  </Link>
                </>
              )}
            </>
          ) : (
            /* ── Authenticated app nav (non-homepage) ── */
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
          className="nav-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}