import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/auth.css';

const Login = ({ onSwitchToRegister, onSwitchToForgotPassword, onClose }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { login } = useAuth();

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

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      onClose();
    } else {
      setErrors({ general: result.message });
    }
    setLoading(false);
  };

  return (
    <div className="auth-form">
      <div className="auth-header">
        <h2>Welcome Back</h2>
        <p>Sign in to your Taskify It account</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form-content">
        {errors.general && (
          <div className="error-message general-error">
            {errors.general}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? 'error' : ''}
            placeholder="Enter your email"
            disabled={loading}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={errors.password ? 'error' : ''}
            placeholder="Enter your password"
            disabled={loading}
          />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <button 
          type="submit" 
          className="auth-submit-btn"
          disabled={loading}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        <div className="auth-links">
          <button 
            type="button" 
            className="link-button"
            onClick={onSwitchToForgotPassword}
            disabled={loading}
          >
            Forgot your password?
          </button>
        </div>

        <div className="auth-divider">
          <span>Don't have an account?</span>
        </div>

        <button 
          type="button" 
          className="auth-secondary-btn"
          onClick={onSwitchToRegister}
          disabled={loading}
        >
          Create Account
        </button>
      </form>
    </div>
  );
};

export default Login;