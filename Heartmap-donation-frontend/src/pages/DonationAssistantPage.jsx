import React, { useState } from 'react';
import api from '../api';
import './DonationAssistantPage.css';

const DonationAssistantPage = () => {
  const [message, setMessage] = useState('');
  const [intent, setIntent] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sampleQueries = [
    'I have 5 winter blankets and clothes to donate in Mandi. Find the most relevant verified NGOs for me.',
    'I want to donate school textbooks and novels in Delhi with doorstep pickup.',
    'I have dry food rations and warm blankets to donate in Himachal Pradesh.'
  ];

  const handleSubmit = async (event, queryOverride) => {
    if (event) event.preventDefault();
    const textToQuery = (typeof queryOverride === 'string' ? queryOverride : message).trim();
    if (!textToQuery || textToQuery.length < 5) return;

    if (!message.trim() && textToQuery) {
      setMessage(textToQuery);
    }

    setError('');
    setIsLoading(true);
    setRecommendations(null);

    try {
      // Use /ai/recommendations endpoint, fallback to /ai/donation-assistant
      let data;
      try {
        const res = await api.post('/ai/recommendations', { message: textToQuery });
        data = res.data;
      } catch (err) {
        if (err.response?.status === 404) {
          const fallbackRes = await api.post('/ai/donation-assistant', { message: textToQuery });
          data = fallbackRes.data;
        } else {
          throw err;
        }
      }

      setIntent(data.intent || data.interpretation || null);
      setRecommendations(data.recommendations || data.matches || []);
    } catch (requestError) {
      const serverErr = requestError.response?.data?.error;
      setError(serverErr || 'Unable to fetch NGO recommendations right now. Please try again later or browse our verified NGO directory.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (sample) => {
    setMessage(sample);
  };

  return (
    <main className="recommendations-page">
      <header className="recommendations-header">
        <span className="recommendations-eyebrow">HEARTMAP AI RECOMMENDATIONS</span>
        <h1>Find the Right Verified NGO for Your Donation</h1>
        <p>
          Describe what you want to donate and your location. HeartMap AI analyzes real verified
          NGO profiles to recommend the most relevant matches based on active drives, urgent needs,
          and pickup options.
        </p>
      </header>

      {/* Input Panel */}
      <section className="recommendations-panel" aria-labelledby="recommendation-form-title">
        <form onSubmit={handleSubmit} className="recommendations-form">
          <label htmlFor="donation-description" id="recommendation-form-title">
            Describe your donation items & location
          </label>
          <textarea
            id="donation-description"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            placeholder="Type your items and location (e.g., I have 5 winter blankets and clothes to donate in Mandi...)"
            disabled={isLoading}
          />

          <div className="sample-prompts">
            <span className="sample-label">Try asking:</span>
            <div className="sample-chips">
              {sampleQueries.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="sample-chip"
                  onClick={() => handleSelectSample(sample)}
                  disabled={isLoading}
                >
                  {sample.length > 70 ? `${sample.slice(0, 70)}...` : sample}
                </button>
              ))}
            </div>
          </div>

          <div className="recommendations-form-footer">
            <span className="char-count">{message.length}/2000 characters</span>
            <button
              type="submit"
              className="btn-find-matches"
              disabled={isLoading || !message.trim()}
            >
              {isLoading ? 'Finding matches...' : 'Find My Matches ✨'}
            </button>
          </div>
        </form>
      </section>

      {/* Error Alert */}
      {error && (
        <div className="recommendations-alert alert-error" role="alert">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
          <button type="button" className="alert-close" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="recommendations-loading" aria-live="polite">
          <div className="loading-spinner" />
          <p className="loading-text">Analyzing your request and searching verified NGO records...</p>
        </div>
      )}

      {/* Results Section */}
      {!isLoading && recommendations !== null && (
        <section className="recommendations-results" aria-labelledby="results-title">
          {/* Intent Summary */}
          {intent && (
            <div className="intent-card">
              <span className="intent-title">Understood Donation Request</span>
              <div className="intent-details">
                <div className="intent-item">
                  <span className="intent-label">Items:</span>
                  <strong>{intent.items?.length ? intent.items.join(', ') : 'Useful goods'}</strong>
                </div>
                {intent.quantity && (
                  <div className="intent-item">
                    <span className="intent-label">Quantity:</span>
                    <span>{intent.quantity}</span>
                  </div>
                )}
                {intent.category && (
                  <div className="intent-item">
                    <span className="intent-label">Category:</span>
                    <span>{intent.category}</span>
                  </div>
                )}
                {intent.location && (
                  <div className="intent-item">
                    <span className="intent-label">Location:</span>
                    <span>{intent.location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <h2 id="results-title" className="results-heading">
            Your Donation Match
          </h2>

          {/* No Matches Found */}
          {recommendations.length === 0 ? (
            <div className="recommendations-empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No verified NGOs matching your donation requirements were found.</h3>
              <p>We only recommend real, verified non-profits in our database.</p>
              <div className="empty-suggestions">
                <p><strong>Suggestions to find a match:</strong></p>
                <ul>
                  <li><strong>Location:</strong> Try searching for nearby cities or a broader state region.</li>
                  <li><strong>Donation category:</strong> Broaden the category (e.g. "Clothes", "Books", "Food").</li>
                  <li><strong>Item type:</strong> Try general terms like "winter clothing" or "blankets".</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Match Cards Grid */
            <div className="recommendations-grid">
              {recommendations.map((item) => {
                const ngo = item.ngo;
                const reasons = item.matchReasons || item.reasons || [];
                const locationStr = [ngo.address, ngo.city, ngo.state].filter(Boolean).join(', ');

                return (
                  <article className="recommendation-card" key={ngo.id || ngo._id}>
                    <div className="card-top">
                      <span className="verification-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {ngo.verificationStatus === 'verified' ? 'Verified NGO' : ngo.verificationStatus}
                      </span>
                      {item.urgent && <span className="urgent-badge">Urgent Need</span>}
                    </div>

                    <h3 className="card-ngo-name">{ngo.name || ngo.organizationName}</h3>
                    {ngo.description && <p className="card-description">{ngo.description}</p>}

                    {/* Location */}
                    {locationStr && (
                      <p className="card-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{locationStr}</span>
                        {item.distanceKm !== null && item.distanceKm !== undefined && (
                          <span className="distance-tag">({item.distanceKm} km away)</span>
                        )}
                      </p>
                    )}

                    {/* Match Reasons */}
                    {reasons.length > 0 && (
                      <div className="card-reasons">
                        <span className="reasons-label">Why this matches:</span>
                        <ul className="reasons-list">
                          {reasons.map((reason, rIdx) => (
                            <li key={rIdx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Donation & Logistics Details */}
                    <div className="card-details">
                      {ngo.acceptedDonationTypes?.length > 0 && (
                        <div className="detail-row">
                          <span className="detail-label">Accepts:</span>
                          <span className="detail-value">{ngo.acceptedDonationTypes.join(', ')}</span>
                        </div>
                      )}
                      {ngo.urgentlyNeededItems?.length > 0 && (
                        <div className="detail-row">
                          <span className="detail-label">Current needs:</span>
                          <span className="detail-value urgent-text">{ngo.urgentlyNeededItems.join(', ')}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="detail-label">Pickup/Drop-off:</span>
                        <span className="detail-value">
                          {ngo.pickupAvailable ? 'Pickup available' : 'Pickup not available'} ·{' '}
                          {ngo.dropOffAvailable ? 'Drop-off available' : 'Drop-off not available'}
                        </span>
                      </div>
                    </div>

                    {/* Official Contact Links */}
                    <div className="card-actions">
                      {ngo.officialDonationUrl && (
                        <a
                          href={ngo.officialDonationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-link btn-primary-link"
                        >
                          Official Donation Channel →
                        </a>
                      )}
                      {ngo.website && (
                        <a
                          href={ngo.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-link btn-secondary-link"
                        >
                          Website
                        </a>
                      )}
                      {ngo.phone && (
                        <a href={`tel:${ngo.phone}`} className="contact-link">
                          📞 {ngo.phone}
                        </a>
                      )}
                      {ngo.email && (
                        <a href={`mailto:${ngo.email}`} className="contact-link">
                          ✉️ {ngo.email}
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default DonationAssistantPage;
