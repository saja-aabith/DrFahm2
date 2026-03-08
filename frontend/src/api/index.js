/**
 * API client — wraps fetch with:
 * - Auto Bearer token from localStorage
 * - JSON body serialization
 * - 401 → attempt refresh → retry once
 * - Consistent error shape: { error: { code, message, details } }
 */

const BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function getTokens() {
  return {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  };
}

function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem('access_token', access_token);
  if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function refreshAccessToken() {
  const { refresh } = getTokens();
  if (!refresh) throw new Error('No refresh token');

  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refresh}` },
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  setTokens({ access_token: data.access_token });
  return data.access_token;
}

async function request(path, options = {}, retry = true) {
  const { access } = getTokens();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Token expired — try refresh once
  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return request(path, options, false);
    } catch {
      clearTokens();
      window.dispatchEvent(new Event('auth:logout'));
      throw { status: 401, error: { code: 'unauthenticated', message: 'Session expired.' } };
    }
  }

  // Parse JSON regardless of status
  let body;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    throw { status: res.status, ...body };
  }

  return body;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login:    (data) => request('/api/auth/login',    { method: 'POST', body: JSON.stringify(data) }),
  refresh:  ()     => request('/api/auth/refresh',  { method: 'POST' }),
  me:       ()     => request('/api/auth/me'),
  logout:   ()     => request('/api/auth/logout',   { method: 'POST' }),
};

// ── Billing ─────────────────────────────────────────────────────────────────

export const billing = {
  createCheckoutSession: (data) =>
    request('/api/billing/create-checkout-session', { method: 'POST', body: JSON.stringify(data) }),
  getEntitlements: () => request('/api/billing/entitlements'),
};

// ── Exams ───────────────────────────────────────────────────────────────────

export const exams = {
  worldMap:   (exam)                            => request(`/api/exams/${exam}/world-map`),
  progress:   (exam)                            => request(`/api/exams/${exam}/progress`),

  // Canonical names (used by LevelPage.jsx — Chunk H)
  getQuestions: (exam, worldKey, levelNumber)        =>
    request(`/api/exams/${exam}/worlds/${worldKey}/levels/${levelNumber}/questions`),
  submitLevel:  (exam, worldKey, levelNumber, answers) =>
    request(`/api/exams/${exam}/worlds/${worldKey}/levels/${levelNumber}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  // Legacy aliases — kept so any existing callers don't break
  questions: (exam, worldKey, levelNumber)           =>
    request(`/api/exams/${exam}/worlds/${worldKey}/levels/${levelNumber}/questions`),
  submit:    (exam, worldKey, levelNumber, answers)  =>
    request(`/api/exams/${exam}/worlds/${worldKey}/levels/${levelNumber}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
};

export { setTokens, clearTokens, getTokens };