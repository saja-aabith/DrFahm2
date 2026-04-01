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
    worlds: 10,   // 2 tracks × 5 worlds
    tracks: 2,
  },
  tahsili: {
    label: 'Tahsili',
    arabic: 'التحصيلي',
    description: 'Science & Math achievement — required for science/medicine tracks.',
    worlds: 20,   // 4 tracks × 5 worlds
    tracks: 4,
  },
};

function TrialBadge({ trial }) {
  if (!trial) return null;
  const now      = new Date();
  const expires  = new Date(trial.trial_expires_at);
  const active   = now < expires;
  const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

  if (!active) return <span className="plan-pill expired">Trial Expired</span>;
  return <span className="plan-pill trial">{daysLeft}d trial left</span>;
}

function ExamCard({ examKey, entitlements, trials, progressData, isAdmin }) {
  const info  = EXAM_INFO[examKey];
  const trial = trials?.find((t) => t.exam === examKey);
  const ent   = entitlements?.find((e) => e.exam === examKey);

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
        {info.label}{' '}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>
          / {info.arabic}
        </span>
      </h3>
      <p className="exam-card-desc">{info.description}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {isAdmin && <span className="plan-pill premium">Admin — Full Access</span>}
        {!isAdmin && ent  && (
          <span className={`plan-pill ${ent.plan_id}`} style={{ textTransform: 'capitalize' }}>
            {ent.plan_id} Plan
          </span>
        )}
        {!isAdmin && !ent && <TrialBadge trial={trial} />}
        {!isAdmin && !ent && !trial && <span className="plan-pill trial">7-day trial available</span>}
      </div>

      <div className="exam-progress-bar">
        <div
          className="exam-progress-fill"
          style={{
            width: `${pct}%`,
            background: examKey === 'tahsili' ? 'var(--green)' : 'var(--violet)',
          }}
        />
      </div>
      <p className="exam-progress-label">{worldsCompleted} of {totalWorlds} worlds completed</p>
    </Link>
  );
}

// Determine what upgrade nudge state to show across all exams
function getTrialState(trials, allEntitlements) {
  const now = new Date();

  // Check each exam
  const examKeys = Object.keys(EXAM_INFO);

  // Has any active paid plan?
  const hasAnyPaid = allEntitlements.some(
    (e) => now < new Date(e.entitlement_expires_at)
  );
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

  const [billingData,      setBillingData]      = useState(null);
  const [progressMap,      setProgressMap]      = useState({});
  const [loadingBilling,   setLoadingBilling]   = useState(true);
  const [loadingProgress,  setLoadingProgress]  = useState(true);

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
  const trials     = billingData?.trials || [];
  const trialState = isAdmin ? 'paid' : getTrialState(trials, allEntitlements);

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
                isAdmin={isAdmin}
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
                      Worlds 1–{ent.max_world_index} per track
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

        {/* Upgrade nudge — context-aware, hidden for admins and paid users */}
        {!isAdmin && !loading && trialState !== 'paid' && (
          <div className="paywall-banner">
            {trialState === 'expired' && (
              <>
                <div className="paywall-text">
                  <h3>Your free trial has ended</h3>
                  <p>
                    Upgrade to continue your exam preparation and regain access to
                    all 5 worlds per track.
                  </p>
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
                  <p>
                    Your free trial covers World 1 in each track. Upgrade to access
                    the full exam journey.
                  </p>
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
                  <p>
                    Click any exam above to begin. World 1 is free — no credit card needed.
                  </p>
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