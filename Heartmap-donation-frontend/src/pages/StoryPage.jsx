import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Player } from '@lottiefiles/react-lottie-player';
import api from '../api';
import './StoryPage.css';
import RecentDonors from '../components/RecentDonors';

const StoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const response = await api.get(`/stories/${id}`);
        setStory(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching story:', error);
        // Use demo data
        setStory(getDemoStory(id));
        setLoading(false);
      }
    };
    fetchStory();
  }, [id]);

  const getDemoStory = (id) => {
    const stories = {
      '1': {
        _id: '1',
        title: 'Help Children Access Clean Water',
        description: 'Children in rural communities lack access to clean drinking water and proper nutrition.',
        fullStory: 'In remote villages, families struggle daily to find clean water. Children often miss school to help their parents fetch water from distant sources. Your donation can provide water wells, filtration systems, and nutritious meals to these children, giving them hope for a better future.',
        location: { lat: -1.2921, lng: 36.8219, address: 'Nairobi, Kenya' },
        verified: true,
        totalDonations: 1500,
        goalAmount: 5000,
        media: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop',
        videoUrl: 'https://assets5.lottiefiles.com/packages/lf20_zsqpjdlw.json',
        realVideo: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        dateCreated: '2025-01-15'
      },
      '2': {
        _id: '2',
        title: 'Feed Hungry Children',
        description: 'Malnutrition affects millions of children who go to bed hungry every night.',
        fullStory: 'These young children face daily struggles with hunger and malnutrition. Many families cannot afford even one meal a day. Your support can provide nutritious food, vitamins, and hope to these innocent children who deserve a chance at a healthy life.',
        location: { lat: 9.0820, lng: 8.6753, address: 'Abuja, Nigeria' },
        verified: true,
        totalDonations: 800,
        goalAmount: 3000,
        media: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&h=600&fit=crop',
        videoUrl: 'https://assets7.lottiefiles.com/packages/lf20_q5pk6p1k.json',
        realVideo: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        dateCreated: '2025-02-01'
      },
      '3': {
        _id: '3',
        title: 'Education for Underprivileged Children',
        description: 'Bright young minds deserve access to education and school supplies.',
        fullStory: 'These children are eager to learn but lack basic school supplies, uniforms, and books. Many walk miles to reach school with empty stomachs. Your donation can provide education materials, meals, and the opportunity for these children to build a brighter future through learning.',
        location: { lat: 23.8103, lng: 90.4125, address: 'Dhaka, Bangladesh' },
        verified: true,
        totalDonations: 2000,
        goalAmount: 4000,
        media: 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=800&h=600&fit=crop',
        videoUrl: 'https://assets9.lottiefiles.com/packages/lf20_myejiggj.json',
        realVideo: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        dateCreated: '2025-01-20'
      }
    };
    return stories[id] || stories['1'];
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading story...</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="story-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="story-container">
        <motion.div 
          className="story-header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h1>{story.title}</h1>
          {story.verified && (
            <motion.span 
              className="verified-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.5 }}
            >
              ✓ Verified Story
            </motion.span>
          )}
        </motion.div>

        {story.videoUrl && (
          <motion.div 
            className="story-animation-hero"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="animation-wrapper">
              <Player
                autoplay
                loop
                src={story.videoUrl}
                style={{ height: '400px', width: '100%' }}
              />
              <div className="animation-overlay">
                <span className="animation-label">💫 Animated Message</span>
              </div>
            </div>
          </motion.div>
        )}

        {story.media && (
          <motion.div 
            className="story-image-section"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <img src={story.media} alt={story.title} className="story-main-image" />
          </motion.div>
        )}

        <motion.div 
          className="story-details"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="location-info">
            <span>📍 {story.location.address}</span>
          </div>

          <div className="story-content">
            <h2>Their Story</h2>
            <p className="story-description">{story.fullStory || story.description}</p>
          </div>

          <div className="donation-progress">
            <h3>Donation Progress</h3>
            <div className="progress-stats">
              <div className="stat">
                <span className="stat-value">${story.totalDonations}</span>
                <span className="stat-label">Raised</span>
              </div>
              <div className="stat">
                <span className="stat-value">${story.goalAmount}</span>
                <span className="stat-label">Goal</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {Math.round((story.totalDonations / story.goalAmount) * 100)}%
                </span>
                <span className="stat-label">Complete</span>
              </div>
            </div>
            <div className="progress-bar-large">
              <motion.div 
                className="progress-fill-large"
                initial={{ width: 0 }}
                animate={{ width: `${(story.totalDonations / story.goalAmount) * 100}%` }}
                transition={{ duration: 1.5, delay: 0.6 }}
              />
            </div>
          </div>

          <div className="action-buttons">
            <motion.button 
              className="back-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
            >
              ← Back to Stories
            </motion.button>
          </div>
          
          <div className="story-sidebar">
            <RecentDonors storyId={story._id} limit={12} pollIntervalMs={15000} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default StoryPage;
