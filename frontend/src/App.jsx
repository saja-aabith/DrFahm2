import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import Home           from './pages/Home';

// Global components
import WhatsAppFloat  from './components/WhatsAppFloat';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// Syncs <html dir> and <html lang> whenever the language changes.
// Lives inside BrowserRouter so it re-renders correctly.
function LanguageSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const isAr = i18n.language === 'ar';
    document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageSync />
        <ScrollToTop />
        <Routes>
          {/* Public */}
          <Route path="/"         element={<Home />} />
          <Route path="/pricing"  element={<Pricing />} />
          <Route path="/schools"  element={<Schools />} />
          <Route path="/login"    element={<Login />} />
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

        {/* WhatsApp float visible on every page */}
        <WhatsAppFloat />
      </AuthProvider>
    </BrowserRouter>
  );
}