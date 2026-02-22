import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to={user ? '/dashboard' : '/'} className="navbar-logo">
          <span className="logo-dr">Dr</span>
          <span className="logo-fahm">Fahm</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          {!user ? (
            <>
              <Link to="/pricing" className={`nav-link ${isActive('/pricing') ? 'active' : ''}`}>
                Pricing
              </Link>
              <Link to="/schools" className={`nav-link ${isActive('/schools') ? 'active' : ''}`}>
                Schools
              </Link>
              <Link to="/login" className="nav-link">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Start Free</Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                Dashboard
              </Link>
              {user.role === 'drfahm_admin' && (
                <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
                  Admin
                </Link>
              )}
              <span className="nav-username">{user.username}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>

        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}