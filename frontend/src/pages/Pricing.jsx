import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { billing } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 199,
    duration: '3 months',
    worlds: '1–5',
    features: ['Worlds 1–5 (50 levels)', '7-day trial included', 'Progress tracking'],
    cta: 'Get Basic',
    highlight: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 299,
    duration: '12 months',
    worlds: '1–10',
    features: ['All 10 worlds (100 levels)', 'Full exam coverage', 'Priority support', '12-month access'],
    cta: 'Get Premium',
    highlight: true,
  },
];

const EXAM_LABELS = { qudurat: 'Qudurat', tahsili: 'Tahsili' };

export default function Pricing() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultExam = searchParams.get('exam') || 'qudurat';

  const [selectedExam, setSelectedExam] = useState(defaultExam);
  const [loading, setLoading]           = useState(null); // plan id currently loading
  const [error, setError]               = useState('');

  const handleCheckout = async (planId) => {
    if (!user) {
      navigate('/register');
      return;
    }
    setError('');
    setLoading(planId);
    try {
      const { checkout_url } = await billing.createCheckoutSession({
        plan_id: planId,
        exam: selectedExam,
      });
      window.location.href = checkout_url;
    } catch (err) {
      setError(err?.error?.message || 'Could not start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page" style={{ maxWidth: 800 }}>
        <div className="page-header" style={{ textAlign: 'center' }}>
          <h1 className="page-title">Simple, transparent pricing</h1>
          <p className="page-subtitle">One-time payment. No subscriptions. No auto-renewals.</p>
        </div>

        {/* Exam selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {Object.keys(EXAM_LABELS).map((exam) => (
            <button
              key={exam}
              className={`btn ${selectedExam === exam ? 'btn-violet' : 'btn-ghost'} btn-sm`}
              onClick={() => setSelectedExam(exam)}
            >
              {EXAM_LABELS[exam]}
            </button>
          ))}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="card"
              style={{
                border: plan.highlight
                  ? '1px solid rgba(124,58,237,0.4)'
                  : '1px solid var(--border)',
                position: 'relative',
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--violet)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 20,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                }}>Most Popular</div>
              )}

              <div className={`plan-pill ${plan.id}`} style={{ textTransform: 'capitalize', marginBottom: 16 }}>
                {plan.name}
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '2rem', fontWeight: 800 }}>SAR {plan.price}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: 6 }}>/ {plan.duration}</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                Worlds {plan.worlds} · One exam ({EXAM_LABELS[selectedExam]})
              </p>

              <ul style={{ listStyle: 'none', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: '0.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--green-light)' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${plan.highlight ? 'btn-violet' : 'btn-ghost'} btn-full`}
                onClick={() => handleCheckout(plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? 'Redirecting…' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <p>Start with a free 7-day trial — no payment needed. All plans are per-exam, one-time payments.</p>
          <p style={{ marginTop: 6 }}>
            Looking for school pricing? <a href="/schools" style={{ color: 'var(--violet-light)' }}>Contact us</a>
          </p>
        </div>
      </div>
    </>
  );
}