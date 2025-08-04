import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/auth.css';

const ForgotPassword = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Username or email is required');
      return;
    }

    setLoading(true);
    setError('');
    
    const result = await forgotPassword(email);
    
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="auth-form">
        <div className="auth-header">
          <h2>Check Your Email</h2>
          <p>We've sent password reset instructions to your email address (if an account exists).</p>
        </div>

        <div className="auth-form-content">
          <div className="success-message">
            <span className="success-icon">✓</span>
            <p>If an account with that username/email exists, you'll receive a password reset link shortly.</p>
          </div>

          <button 
            type="button" 
            className="auth-submit-btn"
            onClick={onSwitchToLogin}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Forgot Password</h2>
        <p>Enter your username or email address and we'll send you a link to reset your password.</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form-content">
        {error && (
          <div className="error-message general-error">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Username or Email</label>
          <input
            type="text"
            id="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            className={error ? 'error' : ''}
            placeholder="Enter your username or email"
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          className="auth-submit-btn"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <div className="auth-links">
          <button 
            type="button" 
            className="link-button"
            onClick={onSwitchToLogin}
            disabled={loading}
          >
            Back to Sign In
          </button>
        </div>
      </form>
    </div>
  );
};

export default ForgotPassword;