import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import * as adminApi from '../api/admin';

// ── Constants ─────────────────────────────────────────────────────────────────
const EXAMS      = ['qudurat', 'tahsili'];
const WORLD_KEYS = {
  qudurat: ['math_100','math_150','math_200','math_250','math_300','verbal_100','verbal_150','verbal_200','verbal_250','verbal_300'],
  tahsili: ['math_100','math_150','math_200','math_250','biology_100','biology_150','chemistry_100','chemistry_150','physics_100','physics_150'],
};

// ── Shared components ─────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="admin-tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`admin-tab ${active === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="admin-tab-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Pill({ children, color = 'violet' }) {
  const colors = {
    violet: { bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)', text: '#a78bfa' },
    green:  { bg: 'rgba(22,163,74,0.15)',  border: 'rgba(22,163,74,0.3)',  text: '#86efac' },
    red:    { bg: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.25)', text: '#fca5a5' },
    amber:  { bg: 'rgba(217,119,6,0.15)',  border: 'rgba(217,119,6,0.3)',  text: '#fcd34d' },
    gray:   { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', text: '#94a3b8' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
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
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-loading"><div className="spinner" /></div>;
  if (!stats)  return <div className="alert alert-error">Failed to load stats.</div>;

  const cards = [
    { label: 'Total Students',    value: stats.students.total,      sub: `${stats.students.active} active`,    color: 'violet' },
    { label: 'Active Trials',     value: stats.trials.active,       sub: 'currently in trial',                 color: 'amber'  },
    { label: 'Active Plans',      value: stats.entitlements.active, sub: 'paid entitlements',                  color: 'green'  },
    { label: 'Stripe Payments',   value: stats.stripe_payments,     sub: 'completed checkouts',                color: 'green'  },
    { label: 'Questions (total)', value: stats.questions.total,     sub: `${stats.questions.active} active`,   color: 'gray'   },
    { label: 'School Orgs',       value: stats.orgs.total,          sub: 'registered organisations',           color: 'gray'   },
  ];

  return (
    <div className="admin-stats-grid">
      {cards.map((c) => (
        <div key={c.label} className="admin-stat-card">
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

// ── QUESTIONS TAB ─────────────────────────────────────────────────────────────

function QuestionsTab() {
  const [questions, setQuestions]   = useState([]);
  const [total,     setTotal]       = useState(0);
  const [page,      setPage]        = useState(1);
  const [loading,   setLoading]     = useState(false);
  const [editing,   setEditing]     = useState(null);
  const [flash,     showFlash]      = useFlash();
  const [filters,   setFilters]     = useState({ exam: '', world_key: '', is_active: '' });

  const worldOptions = filters.exam ? WORLD_KEYS[filters.exam] || [] : [];

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    adminApi.listQuestions({ ...filters, page, per_page: 50 })
      .then((d) => { setQuestions(d.questions); setTotal(d.total); })
      .catch(() => showFlash('Failed to load questions.', 'error'))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleFilterChange = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v, ...(k === 'exam' ? { world_key: '' } : {}) }));
    setPage(1);
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
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
  };

  const handleSaveEdit = async (updated) => {
    try {
      await adminApi.updateQuestion(editing.id, updated);
      showFlash('Question saved.');
      setEditing(null);
      fetchQuestions();
    } catch (e) {
      if (e?.status === 409) showFlash('Conflict — reloading.', 'error');
      else showFlash(e?.error?.message || 'Save failed.', 'error');
    }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}

      <div className="admin-filter-row">
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
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: 'auto' }}>{total} question{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Exam</th><th>World</th><th>Idx</th><th>Question</th><th>Answer</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {questions.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No questions found.</td></tr>}
              {questions.map((q) => (
                <tr key={q.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{q.id}</td>
                  <td><Pill color="violet">{q.exam}</Pill></td>
                  <td style={{ fontSize: '0.8rem' }}>{q.world_key}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{q.index}</td>
                  <td className="admin-question-cell">{q.question_text.slice(0, 80)}{q.question_text.length > 80 ? '…' : ''}</td>
                  <td><Pill color={q.correct_answer === 'a' ? 'amber' : 'green'}>{q.correct_answer?.toUpperCase() || '?'}</Pill></td>
                  <td>{q.is_active ? <Pill color="green">Active</Pill> : <Pill color="gray">Inactive</Pill>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-action-btn" onClick={() => setEditing(q)} title="Edit">✏️</button>
                      <button className="admin-action-btn" onClick={() => handleToggle(q)} title={q.is_active ? 'Deactivate' : 'Activate'}>{q.is_active ? '🔴' : '🟢'}</button>
                      <button className="admin-action-btn danger" onClick={() => handleDelete(q)} title="Delete">🗑️</button>
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
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {editing && <QuestionEditModal question={editing} onSave={handleSaveEdit} onClose={() => setEditing(null)} />}
    </div>
  );
}

function QuestionEditModal({ question, onSave, onClose }) {
  const [form, setForm]     = useState({
    question_text: question.question_text, option_a: question.option_a,
    option_b: question.option_b, option_c: question.option_c, option_d: question.option_d,
    correct_answer: question.correct_answer || 'a', topic: question.topic || '',
    is_active: question.is_active, version: question.version,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, version: parseInt(form.version) });
    setSaving(false);
  };

  return (
    <Modal title={`Edit Q#${question.id} — ${question.world_key} [${question.exam}] idx ${question.index}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Question Text</label>
          <textarea className="form-input" rows={3} value={form.question_text} onChange={set('question_text')} required />
        </div>
        {['a','b','c','d'].map((opt) => (
          <div className="form-group" key={opt}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Option {opt.toUpperCase()} {form.correct_answer === opt && <Pill color="green">✓ Correct</Pill>}
            </label>
            <input className="form-input" value={form[`option_${opt}`]} onChange={set(`option_${opt}`)} required />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">Correct Answer</label>
          <select className="form-input" value={form.correct_answer} onChange={set('correct_answer')}>
            {['a','b','c','d'].map((o) => (
              <option key={o} value={o}>{o.toUpperCase()} — {form[`option_${o}`].slice(0,50)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Topic (optional)</label>
          <input className="form-input" value={form.topic} onChange={set('topic')} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="qa-active" checked={form.is_active} onChange={set('is_active')} />
          <label htmlFor="qa-active" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>Active (visible to students)</label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ── ORGS TAB ──────────────────────────────────────────────────────────────────

function OrgsTab() {
  const [orgs,        setOrgs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [flash,       showFlash]      = useFlash();

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    adminApi.listOrgs({ per_page: 100 })
      .then((d) => setOrgs(d.orgs))
      .catch(() => showFlash('Failed to load orgs.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  return (
    <div>
      {flash && <div className={`alert alert-${flash.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: 16 }}>{flash.msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-violet btn-sm" onClick={() => setShowCreate(true)}>+ New Org</button>
      </div>
      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Slug</th><th>Students</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {orgs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No orgs yet.</td></tr>}
              {orgs.map((org) => (
                <tr key={org.id}>
                  <td style={{ fontWeight: 600 }}>{org.name}</td>
                  <td><code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{org.slug}</code></td>
                  <td>{org.student_count}</td>
                  <td><Pill color={org.is_active ? 'green' : 'gray'}>{org.is_active ? 'Active' : 'Inactive'}</Pill></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(org.created_at).toLocaleDateString()}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrg(org)}>Manage →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate  && <CreateOrgModal    onCreated={() => { setShowCreate(false);   fetchOrgs(); showFlash('Org created.'); }}   onClose={() => setShowCreate(false)} />}
      {selectedOrg && <OrgDetailModal orgId={selectedOrg.id} onClose={() => { setSelectedOrg(null); fetchOrgs(); }} showFlash={showFlash} />}
    </div>
  );
}

function CreateOrgModal({ onCreated, onClose }) {
  const [form, setForm]     = useState({ name: '', slug: '', estimated_student_count: '' });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await adminApi.createOrg({ name: form.name, slug: form.slug, estimated_student_count: form.estimated_student_count ? parseInt(form.estimated_student_count) : null });
      onCreated();
    } catch (err) { setError(err?.error?.message || 'Failed.'); setSaving(false); }
  };

  return (
    <Modal title="Create School Org" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group"><label className="form-label">School Name</label><input className="form-input" value={form.name} onChange={set('name')} required /></div>
        <div className="form-group"><label className="form-label">Slug <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(lowercase, used for usernames)</span></label><input className="form-input" value={form.slug} onChange={set('slug')} placeholder="riyadh-school" required /></div>
        <div className="form-group"><label className="form-label">Estimated Students (optional)</label><input className="form-input" type="number" value={form.estimated_student_count} onChange={set('estimated_student_count')} min={1} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Org'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function OrgDetailModal({ orgId, onClose, showFlash }) {
  const [org,          setOrg]          = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [section,      setSection]      = useState('info');
  const [genCount,     setGenCount]     = useState(10);
  const [generating,   setGenerating]   = useState(false);
  const [generated,    setGenerated]    = useState(null);
  const [leaderForm,   setLeaderForm]   = useState({ username: '', email: '', password: '' });
  const [leaderErr,    setLeaderErr]    = useState('');
  const [savingLeader, setSavingLeader] = useState(false);
  const [entForm,      setEntForm]      = useState({ exam: 'qudurat', plan_id: 'premium', duration_days: 365 });
  const [savingEnt,    setSavingEnt]    = useState(false);

  const loadOrg = useCallback(() => {
    adminApi.getOrg(orgId).then((d) => setOrg(d.org)).catch(() => {}).finally(() => setLoading(false));
  }, [orgId]);
  useEffect(() => { loadOrg(); }, [loadOrg]);

  const handleGenerateStudents = async () => {
    if (!window.confirm(`Generate ${genCount} student accounts for ${org.name}?`)) return;
    setGenerating(true);
    try {
      const result = await adminApi.generateStudents(orgId, parseInt(genCount));
      setGenerated(result.students);
      showFlash(`${result.generated} students generated — download CSV now!`);
      loadOrg();
    } catch (e) { showFlash(e?.error?.message || 'Failed.', 'error'); }
    finally { setGenerating(false); }
  };

  const handleDownloadCSV = () => {
    if (!generated) return;
    const rows = ['username,password', ...generated.map((s) => `${s.username},${s.password}`)].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${org?.slug}_passwords.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateLeader = async (e) => {
    e.preventDefault(); setLeaderErr(''); setSavingLeader(true);
    try {
      const result = await adminApi.createLeader(orgId, leaderForm);
      showFlash(`Leader ${result.leader.username} created. Password: ${result.leader.generated_password}`);
      loadOrg(); setSection('info');
    } catch (err) { setLeaderErr(err?.error?.message || 'Failed.'); }
    finally { setSavingLeader(false); }
  };

  const handleGrantEntitlement = async (e) => {
    e.preventDefault(); setSavingEnt(true);
    try {
      await adminApi.grantOrgEntitlement(orgId, { ...entForm, duration_days: parseInt(entForm.duration_days) });
      showFlash('Entitlement granted.'); loadOrg(); setSection('info');
    } catch (err) { showFlash(err?.error?.message || 'Failed.', 'error'); }
    finally { setSavingEnt(false); }
  };

  if (loading) return <Modal title="Loading…" onClose={onClose}><div className="admin-loading"><div className="spinner" /></div></Modal>;
  if (!org)    return <Modal title="Error" onClose={onClose}><div className="alert alert-error">Could not load org.</div></Modal>;

  return (
    <Modal title={`Org: ${org.name}`} onClose={onClose}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[{ id: 'info', label: 'Info' }, { id: 'leader', label: org.leader ? '✓ Leader' : '+ Leader' }, { id: 'students', label: `Students (${org.student_count})` }, { id: 'entitlement', label: '+ Entitlement' }].map((s) => (
          <button key={s.id} className={`btn btn-sm ${section === s.id ? 'btn-violet' : 'btn-ghost'}`} onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
      </div>

      {section === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="admin-detail-row"><span>Slug</span><code>{org.slug}</code></div>
          <div className="admin-detail-row"><span>Students</span><span>{org.student_count}</span></div>
          <div className="admin-detail-row"><span>Leader</span><span>{org.leader?.username || <em style={{ color: 'var(--text-muted)' }}>None</em>}</span></div>
          <div className="admin-detail-row"><span>Created</span><span>{new Date(org.created_at).toLocaleDateString()}</span></div>
          {org.entitlements?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Entitlements</p>
              {org.entitlements.map((e) => (
                <div key={e.id} style={{ fontSize: '0.8rem', padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Pill color="violet">{e.exam}</Pill>
                  <Pill color={e.plan_id === 'premium' ? 'violet' : 'amber'}>{e.plan_id}</Pill>
                  <span style={{ color: 'var(--text-muted)' }}>Expires {new Date(e.entitlement_expires_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'leader' && (
        org.leader ? (
          <div className="alert alert-info">Leader: <strong>{org.leader.username}</strong>{org.leader.email && ` (${org.leader.email})`}</div>
        ) : (
          <form onSubmit={handleCreateLeader} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {leaderErr && <div className="alert alert-error">{leaderErr}</div>}
            <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={leaderForm.username} onChange={(e) => setLeaderForm((f) => ({ ...f, username: e.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Email (optional)</label><input className="form-input" type="email" value={leaderForm.email} onChange={(e) => setLeaderForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(blank = auto-generate)</span></label><input className="form-input" type="text" value={leaderForm.password} onChange={(e) => setLeaderForm((f) => ({ ...f, password: e.target.value }))} /></div>
            <button type="submit" className="btn btn-primary" disabled={savingLeader}>{savingLeader ? 'Creating…' : 'Create Leader'}</button>
          </form>
        )
      )}

      {section === 'students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label className="form-label" style={{ margin: 0 }}>Generate</label>
            <input className="form-input" type="number" min={1} max={500} value={genCount} onChange={(e) => setGenCount(e.target.value)} style={{ width: 80 }} />
            <label className="form-label" style={{ margin: 0 }}>students</label>
            <button className="btn btn-violet btn-sm" onClick={handleGenerateStudents} disabled={generating}>{generating ? 'Generating…' : 'Generate'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => adminApi.exportStudentsCSV(orgId)}>Export CSV (no passwords)</button>
          </div>
          {generated && (
            <div>
              <div className="alert alert-success" style={{ marginBottom: 12 }}>⚠️ <strong>{generated.length} accounts created.</strong> Download passwords now — shown once only!</div>
              <button className="btn btn-primary btn-sm" onClick={handleDownloadCSV} style={{ marginBottom: 12 }}>⬇ Download CSV with passwords</button>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg)', borderRadius: 8, padding: 12 }}>
                <table className="admin-table">
                  <thead><tr><th>Username</th><th>Password</th></tr></thead>
                  <tbody>
                    {generated.slice(0, 20).map((s) => (
                      <tr key={s.username}>
                        <td><code style={{ fontSize: '0.8rem' }}>{s.username}</code></td>
                        <td><code style={{ fontSize: '0.8rem' }}>{s.password}</code></td>
                      </tr>
                    ))}
                    {generated.length > 20 && <tr><td colSpan={2} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>…and {generated.length - 20} more (all in CSV)</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'entitlement' && (
        <form onSubmit={handleGrantEntitlement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">Exam</label>
            <select className="form-input" value={entForm.exam} onChange={(e) => setEntForm((f) => ({ ...f, exam: e.target.value }))}>
              <option value="qudurat">Qudurat</option><option value="tahsili">Tahsili</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Plan</label>
            <select className="form-input" value={entForm.plan_id} onChange={(e) => setEntForm((f) => ({ ...f, plan_id: e.target.value }))}>
              <option value="basic">Basic (Worlds 1–5)</option><option value="premium">Premium (Worlds 1–10)</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Duration (days)</label>
            <input className="form-input" type="number" min={1} value={entForm.duration_days} onChange={(e) => setEntForm((f) => ({ ...f, duration_days: e.target.value }))} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingEnt}>{savingEnt ? 'Granting…' : 'Grant Entitlement'}</button>
        </form>
      )}
    </Modal>
  );
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users,      setUsers]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [flash,      showFlash]     = useFlash();

  const fetchUsers = useCallback(() => {
    setLoading(true);
    adminApi.listUsers({ role: roleFilter, q: search, page, per_page: 50 })
      .then((d) => { setUsers(d.users); setTotal(d.total); })
      .catch(() => showFlash('Failed to load users.', 'error'))
      .finally(() => setLoading(false));
  }, [roleFilter, search, page]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleActive = async (user) => {
    try {
      if (user.is_active) await adminApi.deactivateUser(user.id);
      else                await adminApi.activateUser(user.id);
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
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{total} user{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? <div className="admin-loading"><div className="spinner" /></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Org</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No users found.</td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.email || '—'}</td>
                  <td><Pill color={roleColors[u.role] || 'gray'}>{u.role.replace('_', ' ')}</Pill></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.org_id || '—'}</td>
                  <td><Pill color={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'Active' : 'Inactive'}</Pill></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-action-btn" onClick={() => handleToggleActive(u)} title={u.is_active ? 'Deactivate' : 'Activate'}>{u.is_active ? '🔴' : '🟢'}</button>
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
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {showCreate && <CreateAdminModal onCreated={() => { setShowCreate(false); fetchUsers(); showFlash('Admin user created.'); }} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateAdminModal({ onCreated, onClose }) {
  const [form,   setForm]   = useState({ username: '', email: '', password: '' });
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try { await adminApi.createAdminUser(form); onCreated(); }
    catch (err) { setError(err?.error?.message || 'Failed.'); setSaving(false); }
  };

  return (
    <Modal title="Create DrFahm Admin" onClose={onClose}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={form.username} onChange={set('username')} required /></div>
        <div className="form-group"><label className="form-label">Email (optional)</label><input className="form-input" type="email" value={form.email} onChange={set('email')} /></div>
        <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={form.password} onChange={set('password')} minLength={8} required /></div>
        <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>Max 5 DrFahm admin accounts total.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Admin'}</button>
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