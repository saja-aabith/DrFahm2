import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AdminPanel() {
  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Question management, org provisioning, and user administration.</p>
        </div>
        <div className="alert alert-info">
          Admin Panel UI is implemented in Chunk 7. Backend APIs are ready.
        </div>
        <Link to="/dashboard" className="btn btn-ghost" style={{ marginTop: 16 }}>← Dashboard</Link>
      </div>
    </>
  );
}