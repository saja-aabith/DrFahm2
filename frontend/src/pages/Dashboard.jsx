import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { billing, exams as examsApi } from '../api';
import Navbar from '../components/Navbar';

const EXAM_INFO = {
  qudurat: {
    label: 'Qudurat',
    arabic: '\u0627\u0644\u0642\u062f\u0631\u0627\u062a',
    description: 'Math & Verbal aptitude \u2014 required for all Saudi university admissions.',
    worlds: 10,
    tracks: 2,
  },
  tahsili: {
    label: 'Tahsili',
    arabic: '\u0627\u0644\u062a\u062d\u0635\u064a\u0644\u064a',
    description: 'Science & Math achievement \u2014 required for science/medicine tracks.',
    worlds: 20,
    tracks: 4,
  },
};

// ── M3: Weak Topics Card ──────────────────────────────────────────────────────

const PRIORITY_STYLE = {
  high:   { color: '#B91C1C', bg: 'rgba(185,28,28,0.07)',   border: 'rgba(185,28,28,0.2)',  label: 'High priority' },
  review: { color: '#8A6E2A', bg: 'rgba(198,168,91,0.08)', border: 'rgba(198,168,91,0.25)', label: 'Review' },
};

function WeakTopicsCard({ data }) {
  if (!data?.weak_topics?.length) return null;
  const topics = data.weak_topics;
  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: '1.1rem' }}>⚠</span>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Topics to Review</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 4 }}>
          based on {data.based_on_levels} passed level{data.based_on_levels !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topics.map((t) => {
          const ps     = PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.review;
          const barPct = Math.round(t.struggle_rate * 100);
          return (
            <div key={t.topic} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 100px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.label}>
                {t.label}
              </span>
              <div style={{ height: 8, background: 'var(--bg-card-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: ps.color, borderRadius: 4, transition: 'width 0.4s ease', opacity: 0.85 }} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {t.struggled_levels}/{t.total_levels} levels
              </span>
              <span style={{ display: 'inline-flex', justifyContent: 'center', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, whiteSpace: 'nowrap' }}>
                {ps.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Trial badge — prominent, correct "days" format ────────────────────────────

function TrialBadge({ trial }) {
  if (!trial) return null;
  const now      = new Date();
  const expires  = new Date(trial.trial_expires_at);
  const active   = now < expires;
  const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

  if (!active) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', borderRadius: 20,
        background: 'rgba(185,28,28,0.07)', border: '1.5px solid rgba(185,28,28,0.25)',
        color: '#B91C1C', fontSize: '0.82rem', fontWeight: 700,
      }}>
        Trial Expired
      </span>
    );
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 13px', borderRadius: 20,
      background: 'rgba(11,93,75,0.08)', border: '1.5px solid rgba(11,93,75,0.3)',
      color: 'var(--brand-green, #0B5D4B)', fontSize: '0.85rem', fontWeight: 700,
    }}>
      ⏱ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in trial
    </span>
  );
}

// ── Exam card with prominent CTA ──────────────────────────────────────────────

function ExamCard({ examKey, entitlements, trials, progressData, isAdmin }) {
  const info  = EXAM_INFO[examKey];
  const trial = trials?.find((t) => t.exam === examKey);
  const ent   = entitlements?.find((e) => e.exam === examKey);

  let worldsCompleted = 0;
  const totalWorlds   = info.worlds;
  if (progressData) {
    worldsCompleted = progressData.worlds?.filter((w) => w.fully_completed).length || 0;
  }
  const pct = totalWorlds > 0 ? Math.round((worldsCompleted / totalWorlds) * 100) : 0;

  const trialActive   = trial && new Date() < new Date(trial.trial_expires_at);
  const trialExpired  = trial && new Date() >= new Date(trial.trial_expires_at);
  const noTrialYet    = !trial;

  // CTA label and style
  let ctaLabel = null;
  if (!isAdmin && !ent) {
    if (trialActive)   ctaLabel = 'Continue prep \u2192';
    else if (trialExpired) ctaLabel = 'Unlock access \u2192';
    else                ctaLabel = 'Start free trial \u2192';
  } else if (!isAdmin && ent) {
    ctaLabel = 'Continue prep \u2192';
  }

  return (
    <Link to={`/exam/${examKey}`} className={`exam-card ${examKey}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={`exam-badge ${examKey}`}>{examKey.toUpperCase()}</div>
      <h3 className="exam-card-title">
        {info.label}{' '}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>/ {info.arabic}</span>
      </h3>
      <p className="exam-card-desc">{info.description}</p>

      {/* Status badge */}
      <div style={{ marginBottom: 16 }}>
        {isAdmin && <span className="plan-pill premium">Admin \u2014 Full Access</span>}
        {!isAdmin && ent && (
          <span className={`plan-pill ${ent.plan_id}`} style={{ textTransform: 'capitalize' }}>{ent.plan_id} Plan</span>
        )}
        {!isAdmin && !ent && trialActive  && <TrialBadge trial={trial} />}
        {!isAdmin && !ent && trialExpired && <TrialBadge trial={trial} />}
        {!isAdmin && !ent && noTrialYet   && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 13px', borderRadius: 20,
            background: 'rgba(28,39,51,0.06)', border: '1.5px solid rgba(28,39,51,0.15)',
            color: 'var(--brand-navy, #1C2733)', fontSize: '0.85rem', fontWeight: 700,
          }}>
            7-day free trial available
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="exam-progress-bar" style={{ marginBottom: 6 }}>
        <div className="exam-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="exam-progress-label" style={{ marginBottom: ctaLabel ? 16 : 0 }}>
        {worldsCompleted} of {totalWorlds} worlds completed
      </p>

      {/* CTA button — visual only (whole card is already the link) */}
      {ctaLabel && (
        <div style={{
          marginTop: 'auto',
          padding: '10px 0 0',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 8,
            background: 'var(--brand-green, #0B5D4B)',
            color: 'var(--brand-sand, #F5F2EC)',
            fontSize: '0.9rem', fontWeight: 700,
            width: '100%', justifyContent: 'center',
          }}>
            {ctaLabel}
          </span>
        </div>
      )}
    </Link>
  );
}

function getTrialState(trials, allEntitlements) {
  const now        = new Date();
  const hasAnyPaid = allEntitlements.some((e) => now < new Date(e.entitlement_expires_at));
  if (hasAnyPaid) return 'paid';
  if (!trials || trials.length === 0) return 'no_trial';
  const allExpired = trials.every((t) => now >= new Date(t.trial_expires_at));
  const anyActive  = trials.some((t)  => now <  new Date(t.trial_expires_at));
  if (allExpired) return 'expired';
  if (anyActive)  return 'active_trial';
  return 'no_trial';
}

export default function Dashboard() {
  const { user }  = useAuth();
  const isAdmin   = user?.role === 'drfahm_admin';

  const [billingData,     setBillingData]     = useState(null);
  const [progressMap,     setProgressMap]     = useState({});
  const [weakTopicsMap,   setWeakTopicsMap]   = useState({});
  const [loadingBilling,  setLoadingBilling]  = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(true);

  useEffect(() => {
    billing.getEntitlements()
      .then(setBillingData)
      .catch(() => setBillingData({ individual_entitlements: [], org_entitlements: [], trials: [] }))
      .finally(() => setLoadingBilling(false));
  }, []);

  useEffect(() => {
    Promise.all(
      Object.keys(EXAM_INFO).map((exam) =>
        Promise.all([
          examsApi.progress(exam).then((d) => ({ exam, data: d })).catch(() => ({ exam, data: { worlds: [] } })),
          examsApi.weakTopics(exam).then((d) => ({ exam, data: d })).catch(() => ({ exam, data: null })),
        ])
      )
    ).then((results) => {
      const progMap = {};
      const weakMap = {};
      results.forEach(([progResult, weakResult]) => {
        progMap[progResult.exam] = progResult.data;
        weakMap[weakResult.exam] = weakResult.data;
      });
      setProgressMap(progMap);
      setWeakTopicsMap(weakMap);
    }).finally(() => setLoadingProgress(false));
  }, []);

  const loading = loadingBilling || loadingProgress;

  const allEntitlements = [
    ...(billingData?.individual_entitlements || []),
    ...(billingData?.org_entitlements        || []),
  ];
  const trials     = billingData?.trials || [];
  const trialState = isAdmin ? 'paid' : getTrialState(trials, allEntitlements);

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Welcome back, {user?.username} \ud83d\udc4b</h1>
          <p className="page-subtitle">Pick an exam to continue your preparation.</p>
        </div>

        {/* Exam cards */}
        {loading ? (
          <div className="exam-grid">
            {Object.keys(EXAM_INFO).map((k) => (
              <div key={k} className="card animate-pulse" style={{ height: 220 }} />
            ))}
          </div>
        ) : (
          <div className="exam-grid section">
            {Object.keys(EXAM_INFO).map((examKey) => (
              <ExamCard
                key={examKey}
                examKey={examKey}
                entitlements={allEntitlements}
                trials={trials}
                progressData={progressMap[examKey]}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}

        {/* M3: Weak topics */}
        {!loading && !isAdmin && Object.keys(EXAM_INFO).some((k) => weakTopicsMap[k]?.weak_topics?.length > 0) && (
          <div className="section">
            <p className="section-title">Topics to Review</p>
            {Object.keys(EXAM_INFO).map((examKey) => {
              const wd = weakTopicsMap[examKey];
              if (!wd?.weak_topics?.length) return null;
              return (
                <div key={examKey} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                    {EXAM_INFO[examKey].label}
                  </div>
                  <WeakTopicsCard data={wd} />
                </div>
              );
            })}
          </div>
        )}

        {/* Active entitlements */}
        {!loading && allEntitlements.length > 0 && (
          <div className="section">
            <p className="section-title">Active Plans</p>
            <div className="card">
              {allEntitlements.map((ent) => (
                <div key={ent.id} className="entitlement-row">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', textTransform: 'capitalize' }}>
                      {ent.exam} \u2014 {ent.plan_id} plan
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Expires {new Date(ent.entitlement_expires_at).toLocaleDateString()}
                      {' \u00b7 '}Worlds 1\u2013{ent.max_world_index} per track
                    </div>
                  </div>
                  <span className={`plan-pill ${ent.plan_id}`} style={{ textTransform: 'capitalize' }}>{ent.plan_id}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade nudge */}
        {!isAdmin && !loading && trialState !== 'paid' && (
          <div className="paywall-banner">
            {trialState === 'expired' && (
              <>
                <div className="paywall-text">
                  <h3>Your free trial has ended</h3>
                  <p>Upgrade to continue your exam preparation and regain access to all 5 worlds per track.</p>
                </div>
                <div className="paywall-actions">
                  <Link to="/pricing" className="btn btn-violet btn-sm">Upgrade now</Link>
                </div>
              </>
            )}
            {trialState === 'active_trial' && (
              <>
                <div className="paywall-text">
                  <h3>Unlock all 5 worlds per track</h3>
                  <p>Your free trial covers World 1 in each track. Upgrade to access the full exam journey.</p>
                </div>
                <div className="paywall-actions">
                  <Link to="/pricing" className="btn btn-violet btn-sm">View Plans</Link>
                </div>
              </>
            )}
            {trialState === 'no_trial' && (
              <>
                <div className="paywall-text">
                  <h3>Start your free 7-day trial</h3>
                  <p>Click any exam above to begin. World 1 is free \u2014 no credit card needed.</p>
                </div>
                <div className="paywall-actions">
                  <Link to="/pricing" className="btn btn-ghost btn-sm">View Plans</Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}