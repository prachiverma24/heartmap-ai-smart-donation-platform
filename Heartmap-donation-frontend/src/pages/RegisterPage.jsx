import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { authRegisterVisual } from '../data/visuals';
import './AuthPage.css';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' // 'user' | 'ngo'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // Client-side password validation
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError('Password must be at least 8 characters and include at least one letter and one number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser = await register(form);
      if (newUser?.role === 'ngo') {
        navigate('/ngo/profile', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
        'Unable to create your account. Please check the information provided and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasLength = form.password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);

  return (
    <main className="auth-split-wrapper">
      {/* Left Column: Visual & Emotional Context */}
      <div className="auth-visual-column">
        <img
          src={authRegisterVisual}
          alt="Hands working together to sort community resources"
          className="auth-hero-image"
        />
        <div className="auth-visual-gradient" />

        <div className="auth-visual-content">
          <Link to="/" className="auth-brand-pill">
            <span className="pill-heart">♥</span>
            <span>HeartMap Community</span>
          </Link>

          <blockquote className="auth-quote">
            “No one has ever become poor by giving. Join us in putting useful items into caring hands.”
          </blockquote>

          <div className="auth-trust-highlights">
            <div className="trust-badge-item">
              <span className="badge-icon">✓</span>
              <span>Individual donors connect directly</span>
            </div>
            <div className="trust-badge-item">
              <span className="badge-icon">✓</span>
              <span>Nonprofits publish verified collection needs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Clean Registration Form */}
      <div className="auth-form-column">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="auth-card-header">
            <span className="auth-card-eyebrow">JOIN HEARTMAP</span>
            <h1 className="auth-card-title">Create your account</h1>
            <p className="auth-card-subtext">
              Choose how you want to participate and start making a difference today.
            </p>
          </div>

          {/* Account Role Selector */}
          <div className="role-selector-container">
            <span className="role-selector-label">I want to register as:</span>
            <div className="role-pills-toggle">
              <button
                type="button"
                className={`role-pill-btn ${form.role === 'user' ? 'is-selected' : ''}`}
                onClick={() => setForm({ ...form, role: 'user' })}
              >
                <span className="role-btn-icon">🙋</span>
                <div>
                  <strong>Individual Donor</strong>
                  <small>Discover verified NGOs or request support</small>
                </div>
              </button>

              <button
                type="button"
                className={`role-pill-btn ${form.role === 'ngo' ? 'is-selected' : ''}`}
                onClick={() => setForm({ ...form, role: 'ngo' })}
              >
                <span className="role-btn-icon">🏢</span>
                <div>
                  <strong>Nonprofit / NGO</strong>
                  <small>Receive donations & verify profile</small>
                </div>
              </button>
            </div>
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

          <form className="auth-form-root" onSubmit={handleSubmit}>
            <div className="form-field-group">
              <label htmlFor="reg-name" className="field-label">
                {form.role === 'ngo' ? 'Organization or Representative Name' : 'Full Name'}
              </label>
              <div className="input-wrapper">
                <input
                  id="reg-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={form.role === 'ngo' ? 'e.g. Hope Literacy Foundation' : 'e.g. Sarah Jenkins'}
                  required
                  minLength="2"
                  autoComplete="name"
                  className="text-input"
                />
              </div>
            </div>

            <div className="form-field-group">
              <label htmlFor="reg-email" className="field-label">
                {form.role === 'ngo' ? 'Official Organization Email' : 'Email Address'}
              </label>
              <div className="input-wrapper">
                <input
                  id="reg-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={form.role === 'ngo' ? 'contact@nonprofit.org' : 'name@example.com'}
                  required
                  autoComplete="email"
                  className="text-input"
                />
              </div>
            </div>

            <div className="form-field-group">
              <label htmlFor="reg-password" className="field-label">Password</label>
              <div className="input-wrapper password-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Create a secure password"
                  required
                  minLength="8"
                  autoComplete="new-password"
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

              {/* Password strength checklist */}
              <div className="password-requirements-hints">
                <span className={`hint-chip ${hasLength ? 'valid' : ''}`}>
                  {hasLength ? '✓' : '○'} 8+ characters
                </span>
                <span className={`hint-chip ${hasLetter ? 'valid' : ''}`}>
                  {hasLetter ? '✓' : '○'} Contains letter
                </span>
                <span className={`hint-chip ${hasNumber ? 'valid' : ''}`}>
                  {hasNumber ? '✓' : '○'} Contains number
                </span>
              </div>
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
                  <span className="spinner-dot" /> Creating Account...
                </span>
              ) : (
                <span>
                  {form.role === 'ngo' ? 'Register as NGO Organization' : 'Create Donor Account'} <span>→</span>
                </span>
              )}
            </motion.button>
          </form>

          <div className="auth-card-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-action-link">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default RegisterPage;
