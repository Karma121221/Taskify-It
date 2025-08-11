import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../config';
import '../styles/autosuggest.css';

const AutoPlanAgentModal = ({ open, onClose, jobId, onPlanReady }) => {
  const [jobStatus, setJobStatus] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!open || !jobId) return;

    const pollJobStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${config.API_BASE_URL}/agent/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.status === 'success') {
          setJobStatus(response.data.job);
          setError(null);
        } else {
          setError(response.data.message || 'Failed to fetch job status');
        }
      } catch (err) {
        console.error('Job polling error:', err);
        let errorMessage = 'Network error';
        
        // Check if it's a connection error (likely Render services sleeping)
        if (err.code === 'ECONNREFUSED' || err.response?.status >= 500 || !err.response) {
          errorMessage = '⏳ Backend services are starting up (Render free tier). Please wait 30-60 seconds and try again...';
        } else {
          errorMessage = err.response?.data?.message || 'Network error';
        }
        
        setError(errorMessage);
      }
    };

    // Initial fetch
    pollJobStatus();

    // Poll every second if job is running
    const interval = setInterval(() => {
      if (jobStatus?.status === 'success' || jobStatus?.status === 'error') {
        clearInterval(interval);
        return;
      }
      pollJobStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [open, jobId, retrying, jobStatus?.status]);

  const handleRetry = async () => {
    try {
      setRetrying(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      await axios.post(`${config.API_BASE_URL}/agent/jobs/${jobId}/retry`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Reset job status to trigger re-polling
      setJobStatus(prev => ({
        ...prev,
        status: 'pending',
        steps: prev.steps.map(step => 
          step.status === 'error' ? { ...step, status: 'pending', detail: null } : step
        )
      }));
    } catch (err) {
      console.error('Retry error:', err);
      setError(err.response?.data?.message || 'Failed to retry job');
    } finally {
      setRetrying(false);
    }
  };

  const handleViewPlan = () => {
    if (jobStatus?.result?.planData && onPlanReady) {
      onPlanReady(jobStatus.result.planData);
    }
    onClose();
  };

  const getStepIcon = (step) => {
    switch (step.status) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'running':
        return '⏳';
      default:
        return '⏸️';
    }
  };

  const getStepStatusClass = (step) => {
    switch (step.status) {
      case 'success':
        return 'step-success';
      case 'error':
        return 'step-error';
      case 'running':
        return 'step-running';
      default:
        return 'step-pending';
    }
  };

  if (!open) return null;

  return (
    <div className="autosuggest-overlay" onClick={onClose}>
      <div className="autosuggest-modal" onClick={e => e.stopPropagation()}>
        <div className="autosuggest-header">
          <h2>📚 Syllabus Parser → Plan Agent</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="autosuggest-content">
          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
            </div>
          )}

          {jobStatus && (
            <div className="job-progress">
              <div className="job-status-header">
                <h3>Processing Status: {jobStatus.status}</h3>
                {jobStatus.status === 'running' && (
                  <div className="spinner">⏳</div>
                )}
              </div>

              <div className="steps-container">
                {jobStatus.steps.map((step, index) => (
                  <div key={step.name} className={`step-item ${getStepStatusClass(step)}`}>
                    <div className="step-header">
                      <span className="step-icon">{getStepIcon(step)}</span>
                      <span className="step-name">{step.name}</span>
                      <span className="step-status">{step.status}</span>
                    </div>
                    
                    {step.detail && (
                      <div className="step-detail">
                        {step.detail}
                      </div>
                    )}
                    
                    {step.status === 'running' && (
                      <div className="step-progress">
                        <div className="progress-bar">
                          <div className="progress-fill"></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {jobStatus.status === 'success' && jobStatus.result && (
                <div className="success-actions">
                  <p className="success-message">
                    ✅ Syllabus successfully parsed and study plan generated!
                  </p>
                  <button className="view-plan-btn" onClick={handleViewPlan}>
                    📋 View Study Plan
                  </button>
                </div>
              )}

              {jobStatus.status === 'error' && (
                <div className="error-actions">
                  <p className="error-message">
                    ❌ Processing failed. You can retry the failed step.
                  </p>
                  <button 
                    className="retry-btn" 
                    onClick={handleRetry}
                    disabled={retrying}
                  >
                    {retrying ? '⏳ Retrying...' : '🔄 Retry'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!jobStatus && !error && (
            <div className="loading-state">
              <div className="spinner">⏳</div>
              <p>Initializing job...</p>
            </div>
          )}
        </div>

        <div className="autosuggest-footer">
          <button className="cancel-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoPlanAgentModal;
