import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { exams as examsApi, billing } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const EXAM_LABELS = {
  qudurat: 'Qudurat — القدرات',
  tahsili: 'Tahsili — التحصيلي',
};

const TRACK_LABELS_AR = {
  math:      'الرياضيات',
  verbal:    'اللفظي',
  biology:   'الأحياء',
  chemistry: 'الكيمياء',
  physics:   'الفيزياء',
};

const LOCK_MESSAGES = {
  no_entitlement:    'Start your free trial to unlock',
  trial_expired:     'Trial expired — upgrade to continue',
  beyond_trial_cap:  'Upgrade to access this world',
  prereq_incomplete: 'Complete the previous world first',
  level_locked:      'Pass the previous level first',
  seat_no_coverage:  'Your school has not unlocked this world',
};

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

// ── Leaderboard helpers ───────────────────────────────────────────────────────

function fmtAvg(seconds) {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Leaderboard view ─────────────────────────────────────────────────────────

function LeaderboardView({ exam, currentUsername }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    examsApi.leaderboard(exam)
      .then(setData)
      .catch((err) => setError(err?.error?.message || 'Failed to load leaderboard.'))
      .finally(() => setLoading(false));
  }, [exam]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error" style={{ marginTop: 24 }}>{error}</div>;
  }

  const top         = data?.top || [];
  const currentUser = data?.current_user || null;
  const isEmpty     = top.length === 0;

  // Is current user already visible in top list?
  const currentInTop = top.some((r) => r.is_current_user);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>

      {isEmpty ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'var(--bg-card, rgba(255,255,255,0.03))',
          border: '1px solid var(--border)', borderRadius: 14,
        }}>
          <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>🏆</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 8 }}>
            No rankings yet
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Be the first to complete a level and claim the top spot.
          </div>
        </div>
      ) : (
        <>
          {/* ── Top N table ── */}
          <div style={{
            background: 'var(--bg-card, rgba(255,255,255,0.03))',
            border: '1px solid var(--border)', borderRadius: 14,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 100px 110px',
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.73rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              color: 'var(--text-muted)',
            }}>
              <span>Rank</span>
              <span>Username</span>
              <span style={{ textAlign: 'right' }}>Levels</span>
              <span style={{ textAlign: 'right' }}>Avg Time</span>
            </div>

            {/* Rows */}
            {top.map((row) => {
              const isMe    = row.is_current_user;
              const medal   = RANK_MEDALS[row.rank - 1];
              return (
                <div
                  key={row.rank}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 100px 110px',
                    padding: '13px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: isMe
                      ? 'rgba(139,92,246,0.08)'
                      : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Rank */}
                  <span style={{
                    fontWeight: 800,
                    fontSize: medal ? '1.1rem' : '0.9rem',
                    color: isMe ? 'var(--violet-light, #a78bfa)' : 'var(--text-muted)',
                    lineHeight: 1,
                    alignSelf: 'center',
                  }}>
                    {medal || `#${row.rank}`}
                  </span>

                  {/* Username */}
                  <span style={{
                    fontWeight: isMe ? 700 : 500,
                    color: isMe ? 'var(--violet-light, #a78bfa)' : 'var(--text-primary)',
                    fontSize: '0.93rem',
                    alignSelf: 'center',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {row.username}
                    {isMe && (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        padding: '1px 6px', borderRadius: 10,
                        background: 'rgba(139,92,246,0.2)',
                        border: '1px solid rgba(139,92,246,0.4)',
                        color: 'var(--violet-light, #a78bfa)',
                        letterSpacing: '0.3px',
                      }}>you</span>
                    )}
                  </span>

                  {/* Levels passed */}
                  <span style={{
                    textAlign: 'right', fontWeight: 700,
                    color: 'var(--text-primary)', fontSize: '0.93rem',
                    alignSelf: 'center',
                  }}>
                    {row.levels_passed}
                  </span>

                  {/* Avg time */}
                  <span style={{
                    textAlign: 'right',
                    color: 'var(--text-muted)', fontSize: '0.88rem',
                    fontVariantNumeric: 'tabular-nums',
                    alignSelf: 'center',
                  }}>
                    {fmtAvg(row.avg_seconds_per_level)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Current user rank footer (shown only when outside top N) ── */}
          {!currentInTop && currentUser && (
            <div style={{
              marginTop: 12,
              padding: '14px 20px',
              borderRadius: 12,
              background: 'rgba(139,92,246,0.07)',
              border: '1px solid rgba(139,92,246,0.25)',
              display: 'grid',
              gridTemplateColumns: '48px 1fr 100px 110px',
              alignItems: 'center',
            }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--violet-light, #a78bfa)' }}>
                #{currentUser.rank}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--violet-light, #a78bfa)', fontSize: '0.93rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                {currentUser.username}
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                  background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
                  color: 'var(--violet-light, #a78bfa)',
                }}>you</span>
              </span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.93rem' }}>
                {currentUser.levels_passed}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>
                {fmtAvg(currentUser.avg_seconds_per_level)}
              </span>
            </div>
          )}

          {/* ── No rank yet nudge ── */}
          {!currentUser && (
            <div style={{
              marginTop: 12, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center',
            }}>
              Complete a level to appear on the leaderboard.
            </div>
          )}

          {/* ── Column legend ── */}
          <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', paddingRight: 4 }}>
            Avg Time = average seconds per passed level · — means no timing data yet
          </div>
        </>
      )}
    </div>
  );
}

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
  const totalWorlds     = track.worlds.length;
  const completedWorlds = track.worlds.filter((w) =>
    w.levels.filter((l) => l.passed).length === 10
  ).length;
  const totalLevels  = totalWorlds * 10;
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
  const { exam }  = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const isAdmin = user?.role === 'drfahm_admin';

  const [worldMap,     setWorldMap]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [entitlements, setEntitlements] = useState(null);
  const [activeTrack,  setActiveTrack]  = useState(null);

  // M1: view toggle — 'map' | 'leaderboard'
  const [view,          setView]          = useState('map');
  const [lbEverLoaded,  setLbEverLoaded]  = useState(false);

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
      if (mapData?.tracks?.length > 0) {
        setActiveTrack(mapData.tracks[0].track_key);
      }
    }).catch((err) => {
      setError(err?.error?.message || 'Failed to load world map.');
    }).finally(() => setLoading(false));
  }, [exam, navigate]);

  // Mark leaderboard as ever-loaded on first switch so it doesn't re-fetch
  const handleViewChange = (v) => {
    setView(v);
    if (v === 'leaderboard') setLbEverLoaded(true);
  };

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

  const tracks       = worldMap?.tracks || [];
  const currentTrack = tracks.find((t) => t.track_key === activeTrack) || tracks[0];

  const allEntitlements = [
    ...(entitlements?.individual_entitlements || []),
    ...(entitlements?.org_entitlements || []),
  ];
  const hasPaidPlan = allEntitlements.some(
    (e) => e.exam === exam && new Date() < new Date(e.entitlement_expires_at)
  );
  const trial       = entitlements?.trials?.find((t) => t.exam === exam);
  const trialActive = trial && new Date() < new Date(trial.trial_expires_at);

  const firstUnlockedIdx = currentTrack?.worlds?.findIndex((w) => !w.locked) ?? 0;
  const totalTracks      = tracks.length;
  const worldsPerTrack   = currentTrack?.worlds?.length || 5;

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
        {!isAdmin && !hasPaidPlan && trialActive && (
          <div className="paywall-banner" style={{ marginBottom: 24 }}>
            <div className="paywall-text">
              <h3>You're on the free trial — World 1 unlocked per track</h3>
              <p>Upgrade to Basic for all 5 worlds, or Premium for the full experience.</p>
            </div>
            <div className="paywall-actions">
              <Link to={`/pricing?exam=${exam}&plan=basic`} className="btn btn-ghost btn-sm">Basic Plan</Link>
              <Link to={`/pricing?exam=${exam}&plan=premium`} className="btn btn-violet btn-sm">Premium Plan</Link>
            </div>
          </div>
        )}

        {/* Paywall nudge — trial expired */}
        {!isAdmin && !hasPaidPlan && !trialActive && (
          <div className="paywall-banner" style={{ marginBottom: 24 }}>
            <div className="paywall-text">
              <h3>Your trial has expired</h3>
              <p>Upgrade to a paid plan to continue your exam preparation.</p>
            </div>
            <div className="paywall-actions">
              <Link to={`/pricing?exam=${exam}`} className="btn btn-primary btn-sm">View Plans</Link>
            </div>
          </div>
        )}

        {/* ── M1: View toggle — Map / Leaderboard ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          <button
            onClick={() => handleViewChange('map')}
            style={{
              padding: '7px 18px', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem',
              cursor: 'pointer', transition: 'all 0.15s',
              background: view === 'map' ? 'rgba(139,92,246,0.15)' : 'transparent',
              border: view === 'map' ? '1.5px solid rgba(139,92,246,0.5)' : '1.5px solid var(--border)',
              color: view === 'map' ? 'var(--violet-light, #a78bfa)' : 'var(--text-muted)',
            }}
          >
            🗺 Map
          </button>
          <button
            onClick={() => handleViewChange('leaderboard')}
            style={{
              padding: '7px 18px', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem',
              cursor: 'pointer', transition: 'all 0.15s',
              background: view === 'leaderboard' ? 'rgba(139,92,246,0.15)' : 'transparent',
              border: view === 'leaderboard' ? '1.5px solid rgba(139,92,246,0.5)' : '1.5px solid var(--border)',
              color: view === 'leaderboard' ? 'var(--violet-light, #a78bfa)' : 'var(--text-muted)',
            }}
          >
            🏆 Leaderboard
          </button>
        </div>

        {/* ── MAP VIEW ── */}
        {view === 'map' && (
          <>
            {tracks.length > 1 && (
              <TrackTabs tracks={tracks} activeTrack={activeTrack} onSelect={setActiveTrack} />
            )}
            {currentTrack && <TrackProgressBar track={currentTrack} />}
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
          </>
        )}

        {/* ── LEADERBOARD VIEW ── */}
        {view === 'leaderboard' && (
          <LeaderboardView exam={exam} currentUsername={user?.username} />
        )}

      </div>
    </>
  );
}