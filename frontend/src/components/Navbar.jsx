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
   * isDark = true whenever the navbar sits over a dark background.
   *
   * Home page: ALWAYS dark — whether transparent (unscrolled) or dark-frosted
   * (scrolled). Both states have a dark background so we always need white text.
   *
   * All other pages: always light frosted — dark text.
   */
  const isDark = isHome;

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Scroll listener — drives CSS classes for background transition
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu open
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
    !isHome            ? 'navbar-scrolled' : '',   // always show shadow on other pages
  ].filter(Boolean).join(' ');

  // Logo colors
  const markColor = isDark ? '#4ADE80' : '#15803D';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const dotColor  = isDark ? '#4ADE80' : '#15803D';

  return (
    <nav className={navClass} aria-label="Main navigation">
      <div className="navbar-inner">

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <Link
          to={user ? '/dashboard' : '/'}
          className="navbar-logo-link"
          aria-label="DrFahm — go to homepage"
        >
          <LogoFull
            height={30}
            markColor={markColor}
            textColor={textColor}
            dotColor={dotColor}
          />
        </Link>

        {/* ── Links ────────────────────────────────────────────────── */}
        <div
          className={`navbar-links ${menuOpen ? 'open' : ''}`}
          role="menu"
        >
          {/* Public / home nav */}
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
            /* Authenticated internal nav */
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

              <span className="nav-username" aria-label={`Logged in as ${user.username}`}>
                {user.username}
              </span>

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

      {/* Mobile backdrop */}
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