import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  Users, LayoutDashboard, ShieldCheck,
  FileBarChart2, Crown, HeadphonesIcon,
} from 'lucide-react';

// ── Config (unchanged) ────────────────────────────────────────────────────────
const CALENDLY_URL       = 'https://calendly.com/drfahm-info/30min';
const WA_NUMBER          = '447346463512';
const WA_SCHOOLS_MESSAGE = encodeURIComponent('Hi, I am interested in DrFahm for schools');

// ── Data (unchanged) ──────────────────────────────────────────────────────────
const TIERS = [
  {
    id: 'standard', name: 'Standard', range: '30-99 STUDENTS',
    price: 99, duration: '365 days', minStudents: 30,
    ghost: true, gold: false, badge: null,
  },
  {
    id: 'volume', name: 'Volume', range: '100+ STUDENTS',
    price: 75, duration: '365 days', minStudents: 100,
    ghost: false, gold: true, badge: 'Best Value',
  },
];

const PROBLEMS = [
  'Students study randomly — no structure, no clear path forward',
  'Teachers have no visibility into who is struggling or why',
  'Effort does not translate to score improvement without focused practice',
];

const FEATURES = [
  {
    icon:  <Users size={24} strokeWidth={1.5} />,
    title: 'Bulk student accounts',
    desc:  'Provision hundreds of accounts instantly. Each student gets a unique login with pre-set exam access.',
  },
  {
    icon:  <LayoutDashboard size={24} strokeWidth={1.5} />,
    title: 'Teacher dashboard',
    desc:  "Track every student's world progress and level pass rate from a single view. Know who needs attention.",
  },
  {
    icon:  <ShieldCheck size={24} strokeWidth={1.5} />,
    title: 'Managed access control',
    desc:  'Students only see what you have activated. Lock or unlock worlds per student group from one place.',
  },
  {
    icon:  <FileBarChart2 size={24} strokeWidth={1.5} />,
    title: 'Progress reports',
    desc:  'Export student progress data for internal reporting, parent communication, or teacher review.',
  },
  {
    icon:  <Crown size={24} strokeWidth={1.5} />,
    title: 'School leader account',
    desc:  'One designated leader manages all student accounts. No admin intervention required after setup.',
  },
  {
    icon:  <HeadphonesIcon size={24} strokeWidth={1.5} />,
    title: 'Dedicated onboarding',
    desc:  'We set up your org, configure access, and brief your team. No technical knowledge needed on your end.',
  },
];

const OUTCOMES = [
  {
    stat:  'From day 1',
    label: 'Students have access',
    desc:  'Accounts are live and ready to use from the moment we finish setup. No delays.',
  },
  {
    stat:  'One view',
    label: 'Full class visibility',
    desc:  "See every student's progress, completion rate, and weak areas in a single dashboard.",
  },
  {
    stat:  'Per exam',
    label: 'Flexible licensing',
    desc:  'Pay only for the exams your students need — Qudurat, Tahsili, or both.',
  },
];

const STEPS = [
  {
    num:   '01',
    title: 'Contact us',
    desc:  'Fill in the form below or reach us on WhatsApp. We will call you back within one business day.',
  },
  {
    num:   '02',
    title: 'Agree the deal',
    desc:  'We confirm your student count and send a secure payment link — payable by Mada, Visa, or Mastercard.',
  },
  {
    num:   '03',
    title: 'We set everything up',
    desc:  'We provision all accounts, configure access, and give your team a walkthrough. Nothing on your end.',
  },
  {
    num:   '04',
    title: 'Students start learning',
    desc:  'Accounts are ready on day one. Students log in and begin their structured path immediately.',
  },
];

// ── Helpers (unchanged) ───────────────────────────────────────────────────────
const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function getTierForCount(count) {
  if (count >= 100) return TIERS[1];
  if (count >= 30)  return TIERS[0];
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Schools() {
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

  // ── Submit (unchanged) ──────────────────────────────────────────────────────
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
      setError(err?.error?.message || 'Something went wrong. Please try again.');
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
            For Schools
          </div>

          <h1 className="sch-hero-title">
            Give every student a<br />
            <span style={{ color: '#4ADE80' }}>structured exam path</span>
          </h1>

          <p className="sch-hero-sub">
            DrFahm for schools — bulk accounts, teacher visibility, managed
            access. All set up by us, ready on day one.
          </p>

          <div className="sch-hero-actions">
            <a href="#contact" className="hero-cta" style={{ textDecoration: 'none' }}>
              Get school pricing
              <span className="hero-cta-arrow">→</span>
            </a>
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="sch-hero-ghost-btn"
            >
              Message on WhatsApp
            </a>
          </div>

          <div className="sch-hero-trust">
            <span>✓ Min 30 students</span>
            <span>✓ 365 days access</span>
            <span>✓ Ready from day 1</span>
            <span>✓ Dedicated onboarding</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          PROBLEM — #0D1F35
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="sch-section" style={{ background: '#0D1F35' }}>
        {/* orbs */}
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
          {/* eyebrow */}
          <div className="prob-eyebrow" style={{ display: 'inline-flex', marginBottom: 24 }}>
            The Problem
          </div>
          <h2 className="sch-section-title">
            What is holding your{' '}
            <span style={{ color: '#F87171' }}>students back</span>
          </h2>
          <p className="sch-section-sub">
            Most schools have hardworking students and motivated teachers — but no
            system that ties effort to results.
          </p>

          {/* Problem rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700, marginBottom: 16 }}>
            {PROBLEMS.map((item) => (
              <div key={item} className="sch-problem-item">
                <span className="sch-problem-icon">✕</span>
                <span className="sch-problem-text">{item}</span>
              </div>
            ))}
          </div>

          {/* Solution row */}
          <div className="sch-solution-item" style={{ maxWidth: 700 }}>
            <span style={{ color: '#4ADE80', fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>→</span>
            <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, lineHeight: 1.6 }}>
              DrFahm gives every student a clear, structured path — and gives you
              the visibility to see it working.
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
          {/* header */}
          <div className="val-eyebrow" style={{ display: 'inline-flex', marginBottom: 20 }}>
            Results
          </div>
          <h2 className="sch-section-title">What your school gets</h2>
          <p className="sch-section-sub">
            Everything your school needs to run structured, measurable exam prep
            — without any technical overhead.
          </p>

          {/* Outcome stat cards */}
          <div className="sch-outcomes-grid">
            {OUTCOMES.map((o) => (
              <div key={o.label} className="sch-outcome-card">
                <div className="sch-outcome-stat">{o.stat}</div>
                <div className="sch-outcome-label">{o.label}</div>
                <div className="sch-outcome-desc">{o.desc}</div>
              </div>
            ))}
          </div>

          {/* Feature cards — white on dark */}
          <div className="sch-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="sch-feature-card">
                <div className="sch-feature-icon">{f.icon}</div>
                <div className="sch-feature-title">{f.title}</div>
                <div className="sch-feature-desc">{f.desc}</div>
              </div>
            ))}
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
              Pricing
            </div>
            <h2 className="sch-section-title">Simple, transparent pricing</h2>
            <p className="sch-section-sub" style={{ margin: '0 auto' }}>
              One-time annual fee, per exam. Pay for Qudurat, Tahsili, or both.
            </p>
          </div>

          {/* Pricing cards — white cards naturally pop on dark */}
          <div className="pricing-grid" style={{ maxWidth: 680, margin: '0 auto 20px' }}>
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={[
                  'pricing-card',
                  t.ghost ? 'ghost' : '',
                  t.gold  ? 'gold'  : '',
                ].filter(Boolean).join(' ')}
              >
                {t.badge && <div className="pricing-gold-badge">{t.badge}</div>}
                <div className="pricing-card-header">
                  <div className={`pricing-plan-name ${t.gold ? 'gold-name' : ''}`}>
                    {t.range}
                  </div>
                  <div className="pricing-plan-price">
                    <span className="pricing-price-currency">SAR </span>
                    <span className="pricing-price-amount">{t.price}</span>
                    <span className="pricing-price-period"> / student</span>
                  </div>
                  <div className="pricing-plan-worlds">
                    per exam &middot; 365 days &middot; min {t.minStudents} students
                  </div>
                </div>
                <ul className="pricing-feature-list">
                  <li className="pricing-feature-item">
                    <span className="pricing-check">✓</span>
                    Minimum {t.minStudents} students
                  </li>
                  <li className="pricing-feature-item">
                    <span className="pricing-check">✓</span>
                    Full access for 365 days
                  </li>
                  <li className="pricing-feature-item">
                    <span className="pricing-check">✓</span>
                    Teacher dashboard included
                  </li>
                </ul>
                <div className="pricing-card-actions">
                  <a
                    href="#contact"
                    className={[
                      'btn btn-full',
                      t.gold  ? 'btn-gold'  : '',
                      t.ghost ? 'btn-ghost' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    Get started →
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            Prices in SAR. Payment via Mada, Visa or Mastercard — secure Stripe checkout.
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
            Process
          </div>
          <h2 className="sch-section-title">How it works</h2>
          <p className="sch-section-sub">
            From first contact to students learning — typically under 2 business days.
          </p>

          <div className="sch-steps">
            {STEPS.map((s) => (
              <div key={s.num} className="sch-step">
                <div className="sch-step-num">{s.num}</div>
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
        {/* orbs */}
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
            Talk to us
          </div>
          <h2 className="sch-section-title">Prefer to talk first?</h2>
          <p className="sch-section-sub" style={{ margin: '0 auto 32px' }}>
            Book a free 15-minute call with our team. We will answer your questions
            and walk you through the platform.
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
                Book a 15-min call →
              </a>
            ) : (
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fcta-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Message us on WhatsApp →
              </a>
            )}
            <a href="#contact" className="sch-ghost-btn">
              Or fill in the form ↓
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
              Get started
            </div>
            <h2 className="sch-section-title">Tell us about your school</h2>
            <p className="sch-section-sub">
              We will be in touch within one business day.
            </p>
          </div>

          {submitted ? (
            <div className="sch-success-card">
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
              <h3 className="sch-success-title">Request received!</h3>
              <p className="sch-success-sub">
                We will be in touch at{' '}
                <strong style={{ color: '#4ADE80' }}>{form.email}</strong>{' '}
                within one business day.
              </p>
              <Link
                to="/"
                className="hero-cta"
                style={{ marginTop: 28, textDecoration: 'none', display: 'inline-flex' }}
              >
                Back to home
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
                    <label className="sch-form-label">Your name *</label>
                    <input
                      className="sch-form-input"
                      value={form.name} onChange={set('name')} required
                      placeholder="e.g. Ahmed Al-Rashid"
                    />
                  </div>
                  <div className="form-group">
                    <label className="sch-form-label">Work email *</label>
                    <input
                      className="sch-form-input" type="email"
                      value={form.email} onChange={set('email')} required
                      placeholder="you@school.edu.sa"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="form-group">
                  <label className="sch-form-label">Phone (optional)</label>
                  <input
                    className="sch-form-input" type="tel"
                    value={form.phone} onChange={set('phone')}
                    placeholder="+966 5X XXX XXXX"
                  />
                </div>

                {/* School name */}
                <div className="form-group">
                  <label className="sch-form-label">School name *</label>
                  <input
                    className="sch-form-input"
                    value={form.school_name} onChange={set('school_name')}
                    placeholder="e.g. Al Noor International School, Riyadh"
                    required
                  />
                </div>

                {/* Row: student counts */}
                <div className="schools-form-row">
                  <div className="form-group">
                    <label className="sch-form-label">Students preparing for Qudurat</label>
                    <input
                      className="sch-form-input" type="number" min={0}
                      value={form.qudurat_students} onChange={set('qudurat_students')}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="sch-form-label">Students preparing for Tahsili</label>
                    <input
                      className="sch-form-input" type="number" min={0}
                      value={form.tahsili_students} onChange={set('tahsili_students')}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Live estimate (unchanged logic) */}
                {(qCount > 0 || tCount > 0) && (
                  <div className="sch-estimate">
                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 6, display: 'block' }}>
                      Estimated pricing
                    </span>
                    {qCount > 0 && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)', minWidth: 72 }}>Qudurat</span>
                        {qEst ? (
                          <>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{qCount} × SAR {qEst.tier.price}</span>
                            <span style={{ fontWeight: 700, color: '#4ADE80' }}>= SAR {qEst.total.toLocaleString()}</span>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>({qEst.tier.name})</span>
                          </>
                        ) : (
                          <span style={{ color: '#FBBF24' }}>Minimum 30 students required</span>
                        )}
                      </div>
                    )}
                    {tCount > 0 && (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)', minWidth: 72 }}>Tahsili</span>
                        {tEst ? (
                          <>
                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{tCount} × SAR {tEst.tier.price}</span>
                            <span style={{ fontWeight: 700, color: '#4ADE80' }}>= SAR {tEst.total.toLocaleString()}</span>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>({tEst.tier.name})</span>
                          </>
                        ) : (
                          <span style={{ color: '#FBBF24' }}>Minimum 30 students required</span>
                        )}
                      </div>
                    )}
                    {(qEst || tEst) && (
                      <div style={{
                        marginTop: 8, paddingTop: 10,
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF',
                      }}>
                        Total estimate: SAR {((qEst?.total || 0) + (tEst?.total || 0)).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Message */}
                <div className="form-group">
                  <label className="sch-form-label">Anything else you would like us to know?</label>
                  <textarea
                    className="sch-form-input" rows={3}
                    value={form.message} onChange={set('message')}
                    placeholder="e.g. exam dates, number of classes, special requirements"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="hero-cta"
                  style={{ justifyContent: 'center', width: '100%', marginTop: 4 }}
                  disabled={submitting}
                >
                  {submitting ? 'Sending...' : 'Send request →'}
                </button>

                {/* Footer */}
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: 20, marginTop: 4,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  alignItems: 'center', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
                    We respond within 1 business day.
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>
                    Prefer to message us?{' '}
                    <a
                      href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#4ADE80', fontWeight: 700, textDecoration: 'none' }}
                    >
                      Reach us on WhatsApp
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