import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { billing, exams as examsApi } from '../api';
import Navbar from '../components/Navbar';

// Exam structure metadata — descriptions come from i18n, Arabic name kept for EN bilingual display
const EXAM_INFO = {
  qudurat: {
    arabic: '\u0627\u0644\u0642\u062f\u0631\u0627\u062a',
    worlds: 10,
    tracks: 2,
  },
  tahsili: {
    arabic: '\u0627\u0644\u062a\u062d\u0635\u064a\u0644\u064a',
    worlds: 20,
    tracks: 4,
  },
};

// Display name mapping — plan_id values stay unchanged in DB/API
// Resolves to existing pricing.plans.* translation keys
function planDisplayName(t, planId) {
  switch (planId) {
    case 'free':    return t('pricing.plans.free.name');
    case 'basic':   return t('pricing.plans.silver.name');
    case 'premium': return t('pricing.plans.gold.name');
    default:        return planId;
  }
}

function daysRemaining(expiresAt) {
  return Math.max(0, Math.ceil(
    (new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
  ));
}

function formatExpiry(dateStr, lang) {
  const locale = lang === 'ar' ? 'ar' : 'en-GB';
  return new Date(dateStr).toLocaleDateString(locale, {
    day:      'numeric',
    month:    'short',
    year:     'numeric',
    calendar: 'gregory',
  });
}

// ── M3: Weak Topics Card ──────────────────────────────────────────────────────

function WeakTopicsCard({ data }) {
  const { t } = useTranslation();

  const PRIORITY_STYLE = {
    high:   { color: '#B91C1C', bg: 'rgba(185,28,28,0.07)',   border: 'rgba(185,28,28,0.2)',  label: t('dashboard.priority_high') },
    review: { color: '#8A6E2A', bg: 'rgba(198,168,91,0.08)', border: 'rgba(198,168,91,0.25)', label: t('dashboard.priority_review') },
  };

  if (!data?.weak_topics?.length) return null;
  const topics = data.weak_topics;

  const basedOnText = data.based_on_levels === 1
    ? t('dashboard.topics_based_on_level')
    : t('dashboard.topics_based_on_levels', { count: data.based_on_levels });

  return (
    <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: '1.1rem' }}>⚠</span>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{t('dashboard.topics_section_title')}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginInlineStart: 4 }}>
          {basedOnText}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topics.map((topic) => {
          const ps     = PRIORITY_STYLE[topic.priority] || PRIORITY_STYLE.review;
          const barPct = Math.round(topic.struggle_rate * 100);
          return (
            <div key={topic.topic} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 100px', gap: 10, alignItems: 'center' }}>
              {/* topic.label comes from the backend (English). Add AR topic labels backend-side when available. */}
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topic.label}>
                {topic.label}
              </span>
              <div style={{ height: 8, background: 'var(--bg-card-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: ps.color, borderRadius: 4, transition: 'width 0.4s ease', opacity: 0.85 }} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'end', whiteSpace: 'nowrap' }}>
                {t('dashboard.topics_levels_count', { struggled: topic.struggled_levels, total: topic.total_levels })}
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

// ── Trial badge ───────────────────────────────────────────────────────────────

function TrialBadge({ trial }) {
  const { t } = useTranslation();

  if (!trial) return null;
  const now      = new Date();
  const expires  = new Date(trial.trial_expires_at);
  const active   = now < expires;
  const days     = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

  if (!active) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', borderRadius: 20,
        background: 'rgba(185,28,28,0.07)', border: '1.5px solid rgba(185,28,28,0.25)',
        color: '#B91C1C', fontSize: '0.82rem', fontWeight: 700,
      }}>
        {t('dashboard.trial_expired_badge')}
      </span>
    );
  }

  const daysText = days === 1
    ? t('dashboard.trial_day_left')
    : t('dashboard.trial_days_left', { count: days });

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 13px', borderRadius: 20,
      background: 'rgba(11,93,75,0.08)', border: '1.5px solid rgba(11,93,75,0.3)',
      color: 'var(--brand-green, #0B5D4B)', fontSize: '0.85rem', fontWeight: 700,
    }}>
      {daysText}
    </span>
  );
}

// ── Exam card ─────────────────────────────────────────────────────────────────

function ExamCard({ examKey, entitlements, trials, progressData, isAdmin }) {
  const { t, i18n } = useTranslation();
  const info  = EXAM_INFO[examKey];
  const trial = trials?.find((tr) => tr.exam === examKey);
  const ent   = entitlements?.find((e) => e.exam === examKey);

  const examName = t(`common.${examKey}`);
  const arrow    = t('common.arrow');
  const isEnglish = i18n.language === 'en';

  let worldsCompleted = 0;
  const totalWorlds   = info.worlds;
  if (progressData) {
    worldsCompleted = progressData.worlds?.filter((w) => w.fully_completed).length || 0;
  }
  const pct = totalWorlds > 0 ? Math.round((worldsCompleted / totalWorlds) * 100) : 0;

  const trialActive  = trial && new Date() < new Date(trial.trial_expires_at);
  const trialExpired = trial && new Date() >= new Date(trial.trial_expires_at);
  const noTrialYet   = !trial;

  let ctaLabel = null;
  if (!isAdmin && !ent) {
    if (trialActive)        ctaLabel = t('dashboard.cta_continue',    { arrow });
    else if (trialExpired)  ctaLabel = t('dashboard.cta_unlock',      { arrow });
    else                    ctaLabel = t('dashboard.cta_start_trial', { arrow });
  } else if (!isAdmin && ent) {
    ctaLabel = t('dashboard.cta_continue', { arrow });
  }

  return (
    <Link to={`/exam/${examKey}`} className={`exam-card ${examKey}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={`exam-badge ${examKey}`}>{examName.toUpperCase()}</div>
      <h3 className="exam-card-title">
        {examName}
        {isEnglish && (
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>
            {' '}/ {info.arabic}
          </span>
        )}
      </h3>
      <p className="exam-card-desc">{t(`dashboard.exam_desc.${examKey}`)}</p>

      <div style={{ marginBottom: 16 }}>
        {isAdmin && <span className="plan-pill premium">{t('dashboard.admin_full_access')}</span>}
        {!isAdmin && ent && (
          <span className={`plan-pill ${ent.plan_id}`}>
            {t('dashboard.plan_suffix', { plan: planDisplayName(t, ent.plan_id) })}
          </span>
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
            {t('dashboard.trial_available')}
          </span>
        )}
      </div>

      <div className="exam-progress-bar" style={{ marginBottom: 6 }}>
        <div className="exam-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="exam-progress-label" style={{ marginBottom: ctaLabel ? 16 : 0 }}>
        {t('dashboard.progress_label', { completed: worldsCompleted, total: totalWorlds })}
      </p>

      {ctaLabel && (
        <div style={{
          marginTop: 'auto', padding: '10px 0 0',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'center',
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
  const allExpired = trials.every((tr) => now >= new Date(tr.trial_expires_at));
  const anyActive  = trials.some((tr)  => now <  new Date(tr.trial_expires_at));
  if (allExpired) return 'expired';
  if (anyActive)  return 'active_trial';
  return 'no_trial';
}

// ── Entitlement row with days remaining ───────────────────────────────────────

function EntitlementRow({ ent }) {
  const { t, i18n } = useTranslation();
  const days    = daysRemaining(ent.entitlement_expires_at);
  const expires = formatExpiry(ent.entitlement_expires_at, i18n.language);
  const examName    = t(`common.${ent.exam}`);
  const planName    = planDisplayName(t, ent.plan_id);
  const isLow = days <= 14;

  const daysText = days === 1
    ? t('dashboard.ent_row_day_left')
    : t('dashboard.ent_row_days_left', { count: days });

  return (
    <div className="entitlement-row">
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          {t('dashboard.ent_row_title', { exam: examName, plan: planName })}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {t('dashboard.ent_row_detail', { date: expires, max: ent.max_world_index })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Days remaining pill */}
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 10px', borderRadius: 20,
          fontSize: '0.78rem', fontWeight: 700,
          background: isLow ? 'rgba(185,28,28,0.07)' : 'rgba(11,93,75,0.07)',
          border: `1px solid ${isLow ? 'rgba(185,28,28,0.2)' : 'rgba(11,93,75,0.2)'}`,
          color: isLow ? '#B91C1C' : 'var(--brand-green)',
          whiteSpace: 'nowrap',
        }}>
          {daysText}
        </span>
        <span className={`plan-pill ${ent.plan_id}`}>
          {planName}
        </span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t }    = useTranslation();
  const { user } = useAuth();
  const isAdmin  = user?.role === 'drfahm_admin';

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
          <h1 className="page-title">{t('dashboard.welcome', { username: user?.username })}</h1>
          <p className="page-subtitle">{t('dashboard.subtitle')}</p>
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
            <p className="section-title">{t('dashboard.topics_section_title')}</p>
            {Object.keys(EXAM_INFO).map((examKey) => {
              const wd = weakTopicsMap[examKey];
              if (!wd?.weak_topics?.length) return null;
              return (
                <div key={examKey} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                    {t(`common.${examKey}`)}
                  </div>
                  <WeakTopicsCard data={wd} />
                </div>
              );
            })}
          </div>
        )}

        {/* Active entitlements — with days remaining */}
        {!loading && allEntitlements.length > 0 && (
          <div className="section">
            <p className="section-title">{t('dashboard.active_plans_title')}</p>
            <div className="card">
              {allEntitlements.map((ent) => (
                <EntitlementRow key={ent.id} ent={ent} />
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
                  <h3>{t('dashboard.paywall.expired_title')}</h3>
                  <p>{t('dashboard.paywall.expired_body')}</p>
                </div>
                <div className="paywall-actions">
                  <Link to="/pricing" className="btn btn-violet btn-sm">
                    {t('dashboard.paywall.expired_cta')}
                  </Link>
                </div>
              </>
            )}
            {trialState === 'active_trial' && (
              <>
                <div className="paywall-text">
                  <h3>{t('dashboard.paywall.active_title')}</h3>
                  <p>{t('dashboard.paywall.active_body')}</p>
                </div>
                <div className="paywall-actions">
                  <Link to="/pricing" className="btn btn-violet btn-sm">
                    {t('dashboard.paywall.active_cta')}
                  </Link>
                </div>
              </>
            )}
            {trialState === 'no_trial' && (
              <>
                <div className="paywall-text">
                  <h3>{t('dashboard.paywall.notrial_title')}</h3>
                  <p>{t('dashboard.paywall.notrial_body')}</p>
                </div>
                <div className="paywall-actions">
                  <Link to="/pricing" className="btn btn-ghost btn-sm">
                    {t('dashboard.paywall.notrial_cta')}
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}