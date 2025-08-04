import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

function Navbar({ modules, showDashboard, onExportPdf, onToggleDashboard, onOpenAuth, onNavigateToHistory }) {
  const { user, logout, isAuthenticated } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  const handleHistory = () => {
    onNavigateToHistory();
    setShowDropdown(false);
  };

  const handleUsernameClick = () => {
    setShowDropdown(!showDropdown);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="nav-left">
        <h1>Taskify It!</h1>
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
          <div className="user-menu" ref={dropdownRef}>
            <div className="username-container">
              <span className="username" onClick={handleUsernameClick}>
                {user?.email}
              </span>
              {showDropdown && (
                <div className="dropdown-menu">
                  <button onClick={handleHistory} className="dropdown-item">
                    <span>📋</span> History
                  </button>
                  <button onClick={handleLogout} className="dropdown-item logout">
                    <span>🚪</span> Log Out
                  </button>
                </div>
              )}
            </div>
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