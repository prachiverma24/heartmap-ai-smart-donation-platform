import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './NGODetailPage.css';

const reportReasons = ['Incorrect information', 'Suspicious activity', 'Wrong contact information', 'Suspicious donation link', 'Other'];

const NGODetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [ngo, setNgo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportReason, setReportReason] = useState(reportReasons[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackAnalysis, setFeedbackAnalysis] = useState(null);
  const [isAnalyzingFeedback, setIsAnalyzingFeedback] = useState(false);
  const [feedbackAnalysisError, setFeedbackAnalysisError] = useState('');
  const [feedbackSubmitSuccess, setFeedbackSubmitSuccess] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    api.get(`/ngo/${id}`).then(({ data }) => setNgo(data.profile)).catch((requestError) => setError(requestError.response?.data?.error || 'Unable to load this NGO profile.')).finally(() => setIsLoading(false));
    api.get(`/feedback/ngo/${id}`).then(({ data }) => {
      if (data.success && Array.isArray(data.feedback)) {
        setFeedbackList(data.feedback);
      }
    }).catch(() => {});
  }, [id]);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    setSummaryError('');
    try {
      const { data } = await api.post('/ai/summarize-ngo', { ngoId: id });
      if (data.success && data.summary) {
        setSummary(data.summary);
      } else {
        setSummaryError(data.error || 'Unable to generate summary.');
      }
    } catch (err) {
      setSummaryError(
        err.response?.data?.error ||
        'AI summarization is temporarily unavailable. Please refer to the profile details below.'
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAnalyzeFeedback = async () => {
    if (!feedbackText.trim()) {
      setFeedbackAnalysisError('Please enter feedback text to analyze.');
      return;
    }
    setIsAnalyzingFeedback(true);
    setFeedbackAnalysisError('');
    try {
      const { data } = await api.post('/ai/analyze-feedback', { feedback: feedbackText.trim() });
      if (data.success && data.analysis) {
        setFeedbackAnalysis(data.analysis);
      } else {
        setFeedbackAnalysisError(data.error || 'Unable to analyze feedback.');
      }
    } catch (err) {
      setFeedbackAnalysisError(
        err.response?.data?.error ||
        'AI feedback analysis is temporarily unavailable. Please try again later.'
      );
    } finally {
      setIsAnalyzingFeedback(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      const { data } = await api.post(`/feedback/ngo/${id}`, { feedback: feedbackText.trim() });
      if (data.success && data.feedback) {
        setFeedbackList((prev) => [data.feedback, ...prev]);
        setFeedbackText('');
        setFeedbackSubmitSuccess('Thank you! Your feedback has been shared.');
        setTimeout(() => setFeedbackSubmitSuccess(''), 4000);
      }
    } catch (err) {
      setFeedbackAnalysisError(err.response?.data?.error || 'Unable to submit feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault(); setReportMessage('');
    try { await api.post('/reports', { targetType: 'ngo', targetId: id, reason: reportReason, details: reportDetails }); setReportMessage('Report submitted for admin review.'); setReportDetails(''); }
    catch (requestError) { setReportMessage(requestError.response?.data?.error || 'Unable to submit this report.'); }
  };

  if (isLoading) return <main className="ngo-detail-page"><div className="ngo-state">Loading NGO profile...</div></main>;
  if (error || !ngo) return <main className="ngo-detail-page"><div className="ngo-state ngo-error" role="alert">{error || 'NGO profile not found.'}</div></main>;
  const name = ngo.name || ngo.organizationName;
  const location = [ngo.address, ngo.city, ngo.state].filter(Boolean).join(', ');
  return (
    <main className="ngo-detail-page">
      <Link className="back-link" to="/ngos">← Back to NGO discovery</Link>
      <header className="ngo-detail-header">
        {ngo.logo && <img src={ngo.logo} alt="" className="detail-logo" />}
        <div>
          <span className="ngo-status">Verification status: {ngo.verificationStatus}</span>
          <h1>{name}</h1>
          <p>{ngo.category || 'Community support'}</p>
        </div>
      </header>

      <section className="verification-note">
        <strong>Verification information reviewed</strong>
        <span>{ngo.verificationInformation || 'Verification information is not listed beyond the current status.'}</span>
        <small>This status reflects platform review of submitted information and evidence. It is not a guarantee that an organization is completely genuine.</small>
      </section>

      <div className="ngo-detail-layout">
        <div>
          <section className="detail-section">
            <h2>About</h2>
            <p>{ngo.description || 'This NGO has not added an about description yet.'}</p>

            <div className="ngo-ai-summary-container">
              {!summary && (
                <button
                  type="button"
                  className="btn-summarize-ai"
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  aria-busy={isSummarizing}
                  title="Generate a concise AI summary from verified database facts"
                >
                  {isSummarizing ? (
                    <>
                      <span className="spinner-border-sm" aria-hidden="true">⏳</span> Generating summary...
                    </>
                  ) : (
                    <>
                      ✨ Summarize with AI
                    </>
                  )}
                </button>
              )}

              {summaryError && (
                <div className="ngo-summary-error" role="alert">
                  <span>⚠️</span> {summaryError}
                </div>
              )}

              {summary && (
                <div className="ngo-ai-summary-card" data-testid="ngo-ai-summary-card">
                  <div className="ngo-ai-summary-header">
                    <div className="ngo-ai-summary-title">
                      <h3>✨ AI Summary</h3>
                      <span className="ngo-ai-summary-badge">AI-Generated</span>
                    </div>
                    <button
                      type="button"
                      className="btn-regenerate-summary"
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      title="Regenerate summary with AI"
                    >
                      {isSummarizing ? '⏳ Refreshing...' : '🔄 Regenerate'}
                    </button>
                  </div>
                  <p className="ngo-ai-summary-disclaimer">
                    This summary was generated by AI based strictly on verified information in this profile.
                  </p>
                  <p className="ngo-ai-summary-text" data-testid="ngo-ai-summary-text">
                    {summary}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="detail-section">
            <h2>Accepted donations</h2>
            <div className="detail-list">
              {ngo.acceptedDonationTypes?.length ? (
                ngo.acceptedDonationTypes.map((item) => <span key={item}>{item}</span>)
              ) : (
                <p>No donation types listed.</p>
              )}
            </div>

            <h3>Urgently needed</h3>
            <div className="detail-list urgent-list">
              {ngo.urgentlyNeededItems?.length ? (
                ngo.urgentlyNeededItems.map((item) => <span key={item}>{item}</span>)
              ) : (
                <p>No urgent items listed.</p>
              )}
            </div>
          </section>

          <section className="detail-section">
            <h2>Photos</h2>
            {ngo.images?.length ? (
              <div className="detail-images">
                {ngo.images.map((image) => (
                  <img key={image} src={image} alt={`${name} activity`} />
                ))}
              </div>
            ) : (
              <p>No photos listed.</p>
            )}
          </section>

          <section className="detail-section ngo-feedback-section">
            <div className="feedback-section-header">
              <h2>Community Feedback & Reviews</h2>
              <span className="feedback-count">{feedbackList.length} reviews</span>
            </div>

            {user ? (
              <form className="feedback-submit-card" onSubmit={handleSubmitFeedback}>
                <label htmlFor="ngo-feedback-input" className="feedback-input-label">
                  Share your experience with {name}
                </label>
                <textarea
                  id="ngo-feedback-input"
                  className="feedback-textarea"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Describe your experience donating, communicating, or interacting with this organization..."
                  rows="3"
                  maxLength="2000"
                />

                <div className="feedback-actions-bar">
                  <div className="feedback-buttons-left">
                    <button
                      type="button"
                      className="btn-analyze-feedback"
                      onClick={handleAnalyzeFeedback}
                      disabled={isAnalyzingFeedback || !feedbackText.trim()}
                      aria-busy={isAnalyzingFeedback}
                      title="Analyze sentiment, positive themes, and concerns with AI"
                    >
                      {isAnalyzingFeedback ? (
                        <>
                          <span className="spinner-border-sm" aria-hidden="true">⏳</span> Analyzing feedback...
                        </>
                      ) : (
                        <>
                          ✨ Analyze with AI
                        </>
                      )}
                    </button>
                    <button
                      type="submit"
                      className="btn-submit-feedback"
                      disabled={isSubmittingFeedback || !feedbackText.trim()}
                    >
                      {isSubmittingFeedback ? 'Submitting...' : 'Post Feedback'}
                    </button>
                  </div>
                  <span className="char-count">{feedbackText.length} / 2000</span>
                </div>

                {feedbackSubmitSuccess && (
                  <div className="feedback-submit-success" role="status">
                    ✓ {feedbackSubmitSuccess}
                  </div>
                )}
              </form>
            ) : (
              <p className="feedback-login-prompt">
                <Link to="/login" className="feedback-auth-link">Sign in</Link> to share your feedback or experience with this organization.
              </p>
            )}

            {feedbackAnalysisError && (
              <div className="ngo-feedback-error" role="alert">
                <span>⚠️</span> {feedbackAnalysisError}
              </div>
            )}

            {feedbackAnalysis && (
              <div className="ngo-ai-feedback-card" data-testid="ngo-ai-feedback-card">
                <div className="feedback-analysis-top">
                  <div className="feedback-analysis-badge-group">
                    <h3>✨ AI Feedback Analysis</h3>
                    <span className="feedback-ai-pill">AI-Generated Analysis</span>
                  </div>
                  <span className={`sentiment-badge sentiment-${feedbackAnalysis.sentiment}`}>
                    Sentiment: {feedbackAnalysis.sentiment.toUpperCase()}
                  </span>
                </div>

                <p className="feedback-analysis-disclaimer">
                  Based only on the submitted feedback. Informational only; does not determine NGO legitimacy or trustworthiness.
                </p>

                <div className="feedback-analysis-grid">
                  {feedbackAnalysis.positivePoints?.length > 0 && (
                    <div className="analysis-theme-block positive-theme-block">
                      <strong>Positive themes:</strong>
                      <ul>
                        {feedbackAnalysis.positivePoints.map((point, index) => (
                          <li key={index}>✓ {point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {feedbackAnalysis.concerns?.length > 0 && (
                    <div className="analysis-theme-block concern-theme-block">
                      <strong>Concerns & Issues:</strong>
                      <ul>
                        {feedbackAnalysis.concerns.map((concern, index) => (
                          <li key={index}>• {concern}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {feedbackAnalysis.suggestions?.length > 0 && (
                    <div className="analysis-theme-block suggestion-theme-block">
                      <strong>Suggestions:</strong>
                      <ul>
                        {feedbackAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index}>💡 {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="existing-feedback-list">
              {feedbackList.length > 0 ? (
                feedbackList.map((item) => (
                  <div key={item._id} className="feedback-item-card">
                    <div className="feedback-item-header">
                      <span className="feedback-author">{item.user?.name || 'Community Donor'}</span>
                      <span className="feedback-date">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="feedback-item-comment">{item.feedback}</p>
                  </div>
                ))
              ) : (
                <p className="no-feedback-yet">No feedback shared for this NGO yet. Be the first to share your experience.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="ngo-contact">
          <h2>Contact</h2>
          {location && <p>📍 {location}</p>}
          {ngo.phone && <p>☎ {ngo.phone}</p>}
          {ngo.email && <p>✉ {ngo.email}</p>}
          {ngo.website && (
            <p>
              <a href={ngo.website} target="_blank" rel="noreferrer">
                Visit website
              </a>
            </p>
          )}

          {ngo.officialDonationUrl && (
            <div className="donation-redirect-wrapper">
              <a
                className="donate-link"
                href={ngo.officialDonationUrl}
                target="_blank"
                rel="noreferrer"
              >
                Official donation link →
              </a>
              <p className="donation-disclaimer">
                You will be redirected to the NGO's official donation page. HeartMap does not process or handle payments.
              </p>
            </div>
          )}

          <h3>Giving information</h3>
          <p>{ngo.donationInformation || 'No additional donation information listed.'}</p>

          <h3>Collection options</h3>
          <p>
            {ngo.pickupAvailable
              ? `Pickup available${ngo.pickupAreas?.length ? ` in ${ngo.pickupAreas.join(', ')}` : ''}.`
              : 'Pickup information not listed.'}
          </p>
          <p>{ngo.dropOffAvailable ? 'Drop-off available.' : 'Drop-off information not listed.'}</p>

          <h3>Operating hours & timings</h3>
          {ngo.operatingHours && Object.keys(ngo.operatingHours).length > 0 ? (
            <div className="detail-timings">
              {Object.entries(ngo.operatingHours).map(([day, val]) => {
                let timingText = '';
                if (typeof val === 'string') {
                  timingText = val;
                } else if (val && typeof val === 'object') {
                  timingText = val.closed
                    ? 'Closed'
                    : val.open && val.close
                    ? `${val.open} - ${val.close}`
                    : val.open || val.close || 'Open';
                }
                return (
                  <div key={day} className="timing-row">
                    <span className="timing-day">{day}</span>
                    <span className="timing-hours">{timingText || 'Not specified'}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>Operating hours not listed.</p>
          )}

          {user && user.role !== 'admin' && (
            <form className="report-form" onSubmit={submitReport}>
              <h3>Report this NGO</h3>
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                {reportReasons.map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                rows="3"
                placeholder="Add details for admin review"
              />
              <button type="submit">Submit report</button>
              {reportMessage && <small>{reportMessage}</small>}
            </form>
          )}
        </aside>
      </div>
    </main>
  );
};

export default NGODetailPage;
