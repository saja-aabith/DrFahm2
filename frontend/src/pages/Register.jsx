import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { t, i18n }    = useTranslation();
  const { register }   = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const examParam = searchParams.get('exam');
  const validExam = examParam && ['qudurat', 'tahsili'].includes(examParam) ? examParam : null;
  const examLabel = validExam ? t(`common.${validExam}`) : null;

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
  };

  const features = [
    { bold: t('auth.register.features.f1_bold'), rest: t('auth.register.features.f1_rest') },
    { bold: t('auth.register.features.f2_bold'), rest: t('auth.register.features.f2_rest') },
    { bold: t('auth.register.features.f3_bold'), rest: t('auth.register.features.f3_rest') },
  ];

  const [form, setForm] = useState({
    username: '', email: '', phone: '', password: '', confirm: '',
  });
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError(t('auth.register.err_password_mismatch')); return; }
    if (form.password.length < 8)       { setError(t('auth.register.err_password_short'));    return; }
    setLoading(true);
    try {
      await register(
        form.username.trim(),
        form.email.trim()   || undefined,
        form.password,
        form.phone.trim()   || undefined,   // optional — backend stores for WhatsApp contact
      );
      if (validExam) {
        navigate(`/exam/${validExam}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err?.error?.message || t('auth.register.err_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 48 }}>
      <div className="auth-card" style={{ maxWidth: 460, position: 'relative' }}>

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

        {/* Logo — no home link; registration is a conversion dead-end */}
        <div className="auth-logo" style={{ marginBottom: 20 }}>
          <span className="logo-dr">Dr</span><span className="logo-fahm">Fahm</span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: '1.75rem', fontWeight: 800, textAlign: 'center',
          color: 'var(--brand-navy)', marginBottom: 6, lineHeight: 1.2,
        }}>
          {examLabel
            ? t('auth.register.title_with_exam', { exam: examLabel })
            : t('auth.register.title_no_exam')}
        </h1>
        <p style={{
          textAlign: 'center', color: 'var(--text-secondary)',
          fontSize: '0.9rem', marginBottom: 20,
        }}>
          {t('auth.register.subtitle')}
        </p>

        {/* Feature checklist */}
        <div style={{
          background: 'var(--bg-card-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
        }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(21,128,61,0.1)', border: '1.5px solid rgba(21,128,61,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#15803D', fontSize: '0.7rem', fontWeight: 800,
              }}>✓</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--brand-navy)' }}>{f.bold}</strong>{f.rest}
              </span>
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={handleSubmit}>

          <div className="form-group">
            <label className="form-label">{t('auth.register.username_label')}</label>
            <input
              className="form-input" type="text"
              placeholder={t('auth.register.username_placeholder')}
              value={form.username} onChange={set('username')}
              autoComplete="username" minLength={3} maxLength={80} required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {t('auth.register.email_label')}{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>
                {t('auth.register.email_hint')}
              </span>
            </label>
            <input
              className="form-input" type="email"
              placeholder={t('auth.register.email_placeholder')}
              value={form.email} onChange={set('email')}
              autoComplete="email"
            />
          </div>

          {/* ── Phone number — optional, used for WhatsApp support ── */}
          <div className="form-group">
            <label className="form-label">
              {t('auth.register.phone_label')}{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>
                {t('auth.register.phone_hint')}
              </span>
            </label>
            <input
              className="form-input" type="tel"
              placeholder={t('auth.register.phone_placeholder')}
              value={form.phone} onChange={set('phone')}
              autoComplete="tel"
              dir="ltr"
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.register.password_label')}</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder={t('auth.register.password_placeholder')}
                value={form.password} onChange={set('password')}
                autoComplete="new-password" minLength={8} required
                style={{ paddingInlineEnd: 64 }}
              />
              <button
                type="button" onClick={() => setShowPass((v) => !v)}
                style={{
                  position: 'absolute', insetInlineEnd: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                  fontFamily: 'Tajawal, sans-serif',
                }}
              >
                {showPass ? t('auth.register.hide') : t('auth.register.show')}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.register.confirm_label')}</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showConfirm ? 'text' : 'password'}
                placeholder={t('auth.register.confirm_placeholder')}
                value={form.confirm} onChange={set('confirm')}
                autoComplete="new-password" required
                style={{ paddingInlineEnd: 64 }}
              />
              <button
                type="button" onClick={() => setShowConfirm((v) => !v)}
                style={{
                  position: 'absolute', insetInlineEnd: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                  fontFamily: 'Tajawal, sans-serif',
                }}
              >
                {showConfirm ? t('auth.register.hide') : t('auth.register.show')}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px 20px',
              background: loading ? 'rgba(21,128,61,0.6)' : '#15803D',
              color: 'var(--brand-sand)',
              border: 'none', borderRadius: 8,
              fontSize: '1rem', fontWeight: 800,
              fontFamily: 'Tajawal, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.16s ease',
              marginTop: 4,
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.background = '#166534'; }}
            onMouseLeave={(e) => { if (!loading) e.target.style.background = '#15803D'; }}
          >
            {loading ? t('auth.register.submitting') : t('auth.register.submit')}
          </button>
        </form>

        <div style={{
          display: 'flex', justifyContent: 'center', gap: 20,
          marginTop: 14, flexWrap: 'wrap',
        }}>
          {[
            t('auth.register.trust_1'),
            t('auth.register.trust_2'),
            t('auth.register.trust_3'),
          ].map((tx) => (
            <span key={tx} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '0.78rem', color: 'var(--text-muted)',
            }}>
              <span style={{ color: '#15803D', fontWeight: 700, fontSize: '0.75rem' }}>✓</span>
              {tx}
            </span>
          ))}
        </div>

        <div style={{
          borderTop: '1px solid var(--border)', marginTop: 16,
          paddingTop: 14, textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            {t('auth.register.terms_prompt')}{' '}
            <Link to="/terms" style={{ color: '#15803D', textDecoration: 'none' }}>
              {t('auth.register.terms_link')}
            </Link>.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {t('auth.register.switch_prompt')}{' '}
            <Link to="/login" style={{ color: '#15803D', fontWeight: 700, textDecoration: 'none' }}>
              {t('auth.register.switch_link')}
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}