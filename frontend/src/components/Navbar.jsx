import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LogoFull } from './LogoSVG';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, i18n }      = useTranslation();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isHome   = location.pathname === '/';
  const isActive = (path) => location.pathname === path;

  const isDark = false;

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

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

  const logoProps = isDark
    ? { dColor: '#4ADE80', fColor: '#FFFFFF',  textColor: '#FFFFFF',  dotColor: '#4ADE80' }
    : { dColor: '#1F7A3E', fColor: '#0F2233',  textColor: '#0F2233',  dotColor: '#1F7A3E' };

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
                {t('nav.for_schools')}
              </Link>

              <Link
                to="/pricing"
                className={`nav-link ${isDark ? 'nav-link-dark' : ''} ${isActive('/pricing') ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
                role="menuitem"
              >
                {t('nav.pricing')}
              </Link>

              {/* ── Language toggle pill ──────────────────────────── */}
              <button className="lang-toggle" onClick={toggleLang} aria-label="Toggle language">
                <span className={i18n.language === 'en' ? 'lang-active' : ''}>EN</span>
                <span className="lang-sep" />
                <span className={i18n.language === 'ar' ? 'lang-active' : ''}>AR</span>
              </button>

              {user ? (
                <Link
                  to="/dashboard"
                  className={`nav-cta-btn ${isDark ? 'nav-cta-dark' : ''}`}
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                >
                  {t('nav.dashboard')} {t('common.arrow')}
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`nav-link ${isDark ? 'nav-link-dark' : ''}`}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    className={`nav-cta-btn ${isDark ? 'nav-cta-dark' : ''}`}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    {t('nav.start_free')} {t('common.arrow')}
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
                {t('nav.dashboard')}
              </Link>

              {user.role === 'drfahm_admin' && (
                <Link
                  to="/admin"
                  className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                >
                  {t('nav.admin')}
                </Link>
              )}

              {/* ── Language toggle pill ──────────────────────────── */}
              <button className="lang-toggle" onClick={toggleLang} aria-label="Toggle language">
                <span className={i18n.language === 'en' ? 'lang-active' : ''}>EN</span>
                <span className="lang-sep" />
                <span className={i18n.language === 'ar' ? 'lang-active' : ''}>AR</span>
              </button>

              <span className="nav-username">{user.username}</span>

              <button className="nav-logout-btn" onClick={handleLogout}>
                {t('nav.logout')}
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