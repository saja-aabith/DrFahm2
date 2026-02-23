import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import ImageUpload from '../components/ImageUpload';
import LaTeXCheatsheet from '../components/LaTeXCheatsheet';
import * as adminApi from '../api/admin';

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMS = ['qudurat', 'tahsili'];
const WORLD_KEYS = {
  qudurat: ['math_100','math_150','math_200','math_250','math_300','verbal_100','verbal_150','verbal_200','verbal_250','verbal_300'],
  tahsili: ['math_100','math_150','math_200','math_250','biology_100','biology_150','chemistry_100','chemistry_150','physics_100','physics_150'],
};

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
    green: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
    amber: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    violet: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
    gray: { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
    blue: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
    cyan: { bg: 'rgba(34,211,238,0.12)', text: '#22d3ee', border: 'rgba(34,211,238,0.25)' },
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
    <div className="admin-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" style={width ? { maxWidth: width } : {}}>
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">{title}</h3>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
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
            return (
              <div key={`${p.exam}-${p.world_key}`} className="review-world-row">
                <span className="review-world-label">{p.exam} / {p.world_key}</span>
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

function TopicCoveragePanel({ examFilter, refreshKey }) {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    adminApi.topicCoverage({ exam: examFilter || '' }).then(setData).catch(() => {});
  }, [examFilter, refreshKey]);

  if (!data) return null;
  const { summary, coverage } = data;
  const taggedPct = summary.total > 0 ? Math.round((summary.tagged / summary.total) * 100) : 0;

  // Group by section
  const bySection = {};
  coverage.forEach((c) => {
    const sec = c.section || 'other';
    if (!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(c);
  });

  return (
    <div className="topic-coverage-panel">
      <div className="topic-coverage-header">
        <div>
          <span className="topic-coverage-title">Topic Coverage</span>
          <span className="topic-coverage-stats">
            {summary.tagged} tagged · {summary.untagged} untagged · {taggedPct}%
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'Details'}
        </button>
      </div>
      <div className="review-progress-bar-bg" style={{ marginTop: 6 }}>
        <div className="review-progress-bar-fill" style={{ width: `${taggedPct}%`, background: 'var(--cyan, #22d3ee)' }} />
      </div>
      {expanded && (
        <div className="topic-coverage-details">
          {Object.entries(bySection).map(([section, topics]) => (
            <div key={section} className="topic-section-group">
              <div className="topic-section-label">{section}</div>
              <div className="topic-section-items">
                {topics.map((t) => (
                  <div key={t.topic} className="topic-item">
                    <Pill color="cyan">{t.label}</Pill>
                    <span className="topic-item-count">{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {summary.untagged > 0 && (
            <div className="topic-section-group">
              <div className="topic-section-label" style={{ color: 'var(--amber, #fbbf24)' }}>Untagged</div>
              <span className="topic-item-count">{summary.untagged} questions</span>
            </div>
          )}
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

  if (!open) {
    return (
      <Pill color={question.correct_answer === 'a' ? 'amber' : 'green'} onClick={() => setOpen(true)} title="Click to change correct answer" style={{ cursor: 'pointer' }}>
        {question.correct_answer?.toUpperCase() || '?'}
      </Pill>
    );
  }

  return (
    <div ref={ref} className="inline-answer-picker">
      {saving ? <span className="inline-answer-saving">…</span> : (
        ['a', 'b', 'c', 'd'].map((opt) => (
          <button key={opt} className={`inline-answer-btn ${opt === question.correct_answer ? 'active' : ''}`}
            onClick={() => handlePick(opt)} title={`Set correct answer to ${opt.toUpperCase()}`}>
            {opt.toUpperCase()}
          </button>
        ))
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
        style={{ color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px dashed rgba(255,255,255,0.1)' }}>
        —
      </span>
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

  const section = getSectionFromWorldKey(question.world_key);
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
        style={{ color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, border: '1px dashed rgba(255,255,255,0.1)' }}>
        —
      </span>
    );
  }

  return (
    <div ref={ref} className="inline-topic-picker">
      {saving ? <span className="inline-answer-saving">…</span> : (
        <div className="inline-topic-dropdown">
          {topics.length === 0 && (
            <div className="inline-topic-empty">No topics for this section</div>
          )}
          {topics.map((t) => (
            <button key={t.key}
              className={`inline-topic-btn ${t.key === question.topic ? 'active' : ''}`}
              onClick={() => handlePick(t.key)}>
              {t.label}
            </button>
          ))}
          {question.topic && (
            <button className="inline-topic-btn clear" onClick={() => handlePick('')}>
              ✕ Clear topic
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ── EXPANDED QUESTION ROW ─────────────────────────────────────────────────────

function ExpandedQuestionRow({ question, colSpan, taxonomy }) {
  const section = getSectionFromWorldKey(question.world_key);
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
                  <span className="expanded-option-text">
                    <MathText text={question[`option_${opt}`]} />
                  </span>
                  {isCorrect && <span className="expanded-correct-badge">✓ Correct</span>}
                </div>
              );
            })}
          </div>

          <div className="expanded-meta-row">
            {topicLabel && (
              <span className="expanded-meta-item">
                <span style={{ color: 'var(--text-muted)' }}>Topic:</span>{' '}
                <Pill color="cyan">{topicLabel}</Pill>
              </span>
            )}
            {question.difficulty && (
              <span className="expanded-meta-item">
                <span style={{ color: 'var(--text-muted)' }}>Difficulty:</span>{' '}
                <Pill color={question.difficulty === 'easy' ? 'green' : 'amber'}>{question.difficulty}</Pill>
              </span>
            )}
            <span className="expanded-meta-item">
              <span style={{ color: 'var(--text-muted)' }}>ID:</span>{' '}
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{question.id}</span>
            </span>
            <span className="expanded-meta-item">
              <span style={{ color: 'var(--text-muted)' }}>Version:</span>{' '}
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>v{question.version}</span>
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}


// ── QUESTIONS TAB ─────────────────────────────────────────────────────────────

function QuestionsTab() {
  const [questions, setQuestions]   = useState([]);
  const [total,     setTotal]       = useState(0);
  const [page,      setPage]        = useState(1);
  const [loading,   setLoading]     = useState(false);
  const [editing,   setEditing]     = useState(null);
  const [flash,     showFlash]      = useFlash();
  const [filters,   setFilters]     = useState({ exam: '', world_key: '', is_active: '', difficulty: '', topic: '', search: '' });
  const [creating,  setCreating]    = useState(false);
  const [expanded,  setExpanded]    = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [taxonomy,  setTaxonomy]    = useState(null);
  const [bulkTopicOpen, setBulkTopicOpen] = useState(false);

  // Load taxonomy on mount
  useEffect(() => {
    adminApi.getTopics().then((d) => setTaxonomy(d.taxonomy)).catch(() => {});
  }, []);

  const worldOptions = filters.exam ? WORLD_KEYS[filters.exam] || [] : [];

  // Build topic options based on current filter context
  const currentSection = filters.world_key
    ? getSectionFromWorldKey(filters.world_key)
    : (filters.exam ? null : null);
  const topicOptions = currentSection && taxonomy && taxonomy[currentSection]
    ? taxonomy[currentSection]
    : (taxonomy ? Object.entries(taxonomy).flatMap(([, topics]) => topics) : []);

  // Debounced search
  const searchTimeout = useRef(null);
  const [searchInput, setSearchInput] = useState('');

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: val }));
      setPage(1);
    }, 400);
  };

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    adminApi.listQuestions({ ...filters, page, per_page: 50 })
      .then((d) => { setQuestions(d.questions); setTotal(d.total); })
      .catch(() => showFlash('Failed to load questions.', 'error'))
      .finally(() => setLoading(false));
  }, [filters, page, showFlash]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleFilterChange = (k, v) => {
    const updates = { [k]: v };
    if (k === 'exam') { updates.world_key = ''; updates.topic = ''; }
    if (k === 'world_key') { updates.topic = ''; }
    setFilters((f) => ({ ...f, ...updates }));
    setPage(1);
    setExpanded(new Set());
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
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [bulkLoading, setBulkLoading] = useState(false);

  const handleBulkActivate = async (is_active) => {
    const scope = filters.exam
      ? (filters.world_key ? `world ${filters.world_key}` : `exam ${filters.exam}`)
      : 'ALL questions';
    const action = is_active ? 'activate' : 'deactivate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} all ${scope}? This affects every matching question.`)) return;
    setBulkLoading(true);
    try {
      const result = await adminApi.bulkActivate({ is_active, exam: filters.exam || undefined, world_key: filters.world_key || undefined });
      showFlash(`${result.affected} question(s) ${is_active ? 'activated' : 'deactivated'}.`);
      fetchQuestions();
    } catch (e) { showFlash(e?.error?.message || 'Bulk action failed.', 'error'); }
    finally { setBulkLoading(false); }
  };

  const handleBulkTopic = async (topicKey) => {
    const scope = filters.exam
      ? (filters.world_key ? `world ${filters.world_key}` : `exam ${filters.exam}`)
      : 'ALL questions';
    const label = topicKey
      ? (topicOptions.find(t => t.key === topicKey)?.label || topicKey)
      : 'none';
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
  const TABLE_COLS = 10;

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}

      <ReviewProgressPanel examFilter={filters.exam} refreshKey={refreshKey} />
      <TopicCoveragePanel examFilter={filters.exam} refreshKey={refreshKey} />

      {/* Filters */}
      <div className="admin-filter-row">
        <input className="form-input" style={{ width: 'auto', minWidth: 220 }} placeholder="Search question text…"
          value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        <select className="form-input" style={{ width: 'auto', minWidth: 140 }} value={filters.exam} onChange={(e) => handleFilterChange('exam', e.target.value)}>
          <option value="">All exams</option>
          {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto', minWidth: 160 }} value={filters.world_key} onChange={(e) => handleFilterChange('world_key', e.target.value)} disabled={!filters.exam}>
          <option value="">All worlds</option>
          {worldOptions.map((w) => <option key={w} value={w}>{w}</option>)}
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
        <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginLeft: 'auto' }}>{total} question{total !== 1 ? 's' : ''}</span>
        <button className="btn btn-green btn-sm" onClick={() => setCreating(true)} style={{ marginLeft: 8 }}>+ Add Question</button>
      </div>

      {/* Bulk actions */}
      <div className="admin-bulk-bar">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Bulk actions
          {filters.exam && <strong style={{ color: 'var(--text-secondary)' }}> · {filters.exam}{filters.world_key ? ` / ${filters.world_key}` : ' (all worlds)'}</strong>}
          {!filters.exam && <strong style={{ color: 'var(--amber)' }}> · ALL exams</strong>}
          {' '}({total} questions)
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-green" onClick={() => handleBulkActivate(true)} disabled={bulkLoading || total === 0}>
            {bulkLoading ? '…' : 'Activate all'}
          </button>
          <button className="btn btn-sm btn-ghost" style={{ borderColor: 'rgba(220,38,38,0.3)', color: '#fca5a5' }} onClick={() => handleBulkActivate(false)} disabled={bulkLoading || total === 0}>
            {bulkLoading ? '…' : 'Deactivate all'}
          </button>
          <button className="btn btn-sm" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}
            onClick={() => setBulkTopicOpen(!bulkTopicOpen)} disabled={total === 0}>
            Bulk topic
          </button>
        </div>
      </div>

      {/* Bulk topic selector */}
      {bulkTopicOpen && (
        <div className="bulk-topic-panel">
          <div className="bulk-topic-label">Set topic for all {total} matching questions:</div>
          <div className="bulk-topic-grid">
            {topicOptions.map((t) => (
              <button key={t.key} className="bulk-topic-btn" onClick={() => handleBulkTopic(t.key)} disabled={bulkLoading}>
                {t.label}
              </button>
            ))}
            <button className="bulk-topic-btn clear" onClick={() => handleBulkTopic('')} disabled={bulkLoading}>
              ✕ Clear all topics
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Exam</th><th>World</th><th>Idx</th><th>Question</th><th>Answer</th><th>Topic</th><th>Diff</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {questions.length === 0 && (
                <tr><td colSpan={TABLE_COLS} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No questions found.</td></tr>
              )}
              {questions.map((q) => (
                <React.Fragment key={q.id}>
                  <tr className={`question-row ${expanded.has(q.id) ? 'expanded-active' : ''}`}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{q.id}</td>
                    <td><Pill color="violet">{q.exam}</Pill></td>
                    <td style={{ fontSize: '0.85rem' }}>{q.world_key}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{q.index}</td>
                    <td className="admin-question-cell clickable-cell" onClick={() => toggleExpanded(q.id)} title="Click to expand/collapse">
                      <span className="expand-icon">{expanded.has(q.id) ? '▼' : '▶'}</span>
                      {q.question_text.slice(0, 70)}{q.question_text.length > 70 ? '…' : ''}
                      {q.image_url && <span className="has-image-badge">🖼️</span>}
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
                  {expanded.has(q.id) && <ExpandedQuestionRow question={q} colSpan={TABLE_COLS} taxonomy={taxonomy} />}
                </React.Fragment>
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

      {editing && <QuestionEditModal question={editing} taxonomy={taxonomy} onSave={handleSaveEdit} onClose={() => setEditing(null)} />}
      {creating && <CreateQuestionModal taxonomy={taxonomy} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); fetchQuestions(); setRefreshKey((k) => k + 1); showFlash('Question created.'); }} />}
    </div>
  );
}


// ── QUESTION EDIT MODAL ───────────────────────────────────────────────────────

function QuestionEditModal({ question, taxonomy, onSave, onClose }) {
  const [form, setForm] = useState({
    question_text: question.question_text, option_a: question.option_a,
    option_b: question.option_b, option_c: question.option_c, option_d: question.option_d,
    correct_answer: question.correct_answer || 'a', topic: question.topic || '',
    difficulty: question.difficulty || '', image_url: question.image_url || null,
    is_active: question.is_active, version: question.version,
  });
  const [saving, setSaving] = useState(false);
  const [showMathPreview, setShowMathPreview] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const section = getSectionFromWorldKey(question.world_key);
  const topicOptions = (taxonomy && section && taxonomy[section]) || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (!payload.topic) payload.topic = null;
    if (!payload.difficulty) payload.difficulty = null;
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
          <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>Preview:</div>
            <MathText text={form.question_text} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMathPreview(!showMathPreview)}>
            {showMathPreview ? 'Hide Preview' : 'Preview Math'}
          </button>
          <LaTeXCheatsheet />
        </div>

        <ImageUpload
          value={form.image_url}
          onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
        />

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
    correct_answer: 'a', topic: '', difficulty: '', is_active: false, image_url: null,
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
      const payload = [{
        ...form,
        index: nextIdx.next_index,
        topic: form.topic || null,
        difficulty: form.difficulty || null,
      }];
      await adminApi.importQuestions(payload);
      onCreated();
    } catch (err) {
      alert(err?.error?.message || 'Failed to create question.');
    } finally { setSaving(false); }
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
              {worldOptions.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Question Text (supports LaTeX: $...$)</label>
          <textarea className="form-input" rows={3} value={form.question_text} onChange={set('question_text')} required />
        </div>

        <LaTeXCheatsheet />

        <ImageUpload
          value={form.image_url}
          onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
        />

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
        { label: 'Students', val: stats.users?.students || 0 },
        { label: 'Organisations', val: stats.orgs?.total || 0 },
        { label: 'Active Entitlements', val: stats.entitlements?.active || 0 },
      ].map((s) => (
        <div key={s.label} className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.label}</div>
        </div>
      ))}
      {stats.questions?.per_exam && Object.entries(stats.questions.per_exam).map(([exam, count]) => (
        <div key={exam} className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{count}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{exam} Questions</div>
        </div>
      ))}
    </div>
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
        <button className="btn btn-green btn-sm" onClick={() => setCreating(true)}>+ New Org</button>
      </div>

      {orgs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No organisations yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Name</th><th>Slug</th><th>Students</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.name}</td>
                  <td><code>{o.slug}</code></td>
                  <td>{o.estimated_student_count || '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td><button className="admin-action-btn" onClick={() => setSelected(o)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateOrgModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); fetchOrgs(); showFlash('Org created.'); }} />}
      {selected && <OrgDetailModal org={selected} onClose={() => setSelected(null)} onRefresh={fetchOrgs} />}
    </div>
  );
}

function CreateOrgModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', slug: '', estimated_student_count: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createOrg({ ...form, estimated_student_count: form.estimated_student_count ? parseInt(form.estimated_student_count) : null });
      onCreated();
    } catch (err) { alert(err?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create Organisation" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
        <div className="form-group"><label className="form-label">Slug</label><input className="form-input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} required placeholder="e.g. riyadh-prep-school" /></div>
        <div className="form-group"><label className="form-label">Est. Students (optional)</label><input className="form-input" type="number" value={form.estimated_student_count} onChange={(e) => setForm((f) => ({ ...f, estimated_student_count: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Creating…' : 'Create Org'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function OrgDetailModal({ org, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [flash, showFlash] = useFlash();

  useEffect(() => { adminApi.getOrg(org.id).then(setDetail).catch(() => {}); }, [org.id]);

  if (!detail) return <Modal title={org.name} onClose={onClose}><div className="spinner" /></Modal>;

  return (
    <Modal title={org.name} onClose={onClose} width="700px">
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 12 }}>{flash.msg}</div>}
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Slug: <code>{org.slug}</code></p>

      <h4 style={{ marginBottom: 8 }}>Leader</h4>
      {detail.leader ? (
        <p>{detail.leader.username} (ID: {detail.leader.id})</p>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>No leader assigned yet.</p>
      )}

      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Students ({detail.students?.length || 0})</h4>
      {detail.students?.length > 0 ? (
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {detail.students.map((s) => <div key={s.id} style={{ fontSize: '0.85rem', padding: '2px 0' }}>{s.username}</div>)}
        </div>
      ) : <p style={{ color: 'var(--text-muted)' }}>No students yet.</p>}

      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Entitlements</h4>
      {detail.entitlements?.length > 0 ? (
        detail.entitlements.map((e) => (
          <div key={e.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{e.exam} — {e.plan_id}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Expires: {new Date(e.entitlement_expires_at).toLocaleDateString()}</div>
          </div>
        ))
      ) : <p style={{ color: 'var(--text-muted)' }}>No entitlements.</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
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
                  <td>{u.id}</td>
                  <td>{u.username}</td>
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
    e.preventDefault();
    setSaving(true);
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


// ── ROOT ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stats',     icon: '📊', label: 'Stats'    },
  { id: 'questions', icon: '📝', label: 'Questions' },
  { id: 'orgs',      icon: '🏫', label: 'Orgs'      },
  { id: 'users',     icon: '👤', label: 'Users'     },
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
          {tab === 'orgs'      && <OrgsTab />}
          {tab === 'users'     && <UsersTab />}
        </div>
      </div>
    </>
  );
}