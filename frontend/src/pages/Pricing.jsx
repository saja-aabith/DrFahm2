import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { billing } from '../api';
import Navbar from '../components/Navbar';

// ── DISPLAY-NAME-ONLY RENAME ──────────────────────────────────────────────────
// plan_id values ('free', 'basic', 'premium') are unchanged in all API calls,
// Stripe config, DB rows, and entitlement checks.

const PLAN_SHAPE = [
  {
    id:       'free',
    name:     'Free',
    price:    0,
    duration: '7 days',
    worldsNum: 1,
    cta:      'Start free',
    ghost:    true,
    gold:     false,
    badge:    null,
    doubt:    null,
  },
  {
    id:       'basic',       // plan_id sent to backend — do not change
    name:     'Silver',      // display only
    price:    199,
    duration: '90 days',
    worldsNum: 5,
    cta:      'Get Silver',
    ghost:    false,
    gold:     false,
    badge:    null,
    doubt:    'Most students need more than 90 days',
  },
  {
    id:       'premium',     // plan_id sent to backend — do not change
    name:     'Gold',        // display only
    price:    299,
    duration: '1 year',
    worldsNum: 5,
    cta:      'Get Gold',
    ghost:    false,
    gold:     true,
    badge:    'Best Value',
    doubt:    null,
  },
];

// Qudurat: 2 tracks × 5 worlds × 10 levels = 100 total levels
// Tahsili: 4 tracks × 5 worlds × 10 levels = 200 total levels
const EXAM_META = {
  qudurat: { tracks: 2, totalLevels: 100, freeLevels: 20 },
  tahsili: { tracks: 4, totalLevels: 200, freeLevels: 40 },
};

function buildPlanFeatures(planId, exam) {
  const { totalLevels } = EXAM_META[exam] || EXAM_META.qudurat;
  switch (planId) {
    case 'free':
      return [
        'World 1 in every track (10 levels per track)',
        'Full question experience',
        'Progress tracking',
        'No credit card required',
      ];
    case 'basic':
      return [
        `All 5 worlds per track (${totalLevels} levels total)`,
        '90 days full access',
        'Progress tracking',
        'Level pass certificates',
      ];
    case 'premium':
      return [
        `All 5 worlds per track (${totalLevels} levels total)`,
        '12 months full access',
        'Full exam coverage',
        'Level pass certificates',
      ];
    default:
      return [];
  }
}

const EXAM_LABELS = {
  qudurat: 'Qudurat — قدرات',
  tahsili: 'Tahsili — تحصيلي',
};

const WORLDS_PER_TRACK = 5;

// ── Rainmaker FAQ — conversion-focused, objection-handling ───────────────────
const FAQ = [
  {
    q: 'What happens after my free trial ends?',
    a: 'Your progress is saved. Worlds beyond World 1 lock until you upgrade. Most students who start DrFahm upgrade — because the structure works. You\'ll see it from your first session.',
  },
  {
    q: 'Will I be charged automatically?',
    a: 'No. DrFahm is one-time only. Pay once, use it for the full period. No subscriptions, no auto-renewals, no surprise charges. Ever.',
  },
  {
    q: 'How quickly will I see improvement?',
    a: 'Most students have a clearer picture of their weak areas after session one. Score improvement depends on consistent use — but the direction is clear from day one.',
  },
  {
    q: 'Why Gold over Silver?',
    a: 'Same content. Same structure. The only difference is time. Silver gives you 90 days — Gold gives you a full year. If your exam is more than 3 months away, Gold is the smarter investment.',
  },
  {
    q: 'Do I need a separate plan for each exam?',
    a: 'Yes — each plan is exam-specific. If you\'re preparing for both Qudurat and Tahsili, get one plan for each. Start with the exam you\'re sitting first.',
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

function findActiveEnt(entitlements, planId, exam) {
  if (!entitlements?.length) return null;
  const now = new Date();
  return entitlements.find(
    (e) => e.plan_id === planId && e.exam === exam && now < new Date(e.entitlement_expires_at)
  ) || null;
}

function daysRemaining(expiresAt) {
  return Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
}

export default function Pricing() {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedExam, setSelectedExam] = useState(searchParams.get('exam') || 'qudurat');
  const [loading,      setLoading]      = useState(null);
  const [error,        setError]        = useState('');
  const [entitlements, setEntitlements] = useState([]);

  useEffect(() => {
    if (!user) return;
    billing.getEntitlements()
      .then((data) => {
        const all = [
          ...(data?.individual_entitlements || []),
          ...(data?.org_entitlements        || []),
        ];
        setEntitlements(all);
      })
      .catch(() => {});
  }, [user]);

  const { totalLevels, freeLevels } = EXAM_META[selectedExam];

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

  return (
    <>
      <Navbar />

      <div className="pricing-hero">
        <div className="home-section-tag" style={{ display: 'flex', justifyContent: 'center' }}>
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
          <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>
        )}

        {/* Cards grid — padding-top added in CSS to clear badge overflow */}
        <div className="pricing-grid">
          {PLAN_SHAPE.map((plan) => {
            const features    = buildPlanFeatures(plan.id, selectedExam);
            const worldsLabel = plan.id === 'free'
              ? `World 1 per track · ${selectedExam === 'qudurat' ? 'Qudurat' : 'Tahsili'}`
              : `All 5 worlds per track · ${selectedExam === 'qudurat' ? 'Qudurat' : 'Tahsili'}`;

            const activeEnt = plan.id !== 'free'
              ? findActiveEnt(entitlements, plan.id, selectedExam)
              : null;
            const days = activeEnt ? daysRemaining(activeEnt.entitlement_expires_at) : null;
            const expiryStr = activeEnt
              ? new Date(activeEnt.entitlement_expires_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
              : null;

            return (
              <div
                key={plan.id}
                className={[
                  'pricing-card',
                  plan.ghost ? 'ghost'  : '',
                  plan.gold  ? 'gold'   : '',
                  activeEnt  ? 'active' : '',
                ].filter(Boolean).join(' ')}
              >
                {plan.badge && !activeEnt && (
                  <div className="pricing-gold-badge">{plan.badge}</div>
                )}
                {activeEnt && (
                  <div className="pricing-active-badge">Your plan</div>
                )}

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
                  <div className="pricing-plan-worlds">{worldsLabel}</div>
                </div>

                <ul className="pricing-feature-list">
                  {features.map((f) => (
                    <li key={f} className="pricing-feature-item">
                      <span className="pricing-check">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="pricing-world-bar">
                  {Array.from({ length: WORLDS_PER_TRACK }).map((_, i) => (
                    <div
                      key={i}
                      className={`pricing-world-pip ${i < plan.worldsNum ? 'filled' : ''}`}
                    />
                  ))}
                </div>
                <div className="pricing-world-bar-label">
                  {plan.worldsNum} of {WORLDS_PER_TRACK} worlds per track
                </div>

                {activeEnt ? (
                  <div className="pricing-active-state">
                    <div className="pricing-active-label">Active plan</div>
                    <div className="pricing-active-expiry">
                      <span className="pricing-active-days">{days} day{days !== 1 ? 's' : ''} remaining</span>
                      <span className="pricing-active-date">Expires {expiryStr}</span>
                    </div>
                    <Link
                      to={`/exam/${selectedExam}`}
                      className="btn btn-ghost btn-full"
                      style={{ marginTop: 8 }}
                    >
                      Go to {selectedExam === 'qudurat' ? 'Qudurat' : 'Tahsili'} →
                    </Link>
                  </div>
                ) : (
                  <>
                    <button
                      className={[
                        'btn btn-full btn-lg',
                        plan.gold  ? 'btn-gold'  : '',
                        plan.ghost ? 'btn-ghost' : '',
                        !plan.gold && !plan.ghost ? 'btn-green' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleCheckout(plan.id)}
                      disabled={loading === plan.id}
                    >
                      {loading === plan.id ? 'Redirecting…' : plan.cta}
                    </button>
                    {plan.doubt && (
                      <p className="pricing-silver-doubt">{plan.doubt}</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="pricing-trust">
          {[
            '✓ One-time payment',
            '✓ No credit card for trial',
            '✓ Secure Stripe checkout',
          ].map((t) => (
            <span key={t} className="pricing-trust-item">{t}</span>
          ))}
        </div>

        {/* Compare plans table */}
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
                  ['Worlds per track', '1',                  '5',                '5'],
                  ['Total levels',     String(freeLevels),   String(totalLevels), String(totalLevels)],
                  ['Duration',         '7 days',             '90 days',          '1 year'],
                  ['Progress tracking','✓',                  '✓',                '✓'],
                  ['Full coverage',    '—',                  '✓',                '✓'],
                  ['Price',            'Free',               'SAR 199',          'SAR 299'],
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
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 10 }}>
            {selectedExam === 'qudurat'
              ? 'Qudurat: 2 tracks (Math + Verbal) × 5 worlds × 10 levels = 100 total levels.'
              : 'Tahsili: 4 tracks × 5 worlds × 10 levels = 200 total levels.'}
          </p>
        </div>

        {/* Schools callout */}
        <div className="pricing-schools-callout">
          <div className="pricing-schools-left">
            <div className="pricing-schools-icon">🏫</div>
            <div>
              <div className="pricing-schools-title">Preparing students at scale?</div>
              <div className="pricing-schools-sub">
                School licensing with bulk accounts and custom pricing.
              </div>
            </div>
          </div>
          <Link to="/schools" className="btn btn-ghost">
            Get school pricing →
          </Link>
        </div>

        {/* FAQ */}
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