import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { billing, exams as examsApi } from '../api';
import Navbar from '../components/Navbar';

const EXAM_INFO = {
  qudurat: {
    label: 'Qudurat',
    arabic: 'القدرات',
    description: 'Math & Verbal aptitude — required for all Saudi university admissions.',
    worlds: 10,
  },
  tahsili: {
    label: 'Tahsili',
    arabic: 'التحصيلي',
    description: 'Science & Math achievement — required for science/medicine tracks.',
    worlds: 10,
  },
};

function TrialBadge({ trial }) {
  if (!trial) return null;
  const now     = new Date();
  const expires = new Date(trial.trial_expires_at);
  const active  = now < expires;
  const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

  if (!active) {
    return <span className="plan-pill expired">Trial Expired</span>;
  }
  return <span className="plan-pill trial">{daysLeft}d trial left</span>;
}

function EntitlementBadge({ entitlement }) {
  if (!entitlement) return null;
  const expires = new Date(entitlement.entitlement_expires_at);
  const active  = new Date() < expires;
  if (!active) return <span className="plan-pill expired">Expired</span>;
  return <span className={`plan-pill ${entitlement.plan_id}`} style={{ textTransform: 'capitalize' }}>{entitlement.plan_id}</span>;
}

function ExamCard({ examKey, entitlements, trials, progressData }) {
  const info  = EXAM_INFO[examKey];
  const trial = trials?.find((t) => t.exam === examKey);
  const ent   = entitlements?.find((e) => e.exam === examKey);

  // Compute progress
  let worldsCompleted = 0;
  let totalWorlds     = info.worlds;
  if (progressData) {
    worldsCompleted = progressData.worlds?.filter((w) => w.fully_completed).length || 0;
  }
  const pct = totalWorlds > 0 ? Math.round((worldsCompleted / totalWorlds) * 100) : 0;

  const hasAccess = !!ent || (trial && new Date() < new Date(trial.trial_expires_at));

  return (
    <Link to={`/exam/${examKey}`} className={`exam-card ${examKey}`}>
      <div className={`exam-badge ${examKey}`}>{examKey.toUpperCase()}</div>
      <h3 className="exam-card-title">
        {info.label} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>/ {info.arabic}</span>
      </h3>
      <p className="exam-card-desc">{info.description}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {ent  && <span className={`plan-pill ${ent.plan_id}`} style={{ textTransform: 'capitalize' }}>{ent.plan_id} Plan</span>}
        {!ent && <TrialBadge trial={trial} />}
        {!ent && !trial && <span className="plan-pill trial">7-day trial available</span>}
      </div>

      <div className="exam-progress-bar">
        <div className="exam-progress-fill" style={{ width: `${pct}%`, background: examKey === 'tahsili' ? 'var(--green)' : 'var(--violet)' }} />
      </div>
      <p className="exam-progress-label">{worldsCompleted} of {totalWorlds} worlds completed</p>
    </Link>
  );
}

export default function Dashboard() {
  const { user }   = useAuth();
  const [billingData, setBillingData]   = useState(null);
  const [progressMap, setProgressMap]   = useState({});
  const [loadingBilling, setLoadingBilling] = useState(true);
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
        examsApi.progress(exam)
          .then((data) => ({ exam, data }))
          .catch(() => ({ exam, data: { worlds: [] } }))
      )
    ).then((results) => {
      const map = {};
      results.forEach(({ exam, data }) => { map[exam] = data; });
      setProgressMap(map);
    }).finally(() => setLoadingProgress(false));
  }, []);

  const loading = loadingBilling || loadingProgress;

  const allEntitlements = [
    ...(billingData?.individual_entitlements || []),
    ...(billingData?.org_entitlements        || []),
  ];
  const trials = billingData?.trials || [];

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Welcome back, {user?.username} 👋</h1>
          <p className="page-subtitle">Pick an exam to continue your preparation.</p>
        </div>

        {/* Exam cards */}
        {loading ? (
          <div className="exam-grid">
            {Object.keys(EXAM_INFO).map((k) => (
              <div key={k} className="card animate-pulse" style={{ height: 200 }} />
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
              />
            ))}
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
                      {ent.exam} — {ent.plan_id} plan
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Expires {new Date(ent.entitlement_expires_at).toLocaleDateString()}
                      {' · '}
                      Worlds 1–{ent.max_world_index}
                    </div>
                  </div>
                  <span className={`plan-pill ${ent.plan_id}`} style={{ textTransform: 'capitalize' }}>
                    {ent.plan_id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upgrade nudge if no paid plan */}
        {!loading && allEntitlements.length === 0 && (
          <div className="paywall-banner">
            <div className="paywall-text">
              <h3>Unlock all 10 worlds</h3>
              <p>Your free trial covers worlds 1–2. Upgrade to access the full exam journey.</p>
            </div>
            <div className="paywall-actions">
              <Link to="/pricing" className="btn btn-violet btn-sm">View Plans</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}