import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Map, Trophy, Lock, ChevronUp, ChevronDown,
  CheckCircle, Clock, Layers,
} from 'lucide-react';
import { exams as examsApi, billing } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

// Plan display name — resolves to pricing.plans.* keys so Pricing is source of truth
function planDisplayName(t, planId) {
  switch (planId) {
    case 'free':    return t('pricing.plans.free.name');
    case 'basic':   return t('pricing.plans.silver.name');
    case 'premium': return t('pricing.plans.gold.name');
    default:        return planId;
  }
}

const RANK_STYLES = [
  { bg: 'rgba(250,204,21,0.15)',  border: 'rgba(250,204,21,0.4)',  color: '#facc15' },
  { bg: 'rgba(203,213,225,0.15)', border: 'rgba(203,213,225,0.4)', color: '#cbd5e1' },
  { bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.4)',  color: '#fb923c' },
];

const CONF_COLOR = {
  high:   '#15803d',
  medium: '#0891b2',
  low:    '#b45309',
};

function fmtAvg(seconds) {
  if (seconds == null) return '\u2014';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function RankBadge({ rank }) {
  const style = RANK_STYLES[rank - 1];
  if (style) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 8,
        background: style.bg, border: `1.5px solid ${style.border}`,
        color: style.color, fontWeight: 800, fontSize: '0.88rem',
      }}>
        {rank}
      </span>
    );
  }
  return (
    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
      #{rank}
    </span>
  );
}

// ── M2: Predicted Score Banner ────────────────────────────────────────────────

function PredictedScoreBanner({ exam, data }) {
  const { t } = useTranslation();
  if (!data || data.score == null) return null;
  const confColor  = CONF_COLOR[data.confidence] || 'var(--text-primary)';
  const examName   = t(`common.${exam}`);
  const confLabel  = data.confidence === 'high'   ? t('exam.predicted.conf_high')
                   : data.confidence === 'medium' ? t('exam.predicted.conf_medium')
                   : t('exam.predicted.conf_low');
  const levelsSuffix = data.based_on_levels === 1
    ? t('exam.predicted.level_suffix')
    : t('exam.predicted.levels_suffix', { count: data.based_on_levels });
  const hasSections = Object.keys(data.sections || {}).length > 1;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 18px', borderRadius: 10, marginBottom: 20,
      background: 'var(--bg-card, rgba(255,255,255,0.04))',
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🎯</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>
          {t('exam.predicted.label', { exam: examName })}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1, color: confColor }}>
            {data.score}%
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {confLabel} &middot; {levelsSuffix}
          </span>
        </div>
      </div>
      {hasSections && (
        <div style={{
          display: 'flex', gap: 16, flexShrink: 0,
          paddingInlineStart: 16,
          borderInlineStart: '1px solid var(--border)',
        }}>
          {/* Section keys (math/verbal/biology/…) come from backend in English. POST-MVP: AR */}
          {Object.entries(data.sections).map(([sec, score]) => (
            <div key={sec} style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: confColor }}>{score}%</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 2 }}>{sec}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── M3: Weak Topics Card ──────────────────────────────────────────────────────

function WeakTopicsCard({ data }) {
  const { t } = useTranslation();

  const PRIORITY_STYLE = {
    high:   { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.2)',  label: t('exam.topics.priority_high') },
    review: { color: '#b45309', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.2)',  label: t('exam.topics.priority_review') },
  };

  if (!data?.weak_topics?.length) return null;
  const topics = data.weak_topics;

  const basedOnText = data.based_on_levels === 1
    ? t('exam.topics.based_on_level')
    : t('exam.topics.based_on_levels', { count: data.based_on_levels });

  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: 'var(--bg-card, rgba(255,255,255,0.04))', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: '1.1rem' }}>⚠</span>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{t('exam.topics.title')}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginInlineStart: 4 }}>{basedOnText}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topics.map((topic) => {
          const ps     = PRIORITY_STYLE[topic.priority] || PRIORITY_STYLE.review;
          const barPct = Math.round(topic.struggle_rate * 100);
          return (
            <div key={topic.topic} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 100px', gap: 10, alignItems: 'center' }}>
              {/* topic.label is English from backend — POST-MVP: backend AR */}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topic.label}>{topic.label}</span>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: ps.color, borderRadius: 4, transition: 'width 0.4s ease', opacity: 0.8 }} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'end', whiteSpace: 'nowrap' }}>
                {t('exam.topics.levels_count', { struggled: topic.struggled_levels, total: topic.total_levels })}
              </span>
              <span style={{ display: 'inline-flex', justifyContent: 'center', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, whiteSpace: 'nowrap' }}>{ps.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

function LeaderboardView({ exam }) {
  const { t } = useTranslation();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    examsApi.leaderboard(exam)
      .then(setData)
      .catch((err) => setError(err?.error?.message || t('exam.leaderboard.load_failed')))
      .finally(() => setLoading(false));
  }, [exam, t]);

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
  const currentInTop = top.some((r) => r.is_current_user);
  const colGrid     = '52px 1fr 90px 110px';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid var(--border)', borderRadius: 14 }}>
          <Trophy size={52} strokeWidth={1.4} style={{ color: 'var(--text-muted)', marginBottom: 14 }} />
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: 8 }}>{t('exam.leaderboard.empty_title')}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('exam.leaderboard.empty_body')}</div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--bg-card, rgba(255,255,255,0.03))', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: colGrid, padding: '10px 20px', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span>{t('exam.leaderboard.col_rank')}</span>
              <span>{t('exam.leaderboard.col_username')}</span>
              <span style={{ textAlign: 'end', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                <Layers size={14} strokeWidth={2} /> {t('exam.leaderboard.col_levels')}
              </span>
              <span style={{ textAlign: 'end', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                <Clock size={14} strokeWidth={2} /> {t('exam.leaderboard.col_avg_time')}
              </span>
            </div>
            {top.map((row) => {
              const isMe = row.is_current_user;
              return (
                <div key={row.rank} style={{ display: 'grid', gridTemplateColumns: colGrid, padding: '13px 20px', borderBottom: '1px solid var(--border)', background: isMe ? 'rgba(139,92,246,0.08)' : 'transparent', alignItems: 'center' }}>
                  <RankBadge rank={row.rank} />
                  <span style={{ fontWeight: isMe ? 700 : 500, fontSize: '0.93rem', color: isMe ? 'var(--violet-light, #a78bfa)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {row.username}
                    {isMe && <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: 'var(--violet-light, #a78bfa)', letterSpacing: '0.3px' }}>{t('exam.leaderboard.you_pill')}</span>}
                  </span>
                  <span style={{ textAlign: 'end', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.93rem' }}>{row.levels_passed}</span>
                  <span style={{ textAlign: 'end', color: 'var(--text-muted)', fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>{fmtAvg(row.avg_seconds_per_level)}</span>
                </div>
              );
            })}
          </div>
          {!currentInTop && currentUser && (
            <div style={{ marginTop: 12, padding: '14px 20px', borderRadius: 12, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)', display: 'grid', gridTemplateColumns: colGrid, alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--violet-light, #a78bfa)' }}>#{currentUser.rank}</span>
              <span style={{ fontWeight: 700, color: 'var(--violet-light, #a78bfa)', fontSize: '0.93rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                {currentUser.username}
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: 'var(--violet-light, #a78bfa)' }}>{t('exam.leaderboard.you_pill')}</span>
              </span>
              <span style={{ textAlign: 'end', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.93rem' }}>{currentUser.levels_passed}</span>
              <span style={{ textAlign: 'end', color: 'var(--text-muted)', fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>{fmtAvg(currentUser.avg_seconds_per_level)}</span>
            </div>
          )}
          {!currentUser && (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('exam.leaderboard.not_on_board')}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'end', paddingInlineEnd: 4 }}>
            {t('exam.leaderboard.footnote')}
          </div>
        </>
      )}
    </div>
  );
}

// ── Level Node ───────────────────────────────────────────────────────────────

const PRICING_LOCK_REASONS = new Set([
  'beyond_trial_cap', 'trial_expired', 'no_entitlement', 'seat_no_coverage',
]);

function LevelNode({ level, examKey, worldKey }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { level_number, locked, lock_reason, passed } = level;
  const status        = passed ? 'passed' : locked ? 'locked' : 'unlocked';
  const isPricingLock = locked && PRICING_LOCK_REASONS.has(lock_reason);

  const handleClick = () => {
    if (!locked) {
      navigate(`/exam/${examKey}/world/${worldKey}/level/${level_number}`);
    } else if (isPricingLock) {
      navigate(`/pricing?exam=${examKey}`);
    }
  };

  // Tooltip text resolution
  const lockReasonText = t(`exam.lock_reason.${lock_reason}`, { defaultValue: lock_reason });
  const title = isPricingLock
    ? t('exam.level_node.unlock_with_upgrade')
    : locked
      ? lockReasonText
      : t('exam.level_node.tooltip_level', { n: level_number });

  return (
    <div
      className={`level-node ${status}${isPricingLock ? ' upgrade-trigger' : ''}`}
      onClick={handleClick}
      title={title}
      role="button"
      tabIndex={locked && !isPricingLock ? -1 : 0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      style={{ cursor: isPricingLock ? 'pointer' : undefined }}
    >
      <span className="level-node-num">{level_number}</span>
      <span className="level-node-icon">
        {passed
          ? <CheckCircle size={16} strokeWidth={2.5} />
          : isPricingLock
          ? <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>↑</span>
          : locked
          ? <Lock size={14} strokeWidth={2.5} />
          : <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>→</span>}
      </span>
    </div>
  );
}

// ── World Card ───────────────────────────────────────────────────────────────

function WorldCard({ world, examKey, defaultOpen }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen);
  const { world_key, world_name, world_name_ar, index, locked, lock_reason, levels } = world;
  const passedCount   = levels.filter((l) => l.passed).length;
  const allPassed     = passedCount === 10;
  const isPricingLock = locked && PRICING_LOCK_REASONS.has(lock_reason);

  const isArabic = i18n.language === 'ar';

  const arrow           = t('common.arrow');
  const lockReasonText  = t(`exam.lock_reason.${lock_reason}`, { defaultValue: lock_reason });
  const passedCountText = t('exam.world.passed_count', { passed: passedCount });

  const handleHeaderClick = () => {
    if (isPricingLock) {
      navigate(`/pricing?exam=${examKey}`);
    } else {
      setOpen((o) => !o);
    }
  };

  return (
    <div className={`world-card ${locked ? 'locked' : 'unlocked'}`}>
      <div className="world-card-header" onClick={handleHeaderClick}>
        <div className="world-header-left">
          <div className={`world-index-badge ${locked ? 'locked' : 'unlocked'}`}>W{index}</div>
          <div>
            <div className="world-name">
              {/* In AR show Arabic name only. In EN show both EN and muted AR */}
              {isArabic
                ? (world_name_ar || world_name)
                : (
                  <>
                    {world_name}
                    {world_name_ar && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.85rem', marginInlineStart: 8 }}>
                        {world_name_ar}
                      </span>
                    )}
                  </>
                )}
            </div>
            <div className="world-meta">{locked ? lockReasonText : passedCountText}</div>
          </div>
        </div>
        <div className="world-status-right">
          {allPassed && !locked && (
            <span className="world-completion-text" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={17} strokeWidth={2.5} /> {t('exam.world.complete')}
            </span>
          )}
          {locked && isPricingLock && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20,
              background: 'rgba(11,93,75,0.08)', border: '1px solid rgba(11,93,75,0.3)',
              color: 'var(--brand-green, #0B5D4B)', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer',
            }}>
              {t('exam.world.unlock_pill', { arrow })}
            </span>
          )}
          {locked && !isPricingLock && (
            <Lock size={18} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
          )}
          {!isPricingLock && (open
            ? <ChevronUp  size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </div>
      {open && (
        <div className="world-levels-grid">
          {levels.map((level) => (
            <LevelNode key={level.level_number} level={level} examKey={examKey} worldKey={world_key} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Track Tabs ───────────────────────────────────────────────────────────────

function TrackTabs({ tracks, activeTrack, onSelect }) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <div className="track-tabs">
      {tracks.map((track) => {
        // track_name from backend is English (e.g. "Math"). Arabic comes from exam.tracks.{key}
        const arName = t(`exam.tracks.${track.track_key}`, { defaultValue: '' });
        return (
          <button
            key={track.track_key}
            className={`track-tab ${activeTrack === track.track_key ? 'active' : ''}`}
            onClick={() => onSelect(track.track_key)}
          >
            {isArabic ? (
              <span className="track-tab-ar">{arName || track.track_name}</span>
            ) : (
              <>
                <span className="track-tab-en">{track.track_name}</span>
                <span className="track-tab-ar">{arName}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Track Progress Bar ────────────────────────────────────────────────────────

function TrackProgressBar({ track }) {
  const { t } = useTranslation();
  const totalWorlds     = track.worlds.length;
  const completedWorlds = track.worlds.filter((w) => w.levels.filter((l) => l.passed).length === 10).length;
  const totalLevels     = totalWorlds * 10;
  const passedLevels    = track.worlds.reduce((sum, w) => sum + w.levels.filter((l) => l.passed).length, 0);
  const pct             = totalLevels > 0 ? Math.round((passedLevels / totalLevels) * 100) : 0;
  return (
    <div className="track-progress-summary">
      <div className="track-progress-stats">
        <span>{t('exam.track_progress.worlds_complete', { completed: completedWorlds, total: totalWorlds })}</span>
        <span>{t('exam.track_progress.levels_passed',   { passed:    passedLevels,    total: totalLevels })}</span>
      </div>
      <div className="track-progress-bar">
        <div className="track-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── View toggle ───────────────────────────────────────────────────────────────

function ViewToggleBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
        cursor: 'pointer', transition: 'all 0.15s',
        background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
        border: active ? '1.5px solid rgba(139,92,246,0.5)' : '1.5px solid var(--border)',
        color: active ? 'var(--violet-light, #a78bfa)' : 'var(--text-muted)',
      }}
    >
      <Icon size={20} strokeWidth={2} />
      {label}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ExamPage() {
  const { t } = useTranslation();
  const { exam }  = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const isAdmin = user?.role === 'drfahm_admin';

  const [worldMap,       setWorldMap]       = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [entitlements,   setEntitlements]   = useState(null);
  const [activeTrack,    setActiveTrack]    = useState(null);
  const [view,           setView]           = useState('map');
  const [predictedScore, setPredictedScore] = useState(null);
  const [weakTopics,     setWeakTopics]     = useState(null);

  useEffect(() => {
    if (!['qudurat', 'tahsili'].includes(exam)) {
      navigate('/dashboard', { replace: true });
      return;
    }

    Promise.all([
      examsApi.worldMap(exam),
      billing.getEntitlements().catch(() => null),
      examsApi.predictedScore(exam).catch(() => null),
      examsApi.weakTopics(exam).catch(() => null),
    ]).then(([mapData, billingData, predData, weakData]) => {
      setWorldMap(mapData);
      setEntitlements(billingData);
      setPredictedScore(predData);
      setWeakTopics(weakData);
      if (mapData?.tracks?.length > 0) {
        setActiveTrack(mapData.tracks[0].track_key);
      }
    }).catch((err) => {
      setError(err?.error?.message || t('exam.load_map_failed'));
    }).finally(() => setLoading(false));
  }, [exam, navigate, t]);

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
          <Link to="/dashboard" className="btn btn-ghost" style={{ marginTop: 16 }}>
            {t('exam.back_to_dashboard')}
          </Link>
        </div>
      </>
    );
  }

  const tracks       = worldMap?.tracks || [];
  const currentTrack = tracks.find((tr) => tr.track_key === activeTrack) || tracks[0];

  const allEntitlements = [
    ...(entitlements?.individual_entitlements || []),
    ...(entitlements?.org_entitlements        || []),
  ];
  const hasPaidPlan = allEntitlements.some(
    (e) => e.exam === exam && new Date() < new Date(e.entitlement_expires_at)
  );
  const trial       = entitlements?.trials?.find((tr) => tr.exam === exam);
  const trialActive = trial && new Date() < new Date(trial.trial_expires_at);

  const activeEnt        = allEntitlements.find(
    (e) => e.exam === exam && new Date() < new Date(e.entitlement_expires_at)
  );
  const planName         = activeEnt ? planDisplayName(t, activeEnt.plan_id) : null;

  const firstUnlockedIdx = currentTrack?.worlds?.findIndex((w) => !w.locked) ?? 0;
  const totalTracks      = tracks.length;
  const worldsPerTrack   = currentTrack?.worlds?.length || 5;

  const examTitle = t(`exam.title_${exam}`, { defaultValue: exam });
  const subtitle  = totalTracks === 1
    ? t('exam.subtitle_one_track',   { worlds: worldsPerTrack })
    : t('exam.subtitle_many_tracks', { count:  totalTracks, worlds: worldsPerTrack });

  return (
    <>
      <Navbar />
      <div className="page">

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Link to="/dashboard" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
            {t('exam.breadcrumb_dashboard')}
          </Link>
          <span style={{ color: 'var(--border)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{examTitle}</span>
        </div>

        <div className="page-header">
          <h1 className="page-title">{examTitle}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>

        {/* Paid plan — show active plan info, no nudge */}
        {!isAdmin && hasPaidPlan && planName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 18px', borderRadius: 10, marginBottom: 24,
            background: 'rgba(11,93,75,0.05)', border: '1px solid rgba(11,93,75,0.2)',
          }}>
            <span style={{ fontSize: '1rem' }}>✓</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--brand-green)', fontWeight: 600 }}>
              {t('exam.plan_active_banner', { plan: planName })}
            </span>
          </div>
        )}

        {/* Free trial — nudge to upgrade */}
        {!isAdmin && !hasPaidPlan && trialActive && (
          <div className="paywall-banner" style={{ marginBottom: 24 }}>
            <div className="paywall-text">
              <h3>{t('exam.trial_banner_title')}</h3>
              <p>{t('exam.trial_banner_body')}</p>
            </div>
            <div className="paywall-actions">
              <Link to={`/pricing?exam=${exam}`} className="btn btn-ghost btn-sm">
                {t('exam.trial_banner_silver_cta')}
              </Link>
              <Link to={`/pricing?exam=${exam}`} className="btn btn-violet btn-sm">
                {t('exam.trial_banner_gold_cta')}
              </Link>
            </div>
          </div>
        )}

        {/* Trial expired */}
        {!isAdmin && !hasPaidPlan && !trialActive && (
          <div className="paywall-banner" style={{ marginBottom: 24 }}>
            <div className="paywall-text">
              <h3>{t('exam.expired_banner_title')}</h3>
              <p>{t('exam.expired_banner_body')}</p>
            </div>
            <div className="paywall-actions">
              <Link to={`/pricing?exam=${exam}`} className="btn btn-primary btn-sm">
                {t('exam.expired_banner_cta')}
              </Link>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <ViewToggleBtn active={view === 'map'}         onClick={() => setView('map')}         icon={Map}    label={t('exam.view_map')} />
          <ViewToggleBtn active={view === 'leaderboard'} onClick={() => setView('leaderboard')} icon={Trophy} label={t('exam.view_leaderboard')} />
        </div>

        {view === 'map' && (
          <>
            {tracks.length > 1 && (
              <TrackTabs tracks={tracks} activeTrack={activeTrack} onSelect={setActiveTrack} />
            )}
            {currentTrack && <TrackProgressBar track={currentTrack} />}

            <PredictedScoreBanner exam={exam} data={predictedScore} />
            <WeakTopicsCard data={weakTopics} />

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

        {view === 'leaderboard' && (
          <LeaderboardView exam={exam} />
        )}

      </div>
    </>
  );
}