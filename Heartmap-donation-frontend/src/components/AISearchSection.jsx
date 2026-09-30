import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './AISearchSection.css';

const AISearchSection = ({ onSearchResults }) => {
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState(null);
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sampleSearches = [
    'Find verified NGOs in Mandi that accept clothes',
    'Where can I donate food in Himachal Pradesh?',
    'Show verified NGOs near Mandi for blankets',
    'I want to support education for children',
    'Show verified NGOs that accept medical aid'
  ];

  const handleSearch = async (event, searchQuery) => {
    if (event) event.preventDefault();
    const queryText = (searchQuery !== undefined ? searchQuery : query).trim();
    if (!queryText || queryText.length < 3) return;

    setError('');
    setIsLoading(true);
    setResults(null);
    setSuggestions([]);

    try {
      const res = await api.post('/ai/search', { query: queryText });
      const data = res.data;

      setIntent(data.intent || null);
      setResults(data.results || []);
      setSuggestions(data.suggestions || []);

      if (onSearchResults && typeof onSearchResults === 'function') {
        onSearchResults(data.results || [], data.intent || null);
      }
    } catch (err) {
      const serverErr = err.response?.data?.error;
      setError(serverErr || 'Unable to complete AI search right now. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (sample) => {
    setQuery(sample);
    handleSearch(null, sample);
  };

  const handleClear = () => {
    setQuery('');
    setIntent(null);
    setResults(null);
    setSuggestions([]);
    setError('');
  };

  return (
    <section className="ai-search-section" aria-labelledby="ai-search-title">
      <div className="ai-search-banner">
        <div className="ai-search-header">
          <div className="ai-search-tag" id="ai-search-title">
            <span className="ai-sparkle">✨</span> SEARCH NGOs WITH AI
          </div>
          <p className="ai-search-subtitle">
            Describe what you're looking for in your own words.
          </p>
        </div>

        <form onSubmit={handleSearch} className="ai-search-form" role="search">
          <div className="ai-search-input-wrapper">
            <input
              type="search"
              id="ai-search-query-input"
              className="ai-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find verified NGOs in Mandi that accept clothes"
              aria-label="Describe what you are looking for in your own words"
              disabled={isLoading}
              minLength={3}
              maxLength={2000}
            />
            <button
              type="submit"
              className="ai-search-submit-btn"
              disabled={isLoading || query.trim().length < 3}
              aria-label="Search with AI"
            >
              {isLoading ? (
                <>
                  <span className="ai-search-spinner" aria-hidden="true" />
                  Searching...
                </>
              ) : (
                'Search with AI ✨'
              )}
            </button>
          </div>

          <div className="ai-search-samples-row">
            <span className="ai-search-samples-label">Try searching:</span>
            <div className="ai-search-chips">
              {sampleSearches.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="ai-search-chip"
                  onClick={() => handleSelectSample(sample)}
                  disabled={isLoading}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </form>

        {error && (
          <div className="ai-search-alert ai-search-alert-error" role="alert">
            <span className="ai-search-alert-icon">⚠️</span>
            <div className="ai-search-alert-content">
              <p>{error}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="ai-search-loading" aria-live="polite">
            <div className="ai-search-loading-spinner" />
            <p>Analyzing query intent and searching verified NGOs in MongoDB...</p>
          </div>
        )}

        {results !== null && !isLoading && (
          <div className="ai-search-results-area" aria-live="polite">
            <div className="ai-search-results-top">
              <div>
                <span className="ai-search-eyebrow">AI SEARCH RESULTS</span>
                <h2 className="ai-search-results-heading">
                  {results.length > 0 ? 'Verified Organizations' : 'Search Results'}
                </h2>
              </div>
              <div className="ai-search-results-actions">
                <span className="ai-search-count-badge">
                  {results.length} {results.length === 1 ? 'organization found' : 'organizations found'}
                </span>
                <button
                  type="button"
                  className="ai-search-clear-btn"
                  onClick={handleClear}
                >
                  Clear Results
                </button>
              </div>
            </div>

            {intent && (
              <div className="ai-search-intent-bar">
                <span className="ai-search-intent-title">Parsed Search Intent:</span>
                <div className="ai-search-intent-pills">
                  {intent.location && (
                    <span className="ai-search-intent-pill location">
                      <strong>Location:</strong> {intent.location}
                    </span>
                  )}
                  {intent.category && (
                    <span className="ai-search-intent-pill category">
                      <strong>Category:</strong> {intent.category}
                    </span>
                  )}
                  {intent.donationType && (
                    <span className="ai-search-intent-pill donation-type">
                      <strong>Donation Type:</strong> {intent.donationType}
                    </span>
                  )}
                  {intent.item && (
                    <span className="ai-search-intent-pill item">
                      <strong>Item:</strong> {intent.item}
                    </span>
                  )}
                  {intent.purpose && (
                    <span className="ai-search-intent-pill purpose">
                      <strong>Purpose:</strong> {intent.purpose}
                    </span>
                  )}
                  {intent.keywords && intent.keywords.length > 0 && (
                    <span className="ai-search-intent-pill keywords">
                      <strong>Keywords:</strong> {intent.keywords.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {results.length === 0 ? (
              <div className="ai-search-empty-state">
                <div className="ai-search-empty-icon">🔍</div>
                <h3>No verified NGOs matching your search were found.</h3>
                <p>
                  We couldn't find active verified organizations matching all criteria of your query.
                </p>
                {suggestions && suggestions.length > 0 && (
                  <div className="ai-search-suggestions">
                    <strong>Suggestions:</strong>
                    <ul>
                      {suggestions.map((sug, idx) => (
                        <li key={idx}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="ai-search-grid">
                {results.map((item, index) => {
                  const ngo = item.ngo || item;
                  const matchReasons = item.matchReasons || item.reasons || [];
                  const acceptedTypes = ngo.acceptedDonationTypes || [];

                  return (
                    <article className="ai-search-card" key={ngo._id || ngo.id || index}>
                      <div className="ai-search-card-header">
                        <span className="ai-search-verified-badge" title="Verified against official records">
                          <span className="ai-search-check">✓</span> Verified NGO
                        </span>
                        {ngo.category && (
                          <span className="ai-search-category-badge">{ngo.category}</span>
                        )}
                      </div>

                      <h3 className="ai-search-ngo-name">
                        {ngo.name || ngo.organizationName}
                      </h3>

                      <p className="ai-search-ngo-desc">
                        {ngo.description || 'Community support and non-profit organization.'}
                      </p>

                      <div className="ai-search-meta-grid">
                        <div className="ai-search-meta-item">
                          <span className="ai-search-meta-label">📍 Location:</span>
                          <span className="ai-search-meta-value">
                            {[ngo.city, ngo.state].filter(Boolean).join(', ') || ngo.address || 'Location not listed'}
                          </span>
                        </div>

                        <div className="ai-search-meta-item">
                          <span className="ai-search-meta-label">📦 Accepted Donations:</span>
                          <span className="ai-search-meta-value">
                            {acceptedTypes.length > 0 ? (
                              <span className="ai-search-types-wrap">
                                {acceptedTypes.map((type, tIdx) => (
                                  <span key={tIdx} className="ai-search-type-tag">
                                    {type}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              'Not specified'
                            )}
                          </span>
                        </div>

                        <div className="ai-search-meta-item">
                          <span className="ai-search-meta-label">🚚 Logistics:</span>
                          <span className="ai-search-meta-value">
                            {ngo.pickupAvailable
                              ? 'Doorstep pickup verified'
                              : 'Drop-off at center (pickup not verified)'}
                          </span>
                        </div>

                        {(ngo.officialWebsite || ngo.website || ngo.contact || ngo.phone) && (
                          <div className="ai-search-meta-item">
                            <span className="ai-search-meta-label">🌐 Official Contact:</span>
                            <span className="ai-search-meta-value">
                              {(ngo.officialWebsite || ngo.website) && (
                                <a
                                  href={ngo.officialWebsite || ngo.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ai-search-link"
                                >
                                  Official Website ↗
                                </a>
                              )}
                              {(ngo.contact || ngo.phone) && (
                                <span className="ai-search-phone">
                                  📞 {ngo.contact || ngo.phone}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {matchReasons.length > 0 && (
                        <div className="ai-search-reasons-box">
                          <span className="ai-search-reasons-title">Why this matches your search:</span>
                          <ul className="ai-search-reasons-list">
                            {matchReasons.map((reason, rIdx) => (
                              <li key={rIdx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.explanation && (
                        <p className="ai-search-explanation">
                          <em>ℹ️ {item.explanation}</em>
                        </p>
                      )}

                      <div className="ai-search-card-actions">
                        <Link to={`/ngos/${ngo._id || ngo.id}`} className="ai-search-profile-btn">
                          View NGO profile <span>→</span>
                        </Link>
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

export default AISearchSection;

