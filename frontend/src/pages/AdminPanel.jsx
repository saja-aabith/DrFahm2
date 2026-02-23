import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import ImageUpload from '../components/ImageUpload';
import LaTeXCheatsheet from '../components/LaTeXCheatsheet';
import * as adminApi from '../api/admin';

// ── Constants ─────────────────────────────────────────────────────────────────
const EXAMS      = ['qudurat', 'tahsili'];
const WORLD_KEYS = {
  qudurat: ['math_100','math_150','math_200','math_250','math_300','verbal_100','verbal_150','verbal_200','verbal_250','verbal_300'],
  tahsili: ['math_100','math_150','math_200','math_250','biology_100','biology_150','chemistry_100','chemistry_150','physics_100','physics_150'],
};

const SUBJECT_POOLS = [
  { label: 'Qudurat — Math',      exam: 'qudurat', prefix: 'math'      },
  { label: 'Qudurat — Verbal',    exam: 'qudurat', prefix: 'verbal'    },
  { label: 'Tahsili — Math',      exam: 'tahsili', prefix: 'math'      },
  { label: 'Tahsili — Biology',   exam: 'tahsili', prefix: 'biology'   },
  { label: 'Tahsili — Chemistry', exam: 'tahsili', prefix: 'chemistry' },
  { label: 'Tahsili — Physics',   exam: 'tahsili', prefix: 'physics'   },
];

// ── Shared components ─────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="admin-tab-bar">
      {tabs.map((t) => (
        <button key={t.id} className={`admin-tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          <span className="admin-tab-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Pill({ children, color = 'violet', onClick, title, style = {} }) {
  const colors = {
    violet: { bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)', text: '#a78bfa' },
    green:  { bg: 'rgba(22,163,74,0.15)',  border: 'rgba(22,163,74,0.3)',  text: '#86efac' },
    red:    { bg: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.25)', text: '#fca5a5' },
    amber:  { bg: 'rgba(217,119,6,0.15)',  border: 'rgba(217,119,6,0.3)',  text: '#fcd34d' },
    gray:   { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', text: '#94a3b8' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span onClick={onClick} title={title} style={{
      fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s ease', ...style,
    }}>{children}</span>
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

function useFlash() {
  const [flash, setFlash] = useState(null);
  const show = useCallback((msg, type = 'success') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 4000);
  }, []);
  return [flash, show];
}


// ── STATS TAB ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => { adminApi.getStats().then(setStats).catch(() => {}); }, []);
  if (!stats) return <div className="admin-loading"><div className="spinner" /></div>;

  const cards = [
    { label: 'Students',        value: stats.students?.total ?? '—',      sub: `${stats.students?.active ?? 0} active`, color: 'green' },
    { label: 'Active Trials',   value: stats.trials?.active ?? '—',      sub: '7-day free trials',  color: 'violet' },
    { label: 'Paid Plans',      value: stats.entitlements?.active ?? '—', sub: 'active entitlements', color: 'green' },
    { label: 'Stripe Payments', value: stats.stripe_payments ?? '—',     sub: 'completed checkouts', color: 'amber' },
    { label: 'Questions',       value: stats.questions?.total ?? '—',     sub: `${stats.questions?.active ?? 0} active`, color: 'violet' },
    { label: 'Orgs',            value: stats.orgs?.total ?? '—',          sub: 'school organizations', color: 'green' },
  ];

  return (
    <div className="admin-stats-grid">
      {cards.map((c, i) => (
        <div className="admin-stat-card" key={i}>
          <div className="admin-stat-value" style={{ color: c.color === 'green' ? 'var(--green-light)' : c.color === 'violet' ? 'var(--violet-light)' : c.color === 'amber' ? '#fcd34d' : 'var(--text-primary)' }}>
            {c.value}
          </div>
          <div className="admin-stat-label">{c.label}</div>
          <div className="admin-stat-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}


// ── REVIEW PROGRESS BAR ───────────────────────────────────────────────────────

function ReviewProgressPanel({ examFilter }) {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    adminApi.reviewProgress(examFilter || '').then(setData).catch(() => {});
  }, [examFilter]);

  if (!data) return null;

  const { summary, progress } = data;
  const pct = summary.total > 0 ? Math.round((summary.reviewed / summary.total) * 100) : 0;

  return (
    <div className="review-progress-panel">
      <div className="review-progress-header">
        <div className="review-progress-summary">
          <span className="review-progress-title">Review Progress</span>
          <span className="review-progress-numbers">
            <strong style={{ color: 'var(--green-light)' }}>{summary.reviewed}</strong>
            <span style={{ color: 'var(--text-muted)' }}> / {summary.total}</span>
            <span style={{ color: pct === 100 ? 'var(--green-light)' : pct > 50 ? 'var(--violet-light)' : 'var(--amber)', marginLeft: 8, fontWeight: 700 }}>{pct}%</span>
          </span>
        </div>
        {progress.length > 1 && (
          <button className="review-progress-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide worlds ▲' : 'Show worlds ▼'}
          </button>
        )}
      </div>
      <div className="review-bar">
        <div className="review-bar-fill" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green-light)' : 'var(--violet)' }} />
      </div>
      {expanded && (
        <div className="review-worlds-grid">
          {progress.map((w) => {
            const wp = w.total > 0 ? Math.round((w.reviewed / w.total) * 100) : 0;
            return (
              <div key={`${w.exam}-${w.world_key}`} className="review-world-item">
                <div className="review-world-label">
                  <span className="review-world-exam">{w.exam}</span>
                  <span className="review-world-key">{w.world_key}</span>
                  <span className="review-world-count">{w.reviewed}/{w.total}</span>
                </div>
                <div className="review-bar review-bar-sm">
                  <div className="review-bar-fill" style={{ width: `${wp}%`, background: wp === 100 ? 'var(--green-light)' : wp > 50 ? 'var(--violet)' : 'var(--amber)' }} />
                </div>
              </div>
            );
          })}
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

  const handlePick = async (answer) => {
    if (answer === question.correct_answer) { setOpen(false); return; }
    setSaving(true);
    try {
      const result = await adminApi.quickUpdate(question.id, 'correct_answer', answer, question.version);
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
        + tag
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


// ── EXPANDED QUESTION ROW (with MathText + image) ─────────────────────────────

function ExpandedQuestionRow({ question, colSpan }) {
  return (
    <tr className="expanded-row">
      <td colSpan={colSpan}>
        <div className="expanded-content">
          <div className="expanded-question-text">
            <MathText text={question.question_text} />
          </div>

          {/* Supporting image */}
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
          {question.topic && (
            <div className="expanded-meta">
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Topic: </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{question.topic}</span>
            </div>
          )}
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
  const [filters,   setFilters]     = useState({ exam: '', world_key: '', is_active: '', difficulty: '', search: '' });
  const [creating,  setCreating]    = useState(false);
  const [expanded,  setExpanded]    = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const worldOptions = filters.exam ? WORLD_KEYS[filters.exam] || [] : [];

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
    setFilters((f) => ({ ...f, [k]: v, ...(k === 'exam' ? { world_key: '' } : {}) }));
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

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}

      <ReviewProgressPanel examFilter={filters.exam} key={`rp-${refreshKey}-${filters.exam}`} />

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
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-sm btn-green" onClick={() => handleBulkActivate(true)} disabled={bulkLoading || total === 0}>
            {bulkLoading ? '…' : '🟢 Activate all'}
          </button>
          <button className="btn btn-sm btn-ghost" style={{ borderColor: 'rgba(220,38,38,0.3)', color: '#fca5a5' }} onClick={() => handleBulkActivate(false)} disabled={bulkLoading || total === 0}>
            {bulkLoading ? '…' : '🔴 Deactivate all'}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Exam</th><th>World</th><th>Idx</th><th>Question</th><th>Answer</th><th>Difficulty</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {questions.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No questions found.</td></tr>
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
                      {q.question_text.slice(0, 80)}{q.question_text.length > 80 ? '…' : ''}
                      {q.image_url && <span className="has-image-badge">🖼️ img</span>}
                    </td>
                    <td><InlineAnswerPicker question={q} onSaved={handleInlineSaved} /></td>
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
                  {expanded.has(q.id) && <ExpandedQuestionRow question={q} colSpan={9} />}
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

      {editing && <QuestionEditModal question={editing} onSave={handleSaveEdit} onClose={() => setEditing(null)} />}
      {creating && <CreateQuestionModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); fetchQuestions(); setRefreshKey((k) => k + 1); showFlash('Question created.'); }} />}
    </div>
  );
}


// ── QUESTION EDIT MODAL (with image upload + LaTeX cheatsheet) ─────────────

function QuestionEditModal({ question, onSave, onClose }) {
  const [form, setForm] = useState({
    question_text: question.question_text, option_a: question.option_a,
    option_b: question.option_b, option_c: question.option_c, option_d: question.option_d,
    correct_answer: question.correct_answer || 'a', topic: question.topic || '',
    difficulty: question.difficulty || '', image_url: question.image_url || null,
    is_active: question.is_active, version: question.version,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    onSave({ ...form, difficulty: form.difficulty || null });
  };

  // Live preview toggle
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Modal title={`Edit Question #${question.id}`} onClose={onClose} width={700}>
      <form onSubmit={handleSubmit}>

        {/* LaTeX cheatsheet */}
        <div style={{ marginBottom: 14 }}>
          <LaTeXCheatsheet />
        </div>

        {/* Question text */}
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Question Text
            <button type="button" onClick={() => setShowPreview(!showPreview)}
              style={{ fontSize: '0.75rem', color: 'var(--violet-light)', background: 'none', border: '1px solid rgba(124,58,237,0.2)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
              {showPreview ? 'Hide Preview' : 'Preview Math'}
            </button>
          </label>
          <textarea className="form-input" rows={3} value={form.question_text} onChange={set('question_text')} required
            placeholder="Use $...$ for inline math, $$...$$ for display math" />
          {showPreview && form.question_text && (
            <div style={{ padding: '12px 16px', marginTop: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '1rem', lineHeight: 1.7 }}>
              <MathText text={form.question_text} />
            </div>
          )}
        </div>

        {/* Supporting image */}
        <div className="form-group">
          <label className="form-label">Supporting Image (optional)</label>
          <ImageUpload value={form.image_url} onChange={(v) => setForm((f) => ({ ...f, image_url: v }))} />
        </div>

        {/* Options */}
        {['a','b','c','d'].map(opt => (
          <div className="form-group" key={opt}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Option {opt.toUpperCase()}
              {form.correct_answer === opt && <Pill color="green">✓ Correct</Pill>}
            </label>
            <input className="form-input" value={form[`option_${opt}`]} onChange={set(`option_${opt}`)} required
              placeholder="Supports $...$ math notation" />
            {showPreview && form[`option_${opt}`]?.includes('$') && (
              <div style={{ padding: '6px 12px', marginTop: 4, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.9rem' }}>
                <MathText text={form[`option_${opt}`]} />
              </div>
            )}
          </div>
        ))}

        {/* Correct answer + difficulty */}
        <div style={{ display: 'flex', gap: 14 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Correct Answer</label>
            <select className="form-input" value={form.correct_answer} onChange={set('correct_answer')}>
              {['a','b','c','d'].map(o => <option key={o} value={o}>{o.toUpperCase()} — {(form[`option_${o}`] || '').slice(0, 40)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Difficulty</label>
            <select className="form-input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="">Untagged</option>
              <option value="easy">Easy</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Topic (optional)</label>
          <input className="form-input" value={form.topic} onChange={set('topic')} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input type="checkbox" id="eq-active" checked={form.is_active} onChange={set('is_active')} />
          <label htmlFor="eq-active" style={{ fontSize: '1rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Active</label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-violet" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}


// ── CREATE QUESTION MODAL (with image upload + LaTeX cheatsheet) ──────────

function CreateQuestionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    pool: '', world_key: '', question_text: '',
    option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'a', difficulty: '', topic: '', image_url: null, is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [nextIdx, setNextIdx] = useState(null);
  const [loadingIdx, setLoadingIdx] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const selectedPool = SUBJECT_POOLS.find(p => p.label === form.pool);
  const poolWorlds = selectedPool ? WORLD_KEYS[selectedPool.exam].filter(w => w.startsWith(selectedPool.prefix)) : [];

  useEffect(() => {
    if (!selectedPool || !form.world_key) { setNextIdx(null); return; }
    setLoadingIdx(true);
    adminApi.nextIndex(selectedPool.exam, form.world_key)
      .then((d) => setNextIdx(d.next_index))
      .catch(() => setNextIdx(null))
      .finally(() => setLoadingIdx(false));
  }, [form.world_key, selectedPool]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPool || !form.world_key || !nextIdx) return;
    setSaving(true);
    try {
      await adminApi.importQuestions([{
        exam: selectedPool.exam, world_key: form.world_key, index: nextIdx,
        question_text: form.question_text,
        option_a: form.option_a, option_b: form.option_b,
        option_c: form.option_c, option_d: form.option_d,
        correct_answer: form.correct_answer,
        difficulty: form.difficulty || null, topic: form.topic || null,
        image_url: form.image_url || null,
        is_active: form.is_active,
      }]);
      onCreated();
    } catch (err) { alert(err?.error?.message || 'Failed to create question.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Create New Question" onClose={onClose} width={700}>
      <form onSubmit={handleSubmit}>

        {/* LaTeX cheatsheet */}
        <div style={{ marginBottom: 14 }}>
          <LaTeXCheatsheet />
        </div>

        {/* Pool + World + Index */}
        <div style={{ display: 'flex', gap: 14 }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Subject Pool *</label>
            <select className="form-input" value={form.pool} onChange={(e) => { setForm(f => ({ ...f, pool: e.target.value, world_key: '' })); setNextIdx(null); }}>
              <option value="">Select pool…</option>
              {SUBJECT_POOLS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">World *</label>
            <select className="form-input" value={form.world_key} onChange={set('world_key')} disabled={!selectedPool}>
              <option value="">Select…</option>
              {poolWorlds.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 0, minWidth: 80 }}>
            <label className="form-label">Index</label>
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: '1rem',
              color: nextIdx ? 'var(--green-light)' : 'var(--text-muted)', minHeight: 42, display: 'flex', alignItems: 'center' }}>
              {loadingIdx ? '…' : nextIdx ? `#${nextIdx}` : '—'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Auto-detected</div>
          </div>
        </div>

        {/* Question text with preview */}
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Question Text *
            <button type="button" onClick={() => setShowPreview(!showPreview)}
              style={{ fontSize: '0.75rem', color: 'var(--violet-light)', background: 'none', border: '1px solid rgba(124,58,237,0.2)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
              {showPreview ? 'Hide Preview' : 'Preview Math'}
            </button>
          </label>
          <textarea className="form-input" rows={3} value={form.question_text} onChange={set('question_text')} required
            placeholder="Use $\frac{1}{2}$ for inline math, $$...$$ for display" />
          {showPreview && form.question_text && (
            <div style={{ padding: '12px 16px', marginTop: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '1rem', lineHeight: 1.7 }}>
              <MathText text={form.question_text} />
            </div>
          )}
        </div>

        {/* Supporting image */}
        <div className="form-group">
          <label className="form-label">Supporting Image (optional)</label>
          <ImageUpload value={form.image_url} onChange={(v) => setForm((f) => ({ ...f, image_url: v }))} />
        </div>

        {/* Options */}
        {['a','b','c','d'].map(opt => (
          <div className="form-group" key={opt}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Option {opt.toUpperCase()}
              {form.correct_answer === opt && <Pill color="green">✓ Correct</Pill>}
            </label>
            <input className="form-input" value={form[`option_${opt}`]} onChange={set(`option_${opt}`)} required
              placeholder="Supports $...$ math notation" />
          </div>
        ))}

        {/* Correct answer + difficulty */}
        <div style={{ display: 'flex', gap: 14 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Correct Answer *</label>
            <select className="form-input" value={form.correct_answer} onChange={set('correct_answer')}>
              {['a','b','c','d'].map(o => <option key={o} value={o}>{o.toUpperCase()} — {(form[`option_${o}`] || '').slice(0, 40)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Difficulty</label>
            <select className="form-input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="">Untagged</option>
              <option value="easy">Easy</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Topic (optional)</label>
          <input className="form-input" value={form.topic} onChange={set('topic')} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="cq-active" checked={form.is_active} onChange={set('is_active')} />
          <label htmlFor="cq-active" style={{ fontSize: '1rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Active immediately</label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="submit" className="btn btn-green" disabled={saving || !nextIdx || !form.world_key}>
            {saving ? 'Creating…' : 'Create Question'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}


// ── ORGS TAB ──────────────────────────────────────────────────────────────────

function OrgsTab() {
  const [orgs, setOrgs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [creating, setCreating]   = useState(false);
  const [detail, setDetail]       = useState(null);
  const [flash, showFlash]        = useFlash();

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    adminApi.listOrgs().then((d) => setOrgs(d.orgs || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await adminApi.createOrg({ name: fd.get('name'), slug: fd.get('slug') });
      showFlash('Org created.'); setCreating(false); fetchOrgs();
    } catch (err) { showFlash(err?.error?.message || 'Failed.', 'error'); }
  };

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{orgs.length} organization{orgs.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-violet btn-sm" onClick={() => setCreating(true)}>+ New Org</button>
      </div>
      {creating && (
        <div className="admin-stat-card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label className="form-label">Org Name</label><input className="form-input" name="name" required placeholder="Riyadh Academy" /></div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}><label className="form-label">Slug</label><input className="form-input" name="slug" required placeholder="riyadh-academy" /></div>
            <button className="btn btn-green btn-sm" type="submit">Create</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setCreating(false)}>Cancel</button>
          </form>
        </div>
      )}
      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Name</th><th>Slug</th><th>Actions</th></tr></thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{o.id}</td><td>{o.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{o.slug}</td>
                  <td><button className="admin-action-btn" onClick={() => setDetail(o)}>Manage →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && <OrgDetailModal org={detail} onClose={() => { setDetail(null); fetchOrgs(); }} />}
    </div>
  );
}


function OrgDetailModal({ org, onClose }) {
  const [flash, showFlash] = useFlash();
  const [tab, setTab] = useState('info');
  const [leaderForm, setLeaderForm] = useState({ username: '', email: '', password: '' });
  const [genCount, setGenCount] = useState(10);
  const [genExam, setGenExam] = useState('qudurat');
  const [generatedCSV, setGeneratedCSV] = useState(null);
  const [entForm, setEntForm] = useState({ exam: 'qudurat', plan_id: 'basic', duration_days: 365 });
  const [saving, setSaving] = useState(false);

  const handleCreateLeader = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await adminApi.createOrgLeader(org.id, leaderForm); showFlash('Leader created.'); }
    catch (err) { showFlash(err?.error?.message || 'Failed.', 'error'); }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const result = await adminApi.generateStudents(org.id, { count: genCount, exam: genExam });
      const csv = 'username,password,exam\n' + result.students.map(s => `${s.username},${s.password},${genExam}`).join('\n');
      setGeneratedCSV(csv);
      showFlash(`${result.students.length} students generated.`);
    } catch (err) { showFlash(err?.error?.message || 'Failed.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDownloadCSV = () => {
    const blob = new Blob([generatedCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${org.slug}_students.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const handleGrantEntitlement = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await adminApi.grantOrgEntitlement(org.id, entForm); showFlash('Entitlement granted.'); }
    catch (err) { showFlash(err?.error?.message || 'Failed.', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Org: ${org.name}`} onClose={onClose} width={640}>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['info', 'leader', 'students', 'entitlement'].map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-violet' : 'btn-ghost'}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {tab === 'info' && <div><p><strong>ID:</strong> {org.id}</p><p><strong>Name:</strong> {org.name}</p><p><strong>Slug:</strong> {org.slug}</p></div>}
      {tab === 'leader' && (
        <form onSubmit={handleCreateLeader}>
          <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={leaderForm.username} onChange={e => setLeaderForm(f => ({...f, username: e.target.value}))} required /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={leaderForm.email} onChange={e => setLeaderForm(f => ({...f, email: e.target.value}))} required /></div>
          <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={leaderForm.password} onChange={e => setLeaderForm(f => ({...f, password: e.target.value}))} required /></div>
          <button className="btn btn-violet" disabled={saving}>{saving ? 'Creating…' : 'Create Leader'}</button>
        </form>
      )}
      {tab === 'students' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Count</label><input className="form-input" type="number" min={1} max={500} value={genCount} onChange={e => setGenCount(+e.target.value)} style={{ width: 80 }} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Exam</label><select className="form-input" value={genExam} onChange={e => setGenExam(e.target.value)}>{EXAMS.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
            <button className="btn btn-green btn-sm" onClick={handleGenerate} disabled={saving}>{saving ? 'Generating…' : 'Generate Students'}</button>
          </div>
          {generatedCSV && (
            <div className="admin-stat-card" style={{ marginTop: 12 }}>
              <p style={{ color: 'var(--green-light)', fontWeight: 600, marginBottom: 8 }}>Students generated — download CSV now:</p>
              <button className="btn btn-green btn-sm" onClick={handleDownloadCSV}>Download CSV</button>
            </div>
          )}
        </div>
      )}
      {tab === 'entitlement' && (
        <form onSubmit={handleGrantEntitlement}>
          <div className="form-group"><label className="form-label">Exam</label><select className="form-input" value={entForm.exam} onChange={e => setEntForm(f => ({...f, exam: e.target.value}))}>{EXAMS.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Plan</label><select className="form-input" value={entForm.plan_id} onChange={e => setEntForm(f => ({...f, plan_id: e.target.value}))}><option value="basic">Basic</option><option value="premium">Premium</option></select></div>
          <div className="form-group"><label className="form-label">Duration (days)</label><input className="form-input" type="number" min={1} value={entForm.duration_days} onChange={e => setEntForm(f => ({...f, duration_days: +e.target.value}))} /></div>
          <button className="btn btn-violet" disabled={saving}>{saving ? 'Granting…' : 'Grant Entitlement'}</button>
        </form>
      )}
    </Modal>
  );
}


// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [flash, showFlash] = useFlash();

  const fetchUsers = useCallback(() => {
    setLoading(true);
    adminApi.listUsers({ role: roleFilter, q: search, page, per_page: 50 })
      .then((d) => { setUsers(d.users); setTotal(d.total); })
      .catch(() => showFlash('Failed to load users.', 'error'))
      .finally(() => setLoading(false));
  }, [roleFilter, search, page, showFlash]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleActive = async (user) => {
    try {
      if (user.is_active) await adminApi.deactivateUser(user.id);
      else await adminApi.activateUser(user.id);
      showFlash(`${user.username} ${user.is_active ? 'deactivated' : 'activated'}.`);
      fetchUsers();
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Reset password for ${user.username}?`)) return;
    try {
      const result = await adminApi.resetPassword(user.id, {});
      showFlash(`New password for ${user.username}: ${result.new_password}`);
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const roleColors = { student: 'gray', school_leader: 'amber', drfahm_admin: 'violet' };
  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div className="admin-filter-row">
        <input className="form-input" style={{ width: 'auto', minWidth: 200 }} placeholder="Search username / email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-input" style={{ width: 'auto', minWidth: 160 }} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option><option value="student">Student</option>
          <option value="school_leader">School Leader</option><option value="drfahm_admin">DrFahm Admin</option>
        </select>
        <button className="btn btn-violet btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(true)}>+ New Admin</button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{total} user{total !== 1 ? 's' : ''}</span>
      </div>
      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{u.id}</td>
                  <td>{u.username}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{u.email}</td>
                  <td><Pill color={roleColors[u.role] || 'gray'}>{u.role}</Pill></td>
                  <td>{u.is_active ? <Pill color="green">Yes</Pill> : <Pill color="red">No</Pill>}</td>
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
      {showCreate && <CreateAdminModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchUsers(); showFlash('Admin created.'); }} />}
    </div>
  );
}

function CreateAdminModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await adminApi.createUser({ ...form, role: 'drfahm_admin' }); onCreated(); }
    catch (err) { alert(err?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Create DrFahm Admin" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={form.username} onChange={set('username')} required /></div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={set('email')} required /></div>
        <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={form.password} onChange={set('password')} required minLength={8} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-violet" disabled={saving}>{saving ? 'Creating…' : 'Create Admin'}</button>
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