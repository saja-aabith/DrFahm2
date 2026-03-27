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

/**
 * Multipart form upload — used for CSV bulk operations.
 * Does NOT set Content-Type (browser sets it with boundary).
 */
async function adminUpload(path, formData, queryParams = '') {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${BASE}${path}${queryParams ? '?' + queryParams : ''}`;
  const res = await fetch(url, { method: 'POST', headers, body: formData });

  let body;
  try { body = await res.json(); } catch { body = {}; }

  if (!res.ok) throw { status: res.status, ...body };
  return body;
}

// ── Stats ────────────────────────────────────────────────────────────────────
export const getStats = () => adminRequest('/api/admin/stats');

// ── Topics ───────────────────────────────────────────────────────────────────
export const getTopics = (section) =>
  adminRequest(`/api/admin/topics${section ? '?section=' + section : ''}`);

export const topicCoverage = (params = {}) => {
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

export const getQuestion    = (id)       => adminRequest(`/api/admin/questions/${id}`);
export const updateQuestion = (id, data) => adminRequest(`/api/admin/questions/${id}`, { method: 'PUT',    body: JSON.stringify(data) });
export const deleteQuestion = (id)       => adminRequest(`/api/admin/questions/${id}`, { method: 'DELETE' });
export const toggleQuestion = (id, is_active) => adminRequest(`/api/admin/questions/${id}/activate`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
export const importQuestions = (arr)     => adminRequest('/api/admin/questions/import', { method: 'POST', body: JSON.stringify(arr) });
export const nextIndex       = (exam, world_key) => adminRequest(`/api/admin/questions/next-index?exam=${exam}&world_key=${world_key}`);
export const bulkActivate    = (data)    => adminRequest('/api/admin/questions/bulk-activate', { method: 'POST', body: JSON.stringify(data) });
export const bulkTopic       = (data)    => adminRequest('/api/admin/questions/bulk-topic',    { method: 'POST', body: JSON.stringify(data) });
export const reviewProgress  = (exam)    => adminRequest(`/api/admin/questions/review-progress${exam ? '?exam=' + exam : ''}`);
export const markReviewed    = (id, version) => adminRequest(`/api/admin/questions/${id}/mark-reviewed`, { method: 'PATCH', body: JSON.stringify({ version }) });

/**
 * Quick inline update — sends only the changed field + version for optimistic locking.
 */
export const quickUpdate = (id, field, value, version) =>
  adminRequest(`/api/admin/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ [field]: value, version }),
  });

// ── Bulk Delete ──────────────────────────────────────────────────────────────

/**
 * Soft-delete a list of questions by ID.
 * @param {number[]} questionIds
 * @returns {{ deleted: number, message: string }}
 */
export const bulkDelete = (questionIds) =>
  adminRequest('/api/admin/questions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ question_ids: questionIds, confirm: true }),
  });

// ── Bulk Assign ──────────────────────────────────────────────────────────────

/**
 * Bulk assign topic, difficulty, and/or world_key to selected questions.
 *
 * @param {number[]} questionIds
 * @param {{ topic?: string, difficulty?: string, world_key?: string }} assign
 *   Only include fields you want to change — others are left untouched.
 * @returns {{ affected: number, assigned: object, skipped: object[], message: string }}
 */
export const bulkAssign = (questionIds, assign) =>
  adminRequest('/api/admin/questions/bulk-assign', {
    method: 'POST',
    body: JSON.stringify({ question_ids: questionIds, assign }),
  });

// ── Bulk CSV Upload ──────────────────────────────────────────────────────────

/**
 * Download the CSV template for bulk upload.
 * Columns: exam, section, question_text, option_a–d, correct_answer, hint, topic, difficulty
 * NOTE: world_key is NOT a column — world assignment is done via bulk-assign after upload.
 * NOTE: hint column may be left empty — AI Review will generate it.
 */
export const bulkTemplate = () =>
  adminRequest('/api/admin/questions/bulk-template', { _raw: true });

/**
 * Validate a CSV file (dry run — no DB changes).
 * @param {File} file
 * @returns {{ stats, errors, duplicates, preview }}
 */
export const bulkValidate = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return adminUpload('/api/admin/questions/bulk-validate', fd);
};

/**
 * Commit a CSV file — insert all valid rows into the question bank.
 * Questions are inserted unassigned (no world_key) and inactive.
 * @param {File} file
 * @param {boolean} forceDuplicates — also insert flagged duplicates
 * @returns {{ inserted, skipped, errors, duplicates, message }}
 */
export const bulkCommit = (file, forceDuplicates = false) => {
  const fd = new FormData();
  fd.append('file', file);
  const qs = forceDuplicates ? 'force_duplicates=true' : '';
  return adminUpload('/api/admin/questions/bulk-commit', fd, qs);
};

// ── Orgs ─────────────────────────────────────────────────────────────────────
export const listOrgs            = (params = {}) => adminRequest('/api/admin/orgs?' + new URLSearchParams(params));
export const createOrg           = (data)        => adminRequest('/api/admin/orgs', { method: 'POST', body: JSON.stringify(data) });
export const getOrg              = (id)          => adminRequest(`/api/admin/orgs/${id}`);
export const createOrgLeader     = (id, data)    => adminRequest(`/api/admin/orgs/${id}/leader`, { method: 'POST', body: JSON.stringify(data) });
export const generateStudents    = (id, data)    => adminRequest(`/api/admin/orgs/${id}/students/generate`, { method: 'POST', body: JSON.stringify(data) });
export const exportStudentsCsv   = (id)          => adminRequest(`/api/admin/orgs/${id}/students/export`, { _raw: true });
export const grantOrgEntitlement = (id, data)    => adminRequest(`/api/admin/orgs/${id}/entitlement`, { method: 'POST', body: JSON.stringify(data) });

// ── Users ────────────────────────────────────────────────────────────────────
export const listUsers      = (params = {}) => adminRequest('/api/admin/users?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))));
export const createUser     = (data)        => adminRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
export const activateUser   = (id)          => adminRequest(`/api/admin/users/${id}/activate`,      { method: 'PATCH' });
export const deactivateUser = (id)          => adminRequest(`/api/admin/users/${id}/deactivate`,    { method: 'PATCH' });
export const resetPassword  = (id, data)    => adminRequest(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(data) });

// ── AI Review ────────────────────────────────────────────────────────────────

/**
 * Trigger AI review for a batch of questions (max 20 per call).
 * The frontend (AIReviewModal) batches larger selections automatically.
 *
 * The LLM proposes: predicted_answer, confidence, review_note, proposed_hint,
 * and (K1) predicted_topic.
 * Nothing is written to correct_answer, hint, or topic until admin explicitly approves.
 *
 * @param {number[]} questionIds  — array of integer question IDs, max 20
 * @param {boolean}  overwrite    — if true, re-reviews already-approved questions
 * @returns {{
 *   processed: number,
 *   failed: number,
 *   skipped_approved: number[],
 *   results: Array<{
 *     question_id: number,
 *     status: 'reviewed'|'failed',
 *     predicted_answer: string|null,
 *     confidence: number|null,
 *     review_note: string|null,
 *     proposed_hint: string|null,
 *     predicted_topic: string|null,
 *     error: string|null
 *   }>,
 *   message: string
 * }}
 */
export const aiReview = (questionIds, overwrite = false) =>
  adminRequest('/api/admin/questions/ai-review', {
    method: 'POST',
    body: JSON.stringify({ question_ids: questionIds, overwrite }),
  });

/**
 * Approve AI review suggestions for a single question.
 * Uses optimistic locking — version must match the current DB version.
 *
 * @param {number} id
 * @param {{
 *   version: number,           — required
 *   accept_answer?: boolean,   — default true: copies llm_predicted_answer → correct_answer
 *   accept_hint?: boolean,     — default true: copies llm_proposed_hint → hint
 *   accept_topic?: boolean,    — default true: copies llm_predicted_topic → topic (K1)
 *   correct_answer?: string    — optional override ('a'|'b'|'c'|'d')
 *   topic?: string             — optional override: topic key for the question's section (K1)
 * }} body
 * @returns {{ question: object }}
 */
export const approveReview = (id, body) =>
  adminRequest(`/api/admin/questions/${id}/approve-review`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

/**
 * Reject AI review suggestions for a single question.
 * Sets review_status='rejected'. correct_answer, hint, and topic are NOT changed.
 * Admin should then edit the question manually via the standard edit modal.
 *
 * @param {number} id
 * @param {number} version  — current version for optimistic locking
 * @returns {{ question: object }}
 */
export const rejectReview = (id, version) =>
  adminRequest(`/api/admin/questions/${id}/reject-review`, {
    method: 'PATCH',
    body: JSON.stringify({ version }),
  });