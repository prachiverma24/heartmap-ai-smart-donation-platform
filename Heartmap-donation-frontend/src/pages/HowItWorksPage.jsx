import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import OrbitImages from '../components/OrbitImages';
import Footer from '../components/Footer';
import './HowItWorksPage.css';

const orbitDonationItems = [
  {
    id: 'clothes',
    title: 'Warm Clothes & Blankets',
    icon: '👕',
    image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'food',
    title: 'Nutritious Ration Kits',
    icon: '🍲',
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'books',
    title: 'School Books & Stationery',
    icon: '📚',
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'medical',
    title: 'Medical Aid & First Aid',
    icon: '🩹',
    image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'toys',
    title: 'Kids Toys & Study Kits',
    icon: '🧸',
    image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'devices',
    title: 'Learning Devices & Tablets',
    icon: '💻',
    image: 'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=400&q=80'
  }
];

const flowchartData = {
  all: {
    badge: 'Complete Platform Ecosystem',
    title: 'From Intention to Direct Grassroots Impact',
    summary: 'HeartMap acts as an open, zero-fee bridge matching everyday surplus goods and urgent community cries with accredited local NGOs.',
    steps: [
      {
        num: '01',
        icon: '📦',
        tag: 'SURPLUS & REQUESTS',
        title: 'Needs & Items Posted',
        desc: 'Donors list useful surplus (clothing, ration, books) or community members raise immediate localized help requests.'
      },
      {
        num: '02',
        icon: '📍',
        tag: 'SPATIAL MATCHING',
        title: 'Geo & Category Match',
        desc: 'HeartMap filters items by real GPS coordinates and category rules to find verified local hubs within range.'
      },
      {
        num: '03',
        icon: '🏢',
        tag: 'VERIFIED HUBS',
        title: 'NGO Claims & Pickup',
        desc: 'Government-audited NGOs (80G/12A vetted) inspect available listings and open tickets, coordinating drop-off or pickup.'
      },
      {
        num: '04',
        icon: '🤝',
        tag: 'DIRECT IMPACT',
        title: 'Handover & Closed Loop',
        desc: 'Items reach families directly with zero intermediary platform cuts. Lifecycle status updates to Fulfilled.'
      }
    ]
  },
  donor: {
    badge: 'Donor (Giver) Journey',
    title: 'How You Pass on Useful Goods to Good Hands',
    summary: 'Clear your unused goods and put them straight to work supporting families, rural classrooms, and shelter homes.',
    steps: [
      {
        num: '01',
        icon: '📸',
        tag: 'LISTING',
        title: 'Snap & List Your Items',
        desc: 'Take a quick photo, select category (Clothes, Books, Food, etc.), specify condition, and pick drop-off or doorstep pickup.'
      },
      {
        num: '02',
        icon: '🗺️',
        tag: 'HUB DISCOVERY',
        title: 'Explore Verified Hubs',
        desc: 'Use the interactive subcontinent map to view verified NGO collection centers nearby accepting your exact donation category.'
      },
      {
        num: '03',
        icon: '🚚',
        tag: 'HANDOVER',
        title: 'Coordinate Delivery',
        desc: 'Connect directly with NGO volunteers to schedule convenient doorstep pickup or drop off at a verified center.'
      },
      {
        num: '04',
        icon: '🌟',
        tag: 'TRACKING',
        title: 'Impact Confirmed',
        desc: 'Track your donation status from Open to Claimed and Fulfilled, knowing 100% reached real recipients.'
      }
    ]
  },
  community: {
    badge: 'Community & Seekers',
    title: 'Raising Urgent Help Requests in Real Time',
    summary: 'A dignified, rapid portal for individuals and vulnerable neighborhoods needing immediate essential relief.',
    steps: [
      {
        num: '01',
        icon: '✍️',
        tag: 'SUBMISSION',
        title: 'Post Your Need in 60s',
        desc: 'Share what help is required (Winter wear, dry rations, emergency supplies, education aids) with district & address.'
      },
      {
        num: '02',
        icon: '📡',
        tag: 'COMMUNITY FEED',
        title: 'Broadcasting to NGOs',
        desc: 'Your request appears instantly in the NGO-facing community feed where accredited grassroots partners can see it.'
      },
      {
        num: '03',
        icon: '🤝',
        tag: 'DIRECT FULFILMENT',
        title: 'Direct NGO Outreach',
        desc: 'An active local NGO claims your ticket, gathers supplies, and organizes direct handover without middlemen.'
      },
      {
        num: '04',
        icon: '✅',
        tag: 'OWNER CONTROL',
        title: 'Mark as Fulfilled',
        desc: 'You maintain full control over your request: update status to Open, Fulfilled, or Closed as your needs are resolved.'
      }
    ]
  },
  ngo: {
    badge: 'NGOs & Admin Governance',
    title: 'Trust Audits, NGO Accreditation & Distribution',
    summary: 'How HeartMap ensures 100% verified grassroots authenticity and transparent governance.',
    steps: [
      {
        num: '01',
        icon: '📋',
        tag: 'ACCREDITATION',
        title: 'NGO Registration',
        desc: 'Nonprofits submit official Darpan ID, 80G tax exemption, FCRA compliance, registration certificate, and operating address.'
      },
      {
        num: '02',
        icon: '🛡️',
        tag: 'COMPLIANCE',
        title: 'Admin Verification Audit',
        desc: 'HeartMap trust admins review government filings, phone verification, and physical coordinates before approving the green badge.'
      },
      {
        num: '03',
        icon: '📦',
        tag: 'INVENTORY',
        title: 'Claim Donor Listings',
        desc: 'Approved NGOs browse real-time donor listings and local community cries to match their ongoing distribution drives.'
      },
      {
        num: '04',
        icon: '💳',
        tag: 'ZERO-FEE GIVING',
        title: 'Official External Donations',
        desc: 'HeartMap lists the NGO’s official donation portal with zero platform cut, so monetary gifts go 100% to their bank account.'
      }
    ]
  }
};

const HowItWorksPage = () => {
  const [flowRole, setFlowRole] = useState('all');
  const navigate = useNavigate();

  return (
    <div className="how-page-wrapper">
      {/* Header Banner */}
      <section className="how-page-hero">
        <div className="how-page-container">
          <nav className="how-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">How It Works</span>
          </nav>

          <span className="section-eyebrow">HOW HEARTMAP WORKS</span>
          <h1 className="how-hero-title">
            The Complete Giving &amp; Relief <span className="serif-italic">Ecosystem.</span>
          </h1>
          <p className="how-hero-subtitle">
            HeartMap eliminates middlemen and platform commissions. Explore how everyday surplus goods, urgent community cries, accredited NGOs, and verified impact connect in a transparent cycle.
          </p>

          <div className="how-hero-badges">
            <span className="hero-pill-badge">🛡️ 100% Free Platform</span>
            <span className="hero-pill-badge">📍 Subcontinent GPS Mapping</span>
            <span className="hero-pill-badge">✅ Govt 80G/12A Audited NGOs</span>
            <span className="hero-pill-badge">🔄 Real-Time Lifecycle</span>
          </div>
        </div>
      </section>

      {/* Orbit Images Section */}
      <section className="how-page-orbit-section">
        <div className="how-page-container">
          <div className="orbit-section-header">
            <span className="section-eyebrow">INTERACTIVE GIVING CIRCLE</span>
            <h2 className="orbit-section-title">
              Everyday Essentials in <span className="serif-italic">Motion.</span>
            </h2>
            <p className="orbit-section-sub">
              Hover or tap any orbiting category (Warm Clothes, Food Rations, Books, Medical Aid, Toys, Devices) to explore how surplus transforms into local community support.
            </p>
          </div>

          <div className="orbit-card-canvas">
            <OrbitImages
              items={orbitDonationItems}
              radiusX={410}
              radiusY={145}
              duration={24}
              centerContent={
                <div className="orbit-hero-center-badge">
                  <div className="orbit-center-icon-wrap">
                    <span className="orbit-center-heart">♥</span>
                    <span className="orbit-center-pulse" />
                  </div>
                  <strong>HeartMap</strong>
                  <small>Direct Impact</small>
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* Interactive Process Flowchart */}
      <section className="how-page-flowchart-section">
        <div className="how-page-container">
          <div className="how-flowchart-box">
            <div className="how-flow-header">
              <span className="section-eyebrow">STEP-BY-STEP LIFECYCLE FLOWCHART</span>
              <h3 className="how-flow-title">
                Process Flow: <span className="serif-italic">{flowchartData[flowRole].badge}</span>
              </h3>
              <p className="how-flow-summary">{flowchartData[flowRole].summary}</p>

              {/* Role Journey Tabs */}
              <div className="how-role-tabs" role="tablist">
                {[
                  { key: 'all', label: '🌟 Platform Lifecycle' },
                  { key: 'donor', label: '🎁 Donor (Giver) Flow' },
                  { key: 'community', label: '🤝 Community Need Flow' },
                  { key: 'ngo', label: '🏛️ NGOs & Admin Governance' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`how-role-btn ${flowRole === tab.key ? 'active' : ''}`}
                    onClick={() => setFlowRole(tab.key)}
                    role="tab"
                    aria-selected={flowRole === tab.key}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4-Step Animated Flowchart Cards */}
            <div className="flow-steps-grid">
              {flowchartData[flowRole].steps.map((step, idx) => (
                <motion.div
                  key={`${flowRole}-${step.num}`}
                  className="flow-step-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                >
                  <div className="flow-step-top">
                    <span className="flow-step-num">{step.num}</span>
                    <span className="flow-step-icon">{step.icon}</span>
                  </div>
                  <span className="flow-step-tag">{step.tag}</span>
                  <h4 className="flow-step-title">{step.title}</h4>
                  <p className="flow-step-desc">{step.desc}</p>
                  {idx < 3 && <div className="flow-step-arrow">➔</div>}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core Architecture Pillars */}
      <section className="how-page-pillars-section">
        <div className="how-page-container">
          <div className="section-header-row text-center-wrap">
            <span className="section-eyebrow">HEARTMAP ARCHITECTURE</span>
            <h2 className="section-title">
              Engineered for <span className="serif-italic">Trust &amp; Speed.</span>
            </h2>
            <p className="section-subtext max-center">
              Four fundamental principles that make HeartMap different from typical crowdfunding or donation platforms.
            </p>
          </div>

          <div className="how-pillars-grid">
            <div className="how-pillar-card">
              <span className="pillar-icon">🛡️</span>
              <h5>Zero Platform Intermediary Fees</h5>
              <p>HeartMap takes 0% commission. 100% of physical goods and direct monetary gifts reach the NGO with no platform cuts.</p>
            </div>
            <div className="how-pillar-card">
              <span className="pillar-icon">📍</span>
              <h5>Subcontinent GPS Mapping</h5>
              <p>Pins on our subcontinent map reflect real MongoDB locations—never fake or hardcoded demo coordinates in production.</p>
            </div>
            <div className="how-pillar-card">
              <span className="pillar-icon">📜</span>
              <h5>Govt 80G &amp; Darpan Audited</h5>
              <p>Nonprofits must submit official NGO Darpan IDs, 80G tax exemption certificates, and physical addresses for verification.</p>
            </div>
            <div className="how-pillar-card">
              <span className="pillar-icon">🔄</span>
              <h5>Real-Time Closed-Loop Tracking</h5>
              <p>Requests and listings move transparently through Open ➔ In Progress ➔ Fulfilled ➔ Closed with owner verification.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Action CTA Section */}
      <section className="how-page-cta-section">
        <div className="how-page-container text-center-wrap">
          <span className="section-eyebrow">JOIN THE COMMUNITY</span>
          <h2 className="section-title">
            Ready to make a <span className="serif-italic">difference?</span>
          </h2>
          <p className="section-subtext max-center">
            Whether you have surplus items to give, need urgent community help, or run an accredited NGO—HeartMap connects you instantly.
          </p>

          <div className="how-actions-bar">
            <button
              type="button"
              className="btn-how-primary"
              onClick={() => navigate('/ngos')}
            >
              Donate Useful Items ➔
            </button>
            <button
              type="button"
              className="btn-how-secondary"
              onClick={() => navigate('/help-requests')}
            >
              Post a Community Need ➔
            </button>
            <button
              type="button"
              className="btn-how-outline"
              onClick={() => navigate('/ngos')}
            >
              Explore Verified NGOs ➔
            </button>
          </div>
        </div>
      </section>

      {/* 5. Animated Skyline Green Footer */}
      <Footer />
    </div>
  );
};

export default HowItWorksPage;

