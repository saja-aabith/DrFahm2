import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';

import './styles/global.css';

// Pages
import Login          from './pages/Login';
import Register       from './pages/Register';
import Dashboard      from './pages/Dashboard';
import ExamPage       from './pages/Exam';
import Level          from './pages/Level';
import BillingSuccess from './pages/BillingSuccess';
import Pricing        from './pages/Pricing';
import Schools        from './pages/Schools';
import AdminPanel     from './pages/AdminPanel';

// Placeholder for Home (Chunk 8)
const Home = React.lazy(() =>
  Promise.resolve({
    default: () => (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'Tajawal, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 12 }}>
            <span style={{ color: '#8b5cf6' }}>Dr</span>Fahm
          </div>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>Ace your Qudurat & Tahsili exams</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/register" style={{ background: '#16a34a', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Start Free Trial</a>
            <a href="/pricing"  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Pricing</a>
          </div>
        </div>
      </div>
    )
  })
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
          <Routes>
            {/* Public */}
            <Route path="/"        element={<Home />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/schools" element={<Schools />} />
            <Route path="/login"   element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected — any authenticated user */}
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/exam/:exam" element={
              <ProtectedRoute><ExamPage /></ProtectedRoute>
            } />
            <Route path="/exam/:exam/world/:worldKey/level/:levelNumber" element={
              <ProtectedRoute><Level /></ProtectedRoute>
            } />
            <Route path="/billing/success" element={
              <ProtectedRoute><BillingSuccess /></ProtectedRoute>
            } />

            {/* Admin only */}
            <Route path="/admin" element={
              <AdminRoute><AdminPanel /></AdminRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}