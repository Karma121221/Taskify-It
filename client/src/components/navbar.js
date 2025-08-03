import React from 'react';

function Navbar({ modules, showDashboard, onExportPdf, onToggleDashboard }) {
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
      </div>
    </nav>
  );
}

export default Navbar;