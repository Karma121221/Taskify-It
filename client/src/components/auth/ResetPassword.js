import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/auth.css';

const ResetPassword = ({ onClose }) => {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [token, setToken] = useState('');

  const { resetPassword } = useAuth();

  useEffect(() => {
    // Get token from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (resetToken) {
      setToken(resetToken);
    } else {
      setErrors({ general: 'Invalid reset link. Please request a new password reset.' });
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    const result = await resetPassword(token, formData.password);
    
    if (result.success) {
      setSuccess(true);
    } else {
      setErrors({ general: result.message });
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="auth-form">
        <div className="auth-header">
          <h2>Password Reset Successful</h2>
          <p>Your password has been successfully updated.</p>
        </div>

        <div className="auth-form-content">
          <div className="success-message">
            <span className="success-icon">✓</span>
            <p>You can now sign in with your new password.</p>
          </div>

          <button 
            type="button" 
            className="auth-submit-btn"
            onClick={onClose}
          >
            Continue to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Reset Password</h2>
        <p>Enter your new password below.</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form-content">
        {errors.general && (
          <div className="error-message general-error">
            {errors.general}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="password">New Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={errors.password ? 'error' : ''}
            placeholder="Enter your new password (minimum 6 characters)"
            disabled={loading}
          />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={errors.confirmPassword ? 'error' : ''}
            placeholder="Confirm your new password"
            disabled={loading}
          />
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
        </div>

        <button 
          type="submit" 
          className="auth-submit-btn"
          disabled={loading || !token}
        >
          {loading ? 'Updating Password...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;