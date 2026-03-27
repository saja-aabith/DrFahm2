import React, { useState, useEffect, useCallback, useRef } from 'react';
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

    /* ── AI review card ── */
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
    /* AI review progress modal log */
    .ai-log {
      max-height: 180px; overflow: auto;
      background: rgba(0,0,0,0.2); border-radius: 6px; padding: 10px;
      font-size: 0.8rem; font-family: monospace; color: var(--text-muted);
    }
    .ai-log-line { margin-bottom: 2px; }
    .ai-log-line.ok   { color: #4ade80; }
    .ai-log-line.fail { color: #f87171; }
  `;
  document.head.appendChild(s);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BULK_CSV_COLUMNS = ['exam','section','question_text','option_a','option_b','option_c','option_d','correct_answer','hint','topic','difficulty'];
const VALID_EXAM_SECTIONS = { qudurat: ['math','verbal'], tahsili: ['math','biology','chemistry','physics'] };

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
  if (!worldKey) return '—';
  const band = parseInt(worldKey.split('_')[1], 10);
  return TIER_LABELS[band] || worldKey;
}

function getSectionFromWorldKey(wk) {
  if (!wk) return null;
  return wk.replace(/_\d+$/, '');
}

const TABLE_COLS = 11;


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

function ReviewProgressPanel({ examFilter, refreshKey }) {
  const [data, setData] = useState(null);
  const [showWorlds, setShowWorlds] = useState(false);

  useEffect(() => {
    adminApi.reviewProgress(examFilter || '').then(setData).catch(() => {});
  }, [examFilter, refreshKey]);

  if (!data) return null;
  const { summary, progress } = data;
  const pct = summary.total > 0 ? Math.round((summary.reviewed / summary.total) * 100) : 0;

  return (
    <div className="review-progress-panel">
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
            const wpct = p.total > 0 ? Math.round((p.reviewed / p.total) * 100) : 0;
            const sectionKey = p.section || p.world_key || '—';
            return (
              <div key={`${p.exam}-${sectionKey}`} className="review-world-row">
                <span className="review-world-label" style={{ textTransform: 'capitalize' }}>{p.exam} / {sectionKey}</span>
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
  if (count < 10) return { bar: '#dc2626', bg: 'rgba(220,38,38,0.12)', text: '#dc2626' };
  if (count < 30) return { bar: '#d97706', bg: 'rgba(217,119,6,0.12)',  text: '#b45309' };
  return               { bar: '#16a34a', bg: 'rgba(22,163,74,0.1)',   text: '#15803d' };
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
    <div className="topic-coverage-panel" style={{ marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📊 Topic Coverage</span>
        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${overallPct}%`, background: overallBarColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
        </div>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {summary.tagged}/{summary.total} tagged ({overallPct}%)
        </span>
        {summary.untagged > 0 && onShowUntagged && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem', padding: '2px 8px', color: '#b45309', borderColor: 'rgba(217,119,6,0.3)' }}
            onClick={(e) => { e.stopPropagation(); onShowUntagged(); }}>
            Show untagged
          </button>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && by_section && (
        <div style={{ marginTop: 14 }}>
          {Object.entries(by_section).map(([sec, secData]) => (
            <div key={sec} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{sec}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{secData.tagged}/{secData.total} tagged</span>
                {secData.untagged > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#b45309' }}>({secData.untagged} question{secData.untagged !== 1 ? 's' : ''} in this section have no topic tag.</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                {secData.topics.map((t) => {
                  const { bar, bg, text } = topicBarColor(t.count);
                  const maxCount = Math.max(...secData.topics.map(tt => tt.count), 1);
                  const pct = Math.round((t.count / maxCount) * 100);
                  return (
                    <div key={t.topic} style={{ padding: '6px 8px', borderRadius: 6, background: bg, border: `1px solid ${bar}33` }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: text, marginBottom: 3 }}>{t.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: bar, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: text, minWidth: 20, textAlign: 'right' }}>{t.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
        <>
          {['a','b','c','d'].map((opt) => (
            <button key={opt}
              className={`inline-answer-btn ${opt === question.correct_answer ? 'current' : ''}`}
              onClick={() => handlePick(opt)}>
              {opt.toUpperCase()}
            </button>
          ))}
          <button className="inline-confirm-btn" onClick={handleConfirmReview} title="Mark reviewed without changing answer">✓ Confirm</button>
        </>
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

  const handlePick = async (diff) => {
    if (diff === (question.difficulty || '')) { setOpen(false); return; }
    setSaving(true);
    try {
      const result = await adminApi.quickUpdate(question.id, 'difficulty', diff || null, question.version);
      onSaved(result.question);
      setOpen(false);
    } catch (e) { alert(e?.error?.message || 'Failed to save difficulty.'); }
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


// ── AI REVIEW CARD (shown inside ExpandedQuestionRow) — K1 updated ────────────

function AIReviewCard({ question, onUpdated }) {
  const [approving,     setApproving]     = useState(false);
  const [rejecting,     setRejecting]     = useState(false);
  const [editMode,      setEditMode]      = useState(false);
  const [overrideAnswer, setOverrideAnswer] = useState('');
  const [acceptHint,    setAcceptHint]    = useState(true);
  // K1 — topic
  const [acceptTopic,   setAcceptTopic]   = useState(true);
  const [overrideTopic, setOverrideTopic] = useState('');  // '' = use predicted
  const [sectionTopics, setSectionTopics] = useState([]);  // [{key, label}]

  const status     = question.review_status;
  const confidence = question.llm_confidence;

  // Fetch topic list for this question's section on mount
  useEffect(() => {
    if (!question.section) return;
    adminApi.getTopics(question.section)
      .then(data => setSectionTopics(data?.taxonomy?.[question.section] || []))
      .catch(() => setSectionTopics([]));
  }, [question.section]);

  // Confidence colour: high ≥85%, medium 65–84%, low <65%
  const confColor = confidence >= 0.85 ? '#16a34a' : confidence >= 0.65 ? '#d97706' : '#dc2626';
  const confLabel = confidence >= 0.85 ? 'High'   : confidence >= 0.65 ? 'Medium'  : 'Low';
  const confPill  = confidence >= 0.85 ? 'green'  : confidence >= 0.65 ? 'amber'   : 'red';

  const cardClass = status === 'rejected' ? 'ai-review-card rejected'
                  : status === 'approved' ? 'ai-review-card approved'
                  : 'ai-review-card';

  const isReadOnly = status === 'approved';

  const handleApprove = async () => {
    setApproving(true);
    try {
      const body = {
        version:       question.version,
        accept_answer: true,
        accept_hint:   acceptHint,
        accept_topic:  acceptTopic,   // K1
      };
      if (editMode && overrideAnswer)  body.correct_answer = overrideAnswer;
      if (acceptTopic && overrideTopic) body.topic = overrideTopic;  // K1 override
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

  // Don't render if no AI data at all
  if (!question.llm_predicted_answer && !question.llm_review_note && !question.llm_proposed_hint && !question.llm_predicted_topic) return null;

  // Resolved topic for display
  const resolvedTopicKey   = overrideTopic || question.llm_predicted_topic;
  const resolvedTopicLabel = sectionTopics.find(t => t.key === resolvedTopicKey)?.label || resolvedTopicKey;

  return (
    <div className={cardClass}>
      {/* ── Header ── */}
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

      {/* ── Predicted answer + confidence ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Predicted Answer</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="ai-review-predicted">{question.llm_predicted_answer?.toUpperCase() || '?'}</div>
            {confidence != null && (
              <div style={{ fontSize: '0.8rem' }}>
                <Pill color={confPill}>{confLabel} — {Math.round(confidence * 100)}%</Pill>
              </div>
            )}
          </div>
        </div>

        {/* Edit mode: pick a different answer */}
        {!isReadOnly && editMode && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Override Answer</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['a','b','c','d'].map(letter => (
                <button
                  key={letter}
                  className={`ai-override-btn ${overrideAnswer === letter ? 'selected' : ''}`}
                  onClick={() => setOverrideAnswer(prev => prev === letter ? '' : letter)}
                >
                  {letter.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Admin note (internal only) ── */}
      {question.llm_review_note && (
        <div className="ai-review-note" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>🔒 Admin Note (internal)</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{question.llm_review_note}</div>
        </div>
      )}

      {/* ── Proposed hint ── */}
      {question.llm_proposed_hint && (
        <div className="ai-review-hint" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>💡 Proposed Hint</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{question.llm_proposed_hint}</div>
          {!isReadOnly && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={acceptHint} onChange={e => setAcceptHint(e.target.checked)} />
              Accept hint on approval
            </label>
          )}
        </div>
      )}

      {/* ── K1: Predicted topic ── */}
      {(question.llm_predicted_topic || sectionTopics.length > 0) && (
        <div style={{
          padding: '10px 12px', borderRadius: 6, marginBottom: 10,
          background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
            🏷️ Predicted Topic
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (!isReadOnly && sectionTopics.length > 0) ? 8 : 0 }}>
            {resolvedTopicKey
              ? <Pill color="cyan">{resolvedTopicLabel}</Pill>
              : <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None predicted</span>
            }
            {overrideTopic && overrideTopic !== question.llm_predicted_topic && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(overridden)</span>
            )}
          </div>

          {!isReadOnly && sectionTopics.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={overrideTopic || question.llm_predicted_topic || ''}
                onChange={e => {
                  const val = e.target.value;
                  setOverrideTopic(val === question.llm_predicted_topic ? '' : val);
                }}
                style={{
                  fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                {!question.llm_predicted_topic && <option value="">— select topic —</option>}
                {sectionTopics.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={acceptTopic}
                  onChange={e => setAcceptTopic(e.target.checked)}
                />
                Accept topic on approval
              </label>
            </div>
          )}
        </div>
      )}

      {/* ── Action buttons ── */}
      {!isReadOnly && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <button className="ai-review-btn approve" onClick={handleApprove} disabled={approving || rejecting}>
            {approving ? '…' : '✓ Approve'}
          </button>
          <button
            className={`ai-review-btn edit ${editMode ? 'active' : ''}`}
            onClick={() => { setEditMode(m => !m); setOverrideAnswer(''); }}
            disabled={approving || rejecting}
          >
            ✏ Edit & Approve
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
                  <MathText text={question[`option_${opt}`]} />
                  {isCorrect && <span className="expanded-correct-badge">✓ Correct</span>}
                </div>
              );
            })}
          </div>

          <div className="expanded-meta">
            {question.hint && (
              <div className="expanded-hint">
                <span className="expanded-hint-label">💡 Hint:</span>
                <MathText text={question.hint} />
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {topicLabel && <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Topic: <strong>{topicLabel}</strong></span>}
              {question.difficulty && <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Difficulty: <strong style={{ textTransform: 'capitalize' }}>{question.difficulty}</strong></span>}
              {question.qid && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>QID: {question.qid}</span>}
              {question.review_status && (
                <span style={{ fontSize: '0.83rem' }}>
                  <Pill color={
                    question.review_status === 'approved'    ? 'green'  :
                    question.review_status === 'rejected'    ? 'red'    :
                    question.review_status === 'ai_reviewed' ? 'violet' : 'gray'
                  }>{question.review_status}</Pill>
                </span>
              )}
            </div>
          </div>

          {/* AI review card — shows for ai_reviewed, rejected, and approved (approved = read-only view) */}
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
          result.failed > 0 ? 'fail' : 'ok'
        );
        if (i < batches.length - 1) await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        addLog(`  ✗  Batch ${i + 1} error: ${e?.error?.message || String(e)}`, 'fail');
        totalFailed += batch.length;
        setSummary(s => ({ ...s, failed: totalFailed }));
      }
    }

    setRunning(false);
    setDone(true);
  };

  const progressPct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <Modal title={`🤖 AI Review — ${total} question${total !== 1 ? 's' : ''}`} onClose={running ? undefined : onClose} width="520px">
      {!running && !done && (
        <>
          <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            GPT-4o-mini will analyse each question and propose: predicted answer, confidence, hint, and (K1) topic.
            Nothing is applied until you approve each question individually.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
            Re-review already-approved questions (overwrite)
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-violet" onClick={runReview}>▶ Start Review</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}

      {running && (
        <>
          <div style={{ marginBottom: 10, fontSize: '0.88rem', color: 'var(--text-muted)' }}>{progress}/{total} questions processed ({progressPct}%)</div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#7c3aed', borderRadius: 4, transition: 'width 0.3s ease' }} />
          </div>
          <div className="ai-log">
            {log.map((l, i) => <div key={i} className={`ai-log-line ${l.cls}`}>{l.line}</div>)}
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { cancelRef.current = true; }}>Cancel</button>
          </div>
        </>
      )}

      {done && (
        <>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-primary)' }}>AI Review Complete</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 10 }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#15803d' }}>{summary.processed}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Reviewed</div></div>
              {summary.failed > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#dc2626' }}>{summary.failed}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Failed</div></div>}
              {summary.skipped > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#b45309' }}>{summary.skipped}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Skipped</div></div>}
            </div>
          </div>
          <div className="ai-log" style={{ marginBottom: 16 }}>
            {log.map((l, i) => <div key={i} className={`ai-log-line ${l.cls}`}>{l.line}</div>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-violet" onClick={() => onDone(summary)}>Done — Show Results</button>
          </div>
        </>
      )}
    </Modal>
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
          This action is reversible from the database but not from this panel.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.35)' }} onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting…' : `Delete ${count} Question${count !== 1 ? 's' : ''}`}
        </button>
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
      </div>
    </Modal>
  );
}


// ── EDIT QUESTION MODAL ───────────────────────────────────────────────────────

function EditQuestionModal({ question, taxonomy, onSave, onClose }) {
  const section = question?.section || getSectionFromWorldKey(question?.world_key);
  const topicOptions = (taxonomy && section && taxonomy[section]) || [];

  const [form, setForm] = useState({
    question_text:  question?.question_text  || '',
    option_a:       question?.option_a       || '',
    option_b:       question?.option_b       || '',
    option_c:       question?.option_c       || '',
    option_d:       question?.option_d       || '',
    correct_answer: question?.correct_answer || 'a',
    hint:           question?.hint           || '',
    topic:          question?.topic          || '',
    difficulty:     question?.difficulty     || '',
    is_active:      question?.is_active      ?? false,
    image_url:      question?.image_url      || '',
    version:        question?.version        ?? 1,
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBool = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={question ? `Edit Question #${question.id}` : 'Create Question'} onClose={onClose}>
      <div className="form-group">
        <label className="form-label">Question Text</label>
        <textarea className="form-input" rows={3} value={form.question_text} onChange={set('question_text')} />
        <LaTeXCheatsheet />
      </div>
      {['a','b','c','d'].map(opt => (
        <div className="form-group" key={opt} style={{ marginTop: 8 }}>
          <label className="form-label">Option {opt.toUpperCase()}</label>
          <input className="form-input" value={form[`option_${opt}`]} onChange={set(`option_${opt}`)} />
        </div>
      ))}
      <div className="form-group" style={{ marginTop: 8 }}>
        <label className="form-label">Correct Answer</label>
        <select className="form-input" value={form.correct_answer} onChange={set('correct_answer')}>
          {['a','b','c','d'].map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label className="form-label">Hint (shown after wrong answer)</label>
        <textarea className="form-input" rows={2} value={form.hint} onChange={set('hint')} />
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label className="form-label">Topic</label>
        <select className="form-input" value={form.topic} onChange={set('topic')}>
          <option value="">— None —</option>
          {topicOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label className="form-label">Difficulty</label>
        <select className="form-input" value={form.difficulty} onChange={set('difficulty')}>
          <option value="">— None —</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={form.is_active} onChange={setBool('is_active')} />
          Active (visible to students)
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="form-label">Image</label>
        <ImageUpload value={form.image_url} onChange={(url) => setForm(f => ({ ...f, image_url: url }))} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-violet" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}


// ── CREATE ADMIN MODAL ────────────────────────────────────────────────────────

function CreateAdminModal({ onSave, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ username, password: password || undefined }); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create Admin User" onClose={onClose} width="400px">
      <div className="form-group">
        <label className="form-label">Username</label>
        <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin_username" />
      </div>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Password (optional — auto-generated if blank)</label>
        <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-violet" onClick={handleSave} disabled={saving || !username}>{saving ? 'Creating…' : 'Create Admin'}</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}


// ── BULK UPLOAD TAB ───────────────────────────────────────────────────────────

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
    catch (e) { showFlash(e?.error?.message || 'Commit failed.', 'error'); }
    finally { setCommitting(false); }
  };

  const handleReset = () => { setFile(null); setReport(null); setResult(null); setStep(1); setForceDupes(false); };

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {['Upload', 'Validate', 'Commit'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: step === i+1 ? 'rgba(124,58,237,0.12)' : 'transparent', border: step === i+1 ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: step > i ? '#7c3aed' : step === i+1 ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)', color: step > i ? '#fff' : 'var(--text-muted)' }}>{step > i ? '✓' : i+1}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: step === i+1 ? 700 : 400, color: step === i+1 ? 'var(--violet-light)' : 'var(--text-muted)' }}>{label}</span>
            </div>
            {i < 2 && <span style={{ color: 'var(--border)', padding: '0 4px' }}>›</span>}
          </div>
        ))}
      </div>

      {step < 3 && (
        <div style={{ marginBottom: 20 }}>
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
              <div><strong style={{ color: 'var(--text-secondary)' }}>hint</strong> — shown after wrong answer (optional)</div>
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
                {validating ? '⏳ Validating…' : '→ Validate CSV'}
              </button>
              <button className="btn btn-ghost" onClick={handleDownloadTemplate}>⬇ Download Template</button>
            </div>
          )}
          {!file && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleDownloadTemplate}>⬇ Download Template CSV</button>
            </div>
          )}
        </div>
      )}

      {step === 2 && report && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>{report.stats?.valid_count}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valid</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.5rem', fontWeight: 700, color: report.stats?.error_count > 0 ? '#dc2626' : 'var(--text-muted)' }}>{report.stats?.error_count}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Errors</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b45309' }}>{report.stats?.duplicate_count}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duplicates</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{report.stats?.total_rows}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Rows</div></div>
          </div>
          {report.errors?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>⚠ Validation Errors</span>
                <button className="btn btn-ghost btn-sm" onClick={handleDownloadErrors}>⬇ Download Errors CSV</button>
              </div>
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {report.errors.slice(0, 20).map((e, i) => (
                  <div key={i} style={{ fontSize: '0.83rem', padding: '4px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    Row {e.row} · <strong>{e.field}</strong>: {e.message}
                  </div>
                ))}
                {report.errors.length > 20 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>… and {report.errors.length - 20} more (download CSV for full list)</div>}
              </div>
            </div>
          )}
          {report.duplicates?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 6 }}>⚠ {report.duplicates.length} Duplicate(s) Detected</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={forceDupes} onChange={e => setForceDupes(e.target.checked)} />
                Insert duplicates anyway
              </label>
            </div>
          )}
          {report.stats?.error_count === 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-green" onClick={handleCommit} disabled={committing}>
                {committing ? '⏳ Importing…' : `✓ Import ${report.stats?.valid_count} Question${report.stats?.valid_count !== 1 ? 's' : ''}`}
              </button>
              <button className="btn btn-ghost" onClick={handleReset}>✕ Cancel</button>
            </div>
          )}
          {report.stats?.error_count > 0 && (
            <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>Fix the {report.stats.error_count} error(s) above and re-upload to proceed.</p>
          )}
        </div>
      )}

      {step === 3 && result && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
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
      )}
    </div>
  );
}


// ── STATS TAB ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => { adminApi.getStats().then(setStats).catch(() => {}); }, []);

  if (!stats) return <div className="admin-loading"><div className="spinner" /></div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
      {[
        { label: 'Total Questions', val: stats.questions?.total || 0 },
        { label: 'Active Questions', val: stats.questions?.active || 0 },
        { label: 'Unassigned Questions', val: stats.questions?.unassigned || 0 },
        { label: 'Students', val: stats.users?.students || 0 },
        { label: 'Organisations', val: stats.orgs?.total || 0 },
        { label: 'Active Entitlements', val: stats.entitlements?.active || 0 },
      ].map((s) => (
        <div key={s.label} className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.val.toLocaleString()}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.label}</div>
        </div>
      ))}
      {stats.questions?.per_exam && Object.entries(stats.questions.per_exam).map(([exam, count]) => (
        <div key={exam} className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{count.toLocaleString()}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{exam} Questions</div>
        </div>
      ))}
    </div>
  );
}


// ── ORGS TAB ──────────────────────────────────────────────────────────────────

function OrgDetailModal({ orgId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [flash, showFlash]  = useFlash();

  useEffect(() => {
    adminApi.getOrg(orgId).then(setDetail).catch(() => showFlash('Failed to load org.', 'error'));
  }, [orgId, showFlash]);

  if (!detail) return (
    <Modal title="Org Details" onClose={onClose}>
      <div className="admin-loading"><div className="spinner" /></div>
    </Modal>
  );

  return (
    <Modal title={detail.org.name} onClose={onClose}>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 12 }}>{flash.msg}</div>}
      <div className="admin-detail-row"><span>Slug</span><span>{detail.org.slug}</span></div>
      <div className="admin-detail-row"><span>Leader</span><span>{detail.leader?.username || '—'}</span></div>
      <div className="admin-detail-row"><span>Students</span><span>{detail.students?.length || 0}</span></div>
      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Students</h4>
      {detail.students?.length > 0
        ? <div style={{ maxHeight: 200, overflow: 'auto' }}>{detail.students.map((s) => <div key={s.id} style={{ fontSize: '0.85rem', padding: '2px 0' }}>{s.username}</div>)}</div>
        : <p style={{ color: 'var(--text-muted)' }}>No students yet.</p>}
      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Entitlements</h4>
      {detail.entitlements?.length > 0
        ? detail.entitlements.map((e) => (
            <div key={e.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{e.exam} — {e.plan_id}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Expires: {new Date(e.entitlement_expires_at).toLocaleDateString()}</div>
            </div>
          ))
        : <p style={{ color: 'var(--text-muted)' }}>No entitlements.</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function OrgsTab() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash, showFlash] = useFlash();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', estimated_student_count: '' });

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    adminApi.listOrgs({ per_page: 100 })
      .then((d) => setOrgs(d.orgs))
      .catch(() => showFlash('Failed to load orgs.', 'error'))
      .finally(() => setLoading(false));
  }, [showFlash]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleCreate = async () => {
    try {
      await adminApi.createOrg({
        name: createForm.name,
        slug: createForm.slug,
        estimated_student_count: createForm.estimated_student_count ? parseInt(createForm.estimated_student_count) : null,
      });
      showFlash('Org created.');
      setCreating(false);
      setCreateForm({ name: '', slug: '', estimated_student_count: '' });
      fetchOrgs();
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  if (loading) return <div className="admin-loading"><div className="spinner" /></div>;

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-green btn-sm" onClick={() => setCreating(true)}>+ New Org</button>
      </div>
      {creating && (
        <Modal title="Create Organisation" onClose={() => setCreating(false)} width="440px">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="King Abdulaziz School" />
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Slug (URL-safe)</label>
            <input className="form-input" value={createForm.slug} onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value }))} placeholder="ka_school" />
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Estimated Students (optional)</label>
            <input className="form-input" type="number" value={createForm.estimated_student_count} onChange={e => setCreateForm(f => ({ ...f, estimated_student_count: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-green" onClick={handleCreate} disabled={!createForm.name || !createForm.slug}>Create</button>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </Modal>
      )}
      {selected && <OrgDetailModal orgId={selected} onClose={() => setSelected(null)} />}
      {orgs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No organisations yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Name</th><th>Slug</th><th>Est. Students</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td style={{ fontWeight: 600 }}>{o.name}</td>
                  <td><code>{o.slug}</code></td>
                  <td>{o.estimated_student_count ?? '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td><button className="admin-action-btn" onClick={() => setSelected(o.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [flash, showFlash]    = useFlash();
  const [creating, setCreating] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef(null);

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

  const handleCreateAdmin = async (data) => {
    try {
      const result = await adminApi.createUser(data);
      showFlash(`Admin ${result.user.username} created. Password: ${result.password}`);
      setCreating(false);
      fetchUsers();
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      {creating && <CreateAdminModal onSave={handleCreateAdmin} onClose={() => setCreating(false)} />}
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
                      <button className="admin-action-btn" onClick={() => handleToggleActive(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button className="admin-action-btn" onClick={() => handleResetPassword(u)}>Reset PW</button>
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
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Page {page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}


// ── QUESTIONS TAB ─────────────────────────────────────────────────────────────

function QuestionsTab() {
  const [questions,         setQuestions]         = useState([]);
  const [total,             setTotal]             = useState(0);
  const [page,              setPage]              = useState(1);
  const [loading,           setLoading]           = useState(true);
  const [expanded,          setExpanded]          = useState(new Set());
  const [editing,           setEditing]           = useState(null);
  const [taxonomy,          setTaxonomy]          = useState(null);
  const [flash,             showFlash]            = useFlash();
  const [refreshKey,        setRefreshKey]        = useState(0);
  const [searchInput,       setSearchInput]       = useState('');
  const [selectedIds,       setSelectedIds]       = useState(new Set());
  const [selectAllLoading,  setSelectAllLoading]  = useState(false);
  const [bulkAssignOpen,    setBulkAssignOpen]    = useState(false);
  const [bulkDeleteOpen,    setBulkDeleteOpen]    = useState(false);
  const [bulkOpLoading,     setBulkOpLoading]     = useState(false);
  const [aiReviewOpen,      setAiReviewOpen]      = useState(false);
  const searchTimeout = useRef(null);

  const [filters, setFilters] = useState({
    exam:          'qudurat',
    section:       'math',
    world_key:     '',
    topic:         '',
    difficulty:    '',
    is_active:     '',
    unassigned:    '',
    review_status: '',
    search:        '',
  });

  useEffect(() => {
    adminApi.getTopics().then(d => setTaxonomy(d.taxonomy)).catch(() => {});
  }, []);

  const examConfig    = SECTION_CONFIG[filters.exam];
  const sectionConfig = examConfig?.sections?.[filters.section];
  const worldOptions  = sectionConfig?.worlds || [];
  const topicOptions  = filters.section && taxonomy && taxonomy[filters.section]
    ? taxonomy[filters.section]
    : (taxonomy ? Object.entries(taxonomy).flatMap(([, topics]) => topics) : []);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    adminApi.listQuestions({ ...filters, page, per_page: 50 })
      .then((d) => { setQuestions(d.questions); setTotal(d.total); })
      .catch(() => showFlash('Failed to load questions.', 'error'))
      .finally(() => setLoading(false));
  }, [filters, page, showFlash]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleExamChange = (exam) => {
    const firstSection = Object.keys(SECTION_CONFIG[exam].sections)[0];
    setFilters((f) => ({ ...f, exam, section: firstSection, world_key: '', topic: '' }));
    setPage(1); setExpanded(new Set()); clearSelection();
  };

  const handleFilterChange = (k, v) => {
    const updates = { [k]: v };
    if (k === 'world_key') updates.topic = '';
    setFilters((f) => ({ ...f, ...updates }));
    setPage(1); setExpanded(new Set()); clearSelection();
  };

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setFilters((f) => ({ ...f, search: val })); setPage(1); }, 400);
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const clearSelection = () => setSelectedIds(new Set());
  const toggleSelectRow = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const pageIds = questions.map(q => q.id);
  const allPageSelected  = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const somePageSelected = pageIds.some(id => selectedIds.has(id));
  const toggleSelectAllPage = () => {
    if (allPageSelected) { setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n; }); }
    else                 { setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n; }); }
  };
  const handleSelectAllMatching = async () => {
    setSelectAllLoading(true);
    try {
      const data = await adminApi.listQuestions({ ...filters, page: 1, per_page: 2000 });
      setSelectedIds(new Set(data.questions.map(q => q.id)));
    } catch (e) { showFlash(e?.error?.message || 'Failed to select all.', 'error'); }
    finally { setSelectAllLoading(false); }
  };

  // ── Inline save handler ────────────────────────────────────────────────────
  const handleInlineSaved = (updatedQuestion) => {
    setQuestions((prev) => prev.map((q) => q.id === updatedQuestion.id ? updatedQuestion : q));
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

  const toggleExpanded = (id) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // ── Bulk handlers ──────────────────────────────────────────────────────────
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
      showFlash(`${result.affected} question(s) updated.${skippedMsg}`);
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

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}

      <ReviewProgressPanel examFilter={filters.exam} refreshKey={refreshKey} />
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
              border: filters.section === secKey ? '1px solid rgba(34,211,238,0.3)' : '1px solid transparent',
            }}
            onClick={() => handleFilterChange('section', secKey)}>
            {secCfg.label}
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="admin-filter-row" style={{ marginBottom: 12 }}>
        <select className="form-input" style={{ width: 'auto' }} value={filters.world_key} onChange={(e) => handleFilterChange('world_key', e.target.value)}>
          <option value="">All worlds</option>
          {worldOptions.map((w) => <option key={w} value={w}>{worldDisplayName(w)}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.topic} onChange={(e) => handleFilterChange('topic', e.target.value)}>
          <option value="">All topics</option>
          {topicOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.difficulty} onChange={(e) => handleFilterChange('difficulty', e.target.value)}>
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.is_active} onChange={(e) => handleFilterChange('is_active', e.target.value)}>
          <option value="">Active + Inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.unassigned} onChange={(e) => handleFilterChange('unassigned', e.target.value)}>
          <option value="">All assignment</option>
          <option value="true">Unassigned only</option>
          <option value="false">Assigned only</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.review_status} onChange={(e) => handleFilterChange('review_status', e.target.value)}>
          <option value="">All review status</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="ai_pending">AI Pending</option>
          <option value="ai_reviewed">AI Reviewed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input className="form-input" style={{ width: 'auto', minWidth: 180 }} placeholder="Search question…" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginLeft: 'auto' }}>{total} question{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Bulk selection action bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 10, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--violet-light)', fontSize: '0.9rem' }}>{selectedIds.size} selected</span>
          {selectedIds.size < total && (
            <button className="btn btn-ghost btn-sm" onClick={handleSelectAllMatching} disabled={selectAllLoading}>
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
                        <button className="admin-action-btn" onClick={() => handleToggle(q)} title={q.is_active ? 'Deactivate' : 'Activate'}>{q.is_active ? '⏸' : '▶'}</button>
                        <button className="admin-action-btn danger" onClick={() => handleDelete(q)} title="Delete">🗑</button>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="admin-pagination">
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Page {page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* Modals */}
      {editing && (
        <EditQuestionModal question={editing} taxonomy={taxonomy} onSave={handleSaveEdit} onClose={() => setEditing(null)} />
      )}
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
    </div>
  );
}


// ── ROOT ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stats',     icon: '📊', label: 'Stats'      },
  { id: 'questions', icon: '📝', label: 'Questions'   },
  { id: 'bulk',      icon: '📤', label: 'Bulk Upload' },
  { id: 'orgs',      icon: '🏫', label: 'Orgs'        },
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
          <p className="page-subtitle">Question management · Org provisioning · User administration</p>
        </div>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 24 }}>
          {tab === 'stats'     && <StatsTab />}
          {tab === 'questions' && <QuestionsTab />}
          {tab === 'bulk'      && <BulkUploadTab />}
          {tab === 'orgs'      && <OrgsTab />}
          {tab === 'users'     && <UsersTab />}
        </div>
      </div>
    </>
  );
}