import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const TIERS = [
  { range: '1–50',    price: 'SAR 3,500',  per: '~SAR 70/student', color: '#16a34a' },
  { range: '51–200',  price: 'SAR 9,000',  per: '~SAR 45/student', color: '#7c3aed', popular: true },
  { range: '201–500', price: 'SAR 16,000', per: '~SAR 32/student', color: '#0891b2' },
  { range: '500+',    price: 'Custom',     per: 'Contact us',       color: '#d97706' },
];

const FEATURES = [
  { icon: '👤', title: 'Bulk student accounts',     desc: 'Generate hundreds of accounts instantly. Each student gets a unique login with pre-set access.' },
  { icon: '📊', title: 'Teacher dashboard',         desc: 'Track every student\'s world progress and level pass rate from a single view.' },
  { icon: '🔒', title: 'Managed access control',    desc: 'Students only see content you\'ve activated. Lock or unlock worlds per student group.' },
  { icon: '📋', title: 'CSV export',                desc: 'Export student progress reports for internal reporting or parent communication.' },
  { icon: '🔑', title: 'School leader account',     desc: 'One designated school leader manages all student accounts without admin intervention.' },
  { icon: '💬', title: 'Dedicated onboarding',      desc: 'We set up your org, configure access, and brief your team. No tech knowledge required.' },
];

const STEPS = [
  { num: '01', title: 'Submit the form', desc: 'Tell us about your school and how many students you\'re preparing.' },
  { num: '02', title: 'We send a proposal', desc: 'Within 1–2 business days, you\'ll receive a tailored quote and implementation plan.' },
  { num: '03', title: 'We set up your org', desc: 'We provision all accounts, configure access, and give your team a walkthrough.' },
  { num: '04', title: 'Students start learning', desc: 'Accounts are ready to use from day one. No setup required on your end.' },
];

const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function Schools() {
  const [form, setForm] = useState({
    name: '', email: '', school_name: '', role: 'school',
    qudurat_students: '', tahsili_students: '',
    preferred_duration: '', message: '', context: 'schools_page',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const total = (parseInt(form.qudurat_students) || 0) + (parseInt(form.tahsili_students) || 0);

  const estimatedTier = TIERS.find((t) => {
    if (t.range === '500+') return total >= 500;
    const [lo, hi] = t.range.split('–').map(Number);
    return total >= lo && total <= hi;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const body = {
        name:                form.name,
        email:               form.email,
        role:                'school',
        school_name:         form.school_name,
        qudurat_students:    form.qudurat_students ? parseInt(form.qudurat_students) : null,
        tahsili_students:    form.tahsili_students ? parseInt(form.tahsili_students) : null,
        preferred_duration:  form.preferred_duration || null,
        message:             form.message || null,
        context:             'schools_page',
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
          <p className="schools-section-sub">One-time annual fee. Covers both Qudurat and Tahsili.</p>
          <div className="schools-tiers-grid">
            {TIERS.map((t) => (
              <div key={t.range} className={`schools-tier-card ${t.popular ? 'popular' : ''}`}
                style={{ borderColor: `${t.color}40` }}>
                {t.popular && <div className="schools-tier-badge" style={{ background: t.color }}>Most common</div>}
                <div className="schools-tier-range" style={{ color: t.color }}>{t.range} students</div>
                <div className="schools-tier-price">{t.price}</div>
                <div className="schools-tier-per">{t.per}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 12 }}>
            All prices include both exams. Prices in SAR. Custom contracts available for large institutions.
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
          <h2 className="schools-section-title">How onboarding works</h2>
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
          <h2 className="schools-section-title">Get a quote</h2>
          <p className="schools-section-sub">Fill in the form and we'll respond within 1–2 business days.</p>

          {submitted ? (
            <div className="schools-success">
              <div className="schools-success-icon">✅</div>
              <h3 className="schools-success-title">We've received your request!</h3>
              <p className="schools-success-body">
                We'll review your details and send a proposal to <strong>{form.email}</strong> within 1–2 business days.
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
                <input className="form-input" value={form.school_name} onChange={set('school_name')} placeholder="e.g. Al Noor International School, Riyadh" required />
              </div>

              <div className="schools-form-row">
                <div className="form-group">
                  <label className="form-label">Students preparing for Qudurat</label>
                  <input className="form-input" type="number" min={0} value={form.qudurat_students} onChange={set('qudurat_students')} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Students preparing for Tahsili</label>
                  <input className="form-input" type="number" min={0} value={form.tahsili_students} onChange={set('tahsili_students')} placeholder="0" />
                </div>
              </div>

              {/* Live estimate */}
              {total > 0 && (
                <div className="schools-estimate">
                  <span>📊 Estimated for <strong>{total} students</strong>:</span>
                  {estimatedTier ? (
                    <span style={{ color: 'var(--green-light)', fontWeight: 700 }}>
                      {estimatedTier.price} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({estimatedTier.per})</span>
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>Custom quote</span>}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Preferred duration</label>
                <select className="form-input" value={form.preferred_duration} onChange={set('preferred_duration')}>
                  <option value="">Not sure yet</option>
                  <option value="1_semester">1 semester (~5 months)</option>
                  <option value="1_year">1 year</option>
                  <option value="2_years">2 years</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Anything else you'd like us to know?</label>
                <textarea className="form-input" rows={3} value={form.message} onChange={set('message')}
                  placeholder="e.g. exam dates, special requirements, existing LMS integration…" />
              </div>

              <button type="submit" className="btn btn-green btn-lg btn-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send request'}
              </button>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 10 }}>
                We respond within 1–2 business days. No spam.
              </p>
            </form>
          )}
        </section>
      </div>
    </>
  );
}