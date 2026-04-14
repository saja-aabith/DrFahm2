import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogoFull } from './LogoSVG';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isHome   = location.pathname === '/';
  const isActive = (path) => location.pathname === path;

  /**
   * Home page always has a dark background (transparent or dark-frosted).
   * All other pages: white frosted.
   */
  const isDark = isHome;

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navClass = [
    'navbar',
    isHome             ? 'navbar-home'     : '',
    isHome && scrolled ? 'navbar-scrolled' : '',
    !isHome            ? 'navbar-scrolled' : '',
  ].filter(Boolean).join(' ');

  // ── Logo colors ─────────────────────────────────────────────────────────────
  // Dark (home): D = bright #4ADE80, F = white, text = white, dot = #4ADE80
  // Light (other pages): D = brand green, F = navy, text = navy, dot = brand green
  const logoProps = isDark
    ? { dColor: '#4ADE80', fColor: '#FFFFFF', textColor: '#FFFFFF', dotColor: '#4ADE80' }
    : { dColor: '#1F7A3E', fColor: '#0F2233', textColor: '#0F2233', dotColor: '#1F7A3E' };

  return (
    <nav className={navClass} aria-label="Main navigation">
      <div className="navbar-inner">

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <Link
          to={user ? '/dashboard' : '/'}
          className="navbar-logo-link"
          aria-label="DrFahm — go to homepage"
        >
          <LogoFull height={30} {...logoProps} />
        </Link>

        {/* ── Links ────────────────────────────────────────────────── */}
        <div className={`navbar-links ${menuOpen ? 'open' : ''}`} role="menu">

          {(!user || isHome) ? (
            <>
              <Link
                to="/schools"
                className={`nav-link ${isDark ? 'nav-link-dark' : ''} ${isActive('/schools') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
                role="menuitem"
              >
                For Schools
              </Link>

              <Link
                to="/pricing"
                className={`nav-link ${isDark ? 'nav-link-dark' : ''} ${isActive('/pricing') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
                role="menuitem"
              >
                Pricing
              </Link>

              {user ? (
                <Link
                  to="/dashboard"
                  className={`nav-cta-btn ${isDark ? 'nav-cta-dark' : ''}`}
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                >
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`nav-link ${isDark ? 'nav-link-dark' : ''}`}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className={`nav-cta-btn ${isDark ? 'nav-cta-dark' : ''}`}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    Start Free →
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
                role="menuitem"
              >
                Dashboard
              </Link>

              {user.role === 'drfahm_admin' && (
                <Link
                  to="/admin"
                  className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                >
                  Admin
                </Link>
              )}

              <span className="nav-username">{user.username}</span>

              <button className="nav-logout-btn" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>

        {/* ── Hamburger ────────────────────────────────────────────── */}
        <button
          className={`nav-hamburger ${menuOpen ? 'open' : ''} ${isDark ? 'nav-hamburger-dark' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div
          className="nav-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </nav>
  );
}