/**
 * Admin API client — all /api/admin/* calls.
 * Only used by AdminPanel. Requires drfahm_admin JWT.
 */

const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function getToken() {
  return localStorage.getItem('access_token');
}

async function adminRequest(path, options = {}) {
  const token   = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  // For CSV downloads — return raw response
  if (options._raw) return res;

  let body;
  try { body = await res.json(); } catch { body = {}; }

  if (!res.ok) throw { status: res.status, ...body };
  return body;
}

// ── Stats ────────────────────────────────────────────────────────────────────
export const getStats = () => adminRequest('/api/admin/stats');

// ── Topics ───────────────────────────────────────────────────────────────────
export const getTopics       = (section) => adminRequest(`/api/admin/topics${section ? '?section=' + section : ''}`);
export const topicCoverage   = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  ).toString();
  return adminRequest(`/api/admin/questions/topic-coverage${qs ? '?' + qs : ''}`);
};

// ── Questions ────────────────────────────────────────────────────────────────
export const listQuestions = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  ).toString();
  return adminRequest(`/api/admin/questions${qs ? '?' + qs : ''}`);
};

export const getQuestion     = (id)       => adminRequest(`/api/admin/questions/${id}`);
export const updateQuestion  = (id, data) => adminRequest(`/api/admin/questions/${id}`, { method: 'PUT',   body: JSON.stringify(data) });
export const deleteQuestion  = (id)       => adminRequest(`/api/admin/questions/${id}`, { method: 'DELETE' });
export const toggleQuestion  = (id, is_active) => adminRequest(`/api/admin/questions/${id}/activate`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
export const importQuestions = (arr)      => adminRequest('/api/admin/questions/import', { method: 'POST', body: JSON.stringify(arr) });
export const nextIndex       = (exam, world_key) => adminRequest(`/api/admin/questions/next-index?exam=${exam}&world_key=${world_key}`);
export const bulkActivate    = (data)     => adminRequest('/api/admin/questions/bulk-activate', { method: 'POST', body: JSON.stringify(data) });
export const bulkTopic       = (data)     => adminRequest('/api/admin/questions/bulk-topic', { method: 'POST', body: JSON.stringify(data) });
export const reviewProgress  = (exam)     => adminRequest(`/api/admin/questions/review-progress${exam ? '?exam=' + exam : ''}`);
export const markReviewed    = (id, version) => adminRequest(`/api/admin/questions/${id}/mark-reviewed`, { method: 'PATCH', body: JSON.stringify({ version }) });

/**
 * Quick inline update — sends only changed field + version for optimistic locking.
 * Used by inline answer picker, inline difficulty picker, and inline topic picker.
 */
export const quickUpdate = (id, field, value, version) =>
  adminRequest(`/api/admin/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ [field]: value, version }),
  });

// ── Orgs ─────────────────────────────────────────────────────────────────────
export const listOrgs          = (params = {}) => adminRequest('/api/admin/orgs?' + new URLSearchParams(params));
export const createOrg         = (data)        => adminRequest('/api/admin/orgs', { method: 'POST', body: JSON.stringify(data) });
export const getOrg            = (id)          => adminRequest(`/api/admin/orgs/${id}`);
export const createOrgLeader   = (id, data)    => adminRequest(`/api/admin/orgs/${id}/leader`, { method: 'POST', body: JSON.stringify(data) });
export const generateStudents  = (id, data)    => adminRequest(`/api/admin/orgs/${id}/students/generate`, { method: 'POST', body: JSON.stringify(data) });
export const exportStudentsCsv = (id)          => adminRequest(`/api/admin/orgs/${id}/students/export`, { _raw: true });
export const grantOrgEntitlement = (id, data)  => adminRequest(`/api/admin/orgs/${id}/entitlement`, { method: 'POST', body: JSON.stringify(data) });

// ── Users ────────────────────────────────────────────────────────────────────
export const listUsers       = (params = {}) => adminRequest('/api/admin/users?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))));
export const createUser      = (data)        => adminRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
export const activateUser    = (id)          => adminRequest(`/api/admin/users/${id}/activate`, { method: 'PATCH' });
export const deactivateUser  = (id)          => adminRequest(`/api/admin/users/${id}/deactivate`, { method: 'PATCH' });
export const resetPassword   = (id, data)    => adminRequest(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) });