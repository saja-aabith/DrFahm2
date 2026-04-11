import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EXAM_LABELS = { qudurat: 'Qudurat', tahsili: 'Tahsili' };

const FEATURES = [
  { bold: 'Real Qudurat & Tahsili', rest: ' exam questions' },
  { bold: 'Step-by-step', rest: ' hints & explanations' },
  { bold: 'Track your', rest: ' progress across all worlds' },
];

export default function Register() {
  const { register }   = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const examParam = searchParams.get('exam');
  const examLabel = EXAM_LABELS[examParam] || null;

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
    if (form.password !== form.confirm) { setError('Passwords do not match.');             return; }
    if (form.password.length < 8)       { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await register(
        form.username.trim(),
        form.email.trim()   || undefined,
        form.password,
        form.phone.trim()   || undefined,   // optional — backend stores for WhatsApp contact
      );
      if (examParam && ['qudurat', 'tahsili'].includes(examParam)) {
        navigate(`/exam/${examParam}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err?.error?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: 48 }}>
      <div className="auth-card" style={{ maxWidth: 460 }}>

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
            ? `Start your free 7-day ${examLabel} trial`
            : 'Start your 7-day free trial'}
        </h1>
        <p style={{
          textAlign: 'center', color: 'var(--text-secondary)',
          fontSize: '0.9rem', marginBottom: 20,
        }}>
          Full access. No credit card. Cancel anytime.
        </p>

        {/* Feature checklist */}
        <div style={{
          background: 'var(--bg-card-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
        }}>
          {FEATURES.map((f, i) => (
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
            <label className="form-label">Username</label>
            <input
              className="form-input" type="text"
              placeholder="Choose a username"
              value={form.username} onChange={set('username')}
              autoComplete="username" minLength={3} maxLength={80} required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Email{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>
                (optional — for progress saving)
              </span>
            </label>
            <input
              className="form-input" type="email"
              placeholder="your@email.com"
              value={form.email} onChange={set('email')}
              autoComplete="email"
            />
          </div>

          {/* ── Phone number — optional, used for WhatsApp support ── */}
          <div className="form-group">
            <label className="form-label">
              Phone{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem' }}>
                (optional — for WhatsApp updates)
              </span>
            </label>
            <input
              className="form-input" type="tel"
              placeholder="+966 5X XXX XXXX"
              value={form.phone} onChange={set('phone')}
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={form.password} onChange={set('password')}
                autoComplete="new-password" minLength={8} required
                style={{ paddingRight: 64 }}
              />
              <button
                type="button" onClick={() => setShowPass((v) => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                  fontFamily: 'Tajawal, sans-serif',
                }}
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={form.confirm} onChange={set('confirm')}
                autoComplete="new-password" required
                style={{ paddingRight: 64 }}
              />
              <button
                type="button" onClick={() => setShowConfirm((v) => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                  fontFamily: 'Tajawal, sans-serif',
                }}
              >
                {showConfirm ? 'Hide' : 'Show'}
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
            {loading ? 'Creating your account…' : 'Start My Free Trial'}
          </button>
        </form>

        <div style={{
          display: 'flex', justifyContent: 'center', gap: 20,
          marginTop: 14, flexWrap: 'wrap',
        }}>
          {['Takes 30 seconds', 'No credit card required', 'Cancel anytime'].map((t) => (
            <span key={t} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '0.78rem', color: 'var(--text-muted)',
            }}>
              <span style={{ color: '#15803D', fontWeight: 700, fontSize: '0.75rem' }}>✓</span>
              {t}
            </span>
          ))}
        </div>

        <div style={{
          borderTop: '1px solid var(--border)', marginTop: 16,
          paddingTop: 14, textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            By signing up you agree to our{' '}
            <Link to="/terms" style={{ color: '#15803D', textDecoration: 'none' }}>
              Terms of Service
            </Link>.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#15803D', fontWeight: 700, textDecoration: 'none' }}>
              Log in
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}