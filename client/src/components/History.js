import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import '../styles/history.css';

const History = ({ onBackToMain }) => {
  const [historyData, setHistoryData] = useState([]);
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNext: false,
    hasPrev: false
  });
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadHistoryData();
    }
  }, [isAuthenticated]);

  const loadHistoryData = async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/history?page=${page}&limit=10`);
      const { history, pagination: paginationData } = response.data.data;
      
      setHistoryData(history);
      setPagination(paginationData);
    } catch (error) {
      console.error('Error loading history:', error);
      setError('Failed to load history. Please try again.');
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const clearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      try {
        setLoading(true);
        await axios.delete('/history');
        setHistoryData([]);
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          hasNext: false,
          hasPrev: false
        });
      } catch (error) {
        console.error('Error clearing history:', error);
        setError('Failed to clear history. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const deleteSession = async (sessionId) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await axios.delete(`/history/${sessionId}`);
        // Reload current page
        loadHistoryData(pagination.currentPage);
      } catch (error) {
        console.error('Error deleting session:', error);
        setError('Failed to delete session. Please try again.');
      }
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadHistoryData(newPage);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="history-container">
        <div className="history-header">
          <h2>📋 Study History</h2>
          <button onClick={onBackToMain} className="back-button">
            ← Back to Main
          </button>
        </div>
        <div className="history-empty">
          <p>Please sign in to view your study history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>📋 Study History</h2>
        <div className="history-actions">
          {historyData.length > 0 && (
            <button onClick={clearHistory} className="clear-history-btn" disabled={loading}>
              🗑️ Clear All
            </button>
          )}
          <button onClick={onBackToMain} className="back-button">
            ← Back to Main
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => loadHistoryData(pagination.currentPage)} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner">Loading history...</div>
        </div>
      ) : historyData.length === 0 ? (
        <div className="history-empty">
          <div className="empty-icon">📚</div>
          <h3>No Study Sessions Yet</h3>
          <p>Your uploaded PDFs and study tasks will appear here once you start using Taskify It!</p>
          <button onClick={onBackToMain} className="start-studying-btn">
            Start Studying
          </button>
        </div>
      ) : (
        <>
          <div className="history-list">
            {historyData.map((session) => (
              <div key={session._id} className="history-session">
                <div className="session-header" onClick={() => toggleSession(session._id)}>
                  <div className="session-info">
                    <h3 className="session-title">
                      {session.title}
                    </h3>
                    <div className="session-meta">
                      <span className="session-date">{formatDate(session.createdAt)}</span>
                      <span className="session-stats">
                        {session.topicCount} topics • {session.totalTasks} tasks
                      </span>
                    </div>
                  </div>
                  <div className="session-controls">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session._id);
                      }}
                      className="delete-session-btn"
                      title="Delete this session"
                    >
                      🗑️
                    </button>
                    <span className={`expand-icon ${expandedSessions.has(session._id) ? 'expanded' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {expandedSessions.has(session._id) && (
                  <div className="session-content">
                    {session.modules.map((module, moduleIndex) => (
                      <div key={moduleIndex} className="history-module">
                        <h4 className="module-title">
                          {moduleIndex + 1}. {module.topic}
                        </h4>
                        <div className="tasks-grid">
                          {module.tasks.map((task, taskIndex) => (
                            <div key={taskIndex} className="task-card">
                              <div className="task-description">
                                {task.description}
                              </div>
                              {task.resources && task.resources.length > 0 && (
                                <div className="task-resources">
                                  <span className="resources-label">Resources:</span>
                                  <div className="resources-list">
                                    {task.resources.map((resource, resIndex) => (
                                      <a
                                        key={resIndex}
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="resource-link"
                                        title={resource.title}
                                      >
                                        🔗 {resource.title.substring(0, 30)}
                                        {resource.title.length > 30 ? '...' : ''}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="page-btn"
              >
                ← Previous
              </button>
              
              <div className="page-info">
                Page {pagination.currentPage} of {pagination.totalPages}
                <span className="total-items">({pagination.totalItems} total sessions)</span>
              </div>
              
              <button 
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNext}
                className="page-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default History;