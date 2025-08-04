import React from 'react';
import { useAuth } from '../contexts/AuthContext';

function Navbar({ modules, showDashboard, onExportPdf, onToggleDashboard, onOpenAuth }) {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-left">
        <h1>Taskitize It!</h1>
        <div className="nav-tagline">Upload your syllabus to generate personalized study tasks</div>
      </div>
      <div className="nav-right">
        {modules.length > 0 && (
          <>
            <button onClick={onExportPdf} className="nav-button">
              <span>📄</span> Export PDF
            </button>
            <button 
              onClick={onToggleDashboard} 
              className="nav-button"
            >
              {showDashboard ? <><span>📚</span> View Tasks</> : <><span>📊</span> Dashboard</>}
            </button>
          </>
        )}
        
        {isAuthenticated ? (
          <div className="auth-section">
            <span className="user-email">{user?.email}</span>
            <button onClick={logout} className="nav-button logout-btn">
              <span>🚪</span> Logout
            </button>
          </div>
        ) : (
          <button onClick={() => onOpenAuth('login')} className="nav-button auth-btn">
            <span>👤</span> Sign In
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;