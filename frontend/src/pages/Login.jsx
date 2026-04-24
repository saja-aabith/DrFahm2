import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.error?.message || t('auth.login.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ position: 'relative' }}>

        {/* Language toggle pill — top-right (top-left in RTL via auto flip) */}
        <button
          className="lang-toggle"
          onClick={toggleLang}
          aria-label={t('auth.lang_toggle_aria')}
          style={{ position: 'absolute', top: 16, insetInlineEnd: 16 }}
        >
          <span className={i18n.language === 'en' ? 'lang-active' : ''}>EN</span>
          <span className="lang-sep" />
          <span className={i18n.language === 'ar' ? 'lang-active' : ''}>AR</span>
        </button>

        <div className="auth-logo">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span className="logo-dr">Dr</span><span className="logo-fahm">Fahm</span>
          </Link>
        </div>
        <h1 className="auth-title">{t('auth.login.title')}</h1>
        <p className="auth-subtitle">{t('auth.login.subtitle')}</p>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.login.identifier_label')}</label>
            <input
              className="form-input"
              type="text"
              placeholder={t('auth.login.identifier_placeholder')}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.login.password_label')}</label>
            <input
              className="form-input"
              type="password"
              placeholder={t('auth.login.password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <p className="auth-switch" style={{ marginTop: 20 }}>
          {t('auth.login.switch_prompt')} <Link to="/register">{t('auth.login.switch_link')}</Link>
        </p>
      </div>
    </div>
  );
}