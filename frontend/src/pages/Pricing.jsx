import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

// ── DISPLAY-NAME-ONLY RENAME ──────────────────────────────────────────────────
// plan_id values ('free', 'basic', 'premium') are unchanged in all API calls,
// Stripe config, DB rows, and entitlement checks.
// Only the name/cta/badge strings shown to the user have changed.
// To revert: change name/cta back; no backend migration needed.
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    duration: '7 days',
    worlds: 'Worlds 1 & 2 per track',
    worldsNum: 2,
    features: [
      'Worlds 1 & 2 in every track',
      'Full question experience',
      'Progress tracking',
      'No credit card required',
    ],
    cta: 'Start free',
    ghost: true,
    gold: false,
    badge: null,
    doubt: null,
  },
  {
    id: 'basic',                          // plan_id sent to backend — do not change
    name: 'Silver',                       // display only
    price: 199,
    duration: '90 days',
    worlds: 'All 5 worlds per track',
    worldsNum: 5,
    features: [
      'All 5 worlds per track (50 levels)',
      '90 days full access',
      'Progress tracking',
      'Level pass certificates',
    ],
    cta: 'Get Silver',
    ghost: false,
    gold: false,
    badge: null,
    doubt: 'Most students need more than 90 days',
  },
  {
    id: 'premium',                        // plan_id sent to backend — do not change
    name: 'Gold',                         // display only
    price: 299,
    duration: '1 year',
    worlds: 'All 5 worlds per track',
    worldsNum: 5,
    features: [
      'All 5 worlds per track (50 levels)',
      '12 months full access',
      'Full exam coverage',
      'Priority support',
      'Level pass certificates',
    ],
    cta: 'Get Gold',
    ghost: false,
    gold: true,
    badge: 'Best Value',
    doubt: null,
  },
];

const EXAM_LABELS = {
  qudurat: 'Qudurat — قدرات',
  tahsili: 'Tahsili — تحصيلي',
};

const FAQ = [
  {
    q: 'What happens after my free trial ends?',
    a: 'Your progress is saved, but worlds beyond World 2 remain locked until you upgrade to Silver or Gold.',
  },
  {
    q: 'Is this a subscription? Will I be charged automatically?',
    a: 'No. DrFahm uses one-time payments only. No auto-renewals, no monthly charges, no surprises.',
  },
  {
    q: 'Can I get a refund?',
    a: "If you've completed fewer than 5 levels of paid content, contact us within 7 days for a full refund.",
  },
  {
    q: 'Do I need one plan per exam?',
    a: 'Yes — each plan covers one exam. If preparing for both Qudurat and Tahsili, you need a plan for each.',
  },
  {
    q: 'Is the content in Arabic or English?',
    a: 'Questions mirror the official exam format. Qudurat verbal is in Arabic, math in Arabic. Tahsili follows the national exam language.',
  },
  {
    q: 'What is the difference between Silver and Gold?',
    a: 'Both cover the same 5 worlds and 50 levels per track. The only difference is duration: Silver gives you 90 days, Gold gives you a full year. If you have more time to prepare, Gold is better value.',
  },
  {
    q: 'Can my school get a group deal?',
    a: 'Yes. We offer school licensing with bulk accounts and custom pricing. See the Schools page.',
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`pricing-faq-item ${open ? 'open' : ''}`}
      onClick={() => setOpen(!open)}
    >
      <div className="pricing-faq-q">
        <span>{q}</span>
        <span className="pricing-faq-arrow">{open ? '−' : '+'}</span>
      </div>
      {open && <div className="pricing-faq-a">{a}</div>}
    </div>
  );
}

export default function Pricing() {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedExam, setSelectedExam] = useState(
    searchParams.get('exam') || 'qudurat'
  );
  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState('');

  const handleCheckout = async (planId) => {
    if (planId === 'free') {
      if (user) navigate(`/exam/${selectedExam}`);
      else      navigate(`/register?exam=${selectedExam}`);
      return;
    }
    if (!user) {
      navigate(`/register?redirect=pricing&exam=${selectedExam}`);
      return;
    }
    setError('');
    setLoading(planId);
    try {
      const BASE  = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const token = localStorage.getItem('access_token');
      const res   = await fetch(`${BASE}/api/billing/create-checkout-session`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan_id: planId, exam: selectedExam }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err?.error?.message || 'Could not start checkout. Please try again.');
      setLoading(null);
    }
  };

  const worldsPerTrack = 5;

  return (
    <>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="pricing-hero">
        <div
          className="home-section-tag"
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          Pricing
        </div>
        <h1 className="pricing-hero-title">Simple, one-time pricing</h1>
        <p className="pricing-hero-sub">
          No subscriptions. No auto-renewals. Pay once, study for the full period.
        </p>
        <div className="pricing-exam-toggle">
          {Object.entries(EXAM_LABELS).map(([id, label]) => (
            <button
              key={id}
              className={`pricing-exam-btn ${selectedExam === id ? 'active' : ''}`}
              onClick={() => setSelectedExam(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pricing-container">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* ── Plan cards ─────────────────────────────────────────────────── */}
        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={[
                'pricing-card',
                plan.ghost ? 'ghost'    : '',
                plan.gold  ? 'gold'     : '',
              ].filter(Boolean).join(' ')}
            >
              {/* Badge — Best Value on Gold only */}
              {plan.badge && (
                <div className="pricing-gold-badge">{plan.badge}</div>
              )}

              {/* Header */}
              <div className="pricing-card-header">
                <div className={`pricing-plan-name ${plan.gold ? 'gold-name' : ''}`}>
                  {plan.name}
                </div>
                <div className="pricing-plan-price">
                  {plan.price === 0
                    ? <span className="pricing-price-free">Free</span>
                    : (
                      <>
                        <span className="pricing-price-currency">SAR </span>
                        <span className="pricing-price-amount">{plan.price}</span>
                      </>
                    )
                  }
                  <span className="pricing-price-period"> / {plan.duration}</span>
                </div>
                <div className="pricing-plan-worlds">
                  {plan.worlds} · {selectedExam === 'qudurat' ? 'Qudurat' : 'Tahsili'}
                </div>
              </div>

              {/* Feature list */}
              <ul className="pricing-feature-list">
                {plan.features.map((f) => (
                  <li key={f} className="pricing-feature-item">
                    <span className="pricing-check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* World progress bar */}
              <div className="pricing-world-bar">
                {Array.from({ length: worldsPerTrack }).map((_, i) => (
                  <div
                    key={i}
                    className={`pricing-world-pip ${i < plan.worldsNum ? 'filled' : ''}`}
                  />
                ))}
              </div>
              <div className="pricing-world-bar-label">
                {plan.worldsNum} of {worldsPerTrack} worlds per track
              </div>

              {/* CTA */}
              <button
                className={[
                  'btn btn-full btn-lg',
                  plan.gold  ? 'btn-gold'   : '',
                  plan.ghost ? 'btn-ghost'  : '',
                  !plan.gold && !plan.ghost ? 'btn-green' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleCheckout(plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? 'Redirecting…' : plan.cta}
              </button>

              {/* Silver doubt nudge */}
              {plan.doubt && (
                <p className="pricing-silver-doubt">{plan.doubt}</p>
              )}
            </div>
          ))}
        </div>

        {/* ── Trust strip ────────────────────────────────────────────────── */}
        <div className="pricing-trust">
          {[
            '✓ One-time payment',
            '✓ No credit card for trial',
            '✓ 7-day refund policy',
            '✓ Secure Stripe checkout',
          ].map((t) => (
            <span key={t} className="pricing-trust-item">{t}</span>
          ))}
        </div>

        {/* ── Compare plans table ─────────────────────────────────────────── */}
        <div className="pricing-compare">
          <h2 className="pricing-compare-title">Compare plans</h2>
          <div className="pricing-table-wrap">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Free</th>
                  <th>Silver</th>
                  <th className="highlight-col">Gold</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Worlds per track',  '2',      '5',        '5'],
                  ['Levels per track',  '20',     '50',       '50'],
                  ['Duration',          '7 days', '90 days',  '1 year'],
                  ['Progress tracking', '✓',      '✓',        '✓'],
                  ['Full coverage',     '—',      '✓',        '✓'],
                  ['Priority support',  '—',      '—',        '✓'],
                  ['Price',             'Free',   'SAR 199',  'SAR 299'],
                ].map(([feature, free, silver, gold]) => (
                  <tr key={feature}>
                    <td className="pricing-table-feature">{feature}</td>
                    <td className="pricing-table-val">{free}</td>
                    <td className="pricing-table-val">{silver}</td>
                    <td className="pricing-table-val highlight-col">{gold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Schools callout ─────────────────────────────────────────────── */}
        <div className="pricing-schools-callout">
          <div className="pricing-schools-left">
            <div className="pricing-schools-icon">🏫</div>
            <div>
              <div className="pricing-schools-title">Preparing students at scale?</div>
              <div className="pricing-schools-sub">
                School licensing with bulk accounts, teacher dashboards, and custom pricing.
              </div>
            </div>
          </div>
          <Link to="/schools" className="btn btn-ghost">
            Get school pricing →
          </Link>
        </div>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <div className="pricing-faq">
          <h2 className="pricing-compare-title">Frequently asked questions</h2>
          <div className="pricing-faq-list">
            {FAQ.map((item) => (
              <FAQItem key={item.q} {...item} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}