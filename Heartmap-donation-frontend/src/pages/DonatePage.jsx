import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api';
import './DonatePage.css';

const DonatePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const response = await api.get(`/stories/${id}`);
        setStory(response.data);
      } catch (error) {
        setStory(getDemoStory(id));
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [id]);

  const getDemoStory = (storyId) => ({
    _id: storyId,
    title: 'Community Support & Needs',
    totalDonations: 1500,
    goalAmount: 5000
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="ngo-state">Loading details...</div>
      </div>
    );
  }

  return (
    <motion.div 
      className="donate-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="donate-container">
        <motion.div 
          className="donate-form-container"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="donate-header">
            <h1>Direct Payment Processing Is Disabled</h1>
            <p>Support for: {story?.title || 'Community Need'}</p>
          </div>

          <div className="payment-notice-card">
            <div className="notice-icon">🛡️</div>
            <h3>HeartMap Does Not Process Payments</h3>
            <p>
              HeartMap is an open community coordination and matching platform. We connect donors directly with verified NGOs and local help requests. We do not process credit cards, PayPal, bank transfers, or any monetary transactions.
            </p>
            <p>
              To make a monetary contribution, please explore our verified NGO directory and contribute directly through the organization's official external donation channels.
            </p>

            <div className="notice-actions">
              <button
                type="button"
                className="btn-notice-primary"
                onClick={() => navigate('/ngos')}
              >
                Browse Verified NGOs →
              </button>
              <button
                type="button"
                className="btn-notice-secondary"
                onClick={() => navigate(`/story/${id}`)}
              >
                ← Back to Story
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DonatePage;
