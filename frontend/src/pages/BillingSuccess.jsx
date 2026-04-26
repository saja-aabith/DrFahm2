import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { billing } from '../api';
import Navbar from '../components/Navbar';

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS        = 12;

// Map plan_id (DB/API value, NEVER changes) → translation key under pricing.plans.*
// `basic` → silver, `premium` → gold, `free` → free.
const PLAN_TKEY = {
  basic:   'silver',
  premium: 'gold',
  free:    'free',
};

export default function BillingSuccess() {
  const { t, i18n } = useTranslation();
  const [entitlements, setEntitlements] = useState(null);
  const [pollCount,    setPollCount]    = useState(0);
  const [gaveUp,       setGaveUp]       = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await billing.getEntitlements();
        const active = [
          ...(data?.individual_entitlements || []),
          ...(data?.org_entitlements        || []),
        ].filter((e) => new Date() < new Date(e.entitlement_expires_at));

        if (active.length > 0) {
          clearInterval(pollRef.current);
          setEntitlements(data);
          return;
        }
      } catch {
        // Network error — keep polling
      }

      setPollCount((n) => {
        const next = n + 1;
        if (next >= MAX_POLLS) {
          clearInterval(pollRef.current);
          setGaveUp(true);
        }
        return next;
      });
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  const activeEnts = [
    ...(entitlements?.individual_entitlements || []),
    ...(entitlements?.org_entitlements        || []),
  ].filter((e) => new Date() < new Date(e.entitlement_expires_at));

  const activated = activeEnts.length > 0;
  const arrow     = t('common.arrow');
  const dateLocale = i18n.language === 'ar' ? 'ar' : 'en-GB';

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getPlanName = (planId) => {
    const key = PLAN_TKEY[planId];
    return key ? t(`pricing.plans.${key}.name`) : planId;
  };

  const getExamName = (exam) => t(`common.${exam}`, { defaultValue: exam });

  return (
    <>
      <Navbar />
      <div className="success-page">
        <div className="success-card">
          <div className="success-icon">{activated ? '🎉' : '⏳'}</div>
          <h1 className="success-title">
            {activated
              ? t('billing_success.title_activated')
              : t('billing_success.title_pending')}
          </h1>
          <p className="success-subtitle">
            {activated
              ? t('billing_success.subtitle_activated')
              : t('billing_success.subtitle_pending')}
          </p>

          {!activated && !gaveUp && (
            <div style={{ margin: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="spinner" />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('billing_success.polling_status', { count: pollCount, max: MAX_POLLS })}
              </p>
            </div>
          )}

          {!activated && gaveUp && (
            <div className="alert alert-info" style={{ marginBottom: 24 }}>
              {t('billing_success.give_up_before')}
              <a href="mailto:info@drfahm.com" style={{ color: 'var(--brand-green)' }}>
                {t('billing_success.give_up_link')}
              </a>
              {t('billing_success.give_up_after')}
            </div>
          )}

          {activated && (
            <div style={{ marginBottom: 28 }}>
              {activeEnts.map((e) => {
                const planName = getPlanName(e.plan_id);
                const examName = getExamName(e.exam);
                return (
                  <div key={e.id} className="card" style={{ marginBottom: 10, textAlign: 'start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {t('billing_success.ent_row_title', { exam: examName, plan: planName })}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {t('billing_success.ent_row_detail', {
                            max: e.max_world_index,
                            date: formatDate(e.entitlement_expires_at),
                          })}
                        </div>
                      </div>
                      <span className={`plan-pill ${e.plan_id}`}>
                        {planName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="btn btn-primary">
              {t('billing_success.go_to_dashboard', { arrow })}
            </Link>
            {activated && activeEnts.length > 0 && (
              <Link to={`/exam/${activeEnts[0].exam}`} className="btn btn-ghost">
                {t('billing_success.start_exam', {
                  exam: getExamName(activeEnts[0].exam),
                  arrow,
                })}
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}