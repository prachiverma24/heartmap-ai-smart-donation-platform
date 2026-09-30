import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api';
import MapComponent from '../components/MapComponent';
import DriftWall from '../components/DriftWall';
import StoryModal from '../components/StoryModal';
import Footer from '../components/Footer';
import { donationVisuals, heroVisual, giveSectionVisual } from '../data/visuals';
import { demoStories } from '../data/demoData';
import { driftStories } from '../data/driftStories';
import './HomePage.css';

const categoryKeys = ['Clothes', 'Food', 'Books', 'Toys', 'Electronics', 'Furniture', 'Money', 'Other'];

const HomePage = () => {
  const [stories, setStories] = useState(demoStories);
  const [ngos, setNgos] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Attempt to load stories from backend; fallback to demoStories
    api.get('/stories')
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          setStories(data);
        } else {
          setStories(demoStories);
        }
      })
      .catch(() => setStories(demoStories));

    // Load real verified NGOs from backend; do NOT fallback to demo/fake NGOs
    api.get('/ngo/public')
      .then(({ data }) => {
        const list = data?.profiles;
        if (Array.isArray(list)) {
          setNgos(list);
        } else {
          setNgos([]);
        }
      })
      .catch(() => setNgos([]));
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="home-container">
      {/* 2. HERO SECTION */}
      <section className="hero-section" aria-label="Hero Introduction">
        <div className="hero-grid-layout">
          <motion.div
            className="hero-text-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero-badge">
              <span className="badge-spark">✦</span>
              <span>DIRECT COMMUNITY GIVING</span>
            </div>

            <h1 className="hero-heading">
              Give What You Can.<br />
              <span className="serif-italic">Where It's Needed.</span>
            </h1>

            <p className="hero-supporting-text">
              Have clothes, food, books, furniture or other useful things you no longer need? HeartMap helps you discover where your contribution can make a difference.
            </p>

            <div className="hero-cta-group">
              <motion.button
                type="button"
                className="btn-hero-primary"
                onClick={() => navigate('/ngos')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>I Want to Donate</span>
                <span className="btn-arrow">↗</span>
              </motion.button>

              <motion.button
                type="button"
                className="btn-hero-secondary"
                onClick={() => navigate('/help-requests')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>I Need Help</span>
              </motion.button>
            </div>

            <div className="hero-stats-row">
              <div className="hero-stat">
                <strong>100%</strong>
                <span>Verified Direct Impact</span>
              </div>
              <div className="stat-separator" />
              <div className="hero-stat">
                <strong>8+</strong>
                <span>Donation Categories</span>
              </div>
              <div className="stat-separator" />
              <div className="hero-stat">
                <strong>Zero</strong>
                <span>Intermediary Platform Fees</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-visual-showcase"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero-image-frame">
              <img
                src={heroVisual}
                alt="Community volunteers packing donations with care"
                className="hero-main-photo"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85';
                }}
              />
              <div className="hero-image-overlay" />

              <div className="hero-floating-badge">
                <div className="badge-icon-verified">✓</div>
                <div>
                  <strong>Verified Local Needs</strong>
                  <small>Transparent & direct</small>
                </div>
              </div>

              <div className="hero-floating-card">
                <div className="floating-card-header">
                  <span className="floating-card-dot" />
                  <strong>Active Neighborhood Drive</strong>
                </div>
                <p>18 children's warm jackets requested in Mandi</p>
              </div>
            </div>
          </motion.div>
        </div>

        <button
          type="button"
          className="hero-scroll-prompt"
          onClick={() => scrollToSection('donation-categories')}
          aria-label="Scroll to donation categories"
        >
          <span className="scroll-indicator-line" />
          <span>Explore Categories</span>
        </button>
      </section>

      {/* 3. DONATION CATEGORIES */}
      <section className="categories-section" id="donation-categories">
        <div className="section-container">
          <div className="section-header-row">
            <div>
              <span className="section-eyebrow">WHAT CAN YOU GIVE?</span>
              <h2 className="section-title">
                Small things.<br />
                <span className="serif-italic">Real impact.</span>
              </h2>
            </div>
            <p className="section-subtext">
              From a warm coat to a working laptop, the things you no longer need can become exactly what someone else is looking for.
            </p>
          </div>

          <div className="categories-grid">
            {categoryKeys.map((name, index) => {
              const cat = donationVisuals[name] || {};
              return (
                <motion.article
                  className="category-card"
                  key={name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  onClick={() => navigate('/ngos')}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate('/ngos'); }}
                >
                  <div className="category-image-wrap">
                    <img src={cat.image} alt={name} className="category-bg-photo" />
                    <div className="category-gradient-veil" />
                  </div>

                  <div className="category-header-meta">
                    <span className="category-index">0{index + 1}</span>
                    <span className="category-emoji-badge">{cat.icon}</span>
                  </div>

                  <div className="category-card-body">
                    <h3 className="category-name">{name}</h3>
                    <p className="category-desc">{cat.description}</p>
                    <div className="category-action-link">
                      <span>Give {name}</span>
                      <span className="action-arrow">↗</span>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. "I HAVE SOMETHING TO GIVE" SECTION */}
      <section className="give-story-section">
        <div className="give-story-grid">
          <motion.div
            className="give-story-visual-wrap"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={giveSectionVisual}
              alt="Community volunteers packing donations"
              className="give-story-photo"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85';
              }}
            />
            <div className="give-story-quote-card">
              <span className="quote-mark">“</span>
              <p>Knowing where an item will go makes all the difference in deciding to let it go.</p>
              <cite>— Priya M., Community Donor</cite>
            </div>
          </motion.div>

          <motion.div
            className="give-story-content"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="section-eyebrow">I HAVE SOMETHING TO GIVE</span>
            <h2 className="section-title">
              Sometimes the hardest part of giving is knowing <span className="serif-italic">where to start.</span>
            </h2>

            <p className="give-story-lead">
              HeartMap bridges the gap between what you have stored in closets or shelves and the verified organizations actively searching for those exact items.
            </p>

            <div className="giving-step-journey">
              <div className="journey-node">
                <span className="node-num">01</span>
                <div>
                  <strong>What you have</strong>
                  <p>Choose clothes, books, devices, or household goods.</p>
                </div>
              </div>
              <span className="journey-divider">→</span>
              <div className="journey-node">
                <span className="node-num">02</span>
                <div>
                  <strong>Where you are</strong>
                  <p>Match with nearby collection drives & pickup areas.</p>
                </div>
              </div>
              <span className="journey-divider">→</span>
              <div className="journey-node">
                <span className="node-num">03</span>
                <div>
                  <strong>Relevant opportunities</strong>
                  <p>Connect directly with verified teams in need.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-give-cta"
              onClick={() => navigate('/ngos')}
            >
              <span>Find Where I Can Donate</span>
              <span className="btn-arrow">↗</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* 5. NGO DISCOVERY SECTION */}
      <section className="ngo-discovery-section" id="ngo-discovery">
        <div className="section-container">
          <div className="section-header-row">
            <div>
              <span className="section-eyebrow">DISCOVER ORGANIZATIONS</span>
              <h2 className="section-title">
                Meet the people<br />
                <span className="serif-italic">making room for good.</span>
              </h2>
            </div>
            <div className="header-action-side">
              <p className="section-subtext">
                Browse verified local organizations with transparent missions and active collection needs.
              </p>
              <button
                type="button"
                className="btn-view-all-ngos"
                onClick={() => navigate('/ngos')}
              >
                <span>View All NGOs</span>
                <span className="btn-arrow">↗</span>
              </button>
            </div>
          </div>

          {ngos.length === 0 ? (
            <div className="ngo-cards-empty" role="status">
              <p>No verified organizations currently listed. Discover more on the NGO directory.</p>
            </div>
          ) : (
            <div className="ngo-cards-grid">
              {ngos.slice(0, 3).map((ngo, index) => {
                const name = ngo.name || ngo.organizationName;
                const locationText = [ngo.city, ngo.state].filter(Boolean).join(', ') || ngo.address || 'Location listed on profile';
                const cardImage = ngo.images?.[0] || ngo.logo || donationVisuals[ngo.acceptedDonationTypes?.[0]]?.image || donationVisuals.Other.image;

                return (
                  <motion.article
                    className="ngo-premium-card"
                    key={ngo._id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    whileHover={{ y: -6 }}
                  >
                    <div className="ngo-image-wrapper">
                      <img src={cardImage} alt={name} className="ngo-main-photo" />
                      <div className="ngo-verified-pill">
                        <span className="pill-check">✓</span>
                        <span>Verified: {ngo.verificationStatus || 'Platform Review'}</span>
                      </div>
                    </div>

                    <div className="ngo-content-body">
                      <span className="ngo-cause-tag">{ngo.category || 'Community Support'}</span>
                      <h3 className="ngo-title">{name}</h3>
                      <p className="ngo-location-line">
                        <span className="loc-pin">⌖</span> {locationText}
                      </p>

                      <p className="ngo-bio-snippet">
                        {ngo.description || 'Community organization accepting useful donations to support families.'}
                      </p>

                      <div className="ngo-accepted-section">
                        <span className="accepted-label">Accepts:</span>
                        <div className="accepted-pills-row">
                          {ngo.acceptedDonationTypes?.slice(0, 3).map((type) => (
                            <span key={type} className="accepted-type-pill">{type}</span>
                          )) || <span className="accepted-type-pill">General</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-ngo-details"
                        onClick={() => navigate(`/ngos/${ngo._id}`)}
                      >
                        <span>View Details</span>
                        <span className="btn-arrow">↗</span>
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 6. MAP SECTION */}
      <section className="map-showcase-section" id="nearby-opportunities">
        <div className="section-container">
          <div className="section-header-row map-header-row">
            <div>
              <span className="section-eyebrow eyebrow-light">FIND DONATION OPPORTUNITIES NEAR YOU</span>
              <h2 className="section-title text-white">
                Good things are<br />
                <span className="serif-italic-accent">closer than you think.</span>
              </h2>
            </div>
            <p className="section-subtext text-light">
              Explore interactive story markers and verified NGO drop-off points across the community map.
            </p>
          </div>

          <div className="map-component-holder">
            <MapComponent
              stories={stories}
              ngos={ngos}
            />
          </div>
        </div>
      </section>

      {/* 7. VERIFICATION SECTION */}
      <section className="trust-verification-section">
        <div className="section-container">
          <div className="trust-card-grid">
            <div className="trust-icon-column">
              <div className="trust-badge-circle">
                <span className="trust-check-icon">✓</span>
              </div>
            </div>

            <div className="trust-content-column">
              <span className="section-eyebrow">KNOW BEFORE YOU GIVE</span>
              <h2 className="section-title">
                Context builds <span className="serif-italic">confidence.</span>
              </h2>

              <p className="trust-lead-text">
                HeartMap provides clear visibility into organizational registration records, administrative reviews, activity updates, and verified contact points before you choose to give.
              </p>

              <div className="trust-points-grid">
                <div className="trust-point-item">
                  <strong>Organization Information</strong>
                  <p>Transparent public profiles with official leadership and mission documentation.</p>
                </div>
                <div className="trust-point-item">
                  <strong>Registration Details</strong>
                  <p>Nonprofit credentials and tax-exempt registration records reviewed by administrators.</p>
                </div>
                <div className="trust-point-item">
                  <strong>Activity Information</strong>
                  <p>Recent community distribution drives, ongoing stories, and photo updates.</p>
                </div>
                <div className="trust-point-item">
                  <strong>Contact & Verification Status</strong>
                  <p>Direct phone, address, and email details with published review stamps.</p>
                </div>
              </div>

              <div className="trust-disclaimer-box">
                <span className="disclaimer-icon">ℹ</span>
                <p>
                  <strong>Transparency Commitment:</strong> Verification reflects platform administrator review of submitted documents, active licenses, and contact information. It serves to improve donor transparency and is not an absolute financial guarantee.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* 9. STORIES BEHIND THE GIVING (DRIFT WALL) */}
      <section className="stories-drift-section" id="community-stories">
        <div className="section-container drift-intro-container">
          <div className="section-header-row text-center-wrap">
            <span className="section-eyebrow">STORIES BEHIND THE GIVING</span>
            <h2 className="section-title">
              Stories Behind the <span className="serif-italic">Giving.</span>
            </h2>
            <p className="section-subtext max-center">
              Every donation has a story. Explore the people, places and moments behind meaningful giving.
            </p>
          </div>
        </div>

        {/* Drift Wall Animated Photo Collage */}
        <DriftWall
          stories={driftStories}
          onSelectStory={(story) => setSelectedStory(story)}
          columns={4}
          speed={38}
          tilt={10}
          turn={-7}
          perspective={1200}
        />

        {/* Interactive Story Detail Modal */}
        <StoryModal
          isOpen={!!selectedStory}
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      </section>

      {/* 9. ANIMATED MODERN GREEN FOOTER (SKYLINE HORIZON) */}
      <Footer />
    </div>
  );
};

export default HomePage;
