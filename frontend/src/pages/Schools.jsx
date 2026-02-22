import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Schools() {
  return (
    <>
      <Navbar />
      <div className="page" style={{ maxWidth: 800, textAlign: 'center', paddingTop: 80 }}>
        <div className="empty-state">
          <div className="empty-state-icon">🏫</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>School Partnerships</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            Bulk licensing for schools is available. Contact us for custom pricing and provisioning.
          </p>
          <Link to="/dashboard" className="btn btn-violet">Back to Dashboard</Link>
        </div>
      </div>
    </>
  );
}