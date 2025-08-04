import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import '../../styles/auth.css';

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode);

  // Check if we're on a reset password page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
      setMode('reset');
    }
  }, []);

  if (!isOpen) return null;

  const handleClose = () => {
    // Clear reset token from URL if present
    if (mode === 'reset') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    onClose();
  };

  const renderForm = () => {
    switch (mode) {
      case 'register':
        return (
          <Register
            onSwitchToLogin={() => setMode('login')}
            onClose={handleClose}
          />
        );
      case 'forgot':
        return (
          <ForgotPassword
            onSwitchToLogin={() => setMode('login')}
          />
        );
      case 'reset':
        return (
          <ResetPassword
            onClose={handleClose}
          />
        );
      default:
        return (
          <Login
            onSwitchToRegister={() => setMode('register')}
            onSwitchToForgotPassword={() => setMode('forgot')}
            onClose={handleClose}
          />
        );
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={handleClose}>
          ✕
        </button>
        {renderForm()}
      </div>
    </div>
  );
};

export default AuthModal;