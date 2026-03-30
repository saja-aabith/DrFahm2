import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

// ── Pricing tiers — update here if pricing changes ───────────────────────────
const TIERS = [
  {
    id:               'standard',
    label:            'Standard',
    range:            '30–99 students',
    pricePerStudent:  99,
    display:          'SAR 99 / student',
    minStudents:      30,
    color:            '#16a34a',
    popular:          false,
  },
  {
    id:               'volume',
    label:            'Volume',
    range:            '100+ students',
    pricePerStudent:  75,
    display:          'SAR 75 / student',
    minStudents:      100,
    color:            '#7c3aed',
    popular:          true,
  },
];

function getTierForCount(count) {
  if (count >= 100) return TIERS[1];
  if (count >= 30)  return TIERS[0];
  return null;
}

const FEATURES = [
  { icon: '👤', title: 'Bulk student accounts',  desc: 'Generate hundreds of accounts instantly. Each student gets a unique login with pre-set access.' },
  { icon: '📊', title: 'Teacher dashboard',      desc: "Track every student's world progress and level pass rate from a single view." },
  { icon: '🔒', title: 'Managed access control', desc: "Students only see content you've activated. Lock or unlock worlds per student group." },
  { icon: '📋', title: 'CSV export',             desc: 'Export student progress reports for internal reporting or parent communication.' },
  { icon: '🔑', title: 'School leader account',  desc: 'One designated school leader manages all student accounts without admin intervention.' },
  { icon: '💬', title: 'Dedicated onboarding',   desc: 'We set up your org, configure access, and brief your team. No tech knowledge required.' },
];

const STEPS = [
  { num: '01', title: 'Contact us',         desc: "Fill in the form below or reach us on WhatsApp. We'll call you back within one business day." },
  { num: '02', title: 'Agree the deal',     desc: 'Our team will confirm your student count and send a secure payment link — payable instantly by Mada, Visa or Mastercard.' },
  { num: '03', title: 'We set up your org', desc: 'We provision all accounts, configure access, and give your team a walkthrough.' },
  { num: '04', title: 'Students start learning', desc: 'Accounts are ready to use from day one. No setup required on your end.' },
];

const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function Schools() {
  const [form, setForm] = useState({
    name: '', email: '', school_name: '',
    qudurat_students: '', tahsili_students: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const qCount = parseInt(form.qudurat_students) || 0;
  const tCount = parseInt(form.tahsili_students) || 0;

  // Estimate per exam (tiers apply independently per exam)
  function examEstimate(count) {
    const tier = getTierForCount(count);
    if (!tier || count < 1) return null;
    return { tier, total: tier.pricePerStudent * count };
  }

  const qEstimate = examEstimate(qCount);
  const tEstimate = examEstimate(tCount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const body = {
        name:             form.name,
        email:            form.email,
        role:             'school',
        school_name:      form.school_name,
        qudurat_students: qCount || null,
        tahsili_students: tCount || null,
        message:          form.message || null,
        context:          'schools_page',
      };
      const res = await fetch(`${BASE}/api/schools/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

      {/* ── Hero ── */}
      <div className="schools-hero">
        <div className="home-section-tag" style={{ display: 'flex', justifyContent: 'center' }}>For Schools</div>
        <h1 className="schools-hero-title">DrFahm for your whole school</h1>
        <p className="schools-hero-sub">
          Bulk accounts · Teacher dashboards · Managed access — all set up by us, ready on day one.
        </p>
      </div>

      <div className="schools-container">

        {/* ── Pricing tiers ── */}
        <section className="schools-section">
          <h2 className="schools-section-title">School pricing</h2>
          <p className="schools-section-sub">
            One-time annual fee, per exam. Pay for Qudurat, Tahsili, or both — only what you need.
          </p>
          <div className="schools-tiers-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 600, margin: '0 auto' }}>
            {TIERS.map((t) => (
              <div key={t.id}
                className={`schools-tier-card ${t.popular ? 'popular' : ''}`}
                style={{ borderColor: `${t.color}40` }}>
                {t.popular && (
                  <div className="schools-tier-badge" style={{ background: t.color }}>Best value</div>
                )}
                <div className="schools-tier-range" style={{ color: t.color, fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                  {t.range}
                </div>
                <div className="schools-tier-price" style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                  {t.display}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  per exam · 365 days · minimum {t.minStudents} students
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 16 }}>
            Prices in SAR. Payment via Mada, Visa or Mastercard — secure Stripe checkout.
          </p>
        </section>

        {/* ── Features ── */}
        <section className="schools-section">
          <h2 className="schools-section-title">What your school gets</h2>
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

        {/* ── How it works ── */}
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

        {/* ── Contact form ── */}
        <section className="schools-section" id="contact">
          <h2 className="schools-section-title">Get started</h2>
          <p className="schools-section-sub">Tell us about your school and we'll be in touch within one business day.</p>

          {submitted ? (
            <div className="schools-success">
              <div className="schools-success-icon">✅</div>
              <h3 className="schools-success-title">We've received your request!</h3>
              <p className="schools-success-body">
                We'll be in touch at <strong>{form.email}</strong> within one business day.
              </p>
              <Link to="/" className="btn btn-violet" style={{ marginTop: 16 }}>Back to home</Link>
            </div>
          ) : (
            <form className="schools-form" onSubmit={handleSubmit}>
              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

              <div className="schools-form-row">
                <div className="form-group">
                  <label className="form-label">Your name *</label>
                  <input className="form-input" value={form.name} onChange={set('name')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Work email *</label>
                  <input className="form-input" type="email" value={form.email} onChange={set('email')} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">School name *</label>
                <input className="form-input" value={form.school_name} onChange={set('school_name')}
                  placeholder="e.g. Al Noor International School, Riyadh" required />
              </div>

              <div className="schools-form-row">
                <div className="form-group">
                  <label className="form-label">Students preparing for Qudurat</label>
                  <input className="form-input" type="number" min={0} value={form.qudurat_students}
                    onChange={set('qudurat_students')} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Students preparing for Tahsili</label>
                  <input className="form-input" type="number" min={0} value={form.tahsili_students}
                    onChange={set('tahsili_students')} placeholder="0" />
                </div>
              </div>

              {/* Live estimate — per exam */}
              {(qCount > 0 || tCount > 0) && (
                <div className="schools-estimate" style={{ flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    📊 Estimated pricing
                  </span>
                  {qCount > 0 && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>Qudurat</span>
                      {qEstimate ? (
                        <>
                          <span style={{ color: 'var(--text-secondary)' }}>{qCount} students × SAR {qEstimate.tier.pricePerStudent}</span>
                          <span style={{ fontWeight: 700, color: qEstimate.tier.color }}>= SAR {qEstimate.total.toLocaleString()}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({qEstimate.tier.label})</span>
                        </>
                      ) : (
                        <span style={{ color: '#b45309' }}>Minimum 30 students required</span>
                      )}
                    </div>
                  )}
                  {tCount > 0 && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>Tahsili</span>
                      {tEstimate ? (
                        <>
                          <span style={{ color: 'var(--text-secondary)' }}>{tCount} students × SAR {tEstimate.tier.pricePerStudent}</span>
                          <span style={{ fontWeight: 700, color: tEstimate.tier.color }}>= SAR {tEstimate.total.toLocaleString()}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({tEstimate.tier.label})</span>
                        </>
                      ) : (
                        <span style={{ color: '#b45309' }}>Minimum 30 students required</span>
                      )}
                    </div>
                  )}
                  {(qEstimate || tEstimate) && (
                    <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)',
                      fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      Total estimate: SAR {((qEstimate?.total || 0) + (tEstimate?.total || 0)).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Anything else you'd like us to know?</label>
                <textarea className="form-input" rows={3} value={form.message} onChange={set('message')}
                  placeholder="e.g. exam dates, number of classes, special requirements…" />
              </div>

              <button type="submit" className="btn btn-green btn-lg btn-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send request'}
              </button>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 10 }}>
                We respond within 1 business day. No spam.
              </p>
            </form>
          )}
        </section>
      </div>
    </>
  );
}