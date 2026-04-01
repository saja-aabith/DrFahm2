import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import ImageUpload from '../components/ImageUpload';
import LaTeXCheatsheet from '../components/LaTeXCheatsheet';
import * as adminApi from '../api/admin';

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('chunk-e-styles')) {
  const s = document.createElement('style');
  s.id = 'chunk-e-styles';
  s.textContent = `
    .row-selected { background: rgba(139,92,246,0.07) !important; }
    .row-selected:hover { background: rgba(139,92,246,0.11) !important; }

    /* ── Chunk J: AI review card ── */
    .ai-review-card {
      margin-top: 12px; padding: 14px 16px; border-radius: 10px;
      background: rgba(124,58,237,0.06); border: 1px solid rgba(124,58,237,0.2);
    }
    .ai-review-card.rejected {
      background: rgba(220,38,38,0.05); border-color: rgba(220,38,38,0.2);
    }
    .ai-review-card.approved {
      background: rgba(22,163,74,0.05); border-color: rgba(22,163,74,0.2);
    }
    .ai-review-predicted {
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.1rem;
      background: rgba(124,58,237,0.15); color: #a78bfa;
      border: 1.5px solid rgba(124,58,237,0.3);
    }
    .ai-review-btn {
      padding: 6px 14px; border-radius: 7px; font-weight: 700;
      font-size: 0.85rem; cursor: pointer; transition: opacity 0.15s;
    }
    .ai-review-btn:disabled { opacity: 0.5; cursor: default; }
    .ai-review-btn.approve {
      background: rgba(22,163,74,0.15); color: #16a34a;
      border: 1px solid rgba(22,163,74,0.35);
    }
    .ai-review-btn.edit {
      background: rgba(255,255,255,0.04); color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .ai-review-btn.edit.active {
      background: rgba(59,130,246,0.15); color: #60a5fa;
      border-color: rgba(59,130,246,0.3);
    }
    .ai-review-btn.reject {
      background: rgba(220,38,38,0.08); color: #dc2626;
      border: 1px solid rgba(220,38,38,0.25);
    }
    .ai-review-note {
      padding: 8px 10px; border-radius: 6px;
      background: rgba(0,0,0,0.15); border-left: 3px solid rgba(124,58,237,0.4);
      margin-bottom: 10px;
    }
    .ai-review-hint {
      padding: 8px 10px; border-radius: 6px;
      background: rgba(217,119,6,0.06); border: 1px solid rgba(217,119,6,0.2);
      margin-bottom: 10px;
    }
    .ai-override-btn {
      width: 32px; height: 32px; border-radius: 6px; font-weight: 700;
      font-size: 0.85rem; cursor: pointer;
      background: rgba(255,255,255,0.04); border: 1.5px solid var(--border);
      color: var(--text-muted); transition: all 0.1s;
    }
    .ai-override-btn.selected {
      background: rgba(34,197,94,0.2); border-color: rgba(34,197,94,0.5); color: #4ade80;
    }
    .ai-log {
      max-height: 180px; overflow: auto;
      background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px;
      font-size: 0.8rem; font-family: monospace; color: var(--text-muted);
    }
    .ai-log-line { margin-bottom: 2px; }
    .ai-log-line.ok   { color: #4ade80; }
    .ai-log-line.fail { color: #f87171; }

    /* ── Chunk K2: World health ── */
    .world-section-card {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border); border-radius: 10px;
      padding: 16px; margin-bottom: 16px;
    }
    .world-row {
      display: grid;
      grid-template-columns: 160px 1fr 60px 70px 90px 90px 80px auto;
      gap: 10px; align-items: center;
      padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .world-row:last-child { border-bottom: none; }
    .world-fill-bar-bg {
      height: 8px; background: rgba(255,255,255,0.07);
      border-radius: 4px; overflow: hidden; min-width: 60px;
    }
    .world-fill-bar-fill {
      height: 100%; border-radius: 4px; transition: width 0.4s ease;
    }
    .world-topic-chip {
      display: inline-block; padding: 1px 6px; border-radius: 4px;
      font-size: 0.75rem; font-weight: 600; margin: 1px;
      background: rgba(6,182,212,0.1); color: #0891b2;
      border: 1px solid rgba(6,182,212,0.2);
    }
    .sf-topic-check {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 8px; border-radius: 6px; cursor: pointer;
      font-size: 0.83rem; color: var(--text-secondary);
      border: 1px solid transparent; transition: all 0.1s;
    }
    .sf-topic-check:hover { background: rgba(255,255,255,0.04); }
    .sf-topic-check.selected {
      background: rgba(6,182,212,0.1); color: #0891b2;
      border-color: rgba(6,182,212,0.25);
    }

    /* ── Chunk K3: Duplicate detection ── */
    .dup-group-card {
      background: rgba(255,255,255,0.03); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
    }
    .dup-group-card:hover { border-color: rgba(220,38,38,0.25); }
    .dup-question-row {
      display: grid; grid-template-columns: 1fr auto;
      gap: 12px; align-items: start;
      padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .dup-question-row:last-child { border-bottom: none; padding-bottom: 0; }
    .dup-question-row.deleted { opacity: 0.35; pointer-events: none; }
  `;
  document.head.appendChild(s);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMS = ['qudurat', 'tahsili'];
const WORLD_KEYS = {
  qudurat: ['math_100','math_150','math_200','math_250','math_300','verbal_100','verbal_150','verbal_200','verbal_250','verbal_300'],
  tahsili: ['math_100','math_150','math_200','math_250','math_300','biology_100','biology_150','biology_200','biology_250','biology_300','chemistry_100','chemistry_150','chemistry_200','chemistry_250','chemistry_300','physics_100','physics_150','physics_200','physics_250','physics_300'],
};

const SECTION_CONFIG = {
  qudurat: {
    label: 'Qudurat',
    sections: {
      math:   { label: 'Math',   worlds: ['math_100','math_150','math_200','math_250','math_300'] },
      verbal: { label: 'Verbal', worlds: ['verbal_100','verbal_150','verbal_200','verbal_250','verbal_300'] },
    },
  },
  tahsili: {
    label: 'Tahsili',
    sections: {
      math:      { label: 'Math',      worlds: ['math_100','math_150','math_200','math_250','math_300'] },
      biology:   { label: 'Biology',   worlds: ['biology_100','biology_150','biology_200','biology_250','biology_300'] },
      chemistry: { label: 'Chemistry', worlds: ['chemistry_100','chemistry_150','chemistry_200','chemistry_250','chemistry_300'] },
      physics:   { label: 'Physics',   worlds: ['physics_100','physics_150','physics_200','physics_250','physics_300'] },
    },
  },
};

const TIER_LABELS = {
  100: 'Bidaya (البداية)',
  150: "Su'ood (الصعود)",
  200: 'Tahadi (التحدي)',
  250: 'Itqan (الإتقان)',
  300: 'Qimma (القمة)',
};

function worldDisplayName(worldKey) {
  const band = parseInt(worldKey.split('_')[1], 10);
  return TIER_LABELS[band] || worldKey;
}

function getSectionFromWorldKey(wk) {
  if (!wk) return null;
  return wk.replace(/_\d+$/, '');
}


// ── Shared Components ─────────────────────────────────────────────────────────

function useFlash() {
  const [flash, setFlash] = useState(null);
  const showFlash = useCallback((msg, type = 'success') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 4000);
  }, []);
  return [flash, showFlash];
}

function Pill({ color = 'gray', children, style, ...rest }) {
  const colors = {
    green:  { bg: 'rgba(22,163,74,0.08)',    text: '#15803d',  border: 'rgba(22,163,74,0.2)' },
    amber:  { bg: 'rgba(217,119,6,0.08)',    text: '#b45309',  border: 'rgba(217,119,6,0.2)' },
    violet: { bg: 'rgba(124,58,237,0.08)',   text: '#6d28d9',  border: 'rgba(124,58,237,0.2)' },
    gray:   { bg: 'rgba(100,116,139,0.08)',  text: '#64748b',  border: 'rgba(100,116,139,0.15)' },
    blue:   { bg: 'rgba(59,130,246,0.08)',   text: '#2563eb',  border: 'rgba(59,130,246,0.2)' },
    cyan:   { bg: 'rgba(6,182,212,0.08)',    text: '#0891b2',  border: 'rgba(6,182,212,0.2)' },
    red:    { bg: 'rgba(220,38,38,0.08)',    text: '#dc2626',  border: 'rgba(220,38,38,0.2)' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap', ...style }} {...rest}>
      {children}
    </span>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="admin-tab-bar">
      {tabs.map((t) => (
        <button key={t.id} className={`admin-tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          <span className="admin-tab-icon">{t.icon}</span> {t.label}
        </button>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children, width }) {
  return (
    <div className="admin-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className="admin-modal" style={width ? { maxWidth: width } : {}}>
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">{title}</h3>
          {onClose && <button className="admin-modal-close" onClick={onClose}>✕</button>}
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}


// ── REVIEW PROGRESS PANEL ─────────────────────────────────────────────────────

function ReviewProgressPanel({ examFilter, refreshKey, onShowPending }) {
  const [data, setData] = useState(null);
  const [showWorlds, setShowWorlds] = useState(false);

  useEffect(() => {
    adminApi.reviewProgress(examFilter || '').then(setData).catch(() => {});
  }, [examFilter, refreshKey]);

  if (!data) return null;
  const { summary, progress } = data;
  if (!summary) return null;
  const pct        = summary.total > 0 ? Math.round((summary.reviewed / summary.total) * 100) : 0;
  const aiPending  = summary.ai_pending || 0;

  return (
    <div className="review-progress-panel">
      {/* AI Pending warning — cross-section, shown whenever count > 0 */}
      {aiPending > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', marginBottom: 8, borderRadius: 8,
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
        }}>
          <span style={{ fontSize: '0.88rem' }}>🤖</span>
          <span style={{ fontSize: '0.85rem', color: '#7c3aed', fontWeight: 600 }}>
            {aiPending} question{aiPending !== 1 ? 's' : ''} stuck in AI Pending
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flex: 1 }}>
            — network dropped during AI review run
          </span>
          {onShowPending && (
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed',
                border: '1px solid rgba(124,58,237,0.3)', padding: '3px 10px',
                fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}
              onClick={onShowPending}>
              Show &amp; fix →
            </button>
          )}
        </div>
      )}

      <div className="review-progress-header">
        <div>
          <span className="review-progress-count">{summary.reviewed} / {summary.total} reviewed</span>
          <span className="review-progress-pct"> — {pct}%</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowWorlds(!showWorlds)}>
          {showWorlds ? 'Hide worlds' : 'Show worlds'}
        </button>
      </div>
      <div className="review-progress-bar-bg">
        <div className="review-progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {showWorlds && (
        <div className="review-progress-worlds">
          {progress.map((p) => {
            const wpct      = p.total > 0 ? Math.round((p.reviewed / p.total) * 100) : 0;
            const pending   = p.ai_pending || 0;
            const sectionKey = p.section || p.world_key || '—';
            return (
              <div key={`${p.exam}-${sectionKey}`} className="review-world-row">
                <span className="review-world-label" style={{ textTransform: 'capitalize' }}>
                  {p.exam} / {sectionKey}
                  {pending > 0 && (
                    <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#7c3aed',
                      background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                      borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                      🤖 {pending} pending
                    </span>
                  )}
                </span>
                <div className="review-world-bar-bg">
                  <div className="review-world-bar-fill" style={{ width: `${wpct}%` }} />
                </div>
                <span className="review-world-count">{p.reviewed}/{p.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── TOPIC COVERAGE PANEL ──────────────────────────────────────────────────────

function topicBarColor(count) {
  if (count < 10)  return { bar: '#dc2626', bg: 'rgba(220,38,38,0.12)',  text: '#dc2626' };
  if (count < 30)  return { bar: '#d97706', bg: 'rgba(217,119,6,0.12)',  text: '#b45309' };
  return             { bar: '#16a34a', bg: 'rgba(22,163,74,0.1)',   text: '#15803d' };
}

function TopicCoveragePanel({ examFilter, refreshKey, onShowUntagged }) {
  const [data,     setData]     = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    adminApi.topicCoverage({ exam: examFilter || '' })
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [examFilter, refreshKey]);

  if (!data && !loading) return null;
  if (loading && !data)  return null;

  const { summary, by_section } = data || {};
  if (!summary) return null;

  const overallPct = summary.total > 0 ? Math.round((summary.tagged / summary.total) * 100) : 0;
  const overallBarColor = overallPct < 50 ? '#dc2626' : overallPct < 80 ? '#d97706' : '#16a34a';

  return (
    <div className="topic-coverage-panel" style={{
      background: 'var(--bg-card, rgba(255,255,255,0.04))', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Topic Coverage</span>
        <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
          {summary.tagged.toLocaleString()} tagged · <span style={{ color: summary.untagged > 0 ? '#b45309' : 'var(--text-muted)' }}>{summary.untagged.toLocaleString()} untagged</span>
          {' · '}<strong style={{ color: overallPct < 50 ? '#dc2626' : overallPct < 80 ? '#d97706' : '#15803d' }}>{overallPct}%</strong>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {summary.untagged > 0 && onShowUntagged && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.8rem', color: '#b45309', borderColor: 'rgba(217,119,6,0.3)' }}
              onClick={onShowUntagged}>⚠ Show untagged</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Details'}</button>
        </div>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${overallPct}%`, background: overallBarColor, transition: 'width 0.4s ease' }} />
      </div>
      {expanded && by_section && (
        <div style={{ marginTop: 16 }}>
          {Object.entries(by_section).map(([sectionKey, secData]) => {
            const secPct = secData.total > 0 ? Math.round((secData.tagged / secData.total) * 100) : 0;
            const secBarColor = secPct < 50 ? '#dc2626' : secPct < 80 ? '#d97706' : '#16a34a';
            const topics = secData.topics || [];
            const maxCount = topics.reduce((m, t) => Math.max(m, t.count), 1);
            return (
              <div key={sectionKey} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{sectionKey}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {secData.total.toLocaleString()} total · {secData.tagged.toLocaleString()} tagged ·{' '}
                    <span style={{ color: secData.untagged > 0 ? '#b45309' : 'var(--text-muted)' }}>{secData.untagged.toLocaleString()} untagged</span>
                  </span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', color: secPct < 50 ? '#dc2626' : secPct < 80 ? '#d97706' : '#15803d' }}>{secPct}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${secPct}%`, background: secBarColor, transition: 'width 0.4s ease' }} />
                </div>
                {topics.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>No topics defined for this section.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {topics.map((t) => {
                      const clr = topicBarColor(t.count);
                      const barWidth = maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0;
                      return (
                        <div key={t.topic} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 160, flexShrink: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.label}>{t.label}</span>
                          <div style={{ flex: 1, height: 14, borderRadius: 3, background: clr.bg, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barWidth}%`, background: clr.bar, borderRadius: 3, transition: 'width 0.35s ease', opacity: 0.85 }} />
                          </div>
                          <span style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: clr.text }}>{t.count}</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: clr.bar }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {secData.untagged > 0 && (
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', fontSize: '0.8rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚠</span>
                    <span>{secData.untagged.toLocaleString()} question{secData.untagged !== 1 ? 's' : ''} in this section have no topic tag.</span>
                    {onShowUntagged && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: '0.78rem', padding: '1px 8px', color: '#b45309', borderColor: 'rgba(217,119,6,0.3)' }} onClick={onShowUntagged}>Filter</button>}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {[['#dc2626','<10 questions'],['#d97706','10–29 questions'],['#16a34a','30+ questions']].map(([c,l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ── INLINE ANSWER PICKER ──────────────────────────────────────────────────────

function InlineAnswerPicker({ question, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePick = async (ans) => {
    if (ans === question.correct_answer) { setOpen(false); return; }
    setSaving(true);
    try {
      const result = await adminApi.quickUpdate(question.id, 'correct_answer', ans, question.version);
      onSaved(result.question);
      setOpen(false);
    } catch (e) { alert(e?.error?.message || 'Failed to save. Refresh and try again.'); }
    finally { setSaving(false); }
  };

  const handleConfirmReview = async () => {
    setSaving(true);
    try {
      const result = await adminApi.markReviewed(question.id, question.version);
      onSaved(result.question);
      setOpen(false);
    } catch (e) { alert(e?.error?.message || 'Failed to mark reviewed.'); }
    finally { setSaving(false); }
  };

  const isReviewed = !!question.last_reviewed_at;

  if (!open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Pill color={isReviewed ? 'green' : 'amber'} onClick={() => setOpen(true)} title="Click to change correct answer" style={{ cursor: 'pointer' }}>
          {question.correct_answer?.toUpperCase() || '?'}
        </Pill>
        {isReviewed && <span title={`Reviewed ${new Date(question.last_reviewed_at).toLocaleDateString()}`} style={{ color: '#15803d', fontSize: '0.75rem' }}>✓</span>}
      </span>
    );
  }

  return (
    <div ref={ref} className="inline-answer-picker">
      {saving ? <span className="inline-answer-saving">…</span> : (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {['a', 'b', 'c', 'd'].map((opt) => (
            <button key={opt} className={`inline-answer-btn ${opt === question.correct_answer ? 'active' : ''}`}
              onClick={() => handlePick(opt)} title={`Set correct answer to ${opt.toUpperCase()}`}>
              {opt.toUpperCase()}
            </button>
          ))}
          {!isReviewed && (
            <button className="inline-answer-btn confirm" onClick={handleConfirmReview}
              title="Confirm current answer is correct (mark as reviewed)"
              style={{ marginLeft: 4, background: 'rgba(34,197,94,0.15)', color: '#15803d', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>
              ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ── INLINE DIFFICULTY PICKER ──────────────────────────────────────────────────

function InlineDifficultyPicker({ question, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePick = async (difficulty) => {
    if (difficulty === (question.difficulty || '')) { setOpen(false); return; }
    setSaving(true);
    try {
      const result = await adminApi.quickUpdate(question.id, 'difficulty', difficulty || null, question.version);
      onSaved(result.question);
      setOpen(false);
    } catch (e) { alert(e?.error?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  if (!open) {
    if (question.difficulty) {
      return <Pill color={question.difficulty === 'easy' ? 'green' : 'amber'} onClick={() => setOpen(true)} title="Click to change difficulty" style={{ cursor: 'pointer' }}>{question.difficulty}</Pill>;
    }
    return (
      <span onClick={() => setOpen(true)} title="Click to tag difficulty"
        style={{ color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px dashed rgba(255,255,255,0.1)' }}>—</span>
    );
  }

  return (
    <div ref={ref} className="inline-difficulty-picker">
      {saving ? <span className="inline-answer-saving">…</span> : (
        <>
          <button className={`inline-diff-btn easy ${question.difficulty === 'easy' ? 'active' : ''}`} onClick={() => handlePick('easy')}>Easy</button>
          <button className={`inline-diff-btn hard ${question.difficulty === 'hard' ? 'active' : ''}`} onClick={() => handlePick('hard')}>Hard</button>
          <button className="inline-diff-btn none" onClick={() => handlePick('')} title="Remove tag">✕</button>
        </>
      )}
    </div>
  );
}


// ── INLINE TOPIC PICKER ───────────────────────────────────────────────────────

function InlineTopicPicker({ question, taxonomy, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const section = question.section || getSectionFromWorldKey(question.world_key);
  const topics = (taxonomy && section && taxonomy[section]) || [];

  const handlePick = async (topicKey) => {
    if (topicKey === (question.topic || '')) { setOpen(false); return; }
    setSaving(true);
    try {
      const result = await adminApi.quickUpdate(question.id, 'topic', topicKey || null, question.version);
      onSaved(result.question);
      setOpen(false);
    } catch (e) { alert(e?.error?.message || 'Failed to save topic.'); }
    finally { setSaving(false); }
  };

  if (!open) {
    if (question.topic) {
      const topicLabel = topics.find(t => t.key === question.topic)?.label || question.topic;
      return (
        <Pill color="cyan" onClick={() => setOpen(true)} title="Click to change topic" style={{ cursor: 'pointer', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {topicLabel}
        </Pill>
      );
    }
    return (
      <span onClick={() => setOpen(true)} title="Click to tag topic"
        style={{ color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px dashed rgba(255,255,255,0.1)' }}>—</span>
    );
  }

  return (
    <div ref={ref} className="inline-topic-picker">
      {saving ? <span className="inline-answer-saving">…</span> : (
        <div className="inline-topic-dropdown">
          {topics.length === 0 && <div className="inline-topic-empty">No topics for this section</div>}
          {topics.map((t) => (
            <button key={t.key} className={`inline-topic-btn ${t.key === question.topic ? 'active' : ''}`} onClick={() => handlePick(t.key)}>{t.label}</button>
          ))}
          {question.topic && <button className="inline-topic-btn clear" onClick={() => handlePick('')}>✕ Clear topic</button>}
        </div>
      )}
    </div>
  );
}


// ── AI REVIEW CARD ────────────────────────────────────────────────────────────

function AIReviewCard({ question, onUpdated }) {
  const [approving,      setApproving]      = useState(false);
  const [rejecting,      setRejecting]      = useState(false);
  const [editMode,       setEditMode]       = useState(false);
  const [overrideAnswer, setOverrideAnswer] = useState('');
  const [acceptHint,     setAcceptHint]     = useState(true);

  const status     = question.review_status;
  const confidence = question.llm_confidence;

  const confColor = confidence >= 0.85 ? '#16a34a' : confidence >= 0.65 ? '#d97706' : '#dc2626';
  const confLabel = confidence >= 0.85 ? 'High' : confidence >= 0.65 ? 'Medium' : 'Low';
  const confPill  = confidence >= 0.85 ? 'green'  : confidence >= 0.65 ? 'amber'  : 'red';

  const cardClass = status === 'rejected' ? 'ai-review-card rejected'
                  : status === 'approved' ? 'ai-review-card approved'
                  : 'ai-review-card';

  const handleApprove = async () => {
    setApproving(true);
    try {
      const body = { version: question.version, accept_answer: true, accept_hint: acceptHint };
      if (editMode && overrideAnswer) body.correct_answer = overrideAnswer;
      const result = await adminApi.approveReview(question.id, body);
      onUpdated(result.question);
    } catch (e) { alert(e?.error?.message || 'Approval failed. Reload and try again.'); }
    finally { setApproving(false); }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const result = await adminApi.rejectReview(question.id, question.version);
      onUpdated(result.question);
    } catch (e) { alert(e?.error?.message || 'Rejection failed.'); }
    finally { setRejecting(false); }
  };

  if (!question.llm_predicted_answer && !question.llm_review_note && !question.llm_proposed_hint) return null;

  return (
    <div className={cardClass}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text-secondary)' }}>🤖 AI Review</span>
        {status === 'ai_reviewed' && <Pill color="violet">Pending approval</Pill>}
        {status === 'rejected'    && <Pill color="red">Rejected — edit manually or re-run</Pill>}
        {status === 'approved'    && <Pill color="green">Approved</Pill>}
        {question.llm_reviewed_at && (
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {new Date(question.llm_reviewed_at).toLocaleString()}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Predicted Answer</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="ai-review-predicted">{question.llm_predicted_answer?.toUpperCase() || '?'}</div>
            {question.correct_answer !== question.llm_predicted_answer && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                current: <strong style={{ color: 'var(--text-secondary)' }}>{question.correct_answer?.toUpperCase()}</strong>
              </span>
            )}
            {question.correct_answer === question.llm_predicted_answer && (
              <span style={{ fontSize: '0.75rem', color: '#15803d' }}>matches current ✓</span>
            )}
          </div>
        </div>

        {confidence != null && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Confidence</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: confColor }}>{Math.round(confidence * 100)}%</span>
              <Pill color={confPill}>{confLabel}</Pill>
            </div>
          </div>
        )}
      </div>

      {question.llm_review_note && (
        <div className="ai-review-note">
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: 4 }}>
            🔒 Admin Note (never shown to students)
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {question.llm_review_note}
          </div>
        </div>
      )}

      {question.llm_proposed_hint && (
        <div className="ai-review-hint">
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#b45309', marginBottom: 4 }}>
            💡 Proposed Hint (shown to student after wrong answer)
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <MathText text={question.llm_proposed_hint} />
          </div>
          {status !== 'approved' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={acceptHint} onChange={e => setAcceptHint(e.target.checked)} />
              Accept this hint (copies to live hint field on approval)
            </label>
          )}
        </div>
      )}

      {editMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Override answer:</span>
          {['a', 'b', 'c', 'd'].map(opt => (
            <button key={opt}
              className={`ai-override-btn ${overrideAnswer === opt ? 'selected' : ''}`}
              onClick={() => setOverrideAnswer(overrideAnswer === opt ? '' : opt)}>
              {opt.toUpperCase()}
            </button>
          ))}
          {overrideAnswer ? (
            <span style={{ fontSize: '0.78rem', color: '#4ade80' }}>Will approve as {overrideAnswer.toUpperCase()}</span>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No override — will use AI prediction ({question.llm_predicted_answer?.toUpperCase()})</span>
          )}
        </div>
      )}

      {['ai_reviewed', 'rejected'].includes(status) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ai-review-btn approve" onClick={handleApprove} disabled={approving || rejecting}>
            {approving ? '…' : '✓ Approve'}
          </button>
          <button
            className={`ai-review-btn edit ${editMode ? 'active' : ''}`}
            onClick={() => { setEditMode(!editMode); if (editMode) setOverrideAnswer(''); }}
          >
            ✏ {editMode ? 'Cancel Edit' : 'Edit & Approve'}
          </button>
          <button className="ai-review-btn reject" onClick={handleReject} disabled={approving || rejecting}>
            {rejecting ? '…' : '✗ Reject'}
          </button>
        </div>
      )}
    </div>
  );
}


// ── EXPANDED QUESTION ROW ─────────────────────────────────────────────────────

function ExpandedQuestionRow({ question, colSpan, taxonomy, onQuestionUpdated }) {
  const section = question.section || getSectionFromWorldKey(question.world_key);
  const topics = (taxonomy && section && taxonomy[section]) || [];
  const topicLabel = question.topic
    ? (topics.find(t => t.key === question.topic)?.label || question.topic)
    : null;

  return (
    <tr className="expanded-row">
      <td colSpan={colSpan}>
        <div className="expanded-content">
          <div className="expanded-question-text">
            <MathText text={question.question_text} />
          </div>

          {question.image_url && (
            <div className="expanded-image">
              <img src={question.image_url} alt="Question diagram" />
            </div>
          )}

          <div className="expanded-options-grid">
            {['a', 'b', 'c', 'd'].map((opt) => {
              const isCorrect = question.correct_answer === opt;
              return (
                <div key={opt} className={`expanded-option ${isCorrect ? 'correct' : ''}`}>
                  <span className="expanded-option-letter">{opt.toUpperCase()}</span>
                  <span className="expanded-option-text"><MathText text={question[`option_${opt}`]} /></span>
                  {isCorrect && <span className="expanded-correct-badge">✓ Correct</span>}
                </div>
              );
            })}
          </div>

          {question.hint && (
            <div className="expanded-explanation">
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Hint</span>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 4 }}>
                <MathText text={question.hint} />
              </div>
            </div>
          )}

          <div className="expanded-meta-row">
            {topicLabel && (
              <span className="expanded-meta-item"><span style={{ color: 'var(--text-muted)' }}>Topic:</span> <Pill color="cyan">{topicLabel}</Pill></span>
            )}
            {question.difficulty && (
              <span className="expanded-meta-item"><span style={{ color: 'var(--text-muted)' }}>Difficulty:</span> <Pill color={question.difficulty === 'easy' ? 'green' : 'amber'}>{question.difficulty}</Pill></span>
            )}
            <span className="expanded-meta-item"><span style={{ color: 'var(--text-muted)' }}>ID:</span> <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{question.id}</span></span>
            <span className="expanded-meta-item"><span style={{ color: 'var(--text-muted)' }}>Version:</span> <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>v{question.version}</span></span>
            {question.review_status && question.review_status !== 'unreviewed' && (
              <span className="expanded-meta-item">
                <span style={{ color: 'var(--text-muted)' }}>AI Status:</span>{' '}
                <Pill color={
                  question.review_status === 'approved'    ? 'green'  :
                  question.review_status === 'rejected'    ? 'red'    :
                  question.review_status === 'ai_reviewed' ? 'violet' : 'gray'
                }>{question.review_status}</Pill>
              </span>
            )}
          </div>

          {['ai_reviewed', 'rejected', 'approved'].includes(question.review_status) && onQuestionUpdated && (
            <AIReviewCard question={question} onUpdated={onQuestionUpdated} />
          )}
        </div>
      </td>
    </tr>
  );
}


// ── AI REVIEW MODAL ───────────────────────────────────────────────────────────

const AI_REVIEW_BATCH_SIZE = 20;

function AIReviewModal({ questionIds, onDone, onClose }) {
  const [running,   setRunning]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [overwrite, setOverwrite] = useState(false);
  const [log,       setLog]       = useState([]);
  const [summary,   setSummary]   = useState({ processed: 0, failed: 0, skipped: 0 });
  const cancelRef = useRef(false);
  const total = questionIds.length;

  const addLog = (line, cls = '') => setLog(prev => [...prev, { line, cls }]);

  const runReview = async () => {
    setRunning(true);
    cancelRef.current = false;

    const batches = [];
    for (let i = 0; i < questionIds.length; i += AI_REVIEW_BATCH_SIZE) {
      batches.push(questionIds.slice(i, i + AI_REVIEW_BATCH_SIZE));
    }

    let totalProcessed = 0, totalFailed = 0, totalSkipped = 0;

    for (let i = 0; i < batches.length; i++) {
      if (cancelRef.current) { addLog('Cancelled.', 'fail'); break; }
      const batch = batches[i];
      addLog(`Batch ${i + 1}/${batches.length}  (${batch.length} questions)…`);
      try {
        const result = await adminApi.aiReview(batch, overwrite);
        totalProcessed += result.processed  || 0;
        totalFailed    += result.failed     || 0;
        totalSkipped   += (result.skipped_approved || []).length;
        setProgress(Math.min((i + 1) * AI_REVIEW_BATCH_SIZE, total));
        setSummary({ processed: totalProcessed, failed: totalFailed, skipped: totalSkipped });
        addLog(
          `  ✓  ${result.processed} reviewed, ${result.failed} failed${(result.skipped_approved || []).length ? `, ${result.skipped_approved.length} skipped` : ''}`,
          result.failed > 0 ? 'fail' : 'ok',
        );
      } catch (e) {
        const msg = e?.error?.message || 'Request failed';
        addLog(`  ✗  Batch failed: ${msg}`, 'fail');
        totalFailed += batch.length;
        setSummary({ processed: totalProcessed, failed: totalFailed, skipped: totalSkipped });
      }
      if (i < batches.length - 1 && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    setDone(true);
    setRunning(false);
  };

  const pct = total > 0 ? Math.round((Math.min(progress, total) / total) * 100) : 0;
  const progressBarColor = done ? '#16a34a' : '#7c3aed';

  return (
    <Modal title="🤖 AI Question Review" onClose={running ? undefined : onClose} width="560px">
      {!running && !done && (
        <div>
          <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Run AI review on <strong>{total}</strong> selected question{total !== 1 ? 's' : ''}.
            The AI (GPT-4o-mini) will predict the correct answer, generate a student hint,
            and write an internal review note. You then approve or reject each suggestion.
          </p>
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)', marginBottom: 14, fontSize: '0.83rem', color: '#b45309' }}>
            ⚠ AI predictions are suggestions only — no question is changed until you explicitly approve.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
            Re-review already approved questions
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-violet" onClick={runReview}>Start AI Review ({total} questions)</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}

      {(running || done) && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>{done ? '✓ Complete' : 'Processing…'}</span>
              <span>{Math.min(progress, total)} / {total}</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: progressBarColor, borderRadius: 4, transition: 'width 0.35s' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: '0.87rem' }}>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>✓ {summary.processed} reviewed</span>
            {summary.failed  > 0 && <span style={{ color: '#f87171', fontWeight: 600 }}>✗ {summary.failed} failed</span>}
            {summary.skipped > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}>⟳ {summary.skipped} skipped (approved)</span>}
          </div>
          <div className="ai-log">
            {log.map((entry, i) => (
              <div key={i} className={`ai-log-line ${entry.cls}`}>{entry.line}</div>
            ))}
            {running && <div style={{ color: '#a78bfa' }}>▌</div>}
          </div>
          {done && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="btn btn-violet" onClick={() => onDone(summary)}>
                Done — filter to review results
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}


// ── QUESTIONS TAB ─────────────────────────────────────────────────────────────

function QuestionsTab() {
  const [questions,  setQuestions]  = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [flash,      showFlash]     = useFlash();
  const [filters,    setFilters]    = useState({
    exam: 'qudurat', section: 'math', world_key: '',
    is_active: '', difficulty: '', topic: '', reviewed: '',
    search: '', review_status: '',
  });
  const [creating,   setCreating]   = useState(false);
  const [expanded,   setExpanded]   = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [taxonomy,   setTaxonomy]   = useState(null);
  const [bulkTopicOpen, setBulkTopicOpen] = useState(false);
  const [goToPage,   setGoToPage]   = useState('');
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  useEffect(() => {
    adminApi.getTopics().then((d) => setTaxonomy(d.taxonomy)).catch(() => {});
  }, []);

  const examConfig    = SECTION_CONFIG[filters.exam];
  const sectionConfig = examConfig?.sections?.[filters.section];
  const worldOptions  = sectionConfig?.worlds || [];

  const currentSection = filters.section;
  const topicOptions   = currentSection && taxonomy && taxonomy[currentSection]
    ? taxonomy[currentSection]
    : (taxonomy ? Object.entries(taxonomy).flatMap(([, topics]) => topics) : []);

  const searchTimeout = useRef(null);
  const [searchInput, setSearchInput] = useState('');

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setFilters((f) => ({ ...f, search: val })); setPage(1); }, 400);
  };

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    adminApi.listQuestions({ ...filters, page, per_page: 50 })
      .then((d) => { setQuestions(d.questions || []); setTotal(d.total || 0); })
      .catch(() => showFlash('Failed to load questions.', 'error'))
      .finally(() => setLoading(false));
  }, [filters, page, showFlash]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleExamChange = (exam) => {
    const firstSection = Object.keys(SECTION_CONFIG[exam].sections)[0];
    setFilters((f) => ({ ...f, exam, section: firstSection, world_key: '', topic: '' }));
    setPage(1); setExpanded(new Set()); clearSelection();
  };

  const handleSectionChange = (section) => {
    setFilters((f) => ({ ...f, section, world_key: '', topic: '' }));
    setPage(1); setExpanded(new Set()); clearSelection();
  };

  const handleFilterChange = (k, v) => {
    const updates = { [k]: v };
    if (k === 'world_key') updates.topic = '';
    setFilters((f) => ({ ...f, ...updates }));
    setPage(1); setExpanded(new Set()); clearSelection();
  };

  const handleToggle = async (q) => {
    try {
      await adminApi.toggleQuestion(q.id, !q.is_active);
      showFlash(`Question #${q.id} ${!q.is_active ? 'activated' : 'deactivated'}.`);
      fetchQuestions();
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const handleDelete = async (q) => {
    if (!window.confirm(`Soft-delete question #${q.id}?`)) return;
    try {
      await adminApi.deleteQuestion(q.id);
      showFlash(`Question #${q.id} deleted.`);
      fetchQuestions();
      setRefreshKey((k) => k + 1);
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const handleSaveEdit = async (updated) => {
    try {
      await adminApi.updateQuestion(editing.id, updated);
      showFlash('Question saved.');
      setEditing(null);
      fetchQuestions();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      if (e?.status === 409) showFlash('Conflict — reloading.', 'error');
      else showFlash(e?.error?.message || 'Save failed.', 'error');
    }
  };

  const handleInlineSaved = (updatedQuestion) => {
    setQuestions((prev) => prev.map((q) => q.id === updatedQuestion.id ? updatedQuestion : q));
    setRefreshKey((k) => k + 1);
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const [bulkLoading, setBulkLoading] = useState(false);

  const handleBulkActivate = async (is_active) => {
    const scope = filters.exam ? (filters.world_key ? `world ${filters.world_key}` : `exam ${filters.exam}`) : 'ALL questions';
    const action = is_active ? 'activate' : 'deactivate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} all ${scope}?`)) return;
    setBulkLoading(true);
    try {
      const result = await adminApi.bulkActivate({ is_active, exam: filters.exam || undefined, world_key: filters.world_key || undefined });
      showFlash(`${result.affected} question(s) ${is_active ? 'activated' : 'deactivated'}.`);
      fetchQuestions();
    } catch (e) { showFlash(e?.error?.message || 'Bulk action failed.', 'error'); }
    finally { setBulkLoading(false); }
  };

  const handleBulkTopic = async (topicKey) => {
    const scope = filters.exam ? (filters.world_key ? `world ${filters.world_key}` : `exam ${filters.exam}`) : 'ALL questions';
    const label = topicKey ? (topicOptions.find(t => t.key === topicKey)?.label || topicKey) : 'none';
    if (!window.confirm(`Set topic to "${label}" for all ${scope}? (${total} questions)`)) return;
    setBulkLoading(true);
    try {
      const result = await adminApi.bulkTopic({ topic: topicKey || null, exam: filters.exam || undefined, world_key: filters.world_key || undefined });
      showFlash(`${result.affected} question(s) topic set to ${label}.`);
      fetchQuestions();
      setRefreshKey((k) => k + 1);
      setBulkTopicOpen(false);
    } catch (e) { showFlash(e?.error?.message || 'Bulk topic failed.', 'error'); }
    finally { setBulkLoading(false); }
  };

  const totalPages = Math.ceil(total / 50);
  const TABLE_COLS = 11;

  const [selectedIds,      setSelectedIds]      = useState(new Set());
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [bulkAssignOpen,   setBulkAssignOpen]   = useState(false);
  const [bulkDeleteOpen,   setBulkDeleteOpen]   = useState(false);
  const [bulkOpLoading,    setBulkOpLoading]    = useState(false);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const pageIds          = questions.map((q) => q.id);
  const allPageSelected  = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); pageIds.forEach(id => next.add(id)); return next; });
    }
  };

  const handleSelectAllMatching = async () => {
    setSelectAllLoading(true);
    try {
      const data = await adminApi.listQuestions({ ...filters, ids_only: true });
      setSelectedIds(new Set(data.ids));
    } catch { showFlash('Failed to select all matching.', 'error'); }
    finally { setSelectAllLoading(false); }
  };

  const handleBulkDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    setBulkOpLoading(true);
    try {
      const result = await adminApi.bulkDelete(ids);
      showFlash(`${result.deleted} question(s) soft-deleted.`);
      setBulkDeleteOpen(false);
      clearSelection();
      fetchQuestions();
      setRefreshKey((k) => k + 1);
    } catch (e) { showFlash(e?.error?.message || 'Bulk delete failed.', 'error'); }
    finally { setBulkOpLoading(false); }
  };

  const handleBulkAssignSelected = async (assign) => {
    const ids = Array.from(selectedIds);
    setBulkOpLoading(true);
    try {
      const result = await adminApi.bulkAssign(ids, assign);
      const skippedMsg = result.skipped?.length ? ` (${result.skipped.length} skipped — section mismatch)` : '';
      showFlash(`${result.updated} question(s) updated.${skippedMsg}`);
      setBulkAssignOpen(false);
      clearSelection();
      fetchQuestions();
      setRefreshKey((k) => k + 1);
    } catch (e) { showFlash(e?.error?.message || 'Bulk assign failed.', 'error'); }
    finally { setBulkOpLoading(false); }
  };

  const handleAIReviewDone = (summary) => {
    setAiReviewOpen(false);
    clearSelection();
    fetchQuestions();
    setRefreshKey((k) => k + 1);
    setFilters((f) => ({ ...f, review_status: 'ai_reviewed' }));
    showFlash(`AI review complete: ${summary.processed} reviewed, ${summary.failed} failed. Filtered to pending reviews.`);
  };

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}

      <ReviewProgressPanel
        examFilter={filters.exam}
        refreshKey={refreshKey}
        onShowPending={() => {
          handleFilterChange('review_status', 'ai_pending');
          document.querySelector('.admin-filter-row')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }}
      />
      <TopicCoveragePanel
        examFilter={filters.exam}
        refreshKey={refreshKey}
        onShowUntagged={() => {
          handleFilterChange('topic', '_untagged');
          document.querySelector('.admin-filter-row')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }}
      />

      {/* Exam tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        {Object.entries(SECTION_CONFIG).map(([examKey, cfg]) => (
          <button key={examKey}
            className={`btn btn-sm ${filters.exam === examKey ? '' : 'btn-ghost'}`}
            style={{
              borderRadius: '8px 8px 0 0',
              borderBottom: filters.exam === examKey ? '2px solid var(--violet)' : '2px solid transparent',
              fontWeight: filters.exam === examKey ? 700 : 500,
              fontSize: '0.95rem', padding: '10px 24px',
              color: filters.exam === examKey ? 'var(--violet-light)' : 'var(--text-muted)',
              background: filters.exam === examKey ? 'rgba(139,92,246,0.08)' : 'transparent',
            }}
            onClick={() => handleExamChange(examKey)}>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 0', borderTop: '1px solid var(--border)', marginBottom: 12 }}>
        {examConfig && Object.entries(examConfig.sections).map(([secKey, secCfg]) => (
          <button key={secKey}
            className={`btn btn-sm ${filters.section === secKey ? '' : 'btn-ghost'}`}
            style={{
              borderRadius: 6, fontWeight: filters.section === secKey ? 700 : 400, fontSize: '0.88rem', padding: '6px 16px',
              color: filters.section === secKey ? '#0891b2' : 'var(--text-muted)',
              background: filters.section === secKey ? 'rgba(34,211,238,0.1)' : 'transparent',
              border: filters.section === secKey ? '1px solid rgba(34,211,238,0.25)' : '1px solid transparent',
            }}
            onClick={() => handleSectionChange(secKey)}>
            {secCfg.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="admin-filter-row">
        <input className="form-input" style={{ width: 'auto', minWidth: 220 }} placeholder="Search question text…"
          value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        <select className="form-input" style={{ width: 'auto', minWidth: 160 }} value={filters.world_key} onChange={(e) => handleFilterChange('world_key', e.target.value)}>
          <option value="">All worlds</option>
          {worldOptions.map((w) => <option key={w} value={w}>{worldDisplayName(w)}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto', minWidth: 140 }} value={filters.is_active} onChange={(e) => handleFilterChange('is_active', e.target.value)}>
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select className="form-input" style={{ width: 'auto', minWidth: 140 }} value={filters.difficulty} onChange={(e) => handleFilterChange('difficulty', e.target.value)}>
          <option value="">All difficulty</option>
          <option value="easy">Easy</option>
          <option value="hard">Hard</option>
        </select>
        <select className="form-input" style={{ width: 'auto', minWidth: 160 }} value={filters.topic} onChange={(e) => handleFilterChange('topic', e.target.value)}>
          <option value="">All topics</option>
          <option value="_untagged">⚠ Untagged</option>
          {topicOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto', minWidth: 140 }} value={filters.reviewed} onChange={(e) => handleFilterChange('reviewed', e.target.value)}>
          <option value="">All review</option>
          <option value="true">✓ Reviewed</option>
          <option value="false">⚠ Unreviewed</option>
        </select>
        <select className="form-input" style={{ width: 'auto', minWidth: 160 }} value={filters.review_status} onChange={(e) => handleFilterChange('review_status', e.target.value)}>
          <option value="">All AI status</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="ai_pending">AI Pending…</option>
          <option value="ai_reviewed">🤖 Pending approval</option>
          <option value="approved">✓ Approved</option>
          <option value="rejected">✗ Rejected</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginLeft: 'auto' }}>{total} question{total !== 1 ? 's' : ''}</span>
        <button className="btn btn-green btn-sm" onClick={() => setCreating(true)} style={{ marginLeft: 8 }}>+ Add Question</button>
      </div>

      {/* Bulk actions */}
      <div className="admin-bulk-bar">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Bulk actions
          {filters.exam && <strong style={{ color: 'var(--text-secondary)' }}> · {SECTION_CONFIG[filters.exam]?.label} {examConfig?.sections?.[filters.section]?.label}{filters.world_key ? ` / ${worldDisplayName(filters.world_key)}` : ''}</strong>}
          {' '}({total} questions)
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-green" onClick={() => handleBulkActivate(true)} disabled={bulkLoading || total === 0}>{bulkLoading ? '…' : 'Activate all'}</button>
          <button className="btn btn-sm btn-ghost" style={{ borderColor: 'rgba(220,38,38,0.3)', color: '#dc2626' }} onClick={() => handleBulkActivate(false)} disabled={bulkLoading || total === 0}>{bulkLoading ? '…' : 'Deactivate all'}</button>
          <button className="btn btn-sm" style={{ background: 'rgba(34,211,238,0.15)', color: '#0891b2', border: '1px solid rgba(34,211,238,0.3)' }} onClick={() => setBulkTopicOpen(!bulkTopicOpen)} disabled={total === 0}>Bulk topic</button>
          <button className="btn btn-sm" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }} onClick={() => setDuplicatesOpen(true)}>🔍 Check Duplicates</button>
        </div>
      </div>

      {bulkTopicOpen && (
        <div className="bulk-topic-panel">
          <div className="bulk-topic-label">Set topic for all {total} matching questions:</div>
          <div className="bulk-topic-grid">
            {topicOptions.map((t) => (
              <button key={t.key} className="bulk-topic-btn" onClick={() => handleBulkTopic(t.key)} disabled={bulkLoading}>{t.label}</button>
            ))}
            <button className="bulk-topic-btn clear" onClick={() => handleBulkTopic('')} disabled={bulkLoading}>✕ Clear all topics</button>
          </div>
        </div>
      )}

      {/* Sticky selection action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 16px', marginBottom: 8, borderRadius: 8,
          background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontWeight: 700, color: 'var(--violet-light)', fontSize: '0.92rem' }}>
            {selectedIds.size} selected
          </span>
          {selectedIds.size < total && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.82rem', padding: '3px 10px' }}
              onClick={handleSelectAllMatching} disabled={selectAllLoading}>
              {selectAllLoading ? '…' : `Select all ${total} matching`}
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)', fontWeight: 700 }}
              onClick={() => setAiReviewOpen(true)}
            >
              🤖 AI Review
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(34,211,238,0.15)', color: '#0891b2', border: '1px solid rgba(34,211,238,0.3)' }}
              onClick={() => setBulkAssignOpen(true)}>
              Assign…
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}
              onClick={() => setBulkDeleteOpen(true)}>
              Delete…
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>✕ Clear</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36, padding: '0 8px' }}>
                  <input type="checkbox" style={{ cursor: 'pointer', width: 15, height: 15 }}
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                    onChange={toggleSelectAllPage} title={allPageSelected ? 'Deselect page' : 'Select page'} />
                </th>
                <th>#</th><th>Exam</th><th>World</th><th>Idx</th><th>Question</th><th>Answer</th><th>Topic</th><th>Diff</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 && (
                <tr><td colSpan={TABLE_COLS} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No questions found.</td></tr>
              )}
              {questions.map((q) => (
                <React.Fragment key={q.id}>
                  <tr className={`question-row ${expanded.has(q.id) ? 'expanded-active' : ''} ${selectedIds.has(q.id) ? 'row-selected' : ''}`}>
                    <td style={{ padding: '0 8px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" style={{ cursor: 'pointer', width: 15, height: 15 }}
                        checked={selectedIds.has(q.id)} onChange={() => toggleSelectRow(q.id)} />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{q.id}</td>
                    <td><Pill color="violet">{q.exam}</Pill></td>
                    <td style={{ fontSize: '0.85rem' }} title={q.world_key}>{q.world_key ? worldDisplayName(q.world_key) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>unassigned</span>}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{q.index ?? '—'}</td>
                    <td className="admin-question-cell clickable-cell" onClick={() => toggleExpanded(q.id)} title="Click to expand/collapse">
                      <span className="expand-icon">{expanded.has(q.id) ? '▼' : '▶'}</span>
                      {q.question_text.slice(0, 70)}{q.question_text.length > 70 ? '…' : ''}
                      {q.image_url && <span className="has-image-badge">🖼️</span>}
                      {q.review_status === 'ai_reviewed' && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#a78bfa' }}>🤖</span>}
                      {q.review_status === 'approved'    && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#4ade80' }}>✓AI</span>}
                      {q.review_status === 'rejected'    && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#f87171' }}>✗AI</span>}
                    </td>
                    <td><InlineAnswerPicker question={q} onSaved={handleInlineSaved} /></td>
                    <td><InlineTopicPicker question={q} taxonomy={taxonomy} onSaved={handleInlineSaved} /></td>
                    <td><InlineDifficultyPicker question={q} onSaved={handleInlineSaved} /></td>
                    <td>{q.is_active ? <Pill color="green">Active</Pill> : <Pill color="gray">Inactive</Pill>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-action-btn" onClick={() => setEditing(q)} title="Edit">✏️</button>
                        <button className="admin-action-btn" onClick={() => handleToggle(q)} title={q.is_active ? 'Deactivate' : 'Activate'}>{q.is_active ? '🔴' : '🟢'}</button>
                        <button className="admin-action-btn danger" onClick={() => handleDelete(q)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                  {expanded.has(q.id) && (
                    <ExpandedQuestionRow
                      question={q}
                      colSpan={TABLE_COLS}
                      taxonomy={taxonomy}
                      onQuestionUpdated={handleInlineSaved}
                    />
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(1)}>«</button>
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 12 }}>Go to</span>
          <input type="number" min={1} max={totalPages} className="form-input"
            style={{ width: 64, padding: '4px 8px', fontSize: '0.85rem', textAlign: 'center' }}
            value={goToPage} onChange={(e) => setGoToPage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { const p = Math.max(1, Math.min(totalPages, parseInt(goToPage, 10))); if (!isNaN(p)) { setPage(p); setGoToPage(''); } } }}
            placeholder="#" />
          <button className="btn btn-ghost btn-sm" onClick={() => { const p = Math.max(1, Math.min(totalPages, parseInt(goToPage, 10))); if (!isNaN(p)) { setPage(p); setGoToPage(''); } }}>Go</button>
        </div>
      )}

      {editing && <QuestionEditModal question={editing} taxonomy={taxonomy} onSave={handleSaveEdit} onClose={() => setEditing(null)} />}
      {creating && <CreateQuestionModal taxonomy={taxonomy} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); fetchQuestions(); setRefreshKey((k) => k + 1); showFlash('Question created.'); }} />}
      {bulkAssignOpen && (
        <BulkAssignModal count={selectedIds.size} section={filters.section} taxonomy={taxonomy} worldOptions={worldOptions}
          loading={bulkOpLoading} onAssign={handleBulkAssignSelected} onClose={() => setBulkAssignOpen(false)} />
      )}
      {bulkDeleteOpen && (
        <BulkDeleteModal count={selectedIds.size} loading={bulkOpLoading} onConfirm={handleBulkDeleteSelected} onClose={() => setBulkDeleteOpen(false)} />
      )}
      {aiReviewOpen && (
        <AIReviewModal
          questionIds={Array.from(selectedIds)}
          onDone={handleAIReviewDone}
          onClose={() => setAiReviewOpen(false)}
        />
      )}
      {duplicatesOpen && (
        <DuplicatesModal
          initialSection={filters.section}
          initialExam={filters.exam}
          onClose={() => { setDuplicatesOpen(false); fetchQuestions(); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}


// ── BULK ASSIGN MODAL ─────────────────────────────────────────────────────────

function BulkAssignModal({ count, section, taxonomy, worldOptions, loading, onAssign, onClose }) {
  const [form, setForm] = useState({ topic: '', difficulty: '', world_key: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const topicOptions = (taxonomy && section && taxonomy[section]) || [];
  const hasAny = form.topic || form.difficulty || form.world_key;

  const handleSubmit = () => {
    const assign = {};
    if (form.topic)      assign.topic      = form.topic;
    if (form.difficulty) assign.difficulty = form.difficulty;
    if (form.world_key)  assign.world_key  = form.world_key;
    onAssign(assign);
  };

  return (
    <Modal title={`Bulk Assign — ${count} question${count !== 1 ? 's' : ''}`} onClose={onClose} width="480px">
      <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Set one or more fields on all selected questions. Blank fields are left unchanged.
      </p>
      <div className="form-group">
        <label className="form-label">Topic</label>
        <select className="form-input" value={form.topic} onChange={set('topic')}>
          <option value="">— Leave unchanged —</option>
          {topicOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Difficulty</label>
        <select className="form-input" value={form.difficulty} onChange={set('difficulty')}>
          <option value="">— Leave unchanged —</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Assign to World</label>
        <select className="form-input" value={form.world_key} onChange={set('world_key')}>
          <option value="">— Leave unchanged —</option>
          {worldOptions.map((w) => <option key={w} value={w}>{worldDisplayName(w)} ({w})</option>)}
        </select>
        {form.world_key && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#b45309' }}>⚠ Section-mismatched questions will be skipped.</p>}
      </div>
      {!hasAny && <p style={{ margin: '14px 0 0', fontSize: '0.83rem', color: '#b45309' }}>Set at least one field to proceed.</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-green" onClick={handleSubmit} disabled={loading || !hasAny}>{loading ? 'Updating…' : `Update ${count} Question${count !== 1 ? 's' : ''}`}</button>
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </Modal>
  );
}


// ── BULK DELETE MODAL ─────────────────────────────────────────────────────────

function BulkDeleteModal({ count, loading, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Bulk Delete" onClose={onClose} width="420px">
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗑️</div>
        <p style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Soft-delete {count} question{count !== 1 ? 's' : ''}?</p>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          These questions will be marked as deleted and will not be visible to students.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
        <button className="btn" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)', fontWeight: 600 }}
          onClick={onConfirm} disabled={loading}>{loading ? 'Deleting…' : `Delete ${count} Question${count !== 1 ? 's' : ''}`}</button>
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </Modal>
  );
}


// ── QUESTION EDIT MODAL ───────────────────────────────────────────────────────

function QuestionEditModal({ question, taxonomy, onSave, onClose }) {
  const [form, setForm] = useState({
    question_text: question.question_text, option_a: question.option_a,
    option_b: question.option_b, option_c: question.option_c, option_d: question.option_d,
    correct_answer: question.correct_answer || 'a', topic: question.topic || '',
    difficulty: question.difficulty || '', image_url: question.image_url || null,
    hint: question.hint || '', is_active: question.is_active, version: question.version,
  });
  const [saving, setSaving] = useState(false);
  const [showMathPreview, setShowMathPreview] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const section = question.section || getSectionFromWorldKey(question.world_key);
  const topicOptions = (taxonomy && section && taxonomy[section]) || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (!payload.topic)      payload.topic      = null;
    if (!payload.difficulty) payload.difficulty = null;
    if (!payload.hint)       payload.hint       = null;
    onSave(payload);
    setSaving(false);
  };

  return (
    <Modal title={`Edit Question #${question.id}`} onClose={onClose} width="720px">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Question Text (supports LaTeX: $...$)</label>
          <textarea className="form-input" rows={3} value={form.question_text} onChange={set('question_text')} required />
        </div>
        {showMathPreview && (
          <div style={{ padding: '12px 16px', background: 'var(--bg-card-2)', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>Preview:</div>
            <MathText text={form.question_text} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMathPreview(!showMathPreview)}>{showMathPreview ? 'Hide Preview' : 'Preview Math'}</button>
          <LaTeXCheatsheet />
        </div>
        <ImageUpload value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          {['a', 'b', 'c', 'd'].map((opt) => (
            <div key={opt} className="form-group">
              <label className="form-label">Option {opt.toUpperCase()}</label>
              <input className="form-input" value={form[`option_${opt}`]} onChange={set(`option_${opt}`)} required />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">Correct Answer</label>
            <select className="form-input" value={form.correct_answer} onChange={set('correct_answer')}>
              {['a','b','c','d'].map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Topic</label>
            <select className="form-input" value={form.topic} onChange={set('topic')}>
              <option value="">— None —</option>
              {topicOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select className="form-input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="">— None —</option>
              <option value="easy">Easy</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Hint (shown after wrong answer)</label>
          <textarea className="form-input" rows={3} value={form.hint} onChange={set('hint')} placeholder="Guide the student toward the right answer without giving it away…" />
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
            <span className="form-label" style={{ margin: 0 }}>Active</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}


// ── CREATE QUESTION MODAL ─────────────────────────────────────────────────────

function CreateQuestionModal({ taxonomy, onClose, onCreated }) {
  const [form, setForm] = useState({
    exam: 'qudurat', world_key: 'math_100',
    question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'a', topic: '', difficulty: '', is_active: false, image_url: null, hint: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const worldOptions = WORLD_KEYS[form.exam] || [];
  const section = getSectionFromWorldKey(form.world_key);
  const topicOptions = (taxonomy && section && taxonomy[section]) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nextIdx = await adminApi.nextIndex(form.exam, form.world_key);
      const payload = [{ ...form, index: nextIdx.next_index, topic: form.topic || null, difficulty: form.difficulty || null, hint: form.hint || null }];
      await adminApi.importQuestions(payload);
      onCreated();
    } catch (err) { alert(err?.error?.message || 'Failed to create question.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create New Question" onClose={onClose} width="720px">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Exam</label>
            <select className="form-input" value={form.exam} onChange={(e) => setForm((f) => ({ ...f, exam: e.target.value, world_key: WORLD_KEYS[e.target.value]?.[0] || '', topic: '' }))}>
              {EXAMS.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">World</label>
            <select className="form-input" value={form.world_key} onChange={(e) => setForm((f) => ({ ...f, world_key: e.target.value, topic: '' }))}>
              {worldOptions.map((w) => <option key={w} value={w}>{worldDisplayName(w)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Question Text (supports LaTeX: $...$)</label>
          <textarea className="form-input" rows={3} value={form.question_text} onChange={set('question_text')} required />
        </div>
        <LaTeXCheatsheet />
        <ImageUpload value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          {['a', 'b', 'c', 'd'].map((opt) => (
            <div key={opt} className="form-group">
              <label className="form-label">Option {opt.toUpperCase()}</label>
              <input className="form-input" value={form[`option_${opt}`]} onChange={set(`option_${opt}`)} required />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="form-group">
            <label className="form-label">Correct Answer</label>
            <select className="form-input" value={form.correct_answer} onChange={set('correct_answer')}>
              {['a','b','c','d'].map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Topic</label>
            <select className="form-input" value={form.topic} onChange={set('topic')}>
              <option value="">— None —</option>
              {topicOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select className="form-input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="">— None —</option>
              <option value="easy">Easy</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Hint (shown after wrong answer)</label>
          <textarea className="form-input" rows={3} value={form.hint} onChange={set('hint')} placeholder="Guide the student toward the right answer without giving it away…" />
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
            <span className="form-label" style={{ margin: 0 }}>Active immediately</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Creating…' : 'Create Question'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// K4 SPLICE INSTRUCTIONS FOR AdminPanel.jsx
//
// 1. Find the line:   // ── STATS TAB ─────────────────────────────────────────────────────────────────
// 2. Delete everything from that line up to and including the closing brace of
//    the existing StatsTab function (ends just before // ── WORLDS TAB  (Chunk K2) ──)
// 3. Paste this entire file contents in its place.
//
// No other line in AdminPanel.jsx is touched.
// ─────────────────────────────────────────────────────────────────────────────

// ── K4: Stats chart config ────────────────────────────────────────────────────

const REVIEW_STATUS_CONFIG = [
  { key: 'approved',    label: 'Approved',        color: '#16a34a' },
  { key: 'ai_reviewed', label: 'Pending Approval', color: '#7c3aed' },
  { key: 'rejected',    label: 'Rejected',         color: '#dc2626' },
  { key: 'ai_pending',  label: 'AI Pending',       color: '#d97706' },
  { key: 'unreviewed',  label: 'Unreviewed',       color: '#475569' },
];

const SECTION_ORDER_STATS = ['math', 'verbal', 'biology', 'chemistry', 'physics'];


// ── STATS TAB ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(false);
    adminApi.getStats()
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="admin-loading"><div className="spinner" /></div>;
  if (error) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#dc2626', fontSize: '0.9rem' }}>
      Failed to load stats.{' '}
      <button className="btn btn-ghost btn-sm" onClick={load}>↻ Retry</button>
    </div>
  );
  if (!stats) return null;

  const q     = stats.questions || {};
  const total = q.total || 0;

  const reviewData  = q.by_review_status || {};
  const reviewTotal = REVIEW_STATUS_CONFIG.reduce((s, c) => s + (reviewData[c.key] || 0), 0);

  const bySection = q.by_section_detail || {};
  const secKeys   = SECTION_ORDER_STATS.filter(s => bySection[s]);

  const cardStyle = {
    background: 'var(--bg-card, rgba(255,255,255,0.04))',
    border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Questions',     val: total,                            icon: '📚', color: 'var(--text-primary)' },
          { label: 'Active Questions',    val: q.active      || 0,              icon: '✅', color: '#15803d' },
          { label: 'Unassigned',          val: q.unassigned  || 0,              icon: '📦', color: (q.unassigned || 0) > 0 ? '#b45309' : '#64748b' },
          { label: 'Students',            val: stats.users?.students   || 0,    icon: '👤', color: '#2563eb' },
          { label: 'Schools',             val: stats.orgs?.total       || 0,    icon: '🏫', color: '#0891b2' },
          { label: 'Active Entitlements', val: stats.entitlements?.active || 0, icon: '🔑', color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: 'center', padding: '18px 12px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1.1 }}>
              {s.val.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Review Status + Section Health (two columns) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Review Status */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: 14 }}>
            🔍 Review Status
            <span style={{ marginLeft: 8, fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)' }}>
              {reviewTotal.toLocaleString()} questions
            </span>
          </div>

          {/* Stacked proportional bar */}
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden',
            marginBottom: 16, background: 'rgba(255,255,255,0.04)' }}>
            {REVIEW_STATUS_CONFIG.map(sc => {
              const pct = reviewTotal > 0 ? ((reviewData[sc.key] || 0) / reviewTotal * 100) : 0;
              return pct > 0 ? (
                <div key={sc.key}
                  title={`${sc.label}: ${(reviewData[sc.key] || 0).toLocaleString()}`}
                  style={{ width: `${pct}%`, background: sc.color, minWidth: 2, transition: 'width 0.5s ease' }} />
              ) : null;
            })}
          </div>

          {/* Row per status */}
          {REVIEW_STATUS_CONFIG.map(sc => {
            const count = reviewData[sc.key] || 0;
            const pct   = reviewTotal > 0 ? Math.round(count / reviewTotal * 100) : 0;
            return (
              <div key={sc.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: sc.color, flexShrink: 0 }} />
                <span style={{ width: 138, fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {sc.label}
                </span>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: sc.color,
                    borderRadius: 3, opacity: 0.8, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ width: 52, textAlign: 'right', fontSize: '0.8rem',
                  fontWeight: 600, color: 'var(--text-secondary)' }}>{count.toLocaleString()}</span>
                <span style={{ width: 38, textAlign: 'right', fontSize: '0.74rem',
                  color: 'var(--text-muted)' }}>{pct}%</span>
              </div>
            );
          })}

          {/* Approved % callout */}
          {reviewTotal > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 7,
              background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Approved</span>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#15803d' }}>
                {Math.round((reviewData.approved || 0) / reviewTotal * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Section Health */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: 14 }}>
            📐 Section Health
            <span style={{ marginLeft: 8, fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)' }}>per subject</span>
          </div>

          {secKeys.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No section data yet.</p>
          )}

          {secKeys.map((sec, idx) => {
            const d           = bySection[sec];
            const isLast      = idx === secKeys.length - 1;
            const activePct   = d.total > 0 ? Math.round(d.active                 / d.total * 100) : 0;
            const reviewedPct = d.total > 0 ? Math.round(d.reviewed               / d.total * 100) : 0;
            const assignedPct = d.total > 0 ? Math.round((d.total - d.unassigned) / d.total * 100) : 0;
            return (
              <div key={sec} style={{
                marginBottom: isLast ? 0 : 14, paddingBottom: isLast ? 0 : 13,
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', textTransform: 'capitalize',
                    color: 'var(--text-secondary)' }}>{sec}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {d.total.toLocaleString()} total
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.76rem',
                    color: d.unassigned > 0 ? '#b45309' : 'var(--text-muted)' }}>
                    {d.unassigned > 0 ? `${d.unassigned.toLocaleString()} unassigned` : 'all assigned'}
                  </span>
                </div>
                {[
                  { label: 'Active',   pct: activePct,   color: '#16a34a', count: d.active               },
                  { label: 'Reviewed', pct: reviewedPct, color: '#2563eb', count: d.reviewed             },
                  { label: 'Assigned', pct: assignedPct, color: '#0891b2', count: d.total - d.unassigned },
                ].map(({ label, pct, color, count }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ width: 56, fontSize: '0.74rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {label}
                    </span>
                    <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.05)',
                      borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color,
                        borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ width: 44, textAlign: 'right', fontSize: '0.74rem',
                      fontWeight: 600, color }}>{pct}%</span>
                    <span style={{ width: 44, textAlign: 'right', fontSize: '0.72rem',
                      color: 'var(--text-muted)' }}>{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            );
          })}

          {secKeys.length > 0 && (
            <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.05)',
              fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {[['#16a34a','Active'],['#2563eb','Reviewed'],['#0891b2','Assigned']].map(([c,l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c,
                    display: 'inline-block' }} />{l}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Per-exam breakdown ── */}
      {q.per_exam && Object.keys(q.per_exam).length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: 14 }}>
            🎯 Questions by Exam
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            {Object.entries(q.per_exam).map(([exam, count]) => {
              const pct = total > 0 ? Math.round(count / total * 100) : 0;
              return (
                <div key={exam} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600,
                      textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{exam}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700,
                      color: 'var(--text-primary)' }}>{count.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`,
                      background: exam === 'qudurat' ? '#7c3aed' : '#0891b2',
                      borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {pct}% of total
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}


// ── WORLDS TAB  (Chunk K2) ────────────────────────────────────────────────────

function SmartFillModal({ target, taxonomy, onDone, onClose }) {
  // target: { world_key, exam, section, display_name, capacity, assigned, empty_slots }
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [difficulty,     setDifficulty]     = useState('');
  const [minConf,        setMinConf]        = useState('');
  const [maxFill,        setMaxFill]        = useState('');
  const [activate,       setActivate]       = useState(false);
  const [reviewedOnly,   setReviewedOnly]   = useState(true);
  const [loading,        setLoading]        = useState(false);
  const [result,         setResult]         = useState(null);

  const sectionTopics  = (taxonomy && target.section && taxonomy[target.section]) || [];
  const availableSlots = target.empty_slots ?? (target.capacity - target.assigned);

  const toggleTopic = (key) =>
    setSelectedTopics(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleFill = async () => {
    setLoading(true);
    try {
      const body = { exam: target.exam, activate, reviewed_only: reviewedOnly };
      if (selectedTopics.length > 0) body.topics         = selectedTopics;
      if (difficulty)                body.difficulty      = difficulty;
      if (minConf)                   body.min_confidence  = parseFloat(minConf);
      if (maxFill)                   body.max_fill        = parseInt(maxFill, 10);
      const res = await adminApi.smartFill(target.world_key, body);
      setResult(res);
    } catch (e) {
      alert(e?.error?.message || 'Smart fill failed.');
    } finally {
      setLoading(false);
    }
  };

  // Result screen
  if (result) {
    const fillColor = result.filled > 0 ? '#15803d' : '#b45309';
    return (
      <Modal title="Smart Fill — Complete" onClose={() => onDone(result)} width="440px">
        <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{result.filled > 0 ? '✅' : '⚠️'}</div>
          <p style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {result.filled > 0 ? `${result.filled} question${result.filled !== 1 ? 's' : ''} filled` : 'No questions filled'}
          </p>
          <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>{result.message}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: fillColor }}>{result.now_assigned}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>assigned now</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{result.capacity}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>capacity</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: result.available_slots === 0 ? '#15803d' : 'var(--text-secondary)' }}>{result.available_slots}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>remaining slots</div>
            </div>
          </div>
          <button className="btn btn-violet" onClick={() => onDone(result)}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Smart Fill — ${target.display_name}`} onClose={onClose} width="540px">
      {/* Summary */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, padding: '10px 14px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{target.assigned}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>assigned</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{target.capacity}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>capacity</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: availableSlots > 0 ? '#0891b2' : '#15803d' }}>{availableSlots}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>available slots</div>
        </div>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Pull unassigned <strong>{target.section}</strong> questions from the bank into this world.
        All filters are optional — leave blank to fill with any matching question.
      </p>

      {/* Topic filter */}
      {sectionTopics.length > 0 && (
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Filter by Topic <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(leave blank for any)</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 180, overflowY: 'auto',
            padding: '8px', borderRadius: 8, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)' }}>
            {sectionTopics.map((t) => (
              <label key={t.key}
                className={`sf-topic-check ${selectedTopics.includes(t.key) ? 'selected' : ''}`}
                onClick={() => toggleTopic(t.key)}>
                <input type="checkbox" checked={selectedTopics.includes(t.key)} onChange={() => toggleTopic(t.key)}
                  style={{ pointerEvents: 'none' }} />
                {t.label}
              </label>
            ))}
          </div>
          {selectedTopics.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: '0.78rem' }}
              onClick={() => setSelectedTopics([])}>✕ Clear topic filters</button>
          )}
        </div>
      )}

      {/* Difficulty + confidence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div className="form-group">
          <label className="form-label">Difficulty</label>
          <select className="form-input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            <option value="">Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Min AI Confidence</label>
          <select className="form-input" value={minConf} onChange={e => setMinConf(e.target.value)}>
            <option value="">Any</option>
            <option value="0.65">≥ 65% (Medium)</option>
            <option value="0.85">≥ 85% (High)</option>
          </select>
        </div>
      </div>

      {/* Max fill + activate + reviewed only */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="form-group">
          <label className="form-label">Max Questions to Fill</label>
          <input type="number" className="form-input" min={1} max={availableSlots}
            value={maxFill} onChange={e => setMaxFill(e.target.value)}
            placeholder={`All (${availableSlots})`} />
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: 8 }}>
            <input type="checkbox" checked={reviewedOnly} onChange={e => setReviewedOnly(e.target.checked)} />
            Reviewed questions only
          </label>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', paddingBottom: 8 }}>
            <input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} />
            Activate filled questions
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-violet" onClick={handleFill} disabled={loading || availableSlots <= 0}>
          {loading ? '…' : availableSlots <= 0 ? 'World is full' : `Fill World`}
        </button>
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </Modal>
  );
}


function ClearWorldModal({ target, onDone, onClose }) {
  // target: { world_key, exam, display_name, assigned, student_count }
  const [loading,    setLoading]    = useState(false);
  const [needsForce, setNeedsForce] = useState(false);

  const handleClear = async (force = false) => {
    setLoading(true);
    try {
      const res = await adminApi.clearWorld(target.world_key, {
        exam: target.exam, confirm: true, force,
      });
      onDone(res);
    } catch (e) {
      if (e?.error?.code === 'student_progress_exists') {
        setNeedsForce(true);
      } else {
        alert(e?.error?.message || 'Clear failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Clear World — ${target.display_name}`} onClose={loading ? undefined : onClose} width="460px">
      <div style={{ textAlign: 'center', padding: '8px 0 8px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>🗂️</div>
        <p style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Return {target.assigned} question{target.assigned !== 1 ? 's' : ''} to the bank?
        </p>
        <p style={{ margin: '0 0 16px', fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Questions will be unassigned and deactivated. They are <strong>not deleted</strong> — you can reassign them at any time.
        </p>
      </div>

      {/* Student progress warning */}
      {target.student_count > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)',
          fontSize: '0.85rem', color: '#b45309', lineHeight: 1.6 }}>
          ⚠ <strong>{target.student_count} student{target.student_count !== 1 ? 's' : ''}</strong> have attempt history in this world.
          Their records are preserved — only the question assignments are cleared.
        </div>
      )}

      {/* Force override prompt (only shown after 409) */}
      {needsForce && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)',
          fontSize: '0.85rem', color: '#dc2626', lineHeight: 1.6 }}>
          Confirm force-clear: student progress records exist but will be preserved.
          Questions will still be unassigned.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {needsForce ? (
          <>
            <button className="btn" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626',
              border: '1px solid rgba(220,38,38,0.3)', fontWeight: 600 }}
              onClick={() => handleClear(true)} disabled={loading}>
              {loading ? 'Clearing…' : 'Force Clear'}
            </button>
            <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626',
              border: '1px solid rgba(220,38,38,0.3)', fontWeight: 600 }}
              onClick={() => handleClear(false)} disabled={loading}>
              {loading ? 'Clearing…' : `Clear ${target.assigned} Question${target.assigned !== 1 ? 's' : ''}`}
            </button>
            <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          </>
        )}
      </div>
    </Modal>
  );
}


function WorldsTab() {
  const [exam,            setExam]            = useState('qudurat');
  const [health,          setHealth]          = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [taxonomy,        setTaxonomy]        = useState(null);
  const [flash,           showFlash]          = useFlash();
  const [smartFillTarget, setSmartFillTarget] = useState(null);
  const [clearTarget,     setClearTarget]     = useState(null);
  const [refreshKey,      setRefreshKey]      = useState(0);

  useEffect(() => {
    adminApi.getTopics().then(d => setTaxonomy(d.taxonomy)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setHealth(null);
    adminApi.getWorldHealth(exam)
      .then(d => setHealth(d))
      .catch(() => showFlash('Failed to load world health.', 'error'))
      .finally(() => setLoading(false));
  }, [exam, refreshKey]);

  // Index worlds by world_key for O(1) lookup
  const worldMap = useMemo(() => {
    if (!health) return {};
    const map = {};
    health.worlds.forEach(w => { map[w.world_key] = w; });
    return map;
  }, [health]);

  const examConfig = SECTION_CONFIG[exam];
  const summary    = health?.summary;

  const fillBarColor = (pct) =>
    pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';

  const handleSmartFillDone = (result) => {
    setSmartFillTarget(null);
    setRefreshKey(k => k + 1);
    showFlash(result.filled > 0
      ? `Filled ${result.filled} question${result.filled !== 1 ? 's' : ''} into ${result.message.split('into')[1]?.trim().split('.')[0] || ''}.`
      : 'No matching questions found in the bank.');
  };

  const handleClearDone = (result) => {
    setClearTarget(null);
    setRefreshKey(k => k + 1);
    showFlash(`${result.cleared} question${result.cleared !== 1 ? 's' : ''} returned to bank.`);
  };

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}

      {/* Exam tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {Object.entries(SECTION_CONFIG).map(([examKey, cfg]) => (
          <button key={examKey}
            className={`btn btn-sm ${exam === examKey ? '' : 'btn-ghost'}`}
            style={{
              borderRadius: '8px 8px 0 0',
              borderBottom: exam === examKey ? '2px solid var(--violet)' : '2px solid transparent',
              fontWeight: exam === examKey ? 700 : 500,
              fontSize: '0.95rem', padding: '10px 24px',
              color: exam === examKey ? 'var(--violet-light)' : 'var(--text-muted)',
              background: exam === examKey ? 'rgba(139,92,246,0.08)' : 'transparent',
            }}
            onClick={() => setExam(examKey)}>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {summary && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: 'var(--bg-card, rgba(255,255,255,0.04))', border: '1px solid var(--border)' }}>
          {[
            { label: 'Total Capacity', val: summary.total_capacity.toLocaleString(), color: 'var(--text-primary)' },
            { label: 'Assigned',       val: summary.total_assigned.toLocaleString(), color: '#0891b2' },
            { label: 'Active',         val: summary.total_active.toLocaleString(),   color: '#15803d' },
            { label: 'Empty Slots',    val: summary.total_empty.toLocaleString(),    color: summary.total_empty > 0 ? '#b45309' : '#15803d' },
            { label: 'Fill %',
              val: summary.total_capacity > 0
                ? `${Math.round(summary.total_assigned / summary.total_capacity * 100)}%`
                : '0%',
              color: fillBarColor(summary.total_capacity > 0 ? Math.round(summary.total_assigned / summary.total_capacity * 100) : 0) },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', alignSelf: 'center' }}
            onClick={() => setRefreshKey(k => k + 1)}>↻ Refresh</button>
        </div>
      )}

      {loading && <div className="admin-loading"><div className="spinner" /></div>}

      {/* Per-section world cards */}
      {!loading && examConfig && Object.entries(examConfig.sections).map(([secKey, secCfg]) => {
        const sectionWorlds = secCfg.worlds.map(wk => worldMap[wk]).filter(Boolean);
        // If health hasn't loaded yet for this section, show placeholders
        const worldsToShow = sectionWorlds.length > 0
          ? sectionWorlds
          : secCfg.worlds.map(wk => ({
              world_key: wk, exam, section: secKey,
              display_name: worldDisplayName(wk),
              capacity: 0, assigned: 0, active: 0, inactive: 0,
              empty_slots: 0, fill_pct: 0,
              topic_breakdown: [], difficulty_breakdown: { easy: 0, medium: 0, hard: 0, untagged: 0 },
              student_count: 0, has_student_progress: false,
            }));

        return (
          <div key={secKey} className="world-section-card">
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {secCfg.label}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {worldsToShow.reduce((s, w) => s + w.assigned, 0).toLocaleString()} /{' '}
                {worldsToShow.reduce((s, w) => s + w.capacity, 0).toLocaleString()} questions assigned
              </span>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 70px 80px 100px 110px auto',
              gap: 10, padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.05)',
              fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              <div>World</div>
              <div>Fill</div>
              <div>Active</div>
              <div>Topics</div>
              <div>Difficulty</div>
              <div>Students</div>
              <div>Actions</div>
            </div>

            {/* World rows */}
            {worldsToShow.map((w) => {
              const pct   = w.fill_pct;
              const barClr = fillBarColor(pct);
              const db    = w.difficulty_breakdown || {};
              const topicCount = w.topic_breakdown?.length || 0;
              const totalTagged = (db.easy || 0) + (db.medium || 0) + (db.hard || 0);
              const untagged    = db.untagged || 0;

              return (
                <div key={w.world_key} style={{ display: 'grid',
                  gridTemplateColumns: '160px 1fr 70px 80px 100px 110px auto',
                  gap: 10, alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

                  {/* World name */}
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {w.display_name}
                  </div>

                  {/* Fill bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.assigned}/{w.capacity}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: barClr }}>{pct}%</span>
                    </div>
                    <div className="world-fill-bar-bg">
                      <div className="world-fill-bar-fill" style={{ width: `${pct}%`, background: barClr }} />
                    </div>
                  </div>

                  {/* Active count */}
                  <div>
                    {w.active > 0
                      ? <Pill color="green">{w.active}</Pill>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>}
                  </div>

                  {/* Topic count */}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {topicCount > 0
                      ? <span style={{ color: '#0891b2', fontWeight: 600 }}>{topicCount} topics</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </div>

                  {/* Difficulty breakdown */}
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.8 }}>
                    {totalTagged > 0 ? (
                      <span>
                        {db.easy   > 0 && <span style={{ color: '#15803d',  marginRight: 4 }}>E:{db.easy}</span>}
                        {db.medium > 0 && <span style={{ color: '#2563eb',  marginRight: 4 }}>M:{db.medium}</span>}
                        {db.hard   > 0 && <span style={{ color: '#b45309',  marginRight: 4 }}>H:{db.hard}</span>}
                        {untagged  > 0 && <span style={{ color: 'var(--text-muted)' }}>U:{untagged}</span>}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>

                  {/* Student progress */}
                  <div>
                    {w.has_student_progress
                      ? <Pill color="amber" title={`${w.student_count} student(s) have progress here`}>
                          👤 {w.student_count}
                        </Pill>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
                        border: '1px solid rgba(124,58,237,0.25)', padding: '4px 10px',
                        fontSize: '0.8rem', fontWeight: 600 }}
                      disabled={w.empty_slots === 0 && w.capacity > 0}
                      title={w.empty_slots === 0 ? 'World is at capacity' : `Fill up to ${w.empty_slots} slots`}
                      onClick={() => setSmartFillTarget(w)}>
                      ⚡ Fill
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ borderColor: 'rgba(220,38,38,0.25)', color: '#dc2626',
                        padding: '4px 10px', fontSize: '0.8rem' }}
                      disabled={w.assigned === 0}
                      title={w.assigned === 0 ? 'World is empty' : `Clear all ${w.assigned} questions`}
                      onClick={() => setClearTarget(w)}>
                      ✕ Clear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Difficulty legend */}
      {!loading && (
        <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {[['#15803d','E = Easy'],['#2563eb','M = Medium'],['#b45309','H = Hard'],['var(--text-muted)','U = Untagged']].map(([c,l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0, display: 'inline-block' }} />{l}
            </span>
          ))}
        </div>
      )}

      {/* Modals */}
      {smartFillTarget && (
        <SmartFillModal
          target={smartFillTarget}
          taxonomy={taxonomy}
          onDone={handleSmartFillDone}
          onClose={() => setSmartFillTarget(null)}
        />
      )}
      {clearTarget && (
        <ClearWorldModal
          target={clearTarget}
          onDone={handleClearDone}
          onClose={() => setClearTarget(null)}
        />
      )}
    </div>
  );
}


// ── DUPLICATES MODAL  (Chunk K3) ─────────────────────────────────────────────

function DuplicatesModal({ initialSection, initialExam, onClose }) {
  const SECTIONS = ['math', 'verbal', 'biology', 'chemistry', 'physics'];

  const [section,  setSection]  = useState(initialSection || 'math');
  const [exam,     setExam]     = useState(initialExam    || '');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [groups,   setGroups]   = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [flash,    showFlash]   = useFlash();

  const runCheck = async () => {
    setLoading(true);
    setResult(null);
    setGroups([]);
    try {
      const data = await adminApi.findDuplicates(section, exam || undefined);
      setResult(data);
      setGroups((data.duplicate_groups || []).map(g => ({ ...g, questions: g.questions.map(q => ({ ...q, _deleted: false })) })));
    } catch (e) {
      showFlash(e?.error?.message || 'Failed to run duplicate check.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runCheck(); }, []); // eslint-disable-line

  const handleDelete = async (groupIdx, questionId) => {
    setDeleting(questionId);
    try {
      await adminApi.deleteQuestion(questionId);
      setGroups(prev => {
        const next = prev.map((g, gi) => {
          if (gi !== groupIdx) return g;
          return { ...g, questions: g.questions.map(q => q.id === questionId ? { ...q, _deleted: true } : q) };
        });
        return next.filter(g => g.questions.filter(q => !q._deleted).length >= 2);
      });
      showFlash(`Question #${questionId} deleted.`);
    } catch (e) {
      showFlash(e?.error?.message || 'Delete failed.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const liveGroups = groups.filter(g => g.questions.filter(q => !q._deleted).length >= 2);
  const hasResults = result !== null;

  return (
    <Modal title="🔍 Duplicate Detection" onClose={onClose} width="780px">
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 12 }}>{flash.msg}</div>}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Section</label>
          <select className="form-input" style={{ minWidth: 140 }} value={section} onChange={e => setSection(e.target.value)}>
            {SECTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>Exam (optional)</label>
          <select className="form-input" style={{ minWidth: 130 }} value={exam} onChange={e => setExam(e.target.value)}>
            <option value="">All exams</option>
            <option value="qudurat">Qudurat</option>
            <option value="tahsili">Tahsili</option>
          </select>
        </div>
        <button className="btn btn-violet" onClick={runCheck} disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? '…' : '↻ Run Check'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '0.88rem' }}>Scanning {section} questions for duplicates…</div>
        </div>
      )}

      {/* Summary */}
      {!loading && hasResults && (
        <div style={{ marginBottom: 16 }}>
          {liveGroups.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)' }}>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <span style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 600 }}>
                No duplicates found in {section}{exam ? ` / ${exam}` : ''}.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', marginBottom: 12 }}>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
              <div>
                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.95rem' }}>
                  {liveGroups.length} duplicate group{liveGroups.length !== 1 ? 's' : ''} found
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginLeft: 10 }}>
                  {liveGroups.reduce((s, g) => s + g.questions.filter(q => !q._deleted).length, 0)} questions total
                  · keep one per group, delete the rest
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Groups */}
      {!loading && liveGroups.length > 0 && (
        <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
          {liveGroups.map((group, gi) => (
            <div key={gi} className="dup-group-card">
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Pill color="red">{group.questions.filter(q => !q._deleted).length} copies</Pill>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  "{(group.normalized_preview || '').slice(0, 80)}{(group.normalized_preview || '').length > 80 ? '…' : ''}"
                </span>
              </div>

              {/* Questions in group */}
              {group.questions.map((q) => (
                <div key={q.id} className={`dup-question-row${q._deleted ? ' deleted' : ''}`}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                      <Pill color="violet">{q.exam}</Pill>
                      {q.world_key
                        ? <Pill color="cyan">{worldDisplayName(q.world_key)}</Pill>
                        : <Pill color="gray">unassigned</Pill>}
                      <Pill color={q.correct_answer ? 'green' : 'amber'}>
                        Ans: {(q.correct_answer || '?').toUpperCase()}
                      </Pill>
                      {q.is_active ? <Pill color="green">Active</Pill> : <Pill color="gray">Inactive</Pill>}
                      {q.review_status === 'approved' && <Pill color="green">✓ Approved</Pill>}
                      {q.last_reviewed_at && <Pill color="blue">Reviewed</Pill>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>#{q.id}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {q.question_text.slice(0, 140)}{q.question_text.length > 140 ? '…' : ''}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    {q._deleted ? (
                      <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>Deleted</span>
                    ) : (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626',
                          border: '1px solid rgba(220,38,38,0.25)', padding: '4px 10px' }}
                        disabled={deleting === q.id}
                        onClick={() => handleDelete(gi, q.id)}>
                        {deleting === q.id ? '…' : '🗑 Delete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}


// ── ORGS TAB ──────────────────────────────────────────────────────────────────

function OrgsTab() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, showFlash] = useFlash();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    adminApi.listOrgs({ per_page: 100 })
      .then((d) => setOrgs(d.orgs))
      .catch(() => showFlash('Failed to load orgs.', 'error'))
      .finally(() => setLoading(false));
  }, [showFlash]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  if (loading) return <div className="admin-loading"><div className="spinner" /></div>;

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-green btn-sm" onClick={() => setCreating(true)}>+ New School</button>
      </div>
      {orgs.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No schools yet.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Name</th><th>Slug</th><th>Students</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td><td>{o.name}</td><td><code>{o.slug}</code></td>
                  <td>{o.estimated_student_count || '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td><button className="admin-action-btn" onClick={() => setSelected(o)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateOrgModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); fetchOrgs(); showFlash('School created.'); }} />}
      {selected && <OrgDetailModal org={selected} onClose={() => setSelected(null)} onRefresh={fetchOrgs} />}
    </div>
  );
}

function CreateOrgModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', slug: '', estimated_student_count: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await adminApi.createOrg({ ...form, estimated_student_count: form.estimated_student_count ? parseInt(form.estimated_student_count) : null });
      onCreated();
    } catch (err) { alert(err?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create School" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
        <div className="form-group"><label className="form-label">Slug</label><input className="form-input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} required placeholder="e.g. riyadh-prep-school" /></div>
        <div className="form-group"><label className="form-label">Est. Students (optional)</label><input className="form-input" type="number" value={form.estimated_student_count} onChange={(e) => setForm((f) => ({ ...f, estimated_student_count: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Creating…' : 'Create School'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
// ── SPLICE INSTRUCTIONS ───────────────────────────────────────────────────────
// Find the existing OrgDetailModal function in AdminPanel.jsx.
// Delete it from `function OrgDetailModal` to its closing `}`.
// Paste this entire file contents in its place (delete this comment block too).
// No other changes to AdminPanel.jsx needed.
// ─────────────────────────────────────────────────────────────────────────────

// ── School tier config ────────────────────────────────────────────────────────
const SCHOOL_TIERS = [
  { id: 'standard', label: 'Standard', pricePerStudent: 99,  minStudents: 30,  color: '#16a34a' },
  { id: 'volume',   label: 'Volume',   pricePerStudent: 75,  minStudents: 100, color: '#7c3aed' },
];

function getSchoolTier(count) {
  if (count >= 100) return SCHOOL_TIERS[1];
  if (count >= 30)  return SCHOOL_TIERS[0];
  return null;
}

function daysRemaining(isoDate) {
  if (!isoDate) return null;
  const diff = new Date(isoDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function entitlementStatusColor(days) {
  if (days <= 0)  return { color: '#dc2626', label: 'Expired',     pill: 'red'   };
  if (days <= 60) return { color: '#d97706', label: `${days}d left`, pill: 'amber' };
  return               { color: '#15803d', label: `${days}d left`, pill: 'green' };
}

function OrgDetailModal({ org, onClose, onRefresh }) {
  const [detail,      setDetail]      = useState(null);
  const [flash,       showFlash]      = useFlash();
  const [refreshKey,  setRefreshKey]  = useState(0);

  // Payment link state
  const [plExam,        setPlExam]        = useState('qudurat');
  const [plCount,       setPlCount]       = useState('');
  const [plGenerating,  setPlGenerating]  = useState(false);
  const [plResult,      setPlResult]      = useState(null);
  const [plCopied,      setPlCopied]      = useState(false);
  const [plDownloading, setPlDownloading] = useState(false);

  // Leader creation state
  const [leaderUsername, setLeaderUsername] = useState('');
  const [leaderPassword, setLeaderPassword] = useState('');
  const [leaderCreating, setLeaderCreating] = useState(false);
  const [leaderCreated,  setLeaderCreated]  = useState(null); // { username, password }
  const [showLeaderForm, setShowLeaderForm] = useState(false);

  // Student generation state
  const [genCount,      setGenCount]      = useState('');
  const [genLoading,    setGenLoading]    = useState(false);
  const [genResult,     setGenResult]     = useState(null); // { created, students }
  const [showGenForm,   setShowGenForm]   = useState(false);
  const [csvDownloading, setCsvDownloading] = useState(false);

  const reload = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    setDetail(null);
    adminApi.getOrg(org.id).then(setDetail).catch(() => {});
  }, [org.id, refreshKey]);

  // ── Payment link helpers ──
  const plCountNum = parseInt(plCount) || 0;
  const plTier     = getSchoolTier(plCountNum);
  const plTotal    = plTier ? plTier.pricePerStudent * plCountNum : 0;

  const handleGenerateLink = async () => {
    if (!plTier) return;
    setPlGenerating(true); setPlResult(null);
    try {
      const result = await adminApi.createSchoolCheckout({
        org_id: org.id, exam: plExam,
        student_count: plCountNum, plan_tier: plTier.id,
      });
      setPlResult(result);
    } catch (e) { showFlash(e?.error?.message || 'Failed to generate payment link.', 'error'); }
    finally { setPlGenerating(false); }
  };

  const handleCopyLink = () => {
    if (!plResult?.checkout_url) return;
    navigator.clipboard.writeText(plResult.checkout_url).then(() => {
      setPlCopied(true); setTimeout(() => setPlCopied(false), 2500);
    });
  };

  const handleDownloadInvoice = async () => {
    if (!plResult) return;
    setPlDownloading(true);
    try {
      const res = await adminApi.downloadSchoolInvoice(plResult.invoice_number, {
        org_name: plResult.org_name, exam: plResult.exam,
        plan_tier: plResult.plan_tier, student_count: plResult.student_count,
        price_per_student: plResult.price_per_student, total_sar: plResult.total_sar,
        expires_days: plResult.expires_days,
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `DrFahm_Invoice_${plResult.invoice_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { showFlash('Failed to download invoice PDF.', 'error'); }
    finally { setPlDownloading(false); }
  };

  const handleResetLink = () => { setPlResult(null); setPlCopied(false); setPlCount(''); };

  // ── Leader creation ──
  const handleCreateLeader = async () => {
    if (!leaderUsername.trim()) return;
    setLeaderCreating(true);
    try {
      const result = await adminApi.createOrgLeader(org.id, {
        username: leaderUsername.trim(),
        password: leaderPassword.trim() || undefined,
      });
      setLeaderCreated({ username: result.user.username, password: result.password });
      setShowLeaderForm(false);
      reload();
      showFlash('School leader created successfully.');
    } catch (e) { showFlash(e?.error?.message || 'Failed to create leader.', 'error'); }
    finally { setLeaderCreating(false); }
  };

  // ── Student generation ──
  const handleGenerateStudents = async () => {
    const count = parseInt(genCount);
    if (!count || count < 1 || count > 500) {
      showFlash('Enter a count between 1 and 500.', 'error'); return;
    }
    setGenLoading(true);
    try {
      const result = await adminApi.generateStudents(org.id, { count });
      setGenResult(result);
      setShowGenForm(false);
      reload();
      showFlash(`${result.created} student accounts created.`);
    } catch (e) { showFlash(e?.error?.message || 'Failed to generate students.', 'error'); }
    finally { setGenLoading(false); }
  };

  const handleExportCsv = async () => {
    setCsvDownloading(true);
    try {
      const res = await adminApi.exportStudentsCsv(org.id);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${org.slug}_students.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { showFlash('Failed to export students CSV.', 'error'); }
    finally { setCsvDownloading(false); }
  };

  if (!detail) return <Modal title={org.name} onClose={onClose}><div className="spinner" /></Modal>;

  const sectionHead = (label) => (
    <div style={{
      fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-secondary)',
      textTransform: 'uppercase', letterSpacing: '0.4px',
      borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12,
    }}>{label}</div>
  );

  return (
    <Modal title={org.name} onClose={onClose} width="800px">
      {flash && (
        <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`}
          style={{ marginBottom: 12 }}>{flash.msg}</div>
      )}

      <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.88rem' }}>
        Slug: <code>{org.slug}</code> · ID: {org.id}
      </p>

      {/* ══ ENTITLEMENTS ══════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 24 }}>
        {sectionHead('📋 Active Licences')}
        {detail.entitlements?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {detail.entitlements.map((e) => {
              const days   = daysRemaining(e.entitlement_expires_at);
              const status = entitlementStatusColor(days);
              return (
                <div key={e.id} style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', textTransform: 'capitalize', marginBottom: 4 }}>
                        {e.exam === 'qudurat' ? 'Qudurat — قدرات' : 'Tahsili — تحصيلي'}
                      </div>
                      {e.student_count && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          👤 {e.student_count} students
                        </div>
                      )}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Expires {new Date(e.entitlement_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Pill color={status.pill}>{days <= 0 ? 'Expired' : 'Active'}</Pill>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: status.color, marginTop: 4 }}>
                        {days <= 0 ? 'Renewal needed' : `${days} days left`}
                      </div>
                    </div>
                  </div>
                  {days > 0 && days <= 60 && (
                    <div style={{
                      marginTop: 8, padding: '5px 8px', borderRadius: 5, fontSize: '0.78rem',
                      background: 'rgba(217,119,6,0.08)', color: '#b45309',
                      border: '1px solid rgba(217,119,6,0.2)',
                    }}>
                      ⚠ Renewal due soon — generate a new payment link to extend
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No licences yet — generate a payment link below to get started.
          </p>
        )}
      </div>

      {/* ══ PAYMENT LINK ══════════════════════════════════════════════════════ */}
      <div style={{
        padding: '16px 18px', borderRadius: 10, marginBottom: 24,
        background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)',
      }}>
        {sectionHead('💳 Generate Payment Link')}

        {!plResult ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Exam</label>
                <select className="form-input" value={plExam} onChange={e => setPlExam(e.target.value)}>
                  <option value="qudurat">Qudurat — قدرات</option>
                  <option value="tahsili">Tahsili — تحصيلي</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Number of Students</label>
                <input type="number" className="form-input" min={1} value={plCount}
                  onChange={e => setPlCount(e.target.value)} placeholder="e.g. 80" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tier (auto)</label>
                <div style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: '0.88rem', minHeight: 38, display: 'flex', alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  color: plTier ? plTier.color : 'var(--text-muted)', fontWeight: plTier ? 700 : 400,
                }}>
                  {plTier ? `${plTier.label} — SAR ${plTier.pricePerStudent}/student`
                    : plCountNum > 0 ? '⚠ Minimum 30 students' : '— enter student count'}
                </div>
              </div>
            </div>

            {plTier && plCountNum > 0 && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                display: 'flex', gap: 24, alignItems: 'center', fontSize: '0.88rem',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{plCountNum} students × SAR {plTier.pricePerStudent}</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: plTier.color }}>= SAR {plTotal.toLocaleString()}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>365 days · all worlds</span>
              </div>
            )}

            <button className="btn btn-violet" onClick={handleGenerateLink}
              disabled={plGenerating || !plTier || plCountNum < 1} style={{ fontWeight: 700 }}>
              {plGenerating ? '…' : '⚡ Generate Payment Link'}
            </button>
            {!plTier && plCountNum > 0 && plCountNum < 30 && (
              <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#b45309' }}>Minimum 30 students required.</p>
            )}
          </>
        ) : (
          <div>
            <div style={{
              padding: '12px 14px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)',
              fontSize: '0.85rem', color: '#15803d', fontWeight: 600,
            }}>
              ✓ Payment link generated — Invoice #{plResult.invoice_number}
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span><span style={{ color: 'var(--text-muted)' }}>School:</span> <strong>{plResult.org_name}</strong></span>
              <span><span style={{ color: 'var(--text-muted)' }}>Exam:</span> <strong style={{ textTransform: 'capitalize' }}>{plResult.exam}</strong></span>
              <span><span style={{ color: 'var(--text-muted)' }}>Students:</span> <strong>{plResult.student_count}</strong></span>
              <span><span style={{ color: 'var(--text-muted)' }}>Total:</span> <strong style={{ color: '#7c3aed' }}>SAR {plResult.total_sar?.toLocaleString()}</strong></span>
            </div>
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)',
              fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)',
              wordBreak: 'break-all', lineHeight: 1.6,
            }}>{plResult.checkout_url}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-violet" onClick={handleCopyLink} style={{ fontWeight: 700 }}>
                {plCopied ? '✓ Copied!' : '📋 Copy Link'}
              </button>
              <button className="btn btn-ghost" onClick={handleDownloadInvoice} disabled={plDownloading} style={{ fontWeight: 600 }}>
                {plDownloading ? '…' : '⬇ Download Invoice PDF'}
              </button>
              <a href={plResult.checkout_url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>
                Open link ↗
              </a>
              <button className="btn btn-ghost btn-sm" onClick={handleResetLink} style={{ marginLeft: 'auto', fontSize: '0.82rem' }}>
                ↩ Generate another
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Send the link to the school leader via WhatsApp. Entitlement is granted automatically once paid.
            </p>
          </div>
        )}
      </div>

      {/* ══ LEADER ════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 24 }}>
        {sectionHead('👤 School Leader')}
        {detail.leader ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            fontSize: '0.88rem',
          }}>
            <Pill color="blue">Leader</Pill>
            <span style={{ fontWeight: 600 }}>{detail.leader.username}</span>
            <span style={{ color: 'var(--text-muted)' }}>ID: {detail.leader.id}</span>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 10 }}>
              No leader assigned. The leader can log in and manage student accounts.
            </p>

            {leaderCreated ? (
              <div style={{
                padding: '12px 14px', borderRadius: 8,
                background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)',
                fontSize: '0.85rem',
              }}>
                <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 6 }}>✓ Leader account created — save these credentials now</div>
                <div>Username: <strong>{leaderCreated.username}</strong></div>
                <div>Password: <strong style={{ fontFamily: 'monospace' }}>{leaderCreated.password}</strong></div>
                <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  This password cannot be retrieved again. Share it securely with the school.
                </p>
              </div>
            ) : showLeaderForm ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                  <label className="form-label">Username</label>
                  <input className="form-input" value={leaderUsername}
                    onChange={e => setLeaderUsername(e.target.value)}
                    placeholder={`${org.slug}-leader`} />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                  <label className="form-label">Password (blank = random)</label>
                  <input className="form-input" value={leaderPassword}
                    onChange={e => setLeaderPassword(e.target.value)}
                    placeholder="Leave blank for auto-generated" />
                </div>
                <button className="btn btn-green" onClick={handleCreateLeader}
                  disabled={leaderCreating || !leaderUsername.trim()}>
                  {leaderCreating ? '…' : 'Create Leader'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowLeaderForm(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaderForm(true)}>
                + Add School Leader
              </button>
            )}
          </>
        )}
      </div>

      {/* ══ STUDENTS ══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {sectionHead(`🎓 Students (${detail.students?.length || 0})`)}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {detail.students?.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={handleExportCsv} disabled={csvDownloading}>
                {csvDownloading ? '…' : '⬇ Export CSV'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowGenForm(!showGenForm); setGenResult(null); }}>
              {showGenForm ? 'Cancel' : '+ Generate Accounts'}
            </button>
          </div>
        </div>

        {showGenForm && (
          <div style={{
            padding: '12px 14px', borderRadius: 8, marginBottom: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
              Generate student accounts for this school. Usernames are auto-created from the school slug.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Number of accounts (max 500)</label>
                <input type="number" className="form-input" min={1} max={500}
                  value={genCount} onChange={e => setGenCount(e.target.value)} placeholder="e.g. 100" style={{ width: 160 }} />
              </div>
              <button className="btn btn-green" onClick={handleGenerateStudents}
                disabled={genLoading || !genCount}>
                {genLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        )}

        {genResult && (
          <div style={{
            padding: '12px 14px', borderRadius: 8, marginBottom: 12,
            background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)',
            fontSize: '0.85rem',
          }}>
            <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 4 }}>
              ✓ {genResult.created} accounts created — export the CSV for credentials
            </div>
            <button className="btn btn-green btn-sm" onClick={handleExportCsv} disabled={csvDownloading}>
              {csvDownloading ? '…' : '⬇ Download Credentials CSV'}
            </button>
          </div>
        )}

        {detail.students?.length > 0 ? (
          <div style={{
            maxHeight: 160, overflow: 'auto', borderRadius: 8,
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
            padding: '8px 12px',
          }}>
            {detail.students.map((s) => (
              <div key={s.id} style={{
                fontSize: '0.83rem', padding: '3px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                color: 'var(--text-secondary)',
              }}>
                {s.username}
                {!s.is_active && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#dc2626' }}>inactive</span>}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No students yet.</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [flash, showFlash] = useFlash();
  const [creating, setCreating] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const searchTimeout = useRef(null);
  const [searchInput, setSearchInput] = useState('');

  const fetchUsers = useCallback(() => {
    setLoading(true);
    adminApi.listUsers({ page, per_page: 50, role: roleFilter, search })
      .then((d) => { setUsers(d.users); setTotal(d.total); })
      .catch(() => showFlash('Failed to load users.', 'error'))
      .finally(() => setLoading(false));
  }, [page, roleFilter, search, showFlash]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  const handleToggleActive = async (u) => {
    try {
      if (u.is_active) await adminApi.deactivateUser(u.id);
      else await adminApi.activateUser(u.id);
      showFlash(`User ${u.username} ${u.is_active ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const handleResetPassword = async (u) => {
    const newPass = window.prompt(`New password for ${u.username}:`);
    if (!newPass) return;
    try {
      const result = await adminApi.resetPassword(u.id, { password: newPass });
      showFlash(`Password reset for ${u.username}. New: ${result.password}`);
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div className="admin-filter-row">
        <input className="form-input" style={{ width: 'auto', minWidth: 200 }} placeholder="Search username…" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        <select className="form-input" style={{ width: 'auto' }} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="student">Student</option>
          <option value="school_leader">School Leader</option>
          <option value="drfahm_admin">Admin</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginLeft: 'auto' }}>{total} user{total !== 1 ? 's' : ''}</span>
        <button className="btn btn-green btn-sm" onClick={() => setCreating(true)} style={{ marginLeft: 8 }}>+ New Admin</button>
      </div>
      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td><td>{u.username}</td>
                  <td><Pill color={u.role === 'drfahm_admin' ? 'violet' : u.role === 'school_leader' ? 'blue' : 'gray'}>{u.role}</Pill></td>
                  <td>{u.is_active ? <Pill color="green">Active</Pill> : <Pill color="gray">Inactive</Pill>}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-action-btn" onClick={() => handleToggleActive(u)}>{u.is_active ? '🔴' : '🟢'}</button>
                      <button className="admin-action-btn" onClick={() => handleResetPassword(u)} title="Reset password">🔑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
      {creating && <CreateAdminModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); fetchUsers(); showFlash('Admin created.'); }} />}
    </div>
  );
}

function CreateAdminModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const result = await adminApi.createUser(form);
      alert(`Admin created!\nUsername: ${result.user.username}\nPassword: ${result.password}\n\nSave this password — it cannot be retrieved later.`);
      onCreated();
    } catch (err) { alert(err?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create Admin" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required minLength={3} /></div>
        <div className="form-group"><label className="form-label">Password (leave blank for random)</label><input className="form-input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Creating…' : 'Create Admin'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}


// ── BULK UPLOAD TAB ───────────────────────────────────────────────────────────

const BULK_CSV_COLUMNS = ['exam','section','question_text','option_a','option_b','option_c','option_d','correct_answer','hint','topic','difficulty'];
const VALID_EXAM_SECTIONS = { qudurat: ['math','verbal'], tahsili: ['math','biology','chemistry','physics'] };

function BulkUploadTab() {
  const [step, setStep]             = useState(1);
  const [file, setFile]             = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [report, setReport]         = useState(null);
  const [result, setResult]         = useState(null);
  const [forceDupes, setForceDupes] = useState(false);
  const [flash, showFlash]          = useFlash();
  const fileInputRef                = useRef(null);

  const handleDownloadTemplate = async () => {
    try {
      const res = await adminApi.bulkTemplate();
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'drfahm_bulk_template.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { showFlash('Failed to download template.', 'error'); }
  };

  const handleDownloadErrors = () => {
    if (!report?.errors?.length) return;
    const header = 'row,field,message\n';
    const rows = report.errors.map((e) => `${e.row},"${e.field}","${String(e.message).replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `drfahm_upload_errors_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) { showFlash('Only .csv files are accepted.', 'error'); return; }
    if (f.size > 10 * 1024 * 1024) { showFlash('File too large. Maximum 10 MB.', 'error'); return; }
    setFile(f); setReport(null); setResult(null); setStep(1); setForceDupes(false);
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer?.files?.[0]); };
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleValidate = async () => {
    if (!file) return; setValidating(true);
    try { const data = await adminApi.bulkValidate(file); setReport(data); setStep(2); }
    catch (e) { showFlash(e?.error?.message || 'Validation failed.', 'error'); }
    finally { setValidating(false); }
  };

  const handleCommit = async () => {
    if (!file) return; setCommitting(true);
    try { const data = await adminApi.bulkCommit(file, forceDupes); setResult(data); setStep(3); }
    catch (e) { showFlash(e?.error?.message || 'Import failed.', 'error'); }
    finally { setCommitting(false); }
  };

  const handleReset = () => {
    setStep(1); setFile(null); setReport(null); setResult(null); setForceDupes(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const importCount = report ? report.stats.valid_count + (forceDupes ? report.stats.duplicate_count : 0) : 0;

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div className="bulk-steps">
        {[{ n: 1, label: 'Upload CSV' }, { n: 2, label: 'Review' }, { n: 3, label: 'Done' }].map(({ n, label }) => (
          <div key={n} className={`bulk-step ${step >= n ? 'active' : ''} ${step === n ? 'current' : ''}`}>
            <div className="bulk-step-number">{step > n ? '✓' : n}</div>
            <span className="bulk-step-label">{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bulk-section">
          <div className="bulk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Upload Questions CSV</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fill in the template, save as CSV, then upload here.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleDownloadTemplate}>⬇ Download Template</button>
            </div>
            <div className={`bulk-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
              {file ? (
                <div className="bulk-dropzone-file">
                  <span className="bulk-dropzone-icon">📄</span>
                  <span className="bulk-dropzone-name">{file.name}</span>
                  <span className="bulk-dropzone-size">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); handleReset(); }}>✕ Remove</button>
                </div>
              ) : (
                <div className="bulk-dropzone-empty">
                  <span className="bulk-dropzone-icon">📁</span>
                  <p style={{ margin: '8px 0 4px', fontWeight: 600, color: 'var(--text-primary)' }}>Drag & drop CSV file here</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>or click to browse</p>
                </div>
              )}
            </div>
            <div className="bulk-format-guide">
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Required Columns (11 total)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {BULK_CSV_COLUMNS.map((c) => <Pill key={c} color={c === 'section' || c === 'hint' ? 'green' : 'violet'}>{c}</Pill>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>exam</strong> — <code>qudurat</code> or <code>tahsili</code></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>section</strong> — subject within exam</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>correct_answer</strong> — <code>a</code>, <code>b</code>, <code>c</code>, or <code>d</code></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>hint</strong> — shown after wrong answer</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>topic</strong> — must match valid topics for section</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>difficulty</strong> — <code>easy</code>, <code>medium</code>, or <code>hard</code></div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(139,92,246,0.06)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Valid exam / section combinations</div>
                {Object.entries(VALID_EXAM_SECTIONS).map(([exam, sections]) => (
                  <div key={exam} style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 3 }}>
                    <strong style={{ textTransform: 'capitalize' }}>{exam}:</strong>{' '}{sections.map((s) => <code key={s} style={{ marginRight: 6 }}>{s}</code>)}
                  </div>
                ))}
              </div>
            </div>
            {file && (
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button className="btn btn-violet" onClick={handleValidate} disabled={validating}>
                  {validating ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }} />Validating…</> : 'Validate CSV'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && report && (
        <div className="bulk-section">
          <div className="bulk-summary-grid">
            <div className="bulk-summary-card success"><div className="bulk-summary-number">{report.stats.valid_count}</div><div className="bulk-summary-label">Valid</div></div>
            <div className="bulk-summary-card error"><div className="bulk-summary-number">{report.stats.error_count}</div><div className="bulk-summary-label">Errors</div></div>
            <div className="bulk-summary-card warning"><div className="bulk-summary-number">{report.stats.duplicate_count}</div><div className="bulk-summary-label">Duplicates</div></div>
            <div className="bulk-summary-card neutral"><div className="bulk-summary-number">{report.stats.total_rows}</div><div className="bulk-summary-label">Total Rows</div></div>
          </div>
          {report.errors.length > 0 && (
            <div className="bulk-card" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, color: '#dc2626', fontSize: '0.95rem' }}>✗ {report.errors.length} Error{report.errors.length !== 1 ? 's' : ''} Found</h4>
                <button className="btn btn-ghost btn-sm" onClick={handleDownloadErrors}>⬇ Download Errors CSV</button>
              </div>
              <div className="bulk-table-wrap">
                <table className="admin-table">
                  <thead><tr><th style={{ width: 70 }}>Row</th><th style={{ width: 130 }}>Field</th><th>Message</th></tr></thead>
                  <tbody>
                    {report.errors.slice(0, 50).map((err, i) => (
                      <tr key={i}><td><Pill color="gray">{err.row}</Pill></td><td><code style={{ fontSize: '0.82rem', color: '#dc2626' }}>{err.field}</code></td><td style={{ fontSize: '0.85rem' }}>{err.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {report.duplicates.length > 0 && (
            <div className="bulk-card" style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 4px', color: '#b45309', fontSize: '0.95rem' }}>⚠ {report.duplicates.length} Duplicate{report.duplicates.length !== 1 ? 's' : ''} Detected</h4>
              <p style={{ margin: '0 0 12px', fontSize: '0.83rem', color: 'var(--text-muted)' }}>These questions match existing records. By default they are skipped.</p>
              <div className="bulk-table-wrap">
                <table className="admin-table">
                  <thead><tr><th style={{ width: 70 }}>Row</th><th>Question Text (preview)</th><th style={{ width: 130 }}>Matches</th></tr></thead>
                  <tbody>
                    {report.duplicates.slice(0, 30).map((dup, i) => (
                      <tr key={i}><td><Pill color="gray">{dup.row}</Pill></td><td style={{ fontSize: '0.85rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dup.question_text}</td>
                        <td>{dup.existing_id ? <Pill color="amber">DB #{dup.existing_id}</Pill> : <Pill color="gray">CSV row {dup.duplicate_of_csv_row}</Pill>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={forceDupes} onChange={(e) => setForceDupes(e.target.checked)} />
                Import duplicates anyway
              </label>
            </div>
          )}
          {report.preview && report.preview.length > 0 && (
            <div className="bulk-card" style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>✓ Preview — {Math.min(report.preview.length, 20)} of {report.stats.valid_count} valid rows</h4>
              <div className="bulk-table-wrap">
                <table className="admin-table">
                  <thead><tr><th style={{ width: 60 }}>Row</th><th style={{ width: 90 }}>Exam</th><th style={{ width: 100 }}>Section</th><th>Question</th><th style={{ width: 55 }}>Ans</th><th style={{ width: 110 }}>Topic</th><th style={{ width: 75 }}>Diff</th></tr></thead>
                  <tbody>
                    {report.preview.map((row, i) => (
                      <tr key={i}>
                        <td><Pill color="gray">{row._row}</Pill></td><td><Pill color="violet">{row.exam}</Pill></td>
                        <td style={{ fontSize: '0.82rem', textTransform: 'capitalize' }}>{row.section}</td>
                        <td style={{ fontSize: '0.85rem', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.question_text}</td>
                        <td><Pill color="green">{row.correct_answer.toUpperCase()}</Pill></td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.topic || '—'}</td>
                        <td>{row.difficulty ? <Pill color={row.difficulty === 'easy' ? 'green' : row.difficulty === 'hard' ? 'amber' : 'blue'}>{row.difficulty}</Pill> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {importCount > 0 ? (
              <button className="btn btn-green" onClick={handleCommit} disabled={committing}>
                {committing ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }} />Importing…</> : `Import ${importCount} Question${importCount !== 1 ? 's' : ''} into Bank`}
              </button>
            ) : <button className="btn" disabled style={{ opacity: 0.5 }}>No valid rows to import</button>}
            {report.stats.error_count > 0 && <button className="btn btn-ghost btn-sm" onClick={handleDownloadErrors}>⬇ Download Errors CSV</button>}
            <button className="btn btn-ghost" onClick={handleReset}>← Back to Upload</button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="bulk-section">
          <div className="bulk-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{result.inserted > 0 ? '✅' : '⚠️'}</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              {result.inserted > 0 ? `${result.inserted} Question${result.inserted !== 1 ? 's' : ''} Added to Bank` : 'No Questions Imported'}
            </h3>
            <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{result.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
              {result.inserted > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#15803d' }}>{result.inserted}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inserted</div></div>}
              {result.skipped > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#b45309' }}>{result.skipped}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Skipped</div></div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button className="btn btn-violet" onClick={handleReset}>Upload Another File</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── ROOT ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stats',     icon: '📊', label: 'Stats'      },
  { id: 'questions', icon: '📝', label: 'Questions'   },
  { id: 'worlds',    icon: '🌍', label: 'Worlds'      },  // K2
  { id: 'bulk',      icon: '📤', label: 'Bulk Upload' },
  { id: 'orgs',      icon: '🏫', label: 'Schools'     },
  { id: 'users',     icon: '👤', label: 'Users'       },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('stats');

  useEffect(() => {
    if (user && user.role !== 'drfahm_admin') navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Question management · School provisioning · User administration</p>
        </div>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 24 }}>
          {tab === 'stats'     && <StatsTab />}
          {tab === 'questions' && <QuestionsTab />}
          {tab === 'worlds'    && <WorldsTab />}
          {tab === 'bulk'      && <BulkUploadTab />}
          {tab === 'orgs'      && <OrgsTab />}
          {tab === 'users'     && <UsersTab />}
        </div>
      </div>
    </>
  );
}