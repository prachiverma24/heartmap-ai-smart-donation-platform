import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import './AdminPage.css';

const AdminPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fullStory: '',
    address: '',
    lat: '',
    lng: '',
    goalAmount: '',
    media: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setShowError(false);
    setShowSuccess(false);
    
    try {
      const storyData = {
        title: formData.title,
        description: formData.description,
        fullStory: formData.fullStory,
        location: {
          lat: parseFloat(formData.lat) || 0,
          lng: parseFloat(formData.lng) || 0,
          address: formData.address
        },
        goalAmount: parseFloat(formData.goalAmount) || 1000,
        media: formData.media || 'https://via.placeholder.com/400x300?text=Story+Image',
        verified: false,
        totalDonations: 0
      };

      console.log('Submitting story:', storyData);
      const response = await axios.post('https://heartmap-donation-backend.onrender.com/api/stories', storyData);
      console.log('Story submitted successfully:', response.data);
      
      setShowSuccess(true);
      setFormData({
        title: '',
        description: '',
        fullStory: '',
        address: '',
        lat: '',
        lng: '',
        goalAmount: '',
        media: ''
      });
      
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      console.error('Error submitting story:', error);
      let errorMsg = 'Error submitting story. ';
      
      if (error.response) {
        // Server responded with error
        errorMsg += `Server error: ${error.response.data.message || error.response.statusText}`;
      } else if (error.request) {
        // Request made but no response
        errorMsg += 'Cannot connect to server. Please check your internet connection.';
      } else {
        // Other error
        errorMsg += error.message;
      }
      
      setErrorMessage(errorMsg);
      setShowError(true);
      setTimeout(() => setShowError(false), 8000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      className="admin-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="admin-container">
        <motion.div 
          className="admin-header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h1>⚙️ Admin Dashboard</h1>
          <p>Submit a new story for review</p>
        </motion.div>

        {showSuccess && (
          <motion.div 
            className="alert success"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ✅ Story submitted successfully! It will be reviewed and verified.
          </motion.div>
        )}

        {showError && (
          <motion.div 
            className="alert error"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ❌ {errorMessage || 'Error submitting story. Please try again.'}
          </motion.div>
        )}

        <motion.form 
          className="admin-form"
          onSubmit={handleSubmit}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="form-section">
            <h2>Story Details</h2>
            
            <div className="form-group">
              <label>Story Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="e.g., Help Maria Rebuild Her Home"
              />
            </div>

            <div className="form-group">
              <label>Short Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder="Brief description for preview (100-200 characters)"
                rows="3"
                maxLength="200"
              />
              <small>{formData.description.length}/200 characters</small>
            </div>

            <div className="form-group">
              <label>Full Story *</label>
              <textarea
                name="fullStory"
                value={formData.fullStory}
                onChange={handleChange}
                required
                placeholder="Tell the complete story with more details..."
                rows="6"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Location Information</h2>
            
            <div className="form-group">
              <label>Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="e.g., New York, USA"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  name="lat"
                  value={formData.lat}
                  onChange={handleChange}
                  step="any"
                  placeholder="e.g., 40.7128"
                />
              </div>

              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  name="lng"
                  value={formData.lng}
                  onChange={handleChange}
                  step="any"
                  placeholder="e.g., -74.0060"
                />
              </div>
            </div>
            
            <small className="help-text">
              💡 Use <a href="https://www.latlong.net/" target="_blank" rel="noopener noreferrer">LatLong.net</a> to find coordinates
            </small>
          </div>

          <div className="form-section">
            <h2>Fundraising & Media</h2>
            
            <div className="form-group">
              <label>Fundraising Goal (USD) *</label>
              <input
                type="number"
                name="goalAmount"
                value={formData.goalAmount}
                onChange={handleChange}
                required
                min="100"
                placeholder="e.g., 5000"
              />
            </div>

            <div className="form-group">
              <label>Media URL (Image)</label>
              <input
                type="url"
                name="media"
                value={formData.media}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
              />
              <small className="help-text">
                💡 Leave empty for placeholder image
              </small>
            </div>
          </div>

          <motion.button
            type="submit"
            className="submit-button"
            whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
            whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
            disabled={isSubmitting}
            style={{ 
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? '⏳ Submitting...' : '📝 Submit Story for Review'}
          </motion.button>
        </motion.form>

        <div className="admin-info">
          <h3>ℹ️ Submission Guidelines</h3>
          <ul>
            <li>All stories are subject to verification</li>
            <li>Provide accurate and honest information</li>
            <li>Include clear and appropriate images</li>
            <li>Set realistic fundraising goals</li>
            <li>Stories typically reviewed within 24-48 hours</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminPage;
