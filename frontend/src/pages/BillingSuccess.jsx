import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { billing } from '../api';
import Navbar from '../components/Navbar';

const POLL_INTERVAL_MS = 2500;  // check every 2.5 seconds
const MAX_POLLS        = 12;    // give up after 30 seconds

export default function BillingSuccess() {
  const [entitlements,  setEntitlements]  = useState(null);
  const [pollCount,     setPollCount]     = useState(0);
  const [gaveUp,        setGaveUp]        = useState(false);
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
          // Entitlement confirmed — stop polling
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

    // First check immediately, then poll
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  const activeEnts = [
    ...(entitlements?.individual_entitlements || []),
    ...(entitlements?.org_entitlements        || []),
  ].filter((e) => new Date() < new Date(e.entitlement_expires_at));

  const activated = activeEnts.length > 0;

  return (
    <>
      <Navbar />
      <div className="success-page">
        <div className="success-card">
          <div className="success-icon">{activated ? '🎉' : '⏳'}</div>
          <h1 className="success-title">
            {activated ? 'Payment successful!' : 'Confirming your payment…'}
          </h1>
          <p className="success-subtitle">
            {activated
              ? 'Your plan is now active. Your full exam journey is unlocked — let\'s go.'
              : 'Your payment went through. We\'re activating your plan now.'}
          </p>

          {/* Activating state */}
          {!activated && !gaveUp && (
            <div style={{ margin: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="spinner" />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Checking… ({pollCount}/{MAX_POLLS})
              </p>
            </div>
          )}

          {/* Gave up — webhook likely delayed */}
          {!activated && gaveUp && (
            <div className="alert alert-info" style={{ marginBottom: 24 }}>
              Your payment was received but activation is taking longer than usual.
              Please refresh your dashboard in a minute — your plan will appear automatically.
              If it doesn't arrive within 5 minutes,{' '}
              <a href="mailto:billing@drfahm.com" style={{ color: 'var(--violet-light)' }}>
                contact us
              </a>.
            </div>
          )}

          {/* Confirmed entitlements */}
          {activated && (
            <div style={{ marginBottom: 28 }}>
              {activeEnts.map((e) => (
                <div key={e.id} className="card" style={{ marginBottom: 10, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>
                        {e.exam} — {e.plan_id} Plan
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Worlds 1–{e.max_world_index} · Expires {new Date(e.entitlement_expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`plan-pill ${e.plan_id}`} style={{ textTransform: 'capitalize' }}>
                      {e.plan_id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard →
            </Link>
            {activated && activeEnts.length > 0 && (
              <Link to={`/exam/${activeEnts[0].exam}`} className="btn btn-ghost">
                Start {activeEnts[0].exam} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}