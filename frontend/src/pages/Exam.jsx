import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { exams as examsApi, billing } from '../api';
import Navbar from '../components/Navbar';

const EXAM_LABELS = {
  qudurat: 'Qudurat — القدرات',
  tahsili: 'Tahsili — التحصيلي',
};

// ── Arabic section labels for track tabs ─────────────────────────────────────
const TRACK_LABELS_AR = {
  math:      'الرياضيات',
  verbal:    'اللفظي',
  biology:   'الأحياء',
  chemistry: 'الكيمياء',
  physics:   'الفيزياء',
};

// Human-readable lock reason messages shown to the student
const LOCK_MESSAGES = {
  no_entitlement:    'Start your free trial to unlock',
  trial_expired:     'Trial expired — upgrade to continue',
  beyond_trial_cap:  'Upgrade to access this world',
  prereq_incomplete: 'Complete the previous world first',
  level_locked:      'Pass the previous level first',
  seat_no_coverage:  'Your school has not unlocked this world',
};

// ── Level Node ───────────────────────────────────────────────────────────────

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

// ── World Card ───────────────────────────────────────────────────────────────

function WorldCard({ world, examKey, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const { world_key, world_name, world_name_ar, index, locked, lock_reason, levels } = world;

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
            <div className="world-name">
              {world_name}
              {world_name_ar && (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem', marginLeft: 8 }}>
                  {world_name_ar}
                </span>
              )}
            </div>
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

// ── Track Tabs ───────────────────────────────────────────────────────────────

function TrackTabs({ tracks, activeTrack, onSelect }) {
  return (
    <div className="track-tabs">
      {tracks.map((track) => (
        <button
          key={track.track_key}
          className={`track-tab ${activeTrack === track.track_key ? 'active' : ''}`}
          onClick={() => onSelect(track.track_key)}
        >
          <span className="track-tab-en">{track.track_name}</span>
          <span className="track-tab-ar">{TRACK_LABELS_AR[track.track_key] || ''}</span>
        </button>
      ))}
    </div>
  );
}

// ── Track Progress Summary ───────────────────────────────────────────────────

function TrackProgressBar({ track }) {
  const totalWorlds = track.worlds.length;
  const completedWorlds = track.worlds.filter((w) => {
    const allLevelsPassed = w.levels.filter((l) => l.passed).length === 10;
    return allLevelsPassed;
  }).length;
  const totalLevels = totalWorlds * 10;
  const passedLevels = track.worlds.reduce(
    (sum, w) => sum + w.levels.filter((l) => l.passed).length, 0
  );
  const pct = totalLevels > 0 ? Math.round((passedLevels / totalLevels) * 100) : 0;

  return (
    <div className="track-progress-summary">
      <div className="track-progress-stats">
        <span>{completedWorlds}/{totalWorlds} worlds complete</span>
        <span>{passedLevels}/{totalLevels} levels passed</span>
      </div>
      <div className="track-progress-bar">
        <div className="track-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main Exam Page ───────────────────────────────────────────────────────────

export default function ExamPage() {
  const { exam }   = useParams();
  const navigate   = useNavigate();

  const [worldMap,      setWorldMap]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [entitlements,  setEntitlements]  = useState(null);
  const [activeTrack,   setActiveTrack]   = useState(null);

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
      // Default to first track
      if (mapData?.tracks?.length > 0) {
        setActiveTrack(mapData.tracks[0].track_key);
      }
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

  const tracks = worldMap?.tracks || [];
  const currentTrack = tracks.find((t) => t.track_key === activeTrack) || tracks[0];

  const allEntitlements = [
    ...(entitlements?.individual_entitlements || []),
    ...(entitlements?.org_entitlements || []),
  ];
  const hasPaidPlan = allEntitlements.some(
    (e) => e.exam === exam && new Date() < new Date(e.entitlement_expires_at)
  );
  const trial = entitlements?.trials?.find((t) => t.exam === exam);
  const trialActive = trial && new Date() < new Date(trial.trial_expires_at);

  // First unlocked world in current track (for defaultOpen)
  const firstUnlockedIdx = currentTrack?.worlds?.findIndex((w) => !w.locked) ?? 0;

  // Overall stats for subtitle
  const totalTracks = tracks.length;
  const worldsPerTrack = currentTrack?.worlds?.length || 5;

  return (
    <>
      <Navbar />
      <div className="page">
        {/* Breadcrumb */}
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
          <p className="page-subtitle">
            {totalTracks} {totalTracks === 1 ? 'track' : 'tracks'} · {worldsPerTrack} worlds each · 10 levels per world
          </p>
        </div>

        {/* Paywall nudge — trial active */}
        {!hasPaidPlan && trialActive && (
          <div className="paywall-banner" style={{ marginBottom: 24 }}>
            <div className="paywall-text">
              <h3>You're on the free trial — World 1 unlocked per track</h3>
              <p>Upgrade to Basic for all 5 worlds, or Premium for the full experience.</p>
            </div>
            <div className="paywall-actions">
              <Link
                to={`/pricing?exam=${exam}&plan=basic`}
                className="btn btn-ghost btn-sm"
              >
                Basic Plan
              </Link>
              <Link
                to={`/pricing?exam=${exam}&plan=premium`}
                className="btn btn-violet btn-sm"
              >
                Premium Plan
              </Link>
            </div>
          </div>
        )}

        {/* Paywall nudge — trial expired */}
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

        {/* Track tabs — always shown when more than 1 track */}
        {tracks.length > 1 && (
          <TrackTabs
            tracks={tracks}
            activeTrack={activeTrack}
            onSelect={setActiveTrack}
          />
        )}

        {/* Track progress bar */}
        {currentTrack && (
          <TrackProgressBar track={currentTrack} />
        )}

        {/* World map — render current track's worlds */}
        <div className="world-map-grid">
          {currentTrack?.worlds?.map((world, idx) => (
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