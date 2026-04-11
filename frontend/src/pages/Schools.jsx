import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

// ── Replace with your Calendly link when ready ────────────────────────────────
const CALENDLY_URL = 'YOUR_CALENDLY_LINK';
const WA_NUMBER    = '447346463512';
const WA_SCHOOLS_MESSAGE = encodeURIComponent("Hi, I am interested in DrFahm for schools");

// ── Pricing tiers ─────────────────────────────────────────────────────────────
const TIERS = [
  {
    id:          'standard',
    name:        'Standard',
    range:       '30-99 STUDENTS',
    price:       99,
    duration:    '90 days',
    minStudents: 30,
    ghost:       true,
    gold:        false,
    badge:       null,
  },
  {
    id:          'volume',
    name:        'Volume',
    range:       '100+ STUDENTS',
    price:       75,
    duration:    '365 days',
    minStudents: 100,
    ghost:       false,
    gold:        true,
    badge:       'Best Value',
  },
];

// ── Problem bullets ───────────────────────────────────────────────────────────
const PROBLEMS = [
  "Students study randomly — no structure, no clear path forward",
  "Teachers have no visibility into who is struggling or why",
  "Effort does not translate to score improvement without focused practice",
];

// ── What schools get ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon:  '👤',
    title: 'Bulk student accounts',
    desc:  'Provision hundreds of accounts instantly. Each student gets a unique login with pre-set exam access.',
  },
  {
    icon:  '📊',
    title: 'Teacher dashboard',
    desc:  "Track every student's world progress and level pass rate from a single view. Know who needs attention.",
  },
  {
    icon:  '🔒',
    title: 'Managed access control',
    desc:  "Students only see what you have activated. Lock or unlock worlds per student group from one place.",
  },
  {
    icon:  '📋',
    title: 'Progress reports',
    desc:  'Export student progress data for internal reporting, parent communication, or teacher review.',
  },
  {
    icon:  '🔑',
    title: 'School leader account',
    desc:  'One designated leader manages all student accounts. No admin intervention required after setup.',
  },
  {
    icon:  '💬',
    title: 'Dedicated onboarding',
    desc:  'We set up your org, configure access, and brief your team. No technical knowledge needed on your end.',
  },
];

// ── Outcomes ──────────────────────────────────────────────────────────────────
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

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  {
    num:   '01',
    title: 'Contact us',
    desc:  "Fill in the form below or reach us on WhatsApp. We will call you back within one business day.",
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

const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function getTierForCount(count) {
  if (count >= 100) return TIERS[1];
  if (count >= 30)  return TIERS[0];
  return null;
}

export default function Schools() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', school_name: '',
    qudurat_students: '', tahsili_students: '',
    message: '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const body = {
        name:             form.name,
        email:            form.email,
        phone:            form.phone  || null,
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

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="schools-hero">
        <div className="home-section-tag" style={{ display: 'flex', justifyContent: 'center' }}>
          For Schools
        </div>
        <h1 className="schools-hero-title">
          Give every student a structured exam preparation path
        </h1>
        <p className="schools-hero-sub">
          DrFahm for schools — bulk accounts, teacher visibility, managed access.
          All set up by us, ready on day one.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
          <a href="#contact" className="btn btn-green btn-lg">
            Get school pricing &rarr;
          </a>
          {CALENDLY_URL !== 'YOUR_CALENDLY_LINK' && (
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-lg"
            >
              Book a call
            </a>
          )}
        </div>
      </div>

      <div className="schools-container">

        {/* ── PROBLEM ──────────────────────────────────────────────────── */}
        <section className="schools-section">
          <div className="home-section-tag" style={{ marginBottom: 16 }}>
            The problem
          </div>
          <h2 className="schools-section-title" style={{ fontSize: '1.5rem', marginBottom: 20 }}>
            What is holding your students back
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 }}>
            {PROBLEMS.map((item) => (
              <div key={item} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px',
                background: 'rgba(185,28,28,0.04)',
                border: '1px solid rgba(185,28,28,0.12)',
                borderRadius: 10,
              }}>
                <span style={{ color: '#DC2626', fontWeight: 800, fontSize: '1.05rem', flexShrink: 0 }}>&#x2715;</span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', marginTop: 12, maxWidth: 640,
            background: 'rgba(21,128,61,0.05)',
            border: '1px solid rgba(21,128,61,0.15)',
            borderRadius: 10,
            fontWeight: 700, color: 'var(--brand-navy)',
          }}>
            <span style={{ color: '#15803D', fontSize: '1.2rem', flexShrink: 0 }}>&rarr;</span>
            DrFahm gives every student a clear, structured path — and gives you the visibility to see it working.
          </div>
        </section>

        {/* ── OUTCOMES ─────────────────────────────────────────────────── */}
        <section className="schools-section">
          <div className="home-section-tag" style={{ marginBottom: 16 }}>Results</div>
          <h2 className="schools-section-title" style={{ fontSize: '1.5rem', marginBottom: 24 }}>
            What your school gets
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 40,
          }}>
            {OUTCOMES.map((o) => (
              <div key={o.label} style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(21,128,61,0.2)',
                borderRadius: 12,
                padding: '24px 20px',
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803D', marginBottom: 6 }}>
                  {o.stat}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: 8 }}>
                  {o.label}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {o.desc}
                </div>
              </div>
            ))}
          </div>

          <div className="schools-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="schools-feature-card">
                <div className="schools-feature-icon">{f.icon}</div>
                <div className="schools-feature-title">{f.title}</div>
                <div className="schools-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────────── */}
        <section className="schools-section">
          <h2 className="schools-section-title">School pricing</h2>
          <p className="schools-section-sub">
            One-time annual fee, per exam. Pay for Qudurat, Tahsili, or both.
          </p>

          <div className="pricing-grid" style={{ maxWidth: 640, margin: '0 auto 16px' }}>
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={[
                  'pricing-card',
                  t.ghost ? 'ghost' : '',
                  t.gold  ? 'gold'  : '',
                ].filter(Boolean).join(' ')}
              >
                {t.badge && (
                  <div className="pricing-gold-badge">{t.badge}</div>
                )}
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
                    <span className="pricing-check">&#10003;</span>
                    Minimum {t.minStudents} students
                  </li>
                  <li className="pricing-feature-item">
                    <span className="pricing-check">&#10003;</span>
                    Full access for 365 days
                  </li>
                  <li className="pricing-feature-item">
                    <span className="pricing-check">&#10003;</span>
                    Teacher dashboard included
                  </li>
                </ul>
                <a
                  href="#contact"
                  className={[
                    'btn btn-full',
                    t.gold  ? 'btn-gold'  : '',
                    t.ghost ? 'btn-ghost' : '',
                  ].filter(Boolean).join(' ')}
                >
                  Get started &rarr;
                </a>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
            Prices in SAR. Payment via Mada, Visa or Mastercard — secure Stripe checkout.
          </p>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section className="schools-section">
          <h2 className="schools-section-title">How it works</h2>
          <div className="schools-steps">
            {STEPS.map((s) => (
              <div key={s.num} className="schools-step">
                <div className="schools-step-num">{s.num}</div>
                <div>
                  <div className="schools-step-title">{s.title}</div>
                  <div className="schools-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── BOOK A CALL ──────────────────────────────────────────────── */}
        <section className="schools-section">
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '36px 32px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>&#128197;</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: 8 }}>
              Prefer to talk first?
            </h2>
            <p style={{
              fontSize: '0.9rem', color: 'var(--text-secondary)',
              maxWidth: 420, margin: '0 auto 20px',
            }}>
              Book a free 15-minute call with our team. We will answer your questions and
              walk you through the platform.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {CALENDLY_URL !== 'YOUR_CALENDLY_LINK' ? (
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="btn btn-green">
                  Book a 15-min call &rarr;
                </a>
              ) : (
                <a
                  href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-green"
                >
                  Message us on WhatsApp &rarr;
                </a>
              )}
              <a href="#contact" className="btn btn-ghost">
                Or fill in the form &#8595;
              </a>
            </div>
          </div>
        </section>

        {/* ── CONTACT FORM ─────────────────────────────────────────────── */}
        <section className="schools-section" id="contact">
          <h2 className="schools-section-title">Get started</h2>
          <p className="schools-section-sub">
            Tell us about your school. We will be in touch within one business day.
          </p>

          {submitted ? (
            <div className="schools-success">
              <div className="schools-success-icon">&#9989;</div>
              <h3 className="schools-success-title">We have received your request!</h3>
              <p className="schools-success-body">
                We will be in touch at <strong>{form.email}</strong> within one business day.
              </p>
              <Link to="/" className="btn btn-green" style={{ marginTop: 16 }}>
                Back to home
              </Link>
            </div>
          ) : (
            <form className="schools-form" onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
              )}

              <div className="schools-form-row">
                <div className="form-group">
                  <label className="form-label">Your name *</label>
                  <input
                    className="form-input"
                    value={form.name} onChange={set('name')} required
                    placeholder="e.g. Ahmed Al-Rashid"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Work email *</label>
                  <input
                    className="form-input" type="email"
                    value={form.email} onChange={set('email')} required
                    placeholder="you@school.edu.sa"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Phone (optional)</label>
                <input
                  className="form-input" type="tel"
                  value={form.phone} onChange={set('phone')}
                  placeholder="+966 5X XXX XXXX"
                />
              </div>

              <div className="form-group">
                <label className="form-label">School name *</label>
                <input
                  className="form-input"
                  value={form.school_name} onChange={set('school_name')}
                  placeholder="e.g. Al Noor International School, Riyadh"
                  required
                />
              </div>

              <div className="schools-form-row">
                <div className="form-group">
                  <label className="form-label">Students preparing for Qudurat</label>
                  <input
                    className="form-input" type="number" min={0}
                    value={form.qudurat_students} onChange={set('qudurat_students')}
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Students preparing for Tahsili</label>
                  <input
                    className="form-input" type="number" min={0}
                    value={form.tahsili_students} onChange={set('tahsili_students')}
                    placeholder="0"
                  />
                </div>
              </div>

              {(qCount > 0 || tCount > 0) && (
                <div className="schools-estimate" style={{ flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Estimated pricing
                  </span>
                  {qCount > 0 && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>Qudurat</span>
                      {qEst ? (
                        <>
                          <span style={{ color: 'var(--text-secondary)' }}>{qCount} students x SAR {qEst.tier.price}</span>
                          <span style={{ fontWeight: 700, color: '#15803D' }}>= SAR {qEst.total.toLocaleString()}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({qEst.tier.name})</span>
                        </>
                      ) : (
                        <span style={{ color: '#b45309' }}>Minimum 30 students required</span>
                      )}
                    </div>
                  )}
                  {tCount > 0 && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>Tahsili</span>
                      {tEst ? (
                        <>
                          <span style={{ color: 'var(--text-secondary)' }}>{tCount} students x SAR {tEst.tier.price}</span>
                          <span style={{ fontWeight: 700, color: '#15803D' }}>= SAR {tEst.total.toLocaleString()}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({tEst.tier.name})</span>
                        </>
                      ) : (
                        <span style={{ color: '#b45309' }}>Minimum 30 students required</span>
                      )}
                    </div>
                  )}
                  {(qEst || tEst) && (
                    <div style={{
                      marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)',
                      fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)',
                    }}>
                      Total estimate: SAR {((qEst?.total || 0) + (tEst?.total || 0)).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Anything else you would like us to know?</label>
                <textarea
                  className="form-input" rows={3}
                  value={form.message} onChange={set('message')}
                  placeholder="e.g. exam dates, number of classes, special requirements"
                />
              </div>

              <button type="submit" className="btn btn-green btn-lg btn-full" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send request'}
              </button>

              <div style={{
                borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8,
                display: 'flex', flexDirection: 'column', gap: 6,
                alignItems: 'center', textAlign: 'center',
              }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  We respond within 1 business day.
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Prefer to call? Reach us on{' '}
                  <a
                    href={`https://wa.me/${WA_NUMBER}?text=${WA_SCHOOLS_MESSAGE}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#15803D', fontWeight: 700, textDecoration: 'none' }}
                  >
                    WhatsApp
                  </a>
                  {' '}or call{' '}
                  <a
                    href="tel:+447346463512"
                    style={{ color: '#15803D', fontWeight: 700, textDecoration: 'none' }}
                  >
                    +44 734 646 3512
                  </a>
                </p>
                <a
                  href="mailto:support@drfahm.com"
                  style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                >
                  support@drfahm.com
                </a>
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  );
}