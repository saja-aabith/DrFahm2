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

import Home from './pages/Home';


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}