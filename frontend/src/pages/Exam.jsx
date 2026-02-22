import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { exams as examsApi, billing } from '../api';
import Navbar from '../components/Navbar';

const EXAM_LABELS = {
  qudurat: 'Qudurat — القدرات',
  tahsili: 'Tahsili — التحصيلي',
};

// Human-readable lock reason messages shown to the student
const LOCK_MESSAGES = {
  no_entitlement:          'Start your free trial to unlock',
  trial_expired:           'Trial expired — upgrade to continue',
  beyond_world2_trial_cap: 'Upgrade to access this world',
  prereq_incomplete:       'Complete the previous world first',
  level_locked:            'Pass the previous level first',
  seat_no_coverage:        'Your school has not unlocked this world',
};

function LevelNode({ level, examKey, worldKey, worldLocked }) {
  const navigate = useNavigate();
  const { level_number, locked, lock_reason, passed } = level;

  const status = passed ? 'passed' : locked ? 'locked' : 'unlocked';

  const handleClick = () => {
    if (locked) return;
    navigate(`/exam/${examKey}/world/${worldKey}/level/${level_number}`);
  };

  return (
    <div
      className={`level-node ${status}`}
      onClick={handleClick}
      title={locked ? LOCK_MESSAGES[lock_reason] || lock_reason : `Level ${level_number}`}
      role="button"
      tabIndex={locked ? -1 : 0}
      onKeyDown={(e) => e.key === 'Enter' && !locked && handleClick()}
      aria-label={`Level ${level_number} — ${status}${locked ? ': ' + (LOCK_MESSAGES[lock_reason] || lock_reason) : ''}`}
    >
      <span className="level-node-num">{level_number}</span>
      <span className="level-node-icon">
        {passed ? '✓' : locked ? '🔒' : '→'}
      </span>
    </div>
  );
}

function WorldCard({ world, examKey, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const { world_key, world_name, index, locked, lock_reason, levels } = world;

  const passedCount = levels.filter((l) => l.passed).length;
  const allPassed   = passedCount === 10;

  return (
    <div className={`world-card ${locked ? 'locked' : 'unlocked'}`}>
      <div className="world-card-header" onClick={() => setOpen(!open)}>
        <div className="world-header-left">
          <div className={`world-index-badge ${locked ? 'locked' : 'unlocked'}`}>
            W{index}
          </div>
          <div>
            <div className="world-name">{world_name}</div>
            <div className="world-meta">
              {locked
                ? (LOCK_MESSAGES[lock_reason] || lock_reason)
                : `${passedCount}/10 levels passed`}
            </div>
          </div>
        </div>
        <div className="world-status-right">
          {allPassed && !locked && (
            <span className="world-completion-text">✓ Complete</span>
          )}
          {locked && <span className="lock-icon">🔒</span>}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {open && (
        <div className="world-levels-grid">
          {levels.map((level) => (
            <LevelNode
              key={level.level_number}
              level={level}
              examKey={examKey}
              worldKey={world_key}
              worldLocked={locked}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExamPage() {
  const { exam }    = useParams();
  const navigate    = useNavigate();

  const [worldMap,  setWorldMap]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [entitlements, setEntitlements] = useState(null);

  useEffect(() => {
    if (!['qudurat', 'tahsili'].includes(exam)) {
      navigate('/dashboard', { replace: true });
      return;
    }

    Promise.all([
      examsApi.worldMap(exam),
      billing.getEntitlements().catch(() => null),
    ]).then(([mapData, billingData]) => {
      setWorldMap(mapData);
      setEntitlements(billingData);
    }).catch((err) => {
      setError(err?.error?.message || 'Failed to load world map.');
    }).finally(() => setLoading(false));
  }, [exam, navigate]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="loading-screen" style={{ minHeight: '60vh' }}>
            <div className="spinner" />
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="alert alert-error">{error}</div>
          <Link to="/dashboard" className="btn btn-ghost" style={{ marginTop: 16 }}>← Back to Dashboard</Link>
        </div>
      </>
    );
  }

  const allEntitlements = [
    ...(entitlements?.individual_entitlements || []),
    ...(entitlements?.org_entitlements || []),
  ];
  const hasPaidPlan = allEntitlements.some((e) => e.exam === exam && new Date() < new Date(e.entitlement_expires_at));
  const trial = entitlements?.trials?.find((t) => t.exam === exam);
  const trialActive = trial && new Date() < new Date(trial.trial_expires_at);

  // First unlocked world index (for defaultOpen)
  const firstUnlockedIdx = worldMap?.worlds?.findIndex((w) => !w.locked) ?? 0;

  return (
    <>
      <Navbar />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {EXAM_LABELS[exam] || exam}
          </span>
        </div>

        <div className="page-header">
          <h1 className="page-title">{EXAM_LABELS[exam] || exam}</h1>
          <p className="page-subtitle">10 worlds · 10 levels each · Master every topic to advance</p>
        </div>

        {/* Paywall nudge — shown when on trial with no paid plan */}
        {!hasPaidPlan && trialActive && (
          <div className="paywall-banner" style={{ marginBottom: 24 }}>
            <div className="paywall-text">
              <h3>You're on the free trial — Worlds 1–2 unlocked</h3>
              <p>Upgrade to Basic (SAR 199) for Worlds 1–5, or Premium (SAR 299) for all 10 worlds.</p>
            </div>
            <div className="paywall-actions">
              <Link
                to={`/pricing?exam=${exam}&plan=basic`}
                className="btn btn-ghost btn-sm"
              >
                Basic — SAR 199
              </Link>
              <Link
                to={`/pricing?exam=${exam}&plan=premium`}
                className="btn btn-violet btn-sm"
              >
                Premium — SAR 299
              </Link>
            </div>
          </div>
        )}

        {!hasPaidPlan && !trialActive && (
          <div className="paywall-banner" style={{ marginBottom: 24 }}>
            <div className="paywall-text">
              <h3>Your trial has expired</h3>
              <p>Upgrade to a paid plan to continue your exam preparation.</p>
            </div>
            <div className="paywall-actions">
              <Link to={`/pricing?exam=${exam}`} className="btn btn-primary btn-sm">
                View Plans
              </Link>
            </div>
          </div>
        )}

        {/* World map — render exactly what backend returns */}
        <div className="world-map-grid">
          {worldMap?.worlds?.map((world, idx) => (
            <WorldCard
              key={world.world_key}
              world={world}
              examKey={exam}
              defaultOpen={idx === firstUnlockedIdx}
            />
          ))}
        </div>
      </div>
    </>
  );
}