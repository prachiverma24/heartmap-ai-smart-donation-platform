import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@') || !email.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setErrorMsg('');
    setSubscribed(true);
    setEmail('');
  };

  const handleNavClick = (path, anchor) => {
    if (anchor) {
      if (location.pathname === '/') {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      } else {
        navigate(`/#${anchor}`);
        return;
      }
    }
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="green-footer-master" role="contentinfo" aria-label="HeartMap Site Footer">
      {/* 1. TOP ANIMATED COMMUNITY HORIZON SKYLINE (COMPACT) */}
      <div className="footer-skyline-wrap" aria-hidden="true">
        {/* Floating Animated Heart Balloon */}
        <div className="skyline-floating-balloon">
          <svg viewBox="0 0 64 80" className="balloon-svg" width="32" height="40">
            <defs>
              <linearGradient id="balloonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e58645" />
                <stop offset="50%" stopColor="#d97736" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            {/* Balloon Envelope */}
            <path
              d="M32 4 C18 4, 8 16, 8 32 C8 46, 22 56, 30 64 L34 64 C42 56, 56 46, 56 32 C56 16, 46 4, 32 4 Z"
              fill="url(#balloonGrad)"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
            <path d="M22 6 C16 16, 16 46, 29 63" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
            <path d="M42 6 C48 16, 48 46, 35 63" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
            {/* White Heart Symbol on Balloon */}
            <path
              d="M32 23 C29 19, 23 20, 23 25 C23 31, 32 37, 32 37 C32 37, 41 31, 41 25 C41 20, 35 19, 32 23 Z"
              fill="#ffffff"
            />
            {/* Ropes and Basket */}
            <line x1="28" y1="64" x2="27" y2="71" stroke="#fbf8f2" strokeWidth="1" />
            <line x1="36" y1="64" x2="37" y2="71" stroke="#fbf8f2" strokeWidth="1" />
            <rect x="25" y="71" width="14" height="8" rx="2" fill="#78350f" stroke="#fde68a" strokeWidth="0.8" />
          </svg>
        </div>

        {/* Drifting Clouds */}
        <div className="skyline-cloud skyline-cloud-1" />
        <div className="skyline-cloud skyline-cloud-2" />
        <div className="skyline-cloud skyline-cloud-3" />

        {/* Organic Curved Hill & Community Silhouette SVG */}
        <svg
          className="skyline-svg"
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hillFrontGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#13383c" />
              <stop offset="100%" stopColor="#0e292c" />
            </linearGradient>
            <linearGradient id="hillBackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e5257" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#13383c" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Background gentle wave */}
          <path
            d="M0,35 C240,15 460,42 720,25 C980,12 1200,38 1440,24 L1440,90 L0,90 Z"
            fill="url(#hillBackGrad)"
          />

          {/* Foreground organic landscape curve */}
          <path
            d="M0,52 C180,28 380,60 580,45 C780,28 960,54 1180,36 C1320,28 1390,44 1440,44 L1440,90 L0,90 Z"
            fill="url(#hillFrontGrad)"
          />

          {/* Silhouette Elements along the horizon */}
          <g fill="#0e292c" opacity="0.95">
            {/* Small houses & community buildings */}
            <rect x="180" y="38" width="18" height="22" rx="1" />
            <polygon points="177,38 189,26 201,38" />
            <rect x="204" y="32" width="22" height="28" rx="1" />
            <rect x="230" y="42" width="15" height="18" rx="1" />
            <polygon points="228,42 237,33 247,42" />
            {/* Window dots */}
            <circle cx="189" cy="44" r="1.2" fill="#fde68a" opacity="0.8" />
            <circle cx="211" cy="38" r="1.2" fill="#fde68a" opacity="0.8" />
            <circle cx="219" cy="38" r="1.2" fill="#fde68a" opacity="0.8" />

            {/* Trees & Foliage */}
            <path d="M152,54 C152,47 157,41 163,41 C169,41 174,47 174,54 Z" fill="#1b4332" />
            <rect x="162" y="52" width="3" height="7" fill="#2d6a4f" />
            <path d="M250,52 C250,45 255,40 261,40 C267,40 272,45 272,52 Z" fill="#1b4332" />

            {/* Community Center with Cross / Sign */}
            <rect x="620" y="24" width="34" height="28" rx="2" />
            <polygon points="616,24 637,12 658,24" />
            <rect x="634" y="18" width="6" height="6" rx="1" fill="#e58645" />
            <rect x="626" y="30" width="5" height="6" rx="1" fill="#fde68a" opacity="0.9" />
            <rect x="643" y="30" width="5" height="6" rx="1" fill="#fde68a" opacity="0.9" />

            {/* Trees cluster around center */}
            <circle cx="602" cy="38" r="9" fill="#1b4332" />
            <circle cx="611" cy="42" r="7" fill="#2d6a4f" />
            <circle cx="666" cy="40" r="10" fill="#1b4332" />
            <circle cx="678" cy="44" r="7" fill="#2d6a4f" />

            {/* Ferris Wheel / Community Landmark */}
            <g transform="translate(920, 14)">
              <circle cx="18" cy="18" r="16" stroke="#16433e" strokeWidth="1.5" fill="none" />
              <circle cx="18" cy="18" r="10" stroke="#16433e" strokeWidth="1" fill="none" opacity="0.7" />
              <line x1="18" y1="2" x2="18" y2="34" stroke="#16433e" strokeWidth="1" />
              <line x1="2" y1="18" x2="34" y2="18" stroke="#16433e" strokeWidth="1" />
              <polygon points="12,34 18,18 24,34" fill="#103230" />
              <circle cx="18" cy="18" r="2.5" fill="#d97736" />
            </g>

            {/* School / NGO Hub */}
            <rect x="1000" y="26" width="38" height="24" rx="2" />
            <polygon points="996,26 1019,14 1042,26" />
            <line x1="1019,14" x2="1019,6" stroke="#ffffff" strokeWidth="1" />
            <polygon points="1019,6 1027,9 1019,12" fill="#e58645" />
            <rect x="1006" y="32" width="5" height="6" fill="#fde68a" opacity="0.8" />
            <rect x="1017" y="32" width="5" height="6" fill="#fde68a" opacity="0.8" />
            <rect x="1028" y="32" width="5" height="6" fill="#fde68a" opacity="0.8" />

            {/* Pine Trees on far right */}
            <polygon points="1235,46 1243,30 1251,46" fill="#1b4332" />
            <polygon points="1247,50 1255,34 1263,50" fill="#2d6a4f" />
            <polygon points="1258,47 1266,28 1274,47" fill="#1b4332" />
          </g>
        </svg>
      </div>

      {/* 2. MAIN FOOTER CONTENT CONTAINER */}
      <div className="green-footer-body">
        <div className="green-footer-container">
          <div className="footer-top-grid">
            {/* Left Column: HeartMap Community Newsletter (Inspired by Pinterest Footway's Newsletter) */}
            <div className="footer-newsletter-col">
              <div className="footer-brand-lockup">
                <span className="footer-brand-badge">
                  <span className="footer-pulse-dot" />
                  HEARTMAP DISPATCH
                </span>
                <h3 className="footer-newsletter-title">
                  Stay close to <span className="footer-highlight">local impact.</span>
                </h3>
                <p className="footer-newsletter-sub">
                  Join 50,000+ neighbors and volunteers receiving verified weekly relief updates, urgent drive alerts, and transparent impact stories.
                </p>
              </div>

              {subscribed ? (
                <div className="newsletter-success-toast" role="status">
                  <span className="success-icon">✓</span>
                  <div>
                    <strong>Welcome to the circle!</strong>
                    <p>You are now subscribed to verified community updates.</p>
                  </div>
                </div>
              ) : (
                <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
                  <div className="newsletter-input-group">
                    <input
                      type="email"
                      className="footer-email-input"
                      placeholder="Enter your email address..."
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-label="Email address for community newsletter"
                    />
                    <button type="submit" className="footer-subscribe-btn">
                      <span>Subscribe</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  {errorMsg && <p className="footer-form-error">{errorMsg}</p>}
                  <span className="newsletter-privacy-note">
                    🔒 No spam ever. Zero-selling policy. Unsubscribe in one click anytime.
                  </span>
                </form>
              )}

              {/* Social Channels Row */}
              <div className="footer-social-section">
                <span className="social-row-label">Connect with our team:</span>
                <div className="footer-social-links">
                  <a href="#twitter" className="green-social-pill" aria-label="HeartMap on X Twitter" title="X / Twitter">
                    𝕏
                  </a>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="green-social-pill" aria-label="HeartMap on GitHub" title="GitHub">
                    ⌨
                  </a>
                  <a href="#linkedin" className="green-social-pill" aria-label="HeartMap on LinkedIn" title="LinkedIn">
                    in
                  </a>
                  <a href="#instagram" className="green-social-pill" aria-label="HeartMap on Instagram" title="Instagram">
                    📸
                  </a>
                </div>
              </div>
            </div>

            {/* Right Columns: Structured Navigation Links */}
            <div className="footer-nav-grid">
              {/* Col 1: Discover */}
              <div className="footer-links-col">
                <h4 className="footer-col-heading">Discover</h4>
                <ul className="footer-nav-list">
                  <li>
                    <button type="button" onClick={() => handleNavClick('/ngos')}>
                      Verified Non-Profits
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/how-it-works')}>
                      How It Works Guide
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/', 'nearby-opportunities')}>
                      Live Map of Needs
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/', 'donation-categories')}>
                      Browse Categories
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/', 'community-stories')}>
                      Giving Stories Wall
                    </button>
                  </li>
                </ul>
              </div>

              {/* Col 2: Direct Giving */}
              <div className="footer-links-col">
                <h4 className="footer-col-heading">Direct Giving</h4>
                <ul className="footer-nav-list">
                  <li>
                    <button type="button" onClick={() => handleNavClick('/ngos')}>
                      Donate Surplus Items
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/help-requests')}>
                      Post a Need / Request
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/assistant')}>
                      AI Donation Assistant
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/register')}>
                      Register NGO Drive
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/how-it-works')}>
                      4-Role Flowcharts
                    </button>
                  </li>
                </ul>
              </div>

              {/* Col 3: Trust & Governance */}
              <div className="footer-links-col">
                <h4 className="footer-col-heading">Governance</h4>
                <ul className="footer-nav-list">
                  <li>
                    <button type="button" onClick={() => handleNavClick('/how-it-works')}>
                      About Our Mission
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/how-it-works')}>
                      Verification Protocol
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/login')}>
                      Organization Sign In
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => handleNavClick('/register')}>
                      Volunteer Signup
                    </button>
                  </li>
                  <li>
                    <span className="footer-nav-static">0% Platform Intermediary</span>
                  </li>
                </ul>
              </div>

              {/* Col 4: Support & Contact */}
              <div className="footer-links-col">
                <h4 className="footer-col-heading">Reach &amp; Support</h4>
                <div className="footer-contact-block">
                  <p className="contact-item">
                    <span className="contact-icon">📧</span>
                    <a href="mailto:support@heartmap.org" className="contact-link">
                      support@heartmap.org
                    </a>
                  </p>
                  <p className="contact-item">
                    <span className="contact-icon">📞</span>
                    <span>Toll Free: 1800-HEART-MAP</span>
                  </p>
                  <p className="contact-item">
                    <span className="contact-icon">📍</span>
                    <span>Pan-India Community Relay (Delhi • Mandi • Bangalore • Mumbai)</span>
                  </p>
                  <p className="contact-item">
                    <span className="contact-icon">⏱️</span>
                    <span>Support Desk: 24 / 7 Live Relay</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. TRUST & VERIFICATION BADGES STRIP (Matching screenshot bottom badges) */}
          <div className="footer-trust-badges-strip">
            <div className="trust-badge-item">
              <span className="trust-badge-icon">🛡️</span>
              <div className="trust-badge-text">
                <strong>NGO Darpan Audited</strong>
                <small>Govt. of India NITI Aayog</small>
              </div>
            </div>

            <div className="trust-badge-item">
              <span className="trust-badge-icon">📜</span>
              <div className="trust-badge-text">
                <strong>80G / 12A Certified</strong>
                <small>Tax Exemption Ready</small>
              </div>
            </div>

            <div className="trust-badge-item">
              <span className="trust-badge-icon">🔒</span>
              <div className="trust-badge-text">
                <strong>256-Bit SSL Security</strong>
                <small>Encrypted Community Data</small>
              </div>
            </div>

            <div className="trust-badge-item">
              <span className="trust-badge-icon">📍</span>
              <div className="trust-badge-text">
                <strong>GPS Geo-Audited</strong>
                <small>Zero Fake Production Pins</small>
              </div>
            </div>

            <div className="trust-badge-item">
              <span className="trust-badge-icon">🤝</span>
              <div className="trust-badge-text">
                <strong>0% Platform Fee</strong>
                <small>100% Direct Impact Handoff</small>
              </div>
            </div>
          </div>

          {/* 4. BOTTOM BAR: STATUS + COPYRIGHT + TRANSPARENCY NOTE */}
          <div className="footer-bottom-bar-green">
            <div className="bottom-network-status">
              <span className="status-live-beacon" />
              <span>Real-Time Network Active • 28 States Connected • 1,420+ Verified Drives</span>
            </div>

            <div className="bottom-copyright">
              <span>© {new Date().getFullYear()} HeartMap Humanitarian Platform. Handcrafted for transparent giving.</span>
            </div>

            <div className="bottom-legal-links">
              <button type="button" onClick={() => handleNavClick('/how-it-works')}>
                Transparency Disclosure
              </button>
              <span className="legal-dot">•</span>
              <button type="button" onClick={() => handleNavClick('/how-it-works')}>
                Privacy
              </button>
              <span className="legal-dot">•</span>
              <button type="button" onClick={() => handleNavClick('/how-it-works')}>
                Terms
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

