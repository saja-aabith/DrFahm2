import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import {
  Users, LayoutDashboard, ShieldCheck,
  FileBarChart2, Crown, HeadphonesIcon,
} from 'lucide-react';

// ── Config (unchanged) ────────────────────────────────────────────────────────
const CALENDLY_URL       = 'https://calendly.com/drfahm-info/30min';
const WA_NUMBER          = '447346463512';
const WA_SCHOOLS_MESSAGE = encodeURIComponent('Hi, I am interested in DrFahm for schools');

// ── Tier config — pricing & rules only; user-facing text lives in i18n ────────
const TIERS = [
  { id: 'standard', price: 99, minStudents: 30,  ghost: true,  gold: false, hasBadge: false },
  { id: 'volume',   price: 75, minStudents: 100, ghost: false, gold: true,  hasBadge: true  },
];

// Icons in render order — paired by index with i18n outcomes/features/steps arrays
const FEATURE_ICONS = [
  Users,
  LayoutDashboard,
  ShieldCheck,
  FileBarChart2,
  Crown,
  HeadphonesIcon,
];

const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function getTierForCount(count) {
  if (count >= 100) return TIERS[1];
  if (count >= 30)  return TIERS[0];
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Schools() {
  const { t } = useTranslation();
  const arrow = t('common.arrow');

  const [form, setForm] = useState({
    name: '', email: '', phone: '', school_name: '',
    qudurat_students: '', tahsili_students: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const qCount = parseInt(form.qudurat_students) || 0;
  const tCount = parseInt(form.tahsili_students) || 0;

  function examEstimate(count) {
    const tier = getTierForCount(count);
    if (!tier || count < 1) return null;
    return { tier, total: tier.price * count };
  }

  const qEst = examEstimate(qCount);
  const tEst = examEstimate(tCount);

  // ── i18n array fetches (guarded) ────────────────────────────────────────────
  const problems = (() => {
    const v = t('schools.problem.items', { returnObjects: true });
    return Array.isArray(v) ? v : [];
  })();
  const outcomes = (() => {
    const v = t('schools.results.outcomes', { returnObjects: true });
    return Array.isArray(v) ? v : [];
  })();
  const features = (() => {
    const v = t('schools.results.features', { returnObjects: true });
    return Array.isArray(v) ? v : [];
  })();
  const steps = (() => {
    const v = t('schools.process.steps', { returnObjects: true });
    return Array.isArray(v) ? v : [];
  })();

  const getTierName = (tierId) => t(`schools.pricing.tiers.${tierId}.name`);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const body = {
        name:             form.name,
        email:            form.email,
        phone:            form.phone || null,
        role:             'school',
        school_name:      form.school_name,
        qudurat_students: qCount || null,
        tahsili_students: tCount || null,
        message:          form.message || null,
        context:          'schools_page',
      };
      const res  = await fetch(`${BASE}/api/schools/leads`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setSubmitted(true);
    } catch (err) {
      setError(err?.error?.message || t('schools.form.error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — dark, pulls behind transparent navbar
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="sch-hero">
        <div className="sch-grid" />
        <div className="sch-orb sch-orb-1" />
        <div className="sch-orb sch-orb-2" />

        <div className="sch-container" style={{ textAlign: 'center' }}>
          <div className="sch-eyebrow">
            <span className="sch-eyebrow-dot" />
            {t('schools.hero.eyebrow')}
          </div>

          <h1 className="sch-hero-title">
            {t('schools.hero.title_line1')}<br />
            <span style={{ color: '#4ADE80' }}>{t('schools.hero.title_accent')}</span>
          </h1>

          <p className="sch-hero-sub">
            {t('schools.hero.sub')}
          </p>

          <div className="sch-hero-actions">
            <a href="#contact" className="hero-cta" style={{ textDecoration: 'none' }}>
              {t('schools.hero.cta_pricing')}
              <span className="hero-cta-arrow">{arrow}</span>
            </a>
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="sch-hero-ghost-btn"
            >
              {t('schools.hero.cta_whatsapp')}
            </a>
          </div>

          <div className="sch-hero-trust">
            <span>{t('schools.hero.trust_min_students')}</span>
            <span>{t('schools.hero.trust_365_days')}</span>
            <span>{t('schools.hero.trust_ready')}</span>
            <span>{t('schools.hero.trust_onboarding')}</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          PROBLEM — #0D1F35
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="sch-section" style={{ background: '#0D1F35' }}>
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(220,38,38,0.18) 0%, transparent 70%)',
          top: -200, left: -150,
        }} />
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(21,128,61,0.14) 0%, transparent 70%)',
          bottom: -100, right: -80,
        }} />

        <div className="sch-container">
          <div className="prob-eyebrow" style={{ display: 'inline-flex', marginBottom: 24 }}>
            {t('schools.problem.eyebrow')}
          </div>
          <h2 className="sch-section-title">
            {t('schools.problem.title_before')}{' '}
            <span style={{ color: '#F87171' }}>{t('schools.problem.title_accent')}</span>
          </h2>
          <p className="sch-section-sub">
            {t('schools.problem.sub')}
          </p>

          {/* Problem rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700, marginBottom: 16 }}>
            {problems.map((item, i) => (
              <div key={i} className="sch-problem-item">
                <span className="sch-problem-icon">✕</span>
                <span className="sch-problem-text">{item}</span>
              </div>
            ))}
          </div>

          {/* Solution row */}
          <div className="sch-solution-item" style={{ maxWidth: 700 }}>
            <span style={{ color: '#4ADE80', fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>{arrow}</span>
            <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, lineHeight: 1.6 }}>
              {t('schools.problem.solution')}
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          RESULTS + FEATURES — #0B3D2E
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="sch-section" style={{ background: '#0B3D2E' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 50% at 10% 20%, rgba(74,222,128,0.1) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 90% 80%, rgba(21,128,61,0.18) 0%, transparent 70%)',
        }} />

        <div className="sch-container">
          <div className="val-eyebrow" style={{ display: 'inline-flex', marginBottom: 20 }}>
            {t('schools.results.eyebrow')}
          </div>
          <h2 className="sch-section-title">{t('schools.results.title')}</h2>
          <p className="sch-section-sub">
            {t('schools.results.sub')}
          </p>

          {/* Outcome stat cards */}
          <div className="sch-outcomes-grid">
            {outcomes.map((o, i) => (
              <div key={i} className="sch-outcome-card">
                <div className="sch-outcome-stat">{o.stat}</div>
                <div className="sch-outcome-label">{o.label}</div>
                <div className="sch-outcome-desc">{o.desc}</div>
              </div>
            ))}
          </div>

          {/* Feature cards — white on dark */}
          <div className="sch-features-grid">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div key={i} className="sch-feature-card">
                  <div className="sch-feature-icon">
                    {Icon ? <Icon size={24} strokeWidth={1.5} /> : null}
                  </div>
                  <div className="sch-feature-title">{f.title}</div>
                  <div className="sch-feature-desc">{f.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          PRICING — #0F172A
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="sch-section" style={{ background: '#0F172A' }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 40% 60% at 0% 50%, rgba(198,168,91,0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 100% 50%, rgba(21,128,61,0.1) 0%, transparent 70%)',
        }} />

        <div className="sch-container">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="cmp-eyebrow" style={{ display: 'inline-flex', marginBottom: 20 }}>
              {t('schools.pricing.eyebrow')}
            </div>
            <h2 className="sch-section-title">{t('schools.pricing.title')}</h2>
            <p className="sch-section-sub" style={{ margin: '0 auto' }}>
              {t('schools.pricing.sub')}
            </p>
          </div>

          {/* Pricing cards — white cards naturally pop on dark */}
          <div className="pricing-grid" style={{ maxWidth: 680, margin: '0 auto 20px' }}>
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={[
                  'pricing-card',
                  tier.ghost ? 'ghost' : '',
                  tier.gold  ? 'gold'  : '',
                ].filter(Boolean).join(' ')}
              >
                {tier.hasBadge && (
                  <div className="pricing-gold-badge">
                    {t(`schools.pricing.tiers.${tier.id}.badge`)}
                  </div>
                )}
                <div className="pricing-card-header">
                  <div className={`pricing-plan-name ${tier.gold ? 'gold-name' : ''}`}>
                    {t(`schools.pricing.tiers.${tier.id}.range`)}
                  </div>
                  <div className="pricing-plan-price">
                    <span className="pricing-price-currency">{t('schools.pricing.card.currency')} </span>
                    <span className="pricing-price-amount">{tier.price}</span>
                    <span className="pricing-price-period">{t('schools.pricing.card.per_student')}</span>
                  </div>
                  <div className="pricing-plan-worlds">
                    {t('schools.pricing.card.details', { minStudents: tier.minStudents })}
                  </div>
                </div>
                <ul className="pricing-feature-list">
                  <li className="pricing-feature-item">
                    <span className="pricing-check">✓</span>
                    {t('schools.pricing.card.feature_min_students', { count: tier.minStudents })}
                  </li>
                  <li className="pricing-feature-item">
                    <span className="pricing-check">✓</span>
                    {t('schools.pricing.card.feature_access')}
                  </li>
                  <li className="pricing-feature-item">
                    <span className="pricing-check">✓</span>
                    {t('schools.pricing.card.feature_dashboard')}
                  </li>
                </ul>
                <div className="pricing-card-actions">
                  <a
                    href="#contact"
                    className={[
                      'btn btn-full',
                      tier.gold  ? 'btn-gold'  : '',
                      tier.ghost ? 'btn-ghost' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {t('schools.pricing.card.cta', { arrow })}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            {t('schools.pricing.footnote')}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — #0A1628
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="sch-section" style={{ background: '#0A1628' }}>
        <div className="sch-grid" />
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)',
          top: '50%', left: '60%', transform: 'translate(-50%, -50%)',
        }} />

        <div className="sch-container">
          <div className="val-eyebrow" style={{ display: 'inline-flex', marginBottom: 20 }}>
            {t('schools.process.eyebrow')}
          </div>
          <h2 className="sch-section-title">{t('schools.process.title')}</h2>
          <p className="sch-section-sub">
            {t('schools.process.sub')}
          </p>

          <div className="sch-steps">
            {steps.map((s, i) => (
              <div key={i} className="sch-step">
                <div className="sch-step-num">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <div className="sch-step-title">{s.title}</div>
                  <div className="sch-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          BOOK A CALL CTA — gradient green (matches fcta-section)
          ══════════════════════════════════════════════════════════════════════ */}
      <section
        className="sch-section"
        style={{ background: 'linear-gradient(135deg, #052E16 0%, #14532D 40%, #052E16 100%)' }}
      >
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(74,222,128,0.2) 0%, transparent 70%)',
          top: -150, left: -80,
        }} />
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(21,128,61,0.25) 0%, transparent 70%)',
          bottom: -100, right: -60,
        }} />

        <div className="sch-container" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: 20 }}>📅</div>
          <div className="fcta-eyebrow">
            <span className="fcta-eyebrow-dot" />
            {t('schools.call_cta.eyebrow')}
          </div>
          <h2 className="sch-section-title">{t('schools.call_cta.title')}</h2>
          <p className="sch-section-sub" style={{ margin: '0 auto 32px' }}>
            {t('schools.call_cta.sub')}
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            {CALENDLY_URL !== 'YOUR_CALENDLY_LINK' ? (
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="fcta-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                {t('schools.call_cta.cta_book', { arrow })}
              </a>
            ) : (
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fcta-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                {t('schools.call_cta.cta_whatsapp', { arrow })}
              </a>
            )}
            <a href="#contact" className="sch-ghost-btn">
              {t('schools.call_cta.cta_form')}
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTACT FORM — #0D1F35
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="sch-section" id="contact" style={{ background: '#0D1F35' }}>
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(21,128,61,0.12) 0%, transparent 70%)',
          top: 0, right: 0,
        }} />

        <div className="sch-container">
          <div style={{ marginBottom: 40 }}>
            <div className="val-eyebrow" style={{ display: 'inline-flex', marginBottom: 16 }}>
              {t('schools.form.eyebrow')}
            </div>
            <h2 className="sch-section-title">{t('schools.form.title')}</h2>
            <p className="sch-section-sub">
              {t('schools.form.sub')}
            </p>
          </div>

          {submitted ? (
            <div className="sch-success-card">
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
              <h3 className="sch-success-title">{t('schools.form.success_title')}</h3>
              <p className="sch-success-sub">
                {t('schools.form.success_body_before')}
                <strong style={{ color: '#4ADE80' }}>{form.email}</strong>
                {t('schools.form.success_body_after')}
              </p>
              <Link
                to="/"
                className="hero-cta"
                style={{ marginTop: 28, textDecoration: 'none', display: 'inline-flex' }}
              >
                {t('schools.form.success_back')}
              </Link>
            </div>
          ) : (
            <div className="sch-form-card">
              {error && (
                <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Row: name + email */}
                <div className="schools-form-row">
                  <div className="form-group">
                    <label className="sch-form-label">{t('schools.form.label_name')}</label>
                    <input
                      className="sch-form-input"
                      value={form.name} onChange={set('name')} required
                      placeholder={t('schools.form.ph_name')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="sch-form-label">{t('schools.form.label_email')}</label>
                    <input
                      className="sch-form-input" type="email"
                      value={form.email} onChange={set('email')} required
                      placeholder={t('schools.form.ph_email')}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="form-group">
                  <label className="sch-form-label">{t('schools.form.label_phone')}</label>
                  <input
                    className="sch-form-input" type="tel"
                    value={form.phone} onChange={set('phone')}
                    placeholder={t('schools.form.ph_phone')}
                  />
                </div>

                {/* School name */}
                <div className="form-group">
                  <label className="sch-form-label">{t('schools.form.label_school')}</label>
                  <input
                    className="sch-form-input"
                    value={form.school_name} onChange={set('school_name')}
                    placeholder={t('schools.form.ph_school')}
                    required
                  />
                </div>

                {/* Row: student counts */}
                <div className="schools-form-row">
                  <div className="form-group">
                    <label className="sch-form-label">{t('schools.form.label_qudurat_count')}</label>
                    <input
                      className="sch-form-input" type="number" min={0}
                      value={form.qudurat_students} onChange={set('qudurat_students')}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="sch-form-label">{t('schools.form.label_tahsili_count')}</label>
                    <input
                      className="sch-form-input" type="number" min={0}
                      value={form.tahsili_students} onChange={set('tahsili_students')}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Live estimate */}
                {(qCount > 0 || tCount > 0) && (
                  <div className="sch-estimate">
                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 6, display: 'block' }}>
                      {t('schools.form.estimate.title')}
                    </span>
                    {qCount > 0 && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)', minWidth: 72 }}>
                          {t('schools.form.estimate.qudurat_label')}
                        </span>
                        {qEst ? (
                          <>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                              {t('schools.form.estimate.calc', { count: qCount, price: qEst.tier.price })}
                            </span>
                            <span style={{ fontWeight: 700, color: '#4ADE80' }}>
                              {t('schools.form.estimate.total_line', { total: qEst.total.toLocaleString() })}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                              ({getTierName(qEst.tier.id)})
                            </span>
                          </>
                        ) : (
                          <span style={{ color: '#FBBF24' }}>{t('schools.form.estimate.min_warning')}</span>
                        )}
                      </div>
                    )}
                    {tCount > 0 && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)', minWidth: 72 }}>
                          {t('schools.form.estimate.tahsili_label')}
                        </span>
                        {tEst ? (
                          <>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                              {t('schools.form.estimate.calc', { count: tCount, price: tEst.tier.price })}
                            </span>
                            <span style={{ fontWeight: 700, color: '#4ADE80' }}>
                              {t('schools.form.estimate.total_line', { total: tEst.total.toLocaleString() })}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                              ({getTierName(tEst.tier.id)})
                            </span>
                          </>
                        ) : (
                          <span style={{ color: '#FBBF24' }}>{t('schools.form.estimate.min_warning')}</span>
                        )}
                      </div>
                    )}
                    {(qEst || tEst) && (
                      <div style={{
                        marginTop: 8, paddingTop: 10,
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF',
                      }}>
                        {t('schools.form.estimate.grand_total', {
                          total: ((qEst?.total || 0) + (tEst?.total || 0)).toLocaleString(),
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Message */}
                <div className="form-group">
                  <label className="sch-form-label">{t('schools.form.label_message')}</label>
                  <textarea
                    className="sch-form-input" rows={3}
                    value={form.message} onChange={set('message')}
                    placeholder={t('schools.form.ph_message')}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="hero-cta"
                  style={{ justifyContent: 'center', width: '100%', marginTop: 4 }}
                  disabled={submitting}
                >
                  {submitting
                    ? t('schools.form.submitting')
                    : t('schools.form.submit', { arrow })}
                </button>

                {/* Footer */}
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: 20, marginTop: 4,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  alignItems: 'center', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
                    {t('schools.form.footer_response')}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>
                    {t('schools.form.footer_message_prefix')}{' '}
                    <a
                      href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#4ADE80', fontWeight: 700, textDecoration: 'none' }}
                    >
                      {t('schools.form.footer_whatsapp_link')}
                    </a>
                  </p>
                  <a
                    href="mailto:info@drfahm.com"
                    style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}
                  >
                    info@drfahm.com
                  </a>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>
    </>
  );
}