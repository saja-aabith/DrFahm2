import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { billing } from '../api';
import Navbar from '../components/Navbar';

// ── DISPLAY-NAME-ONLY RENAME ──────────────────────────────────────────────────
// plan_id values ('free', 'basic', 'premium') are unchanged in all API calls,
// Stripe config, DB rows, and entitlement checks.
// Display strings (name, duration, cta, badge, doubt) are pulled from i18n.

function getPlanShape(t) {
  return [
    {
      id:        'free',
      name:      t('pricing.plans.free.name'),
      price:     0,
      duration:  t('pricing.plans.free.duration'),
      worldsNum: 1,
      cta:       t('pricing.plans.free.cta'),
      ghost:     true,
      gold:      false,
      badge:     null,
      doubt:     null,
    },
    {
      id:        'basic',       // plan_id sent to backend — do not change
      name:      t('pricing.plans.silver.name'),
      price:     199,
      duration:  t('pricing.plans.silver.duration'),
      worldsNum: 5,
      cta:       t('pricing.plans.silver.cta'),
      ghost:     false,
      gold:      false,
      badge:     null,
      doubt:     t('pricing.plans.silver.doubt'),
    },
    {
      id:        'premium',     // plan_id sent to backend — do not change
      name:      t('pricing.plans.gold.name'),
      price:     299,
      duration:  t('pricing.plans.gold.duration'),
      worldsNum: 5,
      cta:       t('pricing.plans.gold.cta'),
      ghost:     false,
      gold:      true,
      badge:     t('pricing.plans.gold.badge'),
      doubt:     null,
    },
  ];
}

// Qudurat: 2 tracks × 5 worlds × 10 levels = 100 total levels
// Tahsili: 4 tracks × 5 worlds × 10 levels = 200 total levels
const EXAM_META = {
  qudurat: { tracks: 2, totalLevels: 100, freeLevels: 20 },
  tahsili: { tracks: 4, totalLevels: 200, freeLevels: 40 },
};

const EXAM_IDS = ['qudurat', 'tahsili'];

const WORLDS_PER_TRACK = 5;

function buildPlanFeatures(t, planId, exam) {
  const { totalLevels } = EXAM_META[exam] || EXAM_META.qudurat;
  let features;
  switch (planId) {
    case 'free':
      features = t('pricing.features.free',    { returnObjects: true });
      break;
    case 'basic':
      features = t('pricing.features.silver',  { returnObjects: true });
      break;
    case 'premium':
      features = t('pricing.features.premium', { returnObjects: true });
      break;
    default:
      return [];
  }
  if (!Array.isArray(features)) return [];
  // Manual interpolation — avoids i18next returnObjects+interpolation edge cases
  return features.map((f) => String(f).replace('{{totalLevels}}', totalLevels));
}

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

function formatExpiry(dateStr, lang) {
  const locale = lang === 'ar' ? 'ar' : 'en-GB';
  return new Date(dateStr).toLocaleDateString(locale, {
    day:      'numeric',
    month:    'short',
    year:     'numeric',
    calendar: 'gregory',
  });
}

export default function Pricing() {
  const { t, i18n }    = useTranslation();
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedExam, setSelectedExam] = useState(searchParams.get('exam') || 'qudurat');
  const [loading,      setLoading]      = useState(null);
  const [error,        setError]        = useState('');
  const [entitlements, setEntitlements] = useState([]);

  // Rebuild plan shape when language changes
  const planShape = useMemo(() => getPlanShape(t), [t]);

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
  const arrow    = t('common.arrow');
  const examName = t(`common.${selectedExam}`);

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
      setError(err?.error?.message || t('pricing.errors.checkout_failed'));
      setLoading(null);
    }
  };

  // FAQ items from translations
  const faqItemsRaw = t('pricing.faq.items', { returnObjects: true });
  const faqItems    = Array.isArray(faqItemsRaw) ? faqItemsRaw : [];

  return (
    <>
      <Navbar />

      <div className="pricing-hero">
        <div className="home-section-tag" style={{ display: 'flex', justifyContent: 'center' }}>
          {t('pricing.hero.tag')}
        </div>
        <h1 className="pricing-hero-title">{t('pricing.hero.title')}</h1>
        <p className="pricing-hero-sub">{t('pricing.hero.sub')}</p>
        <div className="pricing-exam-toggle">
          {EXAM_IDS.map((id) => (
            <button
              key={id}
              className={`pricing-exam-btn ${selectedExam === id ? 'active' : ''}`}
              onClick={() => setSelectedExam(id)}
            >
              {t(`pricing.exam.${id}`)}
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
          {planShape.map((plan) => {
            const features    = buildPlanFeatures(t, plan.id, selectedExam);
            const worldsLabel = plan.id === 'free'
              ? t('pricing.card.worlds_free', { exam: examName })
              : t('pricing.card.worlds_paid', { exam: examName });

            const activeEnt = plan.id !== 'free'
              ? findActiveEnt(entitlements, plan.id, selectedExam)
              : null;
            const days      = activeEnt ? daysRemaining(activeEnt.entitlement_expires_at) : null;
            const expiryStr = activeEnt ? formatExpiry(activeEnt.entitlement_expires_at, i18n.language) : null;
            const daysText  = days === 1
              ? t('pricing.card.day_remaining')
              : t('pricing.card.days_remaining', { count: days });

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
                  <div className="pricing-active-badge">{t('pricing.card.your_plan')}</div>
                )}

                <div className="pricing-card-header">
                  <div className={`pricing-plan-name ${plan.gold ? 'gold-name' : ''}`}>
                    {plan.name}
                  </div>
                  <div className="pricing-plan-price">
                    {plan.price === 0
                      ? <span className="pricing-price-free">{t('pricing.card.price_free')}</span>
                      : (
                        <>
                          <span className="pricing-price-currency">{t('pricing.card.currency_code')} </span>
                          <span className="pricing-price-amount">{plan.price}</span>
                        </>
                      )
                    }
                    <span className="pricing-price-period"> {t('pricing.card.period', { duration: plan.duration })}</span>
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
                  {t('pricing.card.worlds_bar_label', { filled: plan.worldsNum, total: WORLDS_PER_TRACK })}
                </div>

                {activeEnt ? (
                  <div className="pricing-card-actions">
                    <div className="pricing-active-state">
                      <div className="pricing-active-label">{t('pricing.card.active_label')}</div>
                      <div className="pricing-active-expiry">
                        <span className="pricing-active-days">{daysText}</span>
                        <span className="pricing-active-date">
                          {t('pricing.card.expires', { date: expiryStr })}
                        </span>
                      </div>
                      <Link
                        to={`/exam/${selectedExam}`}
                        className="btn btn-ghost btn-full"
                        style={{ marginTop: 8 }}
                      >
                        {t('pricing.card.go_to', { exam: examName, arrow })}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="pricing-card-actions">
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
                      {loading === plan.id ? t('pricing.card.redirecting') : plan.cta}
                    </button>
                    {/* Always rendered — hidden when empty so all buttons stay at same height */}
                    <p
                      className="pricing-silver-doubt"
                      style={{ visibility: plan.doubt ? 'visible' : 'hidden' }}
                    >
                      {plan.doubt || 'placeholder'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pricing-trust">
          {[
            t('pricing.trust.one_time'),
            t('pricing.trust.no_card'),
            t('pricing.trust.secure'),
          ].map((item) => (
            <span key={item} className="pricing-trust-item">{item}</span>
          ))}
        </div>

        {/* Compare plans table */}
        <div className="pricing-compare">
          <h2 className="pricing-compare-title">{t('pricing.compare.title')}</h2>
          <div className="pricing-table-wrap">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>{t('pricing.compare.feature')}</th>
                  <th>{t('pricing.plans.free.name')}</th>
                  <th>{t('pricing.plans.silver.name')}</th>
                  <th className="highlight-col">{t('pricing.plans.gold.name')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    t('pricing.compare.rows.worlds'),
                    '1',
                    '5',
                    '5',
                  ],
                  [
                    t('pricing.compare.rows.total_levels'),
                    String(freeLevels),
                    String(totalLevels),
                    String(totalLevels),
                  ],
                  [
                    t('pricing.compare.rows.duration'),
                    t('pricing.plans.free.duration'),
                    t('pricing.plans.silver.duration'),
                    t('pricing.plans.gold.duration'),
                  ],
                  [
                    t('pricing.compare.rows.progress'),
                    '✓',
                    '✓',
                    '✓',
                  ],
                  [
                    t('pricing.compare.rows.coverage'),
                    '—',
                    '✓',
                    '✓',
                  ],
                  [
                    t('pricing.compare.rows.price'),
                    t('pricing.card.price_free'),
                    `${t('pricing.card.currency_code')} ${planShape[1].price}`,
                    `${t('pricing.card.currency_code')} ${planShape[2].price}`,
                  ],
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
            {t(`pricing.compare.footnote_${selectedExam}`)}
          </p>
        </div>

        {/* Schools callout */}
        <div className="pricing-schools-callout">
          <div className="pricing-schools-left">
            <div className="pricing-schools-icon">🏫</div>
            <div>
              <div className="pricing-schools-title">{t('pricing.schools.title')}</div>
              <div className="pricing-schools-sub">{t('pricing.schools.sub')}</div>
            </div>
          </div>
          <Link to="/schools" className="btn btn-ghost">
            {t('pricing.schools.cta', { arrow })}
          </Link>
        </div>

        {/* FAQ */}
        <div className="pricing-faq">
          <h2 className="pricing-compare-title">{t('pricing.faq.title')}</h2>
          <div className="pricing-faq-list">
            {faqItems.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}