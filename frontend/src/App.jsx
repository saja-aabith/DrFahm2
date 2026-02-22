import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Pages stubbed — implemented in later chunks
const Placeholder = ({ name }) => (
  <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
    <h2>{name}</h2>
    <p>Coming in a later chunk.</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                element={<Placeholder name="Home" />} />
        <Route path="/pricing"         element={<Placeholder name="Pricing" />} />
        <Route path="/schools"         element={<Placeholder name="Schools" />} />
        <Route path="/login"           element={<Placeholder name="Login" />} />
        <Route path="/register"        element={<Placeholder name="Register" />} />
        <Route path="/dashboard"       element={<Placeholder name="Dashboard" />} />
        <Route path="/exam/:exam"      element={<Placeholder name="Exam World Map" />} />
        <Route path="/exam/:exam/world/:worldKey/level/:levelNumber"
                                       element={<Placeholder name="Level" />} />
        <Route path="/billing/success" element={<Placeholder name="Billing Success" />} />
        <Route path="/admin"           element={<Placeholder name="Admin Panel" />} />
        <Route path="*"                element={<Placeholder name="404 — Not Found" />} />
      </Routes>
    </BrowserRouter>
  );
}