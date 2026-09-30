import React, { useEffect, useState, useMemo } from 'react';
import api from '../api';
import FileUploadField from '../components/FileUploadField';
import { useAuth } from '../context/AuthContext';
import './SupportPages.css';

const initialForm = {
  title: '',
  category: 'Food',
  requiredItem: '',
  quantity: '1',
  description: '',
  address: '',
  lat: '',
  lng: '',
  images: '',
  contactInformation: '',
  status: 'open'
};

const toList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

const HelpRequestsPage = () => {
  const { user } = useAuth();
  const isNgo = user?.role === 'ngo';

  const [form, setForm] = useState(initialForm);
  const [requests, setRequests] = useState([]);
  const [communityRequests, setCommunityRequests] = useState([]);
  const [activeTab, setActiveTab] = useState(isNgo ? 'community' : 'mine');
  const [editingId, setEditingId] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [communitySearch, setCommunitySearch] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

  const loadRequests = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get('/help-requests?mine=true');
      setRequests(data.requests || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load your help requests.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCommunityRequests = async () => {
    if (!isNgo) return;
    setIsCommunityLoading(true);
    try {
      const { data } = await api.get('/help-requests');
      setCommunityRequests(data.requests || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load community help requests.');
    } finally {
      setIsCommunityLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    if (isNgo) {
      loadCommunityRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNgo]);

  const update = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    const payload = {
      ...form,
      quantity: Number(form.quantity),
      images: [...uploadedImages, ...toList(form.images)],
      location: {
        address: form.address,
        lat: form.lat !== '' && !isNaN(Number(form.lat)) ? Number(form.lat) : undefined,
        lng: form.lng !== '' && !isNaN(Number(form.lng)) ? Number(form.lng) : undefined
      },
      ...(editingId ? { status: form.status || 'open' } : {})
    };

    try {
      if (editingId) {
        await api.patch(`/help-requests/${editingId}`, payload);
        setMessage('Your support request was updated.');
      } else {
        await api.post('/help-requests', payload);
        setMessage('Your support request was created.');
      }
      setForm(initialForm);
      setUploadedImages([]);
      setEditingId(null);
      setAiSuggestion('');
      setAiError('');
      setAiSuccessMessage('');
      await loadRequests();
      if (isNgo) {
        await loadCommunityRequests();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to save your request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const edit = (request) => {
    setEditingId(request._id);
    setUploadedImages(request.images || []);
    setForm({
      ...initialForm,
      ...request,
      quantity: String(request.quantity ?? 1),
      address: request.location?.address || '',
      lat: request.location?.lat !== undefined && request.location?.lat !== null ? String(request.location.lat) : '',
      lng: request.location?.lng !== undefined && request.location?.lng !== null ? String(request.location.lng) : '',
      images: '',
      status: request.status || 'open'
    });
    setMessage('');
    setAiSuggestion('');
    setAiError('');
    setAiSuccessMessage('');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        // Fallback for environments without scrollTo
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
    setUploadedImages([]);
    setError('');
    setMessage('');
    setAiSuggestion('');
    setAiError('');
    setAiSuccessMessage('');
  };

  const handleImproveWithAi = async () => {
    if (!form.description || form.description.trim().length < 3) {
      setAiError('Please enter at least 3 characters in the description before improving with AI.');
      return;
    }
    setIsGeneratingAi(true);
    setAiError('');
    setAiSuccessMessage('');
    try {
      const { data } = await api.post('/ai/generate-content', {
        contentType: 'help_request',
        text: form.description.trim()
      });
      if (data.success && data.generatedText) {
        setAiSuggestion(data.generatedText);
      } else {
        setAiError(data.error || 'Unable to generate suggestion.');
      }
    } catch (err) {
      setAiError(
        err.response?.data?.error ||
        'AI content generation is temporarily unavailable. You can continue writing manually.'
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleUseAiSuggestion = () => {
    if (aiSuggestion) {
      setForm((prev) => ({ ...prev, description: aiSuggestion }));
      setAiSuccessMessage('AI suggestion applied! You can review or make further edits above.');
      setAiSuggestion('');
    }
  };

  const handleDismissAiSuggestion = () => {
    setAiSuggestion('');
    setAiError('');
    setAiSuccessMessage('');
  };

  const remove = async (id) => {
    if (!window.confirm('Are you sure you want to delete this help request?')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await api.delete(`/help-requests/${id}`);
      setMessage('Request deleted.');
      setRequests((prev) => prev.filter((request) => request._id !== id));
      if (editingId === id) {
        cancelEdit();
      }
      if (isNgo) {
        loadCommunityRequests();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to delete that request.');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingStatusId(id);
    setError('');
    setMessage('');
    try {
      await api.patch(`/help-requests/${id}`, { status: newStatus });
      setMessage(`Request status updated to ${newStatus}.`);
      setRequests((prev) => prev.map((r) => (r._id === id ? { ...r, status: newStatus } : r)));
      if (editingId === id) {
        setForm((prev) => ({ ...prev, status: newStatus }));
      }
      if (isNgo) {
        loadCommunityRequests();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update request status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const filteredCommunityRequests = useMemo(() => {
    if (!communitySearch.trim()) return communityRequests;
    const q = communitySearch.toLowerCase().trim();
    return communityRequests.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.requiredItem?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.location?.address?.toLowerCase().includes(q)
    );
  }, [communityRequests, communitySearch]);

  return (
    <main className="support-page">
      <section className="support-panel">
        <p className="eyebrow">{editingId ? 'EDIT SUPPORT REQUEST' : 'I NEED HELP'}</p>
        <h1>{editingId ? 'Update your support request.' : 'Create a support request.'}</h1>
        <p>
          {editingId
            ? 'Modify your existing help request and update its status.'
            : 'Describe what is needed so relevant community organizations can find the request.'}
        </p>

        {message && <div className="support-success">{message}</div>}
        {error && <div className="support-error" role="alert">{error}</div>}

        <form className="support-form" onSubmit={submit}>
          <label>
            Title
            <input
              name="title"
              value={form.title}
              onChange={update}
              required
              placeholder="Winter clothing for a family"
            />
          </label>

          <div className="support-row">
            <label>
              Category
              <input name="category" value={form.category} onChange={update} required />
            </label>
            <label>
              Required item
              <input
                name="requiredItem"
                value={form.requiredItem}
                onChange={update}
                required
                placeholder="Winter clothes"
              />
            </label>
          </div>

          <label>
            Quantity
            <input name="quantity" type="number" min="1" value={form.quantity} onChange={update} required />
          </label>

          <label>
            Description
            <textarea
              name="description"
              value={form.description}
              onChange={update}
              required
              rows="4"
              placeholder="Add details about who needs this and the circumstances."
            />
          </label>

          <div className="ai-content-assistant">
            <div className="ai-content-assistant-header">
              <button
                type="button"
                className="btn-ai-improve"
                onClick={handleImproveWithAi}
                disabled={isGeneratingAi || !form.description || form.description.trim().length < 3}
                aria-busy={isGeneratingAi}
                title="Polish your description into a clear, professional request using AI"
              >
                {isGeneratingAi ? (
                  <>
                    <span className="spinner-border-sm" aria-hidden="true">⏳</span> Polishing with AI...
                  </>
                ) : (
                  <>
                    ✨ Improve with AI
                  </>
                )}
              </button>
              <span className="ai-assistant-tip">
                Type rough notes, then click to polish into a clear, respectful request.
              </span>
            </div>

            {aiError && (
              <div className="ai-assistant-error" role="alert">
                <span>⚠️</span> {aiError}
              </div>
            )}

            {aiSuccessMessage && (
              <div className="ai-assistant-success" role="status">
                <span>✓</span> {aiSuccessMessage}
              </div>
            )}

            {aiSuggestion && (
              <div className="ai-suggestion-box" aria-label="AI Generated Suggestion">
                <div className="ai-suggestion-header">
                  <div className="ai-suggestion-title">
                    <span className="ai-badge">✨ AI-Generated Suggestion</span>
                    <span className="ai-review-notice">Review before using</span>
                  </div>
                </div>
                <p className="ai-suggestion-disclaimer">
                  Review this suggestion carefully. HeartMap never submits requests automatically. You can edit the text in the description box anytime.
                </p>
                <div className="ai-suggestion-text" data-testid="ai-suggestion-text">
                  {aiSuggestion}
                </div>
                <div className="ai-suggestion-actions">
                  <button
                    type="button"
                    className="btn-ai-use"
                    onClick={handleUseAiSuggestion}
                    title="Apply this text to the description field"
                  >
                    ✓ Use This Suggestion
                  </button>
                  <button
                    type="button"
                    className="btn-ai-regenerate"
                    onClick={handleImproveWithAi}
                    disabled={isGeneratingAi}
                    title="Regenerate suggestion with AI"
                  >
                    🔄 Regenerate
                  </button>
                  <button
                    type="button"
                    className="btn-ai-dismiss"
                    onClick={handleDismissAiSuggestion}
                    title="Dismiss this suggestion"
                  >
                    ✕ Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          <label>
            Location
            <input name="address" value={form.address} onChange={update} placeholder="Shimla, Himachal Pradesh" />
          </label>

          <div className="support-row">
            <label>
              Latitude
              <input name="lat" type="number" step="any" value={form.lat} onChange={update} />
            </label>
            <label>
              Longitude
              <input name="lng" type="number" step="any" value={form.lng} onChange={update} />
            </label>
          </div>

          <label>
            Image URLs, comma separated
            <input name="images" value={form.images} onChange={update} placeholder="https://..." />
          </label>

          <FileUploadField
            purpose="help-image"
            value={uploadedImages}
            onChange={setUploadedImages}
            label="Upload request image"
          />

          <label>
            Contact information
            <input
              name="contactInformation"
              value={form.contactInformation}
              onChange={update}
              required
              placeholder="A safe phone or email for follow-up"
            />
          </label>

          {editingId && (
            <label>
              Status
              <select name="status" value={form.status || 'open'} onChange={update}>
                <option value="open">Open (Still needed)</option>
                <option value="fulfilled">Fulfilled (Help received)</option>
                <option value="closed">Closed (No longer needed)</option>
              </select>
            </label>
          )}

          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? editingId
                  ? 'Saving request...'
                  : 'Creating request...'
                : editingId
                ? 'Update support request'
                : 'Create support request'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  background: 'transparent',
                  color: '#627574',
                  border: '1px solid #c2d0c5',
                  borderRadius: '3px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '0.9rem 1.4rem'
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="match-panel">
        {/* NGO Tab Switcher */}
        {isNgo ? (
          <div className="support-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'community'}
              className={`support-tab-btn ${activeTab === 'community' ? 'active' : ''}`}
              onClick={() => setActiveTab('community')}
            >
              Community Open Requests ({communityRequests.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'mine'}
              className={`support-tab-btn ${activeTab === 'mine' ? 'active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              My Organization's Requests ({requests.length})
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow">MY REQUESTS</p>
            <h2>Your support requests</h2>
          </>
        )}

        {/* View 1: NGO Community Feed */}
        {isNgo && activeTab === 'community' ? (
          <div className="community-feed-section">
            <p className="listings-subtitle">
              Browse open support requests submitted by people in the community to offer help.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="search"
                placeholder="Search community requests..."
                value={communitySearch}
                onChange={(e) => setCommunitySearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  border: '1px solid #c2d0c5',
                  background: '#fff',
                  color: '#173b3f',
                  borderRadius: '3px',
                  font: 'inherit'
                }}
              />
            </div>

            {isCommunityLoading ? (
              <div className="listing-state">Loading open community requests...</div>
            ) : filteredCommunityRequests.length === 0 ? (
              <div className="listing-empty-state">
                <p>No open community help requests found.</p>
                <small>
                  {communitySearch
                    ? 'Try clearing your search query.'
                    : 'Check back soon for community requests in need of assistance.'}
                </small>
              </div>
            ) : (
              <div className="request-list">
                {filteredCommunityRequests.map((request) => (
                  <article className="request-card" key={request._id}>
                    <div className="card-top-badges">
                      <span className="badge-status badge-available">{request.status}</span>
                      <span className="badge-type">{request.category}</span>
                    </div>
                    <h2>{request.title}</h2>
                    <p className="card-item-summary">
                      <strong>Item:</strong> {request.requiredItem} &nbsp;·&nbsp; <strong>Qty:</strong> {request.quantity}
                    </p>
                    <p className="card-description">{request.description}</p>
                    {request.location?.address && (
                      <p className="card-details-row">
                        <span>📍 {request.location.address}</span>
                      </p>
                    )}
                    {request.images && request.images.length > 0 && (
                      <div className="card-photo-thumbnails">
                        {request.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={request.requiredItem}
                            className="card-thumb"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="community-contact-box">
                      <strong>Contact:</strong> <span>{request.contactInformation}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#627574', marginTop: '0.5rem' }}>
                      Requested by <strong>{request.owner?.name || 'Community Member'}</strong> ·{' '}
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* View 2: User's / NGO's Own Requests */
          <div>
            {isLoading ? (
              <div className="ngo-state">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="listing-empty-state">
                <p>You have not created any support requests yet.</p>
                <small>Requests you submit will appear here where you can manage and update their status.</small>
              </div>
            ) : (
              <div className="request-list">
                {requests.map((request) => (
                  <article className="request-card" key={request._id}>
                    <div className="card-top-badges">
                      <span className={`badge-status badge-${request.status === 'open' ? 'available' : request.status}`}>
                        {request.status}
                      </span>
                      <span className="badge-type">{request.category}</span>
                    </div>

                    <h2>{request.title}</h2>
                    <p className="card-item-summary">
                      <strong>Item:</strong> {request.requiredItem} &nbsp;·&nbsp; <strong>Qty:</strong> {request.quantity}
                    </p>
                    <p className="card-description">{request.description}</p>
                    {request.location?.address && (
                      <p className="card-details-row">
                        <span>📍 {request.location.address}</span>
                      </p>
                    )}

                    {request.images && request.images.length > 0 && (
                      <div className="card-photo-thumbnails">
                        {request.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={request.requiredItem}
                            className="card-thumb"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Owner Status Management Control */}
                    <div className="request-status-control">
                      <label>
                        <span>Change Status:</span>
                        <select
                          value={request.status}
                          onChange={(e) => handleStatusChange(request._id, e.target.value)}
                          disabled={updatingStatusId === request._id}
                        >
                          <option value="open">Open</option>
                          <option value="fulfilled">Fulfilled</option>
                          <option value="closed">Closed</option>
                        </select>
                      </label>
                      {updatingStatusId === request._id && <small>Saving...</small>}
                    </div>

                    <div className="request-actions">
                      <button type="button" onClick={() => edit(request)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => remove(request._id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
};

export default HelpRequestsPage;
