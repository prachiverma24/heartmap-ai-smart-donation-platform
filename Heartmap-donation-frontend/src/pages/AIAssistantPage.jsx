import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './AIAssistantPage.css';

const QUICK_ACTIONS = [
  { label: '🎁 I want to donate', prompt: 'I want to donate winter clothes in Mandi' },
  { label: '🆘 I need help', prompt: 'I need clothes for a family in Mandi' },
  { label: '🔎 Find an NGO', prompt: 'Find NGOs in Mandi that accept clothes' },
  { label: '✅ Understand verification', prompt: 'How does HeartMap verify NGOs?' }
];

const AIAssistantPage = () => {
  const [message, setMessage] = useState('');
  const [thread, setThread] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [thread, isLoading]);

  const handleSend = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : message).trim();
    if (!text || isLoading) return;

    setError('');
    const userMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text
    };

    setThread((prev) => [...prev, userMessageItem]);
    setMessage('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/ai/assistant', { message: text });
      if (data.success) {
        const assistantMessageItem = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          response: data.response,
          intent: data.intent,
          entities: data.entities || {},
          missingInformation: data.missingInformation || [],
          nextAction: data.nextAction,
          results: data.results || []
        };
        setThread((prev) => [...prev, assistantMessageItem]);
      } else {
        setError(data.error || 'AI Assistant encountered an issue. Please try again.');
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'AI Assistant service is temporarily unavailable. Please try again later.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleQuickAction = (prompt) => {
    setMessage(prompt);
    handleSend(prompt);
  };

  return (
    <main className="ai-assistant-page" data-testid="ai-assistant-page">
      <div className="assistant-container">
        {/* Header */}
        <header className="assistant-header">
          <div className="assistant-title-group">
            <span className="assistant-badge">HeartMap Guided Assistant</span>
            <h1 className="assistant-title">🤖 HeartMap AI Assistant</h1>
            <p className="assistant-subtitle">
              Tell me what you want to donate, what help you need, or what you're looking for.
            </p>
          </div>

          {/* Quick Action Chips */}
          <div className="quick-actions-bar" aria-label="Quick Action Suggestions">
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={index}
                type="button"
                className="quick-action-btn"
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isLoading}
              >
                {action.label}
              </button>
            ))}
          </div>
        </header>

        {/* Conversation Thread */}
        <section className="assistant-conversation" aria-label="Assistant Interaction Thread">
          {thread.length === 0 ? (
            <div className="assistant-welcome-card" data-testid="assistant-welcome-card">
              <div className="welcome-icon">💬</div>
              <h2>How can I guide you today?</h2>
              <p>
                I can help match your donation with verified local NGOs, guide you to submit community help requests, or explain HeartMap verification standards.
              </p>
              <div className="welcome-guidance-grid">
                <div className="guidance-point">
                  <strong>🎁 Donate Goods:</strong> Specify items and location to view real verified NGO matches.
                </div>
                <div className="guidance-point">
                  <strong>🆘 Request Help:</strong> Receive step-by-step guidance to publish community requests.
                </div>
                <div className="guidance-point">
                  <strong>✅ Verification:</strong> Understand how public records are verified without false guarantees.
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {thread.map((item) => (
                <div
                  key={item.id}
                  className={`message-bubble-wrapper ${item.sender === 'user' ? 'user-wrapper' : 'assistant-wrapper'}`}
                >
                  {item.sender === 'user' ? (
                    <div className="user-message-bubble">
                      <p>{item.text}</p>
                    </div>
                  ) : (
                    <div className="assistant-response-container" data-testid="assistant-response-bubble">
                      <div className="assistant-header-pill">
                        <span className="assistant-icon">🤖</span>
                        <span className="assistant-name">HeartMap Assistant</span>
                        {item.intent && (
                          <span className={`intent-tag intent-${item.intent}`}>
                            Intent: {item.intent.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="assistant-text-content">
                        <p>{item.response}</p>
                      </div>

                      {/* Missing Information Prompt */}
                      {item.missingInformation && item.missingInformation.length > 0 && (
                        <div className="missing-info-banner">
                          <span>ℹ️ Please provide: <strong>{item.missingInformation.join(', ')}</strong> to proceed with finding matching NGOs.</span>
                        </div>
                      )}

                      {/* Structured Action Cards */}
                      {item.nextAction === 'create_help_request' && (
                        <div className="action-card action-help-request" data-testid="action-help-request-card">
                          <div className="action-card-text">
                            <h4>Submit a Community Help Request</h4>
                            <p>Share your urgent needs with local community members and registered donors.</p>
                          </div>
                          <Link to="/help-requests" className="btn-action-primary">
                            Create a Help Request →
                          </Link>
                        </div>
                      )}

                      {item.nextAction === 'view_verification' && (
                        <div className="action-card action-verification" data-testid="action-verification-card">
                          <div className="action-card-text">
                            <h4>Explore Verified NGO Profiles</h4>
                            <p>Review documentation sources and verified details in our public NGO directory.</p>
                          </div>
                          <Link to="/ngos" className="btn-action-secondary">
                            Browse Verified NGOs →
                          </Link>
                        </div>
                      )}

                      {/* Real NGO Result Cards */}
                      {item.results && item.results.length > 0 && (
                        <div className="assistant-ngo-results" data-testid="assistant-ngo-results">
                          <h4 className="results-heading">Matching Verified Organizations:</h4>
                          <div className="ngo-cards-grid">
                            {item.results.map((ngo) => (
                              <div key={ngo.id || ngo._id} className="assistant-ngo-card" data-testid="assistant-ngo-card">
                                <div className="ngo-card-top">
                                  <h5 className="ngo-card-name">{ngo.name}</h5>
                                  <span className="ngo-verified-badge">✓ Verified</span>
                                </div>
                                <p className="ngo-location">
                                  📍 {[ngo.city, ngo.state].filter(Boolean).join(', ')}
                                </p>
                                {ngo.acceptedDonationTypes && ngo.acceptedDonationTypes.length > 0 && (
                                  <div className="ngo-tags">
                                    {ngo.acceptedDonationTypes.slice(0, 3).map((type, idx) => (
                                      <span key={idx} className="donation-type-pill">{type}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="ngo-card-actions">
                                  <Link to={`/ngos/${ngo.id || ngo._id}`} className="btn-view-ngo">
                                    View NGO Profile
                                  </Link>
                                  {ngo.officialWebsite && (
                                    <a
                                      href={ngo.officialWebsite}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-ngo-external"
                                    >
                                      Official Website ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="assistant-loading-indicator" aria-live="polite">
              <span className="spinner">⏳</span> Assistant is thinking...
            </div>
          )}

          {error && (
            <div className="assistant-error-banner" role="alert">
              <span>⚠️</span> {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        {/* Input Bar */}
        <footer className="assistant-input-footer">
          <form className="assistant-form" onSubmit={handleFormSubmit}>
            <input
              type="text"
              className="assistant-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your question or request (e.g. 'I want to donate winter clothes in Mandi')..."
              disabled={isLoading}
              maxLength={2000}
            />
            <button
              type="submit"
              className="btn-assistant-send"
              disabled={isLoading || !message.trim()}
            >
              {isLoading ? 'Sending...' : 'Send →'}
            </button>
          </form>
          <div className="assistant-disclaimer">
            <span>
              ℹ️ HeartMap does not process payments. Matching results are grounded strictly in real verified NGO records.
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
};

export default AIAssistantPage;

