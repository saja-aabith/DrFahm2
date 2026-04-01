import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register }     = useAuth();
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();

  // Preserve exam context from home page CTA ("Start here — Qudurat")
  const examParam = searchParams.get('exam');

  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(form.username.trim(), form.email.trim() || undefined, form.password);
      // If student came from a specific exam CTA, take them straight in.
      // Trial starts automatically on first world-map request.
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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-dr">Dr</span><span className="logo-fahm">Fahm</span>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          {examParam
            ? `Start your free 7-day ${examParam === 'qudurat' ? 'Qudurat' : 'Tahsili'} trial — no credit card needed`
            : 'Start with a free 7-day trial — no credit card needed'}
        </p>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              placeholder="Choose a username"
              value={form.username}
              onChange={set('username')}
              autoComplete="username"
              minLength={3}
              maxLength={80}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Email <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              className="form-input"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create free account'}
          </button>
        </form>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
          By signing up you agree to our Terms of Service.
        </p>

        <p className="auth-switch" style={{ marginTop: 12 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}