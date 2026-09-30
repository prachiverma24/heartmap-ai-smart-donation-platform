import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './AIRecommendationsSection.css';

const AIRecommendationsSection = ({ onMatchesFound }) => {
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
    const query = (typeof queryOverride === 'string' ? queryOverride : message).trim();
    if (!query || query.length < 5) return;

    if (!message.trim() && query) {
      setMessage(query);
    }

    setError('');
    setIsLoading(true);
    setRecommendations(null);

    try {
      let data;
      try {
        const res = await api.post('/ai/recommendations', { message: query });
        data = res.data;
      } catch (err) {
        if (err.response?.status === 404) {
          const fallbackRes = await api.post('/ai/match', { message: query });
          data = fallbackRes.data;
        } else {
          throw err;
        }
      }

      const parsedIntent = data.intent || data.interpretation || null;
      const parsedRecommendations = data.recommendations || data.matches || [];

      setIntent(parsedIntent);
      setRecommendations(parsedRecommendations);

      if (onMatchesFound && typeof onMatchesFound === 'function') {
        onMatchesFound(parsedRecommendations, parsedIntent);
      }
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setError('Please sign in to find AI recommendations.');
      } else {
        const serverErr = requestError.response?.data?.error;
        setError(serverErr || 'Unable to fetch NGO recommendations right now. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (sample) => {
    setMessage(sample);
  };

  const handleReset = () => {
    setMessage('');
    setIntent(null);
    setRecommendations(null);
    setError('');
  };

  return (
    <section className="ai-recommendations-section" aria-labelledby="ai-recs-title">
      <div className="ai-recommendations-banner">
        <div className="ai-recs-header">
          <div className="ai-recs-tag">
            <span className="ai-sparkle">✨</span> FIND THE RIGHT NGO WITH AI
          </div>
          <p className="ai-recs-subtitle">
            Tell us what you want to donate, where you are, and we'll find relevant verified organizations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="ai-recs-form">
          <div className="ai-textarea-wrapper">
            <textarea
              id="ai-recommendation-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder="Example: I have 5 winter blankets and clothes to donate in Mandi..."
              aria-label="Describe what you want to donate and where you are"
              disabled={isLoading}
            />
            <div className="ai-textarea-meta">
              <span className="ai-char-counter">
                {message.length} / 2000 characters
              </span>
            </div>
          </div>

          <div className="ai-sample-chips-row">
            <span className="ai-samples-label">Examples:</span>
            <div className="ai-chips-list">
              {sampleQueries.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="ai-chip-btn"
                  onClick={() => handleSelectSample(sample)}
                  disabled={isLoading}
                >
                  {sample.length > 55 ? `${sample.slice(0, 55)}...` : sample}
                </button>
              ))}
            </div>
          </div>

          <div className="ai-form-actions">
            <button
              type="submit"
              className="ai-submit-button"
              disabled={isLoading || !message.trim()}
            >
              {isLoading ? (
                <>
                  <span className="ai-btn-spinner" aria-hidden="true" />
                  Finding matches...
                </>
              ) : (
                'Find My Matches ✨'
              )}
            </button>

            {recommendations !== null && (
              <button
                type="button"
                className="ai-reset-button"
                onClick={handleReset}
                disabled={isLoading}
              >
                Clear AI Results
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="ai-status-alert ai-error-alert" role="alert">
            <span className="ai-alert-icon">⚠️</span>
            <div className="ai-alert-body">
              <p>{error}</p>
              {error.includes('sign in') && (
                <Link to="/login" className="ai-alert-login-link">
                  Sign in here →
                </Link>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="ai-loading-container" aria-live="polite">
            <div className="ai-loading-spinner" />
            <p>Analyzing donation intent and matching verified NGOs across MongoDB...</p>
          </div>
        )}

        {recommendations !== null && !isLoading && (
          <div className="ai-results-wrapper" aria-live="polite">
            <div className="ai-results-header">
              <div className="ai-results-title-group">
                <span className="ai-results-eyebrow">HEARTMAP MATCH RESULTS</span>
                <h2 className="ai-results-title">Your Donation Match</h2>
              </div>
              <span className="ai-results-count">
                {recommendations.length} {recommendations.length === 1 ? 'organization found' : 'organizations found'}
              </span>
            </div>

            {intent && (
              <div className="ai-intent-summary-bar">
                <span className="ai-intent-label">AI Parsed Intent:</span>
                <div className="ai-intent-tags">
                  {intent.category && (
                    <span className="ai-intent-tag category">
                      <strong>Category:</strong> {intent.category}
                    </span>
                  )}
                  {intent.location && (
                    <span className="ai-intent-tag location">
                      <strong>Location:</strong> {intent.location}
                    </span>
                  )}
                  {intent.quantity && (
                    <span className="ai-intent-tag quantity">
                      <strong>Quantity:</strong> {intent.quantity}
                    </span>
                  )}
                  {intent.items && intent.items.length > 0 && (
                    <span className="ai-intent-tag items">
                      <strong>Items:</strong> {intent.items.join(', ')}
                    </span>
                  )}
                  {intent.pickupRequested && (
                    <span className="ai-intent-tag pickup">
                      <strong>Pickup:</strong> Requested
                    </span>
                  )}
                </div>
              </div>
            )}

            {recommendations.length === 0 ? (
              <div className="ai-no-match-card">
                <div className="ai-no-match-icon">🔍</div>
                <h3>No verified NGOs matching your donation requirements were found.</h3>
                <p>
                  No active, verified organizations currently match the combination of your item category and location.
                </p>
                <div className="ai-no-match-tips">
                  <strong>Suggestions:</strong>
                  <ul>
                    <li>Try searching with a broader category (e.g. "Clothes" instead of a specific size/brand).</li>
                    <li>Specify a nearby major town or district in your description.</li>
                    <li>Explore our comprehensive verified NGO directory below.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="ai-recommendations-grid">
                {recommendations.map((item, index) => {
                  const ngo = item.ngo || item;
                  const matchReasons = item.matchReasons || item.reasons || [];
                  const isUrgent = Boolean(item.urgent);

                  return (
                    <article className="ai-ngo-recommendation-card" key={ngo._id || ngo.id || index}>
                      <div className="ai-card-top-bar">
                        <span className="ai-verified-badge" title="Identity and documentation vetted by HeartMap admin">
                          <span className="ai-check">✓</span> Verified NGO
                        </span>
                        {isUrgent && (
                          <span className="ai-urgent-badge">
                            🔥 URGENT NEED
                          </span>
                        )}
                        {item.score !== undefined && (
                          <span className="ai-score-pill">
                            Match Score: {item.score}
                          </span>
                        )}
                      </div>

                      <div className="ai-card-content">
                        <h3 className="ai-ngo-name">
                          {ngo.name || ngo.organizationName}
                        </h3>

                        {ngo.description && (
                          <p className="ai-ngo-description">{ngo.description}</p>
                        )}

                        {matchReasons.length > 0 && (
                          <div className="ai-reasons-block">
                            <span className="ai-reasons-title">Why this NGO matches:</span>
                            <ul className="ai-reasons-list">
                              {matchReasons.map((reason, rIdx) => (
                                <li key={rIdx}>
                                  <span className="ai-reason-bullet">✓</span> {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="ai-ngo-details-grid">
                          <div className="ai-detail-item">
                            <span className="ai-detail-label">Location</span>
                            <span className="ai-detail-value">
                              {[ngo.city, ngo.state].filter(Boolean).join(', ') || ngo.address || 'Location on file'}
                            </span>
                          </div>

                          {ngo.acceptedDonationTypes && ngo.acceptedDonationTypes.length > 0 && (
                            <div className="ai-detail-item">
                              <span className="ai-detail-label">Accepted Donations</span>
                              <div className="ai-tags-row">
                                {ngo.acceptedDonationTypes.map((type, tIdx) => (
                                  <span key={tIdx} className="ai-type-pill">{type}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="ai-detail-item">
                            <span className="ai-detail-label">Urgently Needed</span>
                            {ngo.urgentlyNeededItems && ngo.urgentlyNeededItems.length > 0 ? (
                              <div className="ai-tags-row">
                                {ngo.urgentlyNeededItems.map((uItem, uIdx) => (
                                  <span key={uIdx} className="ai-urgent-item-pill">⚡ {uItem}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="ai-detail-value" style={{ color: '#627574', fontStyle: 'italic' }}>
                                Not specified
                              </span>
                            )}
                          </div>

                          <div className="ai-detail-item">
                            <span className="ai-detail-label">Donation Requirements</span>
                            <span className="ai-detail-value" style={!ngo.requirements?.length ? { color: '#627574', fontStyle: 'italic' } : {}}>
                              {ngo.requirements && ngo.requirements.length > 0
                                ? ngo.requirements.join('; ')
                                : 'Not specified'}
                            </span>
                          </div>

                          <div className="ai-detail-item">
                            <span className="ai-detail-label">Logistics</span>
                            <span className="ai-detail-value">
                              {ngo.pickupAvailable ? 'Doorstep pickup available' : 'Drop-off at center (pickup not verified)'}
                              {ngo.pickupAreas && ngo.pickupAreas.length > 0 && ` (${ngo.pickupAreas.join(', ')})`}
                            </span>
                          </div>

                          {ngo.verificationSource && (
                            <div className="ai-detail-item">
                              <span className="ai-detail-label">Official Source</span>
                              <span className="ai-detail-value">
                                {ngo.sourceUrl ? (
                                  <a
                                    href={ngo.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#2e7d32', textDecoration: 'underline' }}
                                  >
                                    {ngo.verificationSource} ↗
                                  </a>
                                ) : (
                                  ngo.verificationSource
                                )}
                              </span>
                            </div>
                          )}

                          {ngo.contact && (
                            <div className="ai-detail-item">
                              <span className="ai-detail-label">Official Contact</span>
                              <span className="ai-detail-value">{ngo.contact}</span>
                            </div>
                          )}
                        </div>

                        {item.explanation && (
                          <div
                            className="ai-explanation-box"
                            style={{
                              marginTop: '0.5rem',
                              marginBottom: '1rem',
                              padding: '0.65rem 0.85rem',
                              background: '#f4fbf5',
                              border: '1px solid #d1ead5',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              color: '#1b5e20',
                              lineHeight: '1.4'
                            }}
                          >
                            <strong>💡 Context: </strong>
                            {item.explanation}
                          </div>
                        )}

                        <div className="ai-card-footer">
                          <Link to={`/ngos/${ngo._id || ngo.id}`} className="ai-view-ngo-link">
                            View Full NGO Profile <span>→</span>
                          </Link>

                          {(ngo.officialWebsite || ngo.website) && (
                            <a
                              href={ngo.officialWebsite || ngo.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ai-official-link"
                            >
                              Official Website ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AIRecommendationsSection;

