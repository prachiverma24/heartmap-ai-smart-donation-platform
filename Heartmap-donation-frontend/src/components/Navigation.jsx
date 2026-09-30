import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './Navigation.css';

const Navigation = () => {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <motion.header
      className={`navigation-header ${isScrolled ? 'is-scrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="nav-container">
        <Link to="/" className="nav-brand" aria-label="HeartMap Home">
          <span className="brand-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" className="brand-icon" aria-hidden="true">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="brand-text">
            HeartMap<span className="brand-dot">.</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="nav-links-desktop" aria-label="Primary Navigation">
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/ngos"
            className={`nav-link ${location.pathname === '/ngos' ? 'active' : ''}`}
          >
            Discover NGOs
          </Link>
          <Link
            to="/how-it-works"
            className={`nav-link ${location.pathname === '/how-it-works' ? 'active' : ''}`}
          >
            How It Works
          </Link>
          <Link
            to="/ai-assistant"
            className={`nav-link ${location.pathname === '/ai-assistant' ? 'active' : ''}`}
          >
            AI Assistant
          </Link>

          {!isLoading && user && (
            <>
              <Link
                to="/recommendations"
                className={`nav-link ${location.pathname === '/recommendations' || location.pathname === '/assistant' ? 'active' : ''}`}
              >
                AI Recommendations
              </Link>
              <Link
                to="/donation-drives"
                className={`nav-link ${location.pathname.startsWith('/projects') || location.pathname.startsWith('/donation-drives') ? 'active' : ''}`}
              >
                🤝 Donation Drives
              </Link>
              {user.role === 'ngo' && (
                <>
                  <Link
                    to="/ngo/donations"
                    className={`nav-link ${location.pathname === '/ngo/donations' ? 'active' : ''}`}
                  >
                    Available Donations
                  </Link>
                  <Link
                    to="/ngo/profile"
                    className={`nav-link ${location.pathname === '/ngo/profile' ? 'active' : ''}`}
                  >
                    NGO Profile
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
                >
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>

        {/* Desktop CTA / Auth actions */}
        <div className="nav-actions-desktop">
          {!isLoading && user ? (
            <div className="nav-user-greeting">
              <span className="user-badge" title={user.email}>
                <span className="user-role-pill">{user.role}</span>
                <span className="user-name">{user.name?.split(' ')[0] || 'Member'}</span>
              </span>
              <button
                type="button"
                className="btn-signout"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="nav-guest-actions">
              <Link to="/login" className="btn-signin">
                Sign In
              </Link>
              <Link to="/register" className="btn-getstarted">
                <span>Get Started</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3.33337 8H12.6667M12.6667 8L8.00004 3.33334M12.6667 8L8.00004 12.6667" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className={`nav-menu-toggle ${isMenuOpen ? 'is-active' : ''}`}
          type="button"
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="mobile-menu-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="mobile-menu-content">
              <Link to="/" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
                Home
              </Link>
              <Link to="/ngos" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
                Discover NGOs
              </Link>
              <Link
                to="/how-it-works"
                className={`mobile-nav-link ${location.pathname === '/how-it-works' ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link
                to="/ai-assistant"
                className={`mobile-nav-link ${location.pathname === '/ai-assistant' ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                AI Assistant
              </Link>

              {!isLoading && user && (
                <>
                  <Link to="/recommendations" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
                    AI Recommendations
                  </Link>
                  <Link
                    to="/donation-drives"
                    className={`mobile-nav-link ${location.pathname.startsWith('/projects') || location.pathname.startsWith('/donation-drives') ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    🤝 Donation Drives
                  </Link>
                  {user.role === 'ngo' && (
                    <>
                      <Link to="/ngo/donations" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
                        Available Donations
                      </Link>
                      <Link to="/ngo/profile" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
                        NGO Profile
                      </Link>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <Link to="/admin" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
                      Admin Dashboard
                    </Link>
                  )}
                </>
              )}

              <div className="mobile-divider" />

              {!isLoading && user ? (
                <div className="mobile-auth-section">
                  <p className="mobile-user-status">Signed in as <strong>{user.name}</strong> ({user.role})</p>
                  <button type="button" className="mobile-btn-signout" onClick={() => { handleLogout(); setIsMenuOpen(false); }}>
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="mobile-auth-buttons">
                  <Link to="/login" className="mobile-btn-signin" onClick={() => setIsMenuOpen(false)}>
                    Sign In
                  </Link>
                  <Link to="/register" className="mobile-btn-getstarted" onClick={() => setIsMenuOpen(false)}>
                    Get Started <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navigation;
