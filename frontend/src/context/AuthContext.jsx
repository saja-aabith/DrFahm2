import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi, setTokens, clearTokens } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from stored tokens on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((data) => setUser(data.user))
      .catch(() => { clearTokens(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  // Listen for forced logout (401 + refresh failed in api layer)
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await authApi.login({ username: identifier, password });
    setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
    setUser(data.user);
    return data.user;
  }, []);

  // NOTE: backend auth.py register endpoint needs to accept + store phone_number.
  // Migration required: ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
  const register = useCallback(async (username, email, password, phone_number) => {
    const data = await authApi.register({ username, email, password, phone_number });
    setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}