/**
 * Admin API client.
 *
 * All requests attach the JWT from localStorage as a Bearer token.
 * All JSON responses that are not 2xx throw an error with the shape:
 *   { error: { code, message, details }, status }
 *
 * Exception: bulkTemplate() returns the raw Response so the caller
 * can stream it as a blob download.
 */

const API_BASE = process.env.REACT_APP_API_URL || '';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.error  = data?.error  || { code: 'unknown', message: `HTTP ${res.status}` };
    err.status = res.status;
    throw err;
  }

  return data;
}

function jsonBody(body) {
  return {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  };
}

function jsonPatch(body) {
  return {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  };
}

function jsonPut(body) {
  return {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  };
}

function toQuery(params) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
}


// ── Review progress + topic coverage ─────────────────────────────────────────

export const reviewProgress = (exam = '') =>
  apiFetch(`/api/admin/questions/review-progress${exam ? `?exam=${exam}` : ''}`);

export const topicCoverage = ({ exam = '', section = '' } = {}) =>
  apiFetch(`/api/admin/questions/topic-coverage${toQuery({ exam, section })}`);


// ── Topics taxonomy ───────────────────────────────────────────────────────────

export const getTopics = (section = '') =>
  apiFetch(`/api/admin/topics${section ? `?section=${section}` : ''}`);


// ── Question list / CRUD ──────────────────────────────────────────────────────

export const listQuestions = (params = {}) =>
  apiFetch(`/api/admin/questions${toQuery(params)}`);

export const getQuestion = (id) =>
  apiFetch(`/api/admin/questions/${id}`);

/**
 * Full update with optimistic lock.
 * Pass the entire changed object plus { version }.
 */
export const updateQuestion = (id, data) =>
  apiFetch(`/api/admin/questions/${id}`, jsonPut(data));

/**
 * Single-field inline update (e.g. correct_answer, topic, difficulty).
 * Sends a PUT with only that one field plus the version lock.
 */
export const quickUpdate = (id, field, value, version) =>
  apiFetch(`/api/admin/questions/${id}`, jsonPut({ [field]: value, version }));

export const deleteQuestion = (id) =>
  apiFetch(`/api/admin/questions/${id}`, { method: 'DELETE' });

export const toggleQuestion = (id, isActive) =>
  apiFetch(`/api/admin/questions/${id}/activate`, jsonPatch({ is_active: isActive }));

export const markReviewed = (id, version) =>
  apiFetch(`/api/admin/questions/${id}/mark-reviewed`, jsonPatch({ version }));

export const nextIndex = (exam, worldKey) =>
  apiFetch(`/api/admin/questions/next-index?exam=${exam}&world_key=${worldKey}`);


// ── Bulk question operations ──────────────────────────────────────────────────

export const bulkActivate = ({ is_active, exam, world_key, ids } = {}) =>
  apiFetch('/api/admin/questions/bulk-activate', jsonBody({ is_active, exam, world_key, ids }));

export const bulkTopic = ({ topic, exam, world_key, ids } = {}) =>
  apiFetch('/api/admin/questions/bulk-topic', jsonBody({ topic, exam, world_key, ids }));

export const bulkDelete = (ids) =>
  apiFetch('/api/admin/questions/bulk-delete', jsonBody({ question_ids: ids, confirm: true }));

export const bulkAssign = (ids, assign) =>
  apiFetch('/api/admin/questions/bulk-assign', jsonBody({ question_ids: ids, assign }));

export const importQuestions = (payload) =>
  apiFetch('/api/admin/questions/import', jsonBody(payload));


// ── AI Review  (Chunk J + K1) ─────────────────────────────────────────────────

export const aiReview = (questionIds, overwrite = false) =>
  apiFetch('/api/admin/questions/ai-review', jsonBody({ question_ids: questionIds, overwrite }));

export const approveReview = (id, body) =>
  apiFetch(`/api/admin/questions/${id}/approve-review`, jsonPatch(body));

export const rejectReview = (id, version) =>
  apiFetch(`/api/admin/questions/${id}/reject-review`, jsonPatch({ version }));


// ── Bulk CSV upload ───────────────────────────────────────────────────────────

/**
 * Returns raw Response (not parsed JSON) so the caller can blob-download it.
 */
export const bulkTemplate = () =>
  fetch(`${API_BASE}/api/admin/questions/bulk-template`, {
    headers: authHeaders(),
  });

export const bulkValidate = (file) => {
  const form = new FormData();
  form.append('file', file);
  return apiFetch('/api/admin/questions/bulk-validate', { method: 'POST', body: form });
};

export const bulkCommit = (file, forceDuplicates = false) => {
  const form = new FormData();
  form.append('file', file);
  const qs = forceDuplicates ? '?force_duplicates=true' : '';
  return apiFetch(`/api/admin/questions/bulk-commit${qs}`, { method: 'POST', body: form });
};


// ── World Allocation Tools  (Chunk K2) ────────────────────────────────────────

/**
 * GET /api/admin/worlds/health
 * Returns per-world fill status, topic/difficulty breakdown, student progress count.
 * Optional exam filter (qudurat | tahsili); omit to get all exams.
 */
export const getWorldHealth = (exam = '') =>
  apiFetch(`/api/admin/worlds/health${exam ? `?exam=${exam}` : ''}`);

/**
 * POST /api/admin/worlds/:worldKey/smart-fill
 * Pull unassigned questions from the bank into the world using criteria filters.
 *
 * body: {
 *   exam           string   required
 *   topics         [str]    optional
 *   difficulty     string   optional  easy | medium | hard
 *   min_confidence float    optional  0.0 – 1.0
 *   max_fill       int      optional
 *   activate       bool     optional  default false
 * }
 */
export const smartFill = (worldKey, body) =>
  apiFetch(`/api/admin/worlds/${worldKey}/smart-fill`, jsonBody(body));

/**
 * POST /api/admin/worlds/:worldKey/clear
 * Return all questions in the world to the unassigned bank.
 * Student progress records are preserved.
 *
 * body: {
 *   exam     string  required
 *   confirm  bool    required
 *   force    bool    optional  set true to bypass student-progress 409
 * }
 */
export const clearWorld = (worldKey, body) =>
  apiFetch(`/api/admin/worlds/${worldKey}/clear`, jsonBody(body));


// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = () =>
  apiFetch('/api/admin/stats');


// ── Orgs ──────────────────────────────────────────────────────────────────────

export const listOrgs = (params = {}) =>
  apiFetch(`/api/admin/orgs${toQuery(params)}`);

export const createOrg = (data) =>
  apiFetch('/api/admin/orgs', jsonBody(data));

export const getOrg = (id) =>
  apiFetch(`/api/admin/orgs/${id}`);


// ── Users ─────────────────────────────────────────────────────────────────────

export const listUsers = (params = {}) =>
  apiFetch(`/api/admin/users${toQuery(params)}`);

export const createUser = (data) =>
  apiFetch('/api/admin/users', jsonBody(data));

export const activateUser = (id) =>
  apiFetch(`/api/admin/users/${id}/activate`, jsonPatch({}));

export const deactivateUser = (id) =>
  apiFetch(`/api/admin/users/${id}/deactivate`, jsonPatch({}));

export const resetPassword = (id, data) =>
  apiFetch(`/api/admin/users/${id}/reset-password`, jsonBody(data));