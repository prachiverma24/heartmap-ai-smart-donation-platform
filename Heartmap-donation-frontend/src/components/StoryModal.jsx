import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './StoryModal.css';

const StoryModal = ({ isOpen, story, onClose }) => {
  const navigate = useNavigate();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !story) return null;

  const handleNgoClick = () => {
    onClose();
    if (story.ngoId) {
      navigate(`/ngos/${story.ngoId}`);
    } else {
      navigate('/ngos');
    }
  };

  return (
    <AnimatePresence>
      <div className="story-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <motion.div
          className="story-modal-container"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 24 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Close button */}
          <button
            type="button"
            className="story-modal-close-btn"
            onClick={onClose}
            aria-label="Close story details"
          >
            ✕
          </button>

          {/* Modal Header Image */}
          <div className="story-modal-image-wrap">
            <img src={story.image} alt={story.title} className="story-modal-img" />
            <div className="story-modal-image-gradient" />

            <div className="story-modal-top-badges">
              <span className="story-modal-cat-badge">
                {story.categoryIcon && <span>{story.categoryIcon}</span>}
                <span>{story.category}</span>
              </span>

              {story.verified && (
                <span className="story-modal-verified-badge">
                  <span>✓</span> Verified Initiative
                </span>
              )}
            </div>

            <div className="story-modal-image-caption">
              <span className="story-modal-location">
                ⌖ {story.location}
              </span>
              <h2 className="story-modal-title">{story.title}</h2>
            </div>
          </div>

          {/* Modal Body Content */}
          <div className="story-modal-body">
            <p className="story-modal-lead">{story.shortDescription}</p>

            <div className="story-modal-narrative">
              <h3>The Human Story</h3>
              <p>{story.fullStory}</p>
            </div>

            {/* Related Organization Card */}
            {story.ngoName && (
              <div className="story-modal-ngo-box">
                <div className="ngo-box-info">
                  <span className="ngo-box-label">FACILITATING ORGANIZATION</span>
                  <h4>{story.ngoName}</h4>
                  <p>Community partner verifying needs and organizing doorstep item handovers.</p>
                </div>
                <button
                  type="button"
                  className="btn-view-ngo-profile"
                  onClick={handleNgoClick}
                >
                  <span>View Organization</span>
                  <span>↗</span>
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="story-modal-actions">
              <button
                type="button"
                className="btn-modal-close-secondary"
                onClick={onClose}
              >
                Close Story
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StoryModal;
