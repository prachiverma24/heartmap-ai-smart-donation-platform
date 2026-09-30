import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { authLoginVisual } from '../data/visuals';
import './AuthPage.css';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(form);
      navigate(location.state?.from || '/', { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
        'Unable to sign in. Please verify your credentials and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-split-wrapper">
      {/* Left Column: Visual & Emotional Context */}
      <div className="auth-visual-column">
        <img
          src={authLoginVisual}
          alt="Hands passing a donation box with warmth"
          className="auth-hero-image"
        />
        <div className="auth-visual-gradient" />

        <div className="auth-visual-content">
          <Link to="/" className="auth-brand-pill">
            <span className="pill-heart">♥</span>
            <span>HeartMap Platform</span>
          </Link>

          <blockquote className="auth-quote">
            “Giving isn’t just about making a donation. It’s about making a difference.”
          </blockquote>

          <div className="auth-trust-highlights">
            <div className="trust-badge-item">
              <span className="badge-icon">✓</span>
              <span>Direct, unmediated connections</span>
            </div>
            <div className="trust-badge-item">
              <span className="badge-icon">✓</span>
              <span>Transparent organization reviews</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Clean Login Form */}
      <div className="auth-form-column">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="auth-card-header">
            <span className="auth-card-eyebrow">WELCOME BACK</span>
            <h1 className="auth-card-title">Sign in to HeartMap</h1>
            <p className="auth-card-subtext">
              Access community help requests, verified NGO opportunities, and AI recommendations.
            </p>
          </div>

          {error && (
            <motion.div
              className="auth-alert-error"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="alert-icon">⚠</span>
              <span>{error}</span>
            </motion.div>
          )}

          {forgotNotice && (
            <motion.div
              className="auth-alert-info"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="alert-icon">ℹ</span>
              <span>For password recovery assistance, please reach out to our administration team at <strong>support@heartmap.org</strong>.</span>
            </motion.div>
          )}

          <form className="auth-form-root" onSubmit={handleSubmit}>
            <div className="form-field-group">
              <label htmlFor="login-email" className="field-label">Email Address</label>
              <div className="input-wrapper">
                <input
                  id="login-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="text-input"
                />
              </div>
            </div>

            <div className="form-field-group">
              <div className="field-label-row">
                <label htmlFor="login-password" className="field-label">Password</label>
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => setForgotNotice(!forgotNotice)}
                >
                  Forgot password?
                </button>
              </div>

              <div className="input-wrapper password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="text-input"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide plain text' : 'Reveal plain text'}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <div className="form-options-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="checkbox-input"
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            <motion.button
              type="submit"
              className="btn-auth-submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {isSubmitting ? (
                <span className="submitting-spinner-text">
                  <span className="spinner-dot" /> Signing In...
                </span>
              ) : (
                <span>Sign In <span>→</span></span>
              )}
            </motion.button>
          </form>

          <div className="auth-card-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-action-link">
                Create one now
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default LoginPage;
