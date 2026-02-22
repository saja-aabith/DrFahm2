import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { billing } from '../api';
import Navbar from '../components/Navbar';

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Give Stripe webhook a moment to fire before fetching
    const timer = setTimeout(() => {
      billing.getEntitlements()
        .then(setEntitlements)
        .catch(() => setEntitlements(null))
        .finally(() => setLoading(false));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const activeEnts = [
    ...(entitlements?.individual_entitlements || []),
    ...(entitlements?.org_entitlements || []),
  ].filter((e) => new Date() < new Date(e.entitlement_expires_at));

  return (
    <>
      <Navbar />
      <div className="success-page">
        <div className="success-card">
          <div className="success-icon">🎉</div>
          <h1 className="success-title">Payment successful!</h1>
          <p className="success-subtitle">
            Your plan is now active. Your full exam journey is unlocked — let's go.
          </p>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
              <div className="spinner" />
            </div>
          ) : activeEnts.length > 0 ? (
            <div style={{ marginBottom: 28 }}>
              {activeEnts.map((e) => (
                <div
                  key={e.id}
                  className="card"
                  style={{ marginBottom: 10, textAlign: 'left' }}
                >
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
          ) : (
            <div className="alert alert-info" style={{ marginBottom: 24 }}>
              Your plan is being activated — this usually takes a few seconds. If you don't see it shortly, please refresh your dashboard.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard →
            </Link>
            {activeEnts.length > 0 && (
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