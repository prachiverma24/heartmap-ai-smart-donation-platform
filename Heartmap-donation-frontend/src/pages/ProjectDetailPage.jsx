import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './ProjectDetailPage.css';

// Simple markdown renderer (no external deps needed)
const renderMarkdown = (text) => {
  const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (value) => escape(value)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const lines = String(text || '').split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); flushList(); return; }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); }
    else if (bullet) { flushParagraph(); list.push(bullet[1]); }
    else { flushList(); paragraph.push(trimmed); }
  });
  flushParagraph(); flushList();
  return output.join('');
};

const getFileIcon = (mimeType, originalName) => {
  if (!mimeType && !originalName) return '📄';
  const ext = originalName ? originalName.split('.').pop().toLowerCase() : '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📕';
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return '🟨';
  if (ext === 'py') return '🐍';
  if (['java'].includes(ext)) return '☕';
  if (['c', 'cpp', 'h', 'hpp'].includes(ext)) return '⚙️';
  if (['md', 'txt'].includes(ext)) return '📝';
  if (ext === 'json') return '{}';
  if (ext === 'css') return '🎨';
  if (ext === 'html') return '🌐';
  return '📄';
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageFile = (name) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name || '');
const isPdfFile = (name) => /\.pdf$/i.test(name || '');

// Robust clipboard helper with fallback for all browsers/protocols
const copyToClipboard = async (text) => {
  if (!text) return false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback to execCommand
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
};

// =========================================
// MAIN COMPONENT
// =========================================
const ProjectDetailPage = () => {
  const params = useParams();
  const projectId = params.projectId || params.driveId;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const backPath = location.pathname.startsWith('/donation-drives') ? '/donation-drives' : '/projects';
  const isDonationDrive = location.pathname.startsWith('/donation-drives');
  const apiRoot = isDonationDrive ? `/donation-drives/${projectId}` : `/projects/${projectId}`;

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [items, setItems] = useState([]);
  const [interests, setInterests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [aiTool, setAiTool] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const isOwner = project && (project.owner?.id === user?._id || project.owner?._id === user?._id || project.userRole === 'owner');

  const getShareUrl = () => `${window.location.origin}/public/donation-drive/${projectId}`;

  const shareDrive = () => {
    setShowShareModal(true);
  };

  const copyShareLink = async () => {
    const shareUrl = getShareUrl();
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopiedLink(true);
      setShareFeedback('Link copied to clipboard!');
      window.setTimeout(() => setCopiedLink(false), 2500);
    } else {
      const input = document.getElementById('share-link-input');
      if (input) {
        input.focus();
        input.select();
      }
      setShareFeedback('Link selected! Press Ctrl+C (or Cmd+C) to copy.');
    }
    window.setTimeout(() => setShareFeedback(''), 3500);
  };

  const togglePublicSharing = async () => {
    try {
      const nextPublic = !project?.isPublic;
      const { data } = await api.put(apiRoot, { isPublic: nextPublic });
      const updated = data.drive || data.project || {};
      const actualPublic = updated.isPublic !== undefined ? updated.isPublic : nextPublic;
      setProject((current) => ({ ...current, isPublic: actualPublic }));
      setShareFeedback(actualPublic ? 'Public sharing enabled' : 'Project is now private');
    } catch (err) {
      setShareFeedback(err.response?.data?.error || 'Unable to update sharing status');
    }
    window.setTimeout(() => setShareFeedback(''), 3000);
  };

  const runAiTool = async () => {
    if (!aiInput.trim() && aiTool !== 'readme') return;
    try {
      setAiLoading(true);
      setAiError('');
      setAiResult('');
      const endpoint = aiTool === 'explain' ? '/gemini/explain' : aiTool === 'docs' ? '/gemini/docs' : '/gemini/readme';
      const payload = aiTool === 'readme'
        ? (isDonationDrive ? { driveId: projectId, content: aiInput.trim() || undefined } : { projectId, content: aiInput.trim() || undefined })
        : { content: aiInput.trim() };
      const { data } = await api.post(endpoint, payload);
      setAiResult(data.explanation || data.documentation || data.readme || data.improved || '');
    } catch (err) {
      setAiError(err.response?.data?.error || 'Gemini request failed. Please check your network and try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const copyAiResult = async () => {
    if (!aiResult) return;
    try {
      await navigator.clipboard.writeText(aiResult);
      setShareFeedback('AI result copied to clipboard!');
      window.setTimeout(() => setShareFeedback(''), 2500);
    } catch {
      setShareFeedback('Copy failed.');
    }
  };

  const loadProject = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const requests = [
        api.get(apiRoot),
        api.get(`${apiRoot}/members`),
        api.get(`${apiRoot}/notes`),
        api.get(`${apiRoot}/files`)
      ];
      if (isDonationDrive) requests.push(api.get(`${apiRoot}/items`));
      if (isDonationDrive) requests.push(api.get(`${apiRoot}/interests`).catch(() => ({ data: { interests: [] } })));
      const [projRes, membersRes, notesRes, filesRes, itemsRes, interestsRes] = await Promise.all(requests);
      setProject(projRes.data.drive || projRes.data.project);
      setMembers(membersRes.data.members || []);
      setNotes(notesRes.data.notes || []);
      setFiles(filesRes.data.files || []);
      if (isDonationDrive) {
        setItems(itemsRes?.data?.items || []);
        setInterests(interestsRes?.data?.interests || []);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied: You are not a member of this project.');
      } else if (err.response?.status === 404) {
        setError('Project not found.');
      } else {
        setError(err.response?.data?.error || 'Failed to load project');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiRoot, isDonationDrive]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const loadAnalytics = useCallback(async () => {
    if (!isDonationDrive) return;
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const { data } = await api.get(`${apiRoot}/analytics`);
      setAnalytics(data.analytics || null);
    } catch (err) {
      setAnalytics(null);
      setAnalyticsError(err.response?.data?.error || 'Unable to load contribution analytics. Please try again.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [apiRoot, isDonationDrive]);

  useEffect(() => {
    if (isDonationDrive) loadAnalytics();
  }, [isDonationDrive, loadAnalytics]);

  if (isLoading) return (
    <div className="project-detail-page">
      <div className="pd-loading"><div className="pd-spinner" /><p>Loading project…</p></div>
    </div>
  );

  if (error) return (
    <div className="project-detail-page">
      <div className="pd-error">
        <span>⚠️</span> {error}
        <div style={{ marginTop: 16 }}>
          <button className="btn-back" onClick={() => navigate(backPath)}>← Back to {backPath === '/donation-drives' ? 'Donation Drives' : 'Projects'}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="project-detail-page">
      {/* Header */}
      <div className="pd-header">
        <div className="pd-header-content">
          <button className="btn-back" onClick={() => navigate(backPath)}>← {backPath === '/donation-drives' ? 'Donation Drives' : 'Projects'}</button>
          <div className="pd-title-row">
            <div>
              <h1 className="pd-project-name">{project?.name}</h1>
              {project?.description && <p className="pd-project-desc">{project.description}</p>}
            </div>
            <div className="pd-header-actions">
              <div className="pd-role-badge" data-role={project?.userRole}>
                {project?.userRole === 'owner' ? '👑 Owner' : '👤 Member'}
              </div>
              {isDonationDrive && (
                <span className={`pd-visibility-pill ${project?.isPublic ? 'public' : 'private'}`}>
                  {project?.isPublic ? '🟢 Public' : '🔒 Private'}
                </span>
              )}
              {isDonationDrive && (
                <button className="pd-share-button" onClick={shareDrive} title="Share public link">
                  🔗 Share Project
                </button>
              )}
            </div>
            {shareFeedback && <div className="pd-share-toast" role="status"><span>✓</span> {shareFeedback}</div>}
          </div>

          {/* Tabs */}
          <nav className="pd-tabs">
            {(isDonationDrive ? ['overview', 'items', 'files', 'interests', 'members', 'notes', 'analytics'] : ['overview', 'members', 'files', 'notes']).map((tab) => (
              <button
                key={tab}
                className={`pd-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' && '📊 Overview'}
                {tab === 'members' && `👥 Members (${members.length})`}
                {tab === 'notes' && `📝 Notes (${notes.length})`}
                {tab === 'files' && `📁 Files (${files.length})`}
                {tab === 'items' && `🎁 Donation Items (${items.length})`}
                {tab === 'interests' && `🤝 NGOs Interested (${interests.length})`}
                {tab === 'analytics' && '📈 Analytics'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && isDonationDrive && (
        <div className="pd-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="pd-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal-header">
              <h3>🔗 Share Donation Drive</h3>
              <button className="btn-modal-close" onClick={() => setShowShareModal(false)}>✕</button>
            </div>
            <div className="pd-modal-body">
              <div className="pd-share-status-block">
                <div>
                  <strong>Visibility Status</strong>
                  <p>{project?.isPublic ? 'Public — Anyone with the unique link can view this drive in read-only mode.' : 'Private — Only authenticated project members can access this drive.'}</p>
                </div>
                {isOwner && (
                  <button
                    className={`btn-toggle-public ${project?.isPublic ? 'is-public' : ''}`}
                    onClick={togglePublicSharing}
                  >
                    {project?.isPublic ? '🔒 Disable Public Sharing' : '🌐 Enable Public Sharing'}
                  </button>
                )}
              </div>

              <div className="pd-share-link-group">
                <label htmlFor="share-link-input">Shareable Public URL</label>
                <div className="pd-share-link-row">
                  <input
                    id="share-link-input"
                    type="text"
                    readOnly
                    value={getShareUrl()}
                    className="share-link-input"
                    onClick={(e) => e.target.select()}
                  />
                  <button className="btn-copy-link" onClick={copyShareLink}>
                    {copiedLink ? '✓ Copied!' : '📋 Copy Link'}
                  </button>
                </div>
              </div>

              {!project?.isPublic && (
                <div className="pd-share-warning">
                  ⚠️ Public sharing is currently <strong>disabled</strong>. Visitors following this link will see the "Project is currently private" notice until public sharing is enabled.
                </div>
              )}

              <div className="pd-share-security-note">
                🔒 <strong>Security Guarantee:</strong> Public visitors can only view basic project details, donation items, and files explicitly marked public. Private files, notes, tokens, and member management remain protected.
              </div>
            </div>
            <div className="pd-modal-footer">
              <button className="btn-modal-done" onClick={() => setShowShareModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="pd-content">
        {activeTab === 'overview' && (
          <OverviewTab project={project} members={members} notes={notes} files={files} />
        )}
        {activeTab === 'members' && (
          <MembersTab
            project={project}
            projectId={projectId}
            apiRoot={apiRoot}
            members={members}
            setMembers={setMembers}
            isOwner={isOwner}
          />
        )}
        {activeTab === 'notes' && (
          <NotesTab
            projectId={projectId}
            apiRoot={apiRoot}
            notes={notes}
            setNotes={setNotes}
            user={user}
            isOwner={isOwner}
          />
        )}
        {activeTab === 'files' && (
          <FilesTab
            projectId={projectId}
            apiRoot={apiRoot}
            files={files}
            setFiles={setFiles}
            user={user}
            isOwner={isOwner}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab analytics={analytics} loading={analyticsLoading} error={analyticsError} onRetry={loadAnalytics} />
        )}
        {activeTab === 'items' && (
          <DonationItemsTab projectId={projectId} apiRoot={apiRoot} items={items} setItems={setItems} user={user} />
        )}
        {activeTab === 'interests' && (
          <InterestsTab projectId={projectId} apiRoot={apiRoot} interests={interests} setInterests={setInterests} isOwner={isOwner} />
        )}
      </div>
    </div>
  );
};

const DonationItemsTab = ({ projectId, apiRoot, items, setItems, user }) => {
  const [form, setForm] = useState({ title: '', category: '', description: '', quantity: 1, condition: 'good' });
  const [photo, setPhoto] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isNgo = user?.role === 'ngo';

  const addItem = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (photo) body.append('image', photo);
      const { data } = await api.post(`${apiRoot}/items`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setItems((current) => [data.item, ...current]);
      setForm({ title: '', category: '', description: '', quantity: 1, condition: 'good' });
      setPhoto(null); setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to add donation item');
    } finally { setSaving(false); }
  };

  return (
    <section className="donation-items-tab">
      <div className="donation-tab-heading">
        <div><h2>Donation Items</h2><p>Share the items this drive is collecting.</p></div>
        {!isNgo && <button className="pd-primary-button" onClick={() => setShowForm((value) => !value)}>{showForm ? 'Close' : '+ Add item'}</button>}
      </div>
      {showForm && (
        <form className="donation-item-form" onSubmit={addItem}>
          {error && <p className="field-error">{error}</p>}
          <div className="form-row">
            <label>Item name *<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Warm blankets" /></label>
            <label>Category *<input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Clothing" /></label>
          </div>
          <div className="form-row">
            <label>Quantity *<input required type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
            <label>Condition *<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option value="new">New</option><option value="like-new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="used">Used</option></select></label>
          </div>
          <label>Description<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What should donors know?" /></label>
          <label>Item photo<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} /></label>
          <button className="pd-primary-button" disabled={saving}>{saving ? 'Adding…' : 'Add donation item'}</button>
        </form>
      )}
      {items.length === 0 ? <div className="donation-empty">No donation items yet.</div> : (
        <div className="donation-items-grid">{items.map((item) => (
          <article className="donation-item-card" key={item._id || item.id}>
            {item.image && <img src={item.image.startsWith('http') ? item.image : `${api.defaults.baseURL}/uploads/public/${item.image}`} alt="" />}
            <div className="donation-item-card-body"><span className="item-category">{item.category}</span><h3>{item.title}</h3><p>{item.description || 'No description provided.'}</p><strong>{item.quantity} {item.quantity === 1 ? 'item' : 'items'} · {item.condition}</strong>{isNgo && <button className="pd-primary-button item-request-button" onClick={async () => { const note = window.prompt('Message for the drive organiser (optional):', '') || ''; try { await api.post(`${apiRoot}/items/${item._id || item.id}/interest`, { message: note }); window.alert('Your request has been sent.'); } catch (err) { window.alert(err.response?.data?.error || 'Unable to send request'); } }}>Request this item</button>}</div>
          </article>
        ))}</div>
      )}
    </section>
  );
};

const InterestsTab = ({ projectId, apiRoot, interests, setInterests, isOwner }) => {
  const [message, setMessage] = useState('');
  const updateInterest = async (interestId, status) => {
    try {
      const { data } = await api.patch(`${apiRoot}/interests/${interestId}`, { status });
      setInterests((current) => current.map((item) => (item._id === interestId ? data.interest : item)));
    } catch (err) { alert(err.response?.data?.error || 'Unable to update request'); }
  };

  return (
    <section className="interests-tab">
      <div className="donation-tab-heading"><div><h2>NGOs Interested</h2><p>Review requests from verified organisations.</p></div></div>
      {!isOwner && <div className="interest-request-box"><p>Interested in receiving items from this drive?</p><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note for the drive organiser (optional)" /><p className="settings-hint">Open Donation Items and use the request action on an item to send your interest.</p></div>}
      {interests.length === 0 ? <div className="donation-empty">No NGO requests yet.</div> : interests.map((interest) => (
        <div className="interest-row" key={interest._id || interest.id}><div><strong>{interest.ngo?.name || 'NGO'}</strong><span>{interest.item?.title || 'Donation item'} · {interest.message || 'No message'}</span></div><span className={`interest-status ${interest.status}`}>{interest.status}</span>{isOwner && interest.status === 'pending' && <div><button onClick={() => updateInterest(interest._id, 'approved')}>Approve</button><button onClick={() => updateInterest(interest._id, 'rejected')}>Decline</button></div>}</div>
      ))}
    </section>
  );
};

const AnalyticsTab = ({ analytics, loading, error, onRetry }) => {
  if (loading) {
    return (
      <section className="tab-analytics" aria-labelledby="analytics-heading">
        <div className="donation-tab-heading">
          <div><h2 id="analytics-heading">Drive analytics</h2><p>See how your community is responding to this drive.</p></div>
        </div>
        <div className="analytics-state">
          <div className="pd-spinner" style={{ margin: '0 auto 12px' }} />
          Loading contribution analytics...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="tab-analytics" aria-labelledby="analytics-heading">
        <div className="donation-tab-heading">
          <div><h2 id="analytics-heading">Drive analytics</h2><p>See how your community is responding to this drive.</p></div>
        </div>
        <div className="analytics-state analytics-error" role="alert">
          <p>{error}</p>
          <button className="pd-primary-button" onClick={onRetry} style={{ marginTop: 12 }}>Retry</button>
        </div>
      </section>
    );
  }

  const summary = analytics?.summary || {};
  const totalMembers = summary.totalMembers ?? 0;
  const totalNotes = summary.totalNotes ?? 0;
  const totalFiles = summary.totalFiles ?? 0;
  const totalContributions = summary.totalContributions ?? (totalNotes + totalFiles);
  const memberContributions = Array.isArray(analytics?.members?.contributions) ? analytics.members.contributions : [];
  const activityList = Array.isArray(analytics?.activity) ? analytics.activity : [];
  const recentActivity = Array.isArray(analytics?.recentActivity) ? analytics.recentActivity : [];

  const hasActivity = totalMembers > 0 || totalNotes > 0 || totalFiles > 0 || totalContributions > 0 || (summary.totalItems ?? 0) > 0 || recentActivity.length > 0;

  if (!hasActivity) {
    return (
      <section className="tab-analytics" aria-labelledby="analytics-heading">
        <div className="donation-tab-heading">
          <div><h2 id="analytics-heading">Drive analytics</h2><p>See how your community is responding to this drive.</p></div>
        </div>
        <div className="analytics-state analytics-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
          <h3>No contribution activity yet.</h3>
          <p>Real-time analytics, member activity, and contribution charts will appear here as your team adds notes, uploads files, and lists items.</p>
        </div>
      </section>
    );
  }

  // Calculate highest contribution count for proportional chart
  const maxMemberContributions = Math.max(1, ...memberContributions.map((m) => m.totalContributions || 0));

  return (
    <section className="tab-analytics" aria-labelledby="analytics-heading">
      <div className="donation-tab-heading">
        <div>
          <h2 id="analytics-heading">Drive analytics</h2>
          <p>Real-time contribution and engagement metrics from project records.</p>
        </div>
      </div>

      {/* Primary Summary Statistic Cards */}
      <div className="overview-stats analytics-stats">
        <div className="stat-card">
          <div className="stat-number">{totalMembers}</div>
          <div className="stat-label">👥 Total Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{totalNotes}</div>
          <div className="stat-label">📝 Notes Created</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{totalFiles}</div>
          <div className="stat-label">📁 Files Uploaded</div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-number">{totalContributions}</div>
          <div className="stat-label">🌟 Total Contributions</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{summary.totalItems ?? 0}</div>
          <div className="stat-label">🎁 Donation Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{summary.totalNGOInterests ?? 0}</div>
          <div className="stat-label">🤝 NGO Requests</div>
        </div>
      </div>

      <div className="analytics-grid">
        {/* Feature 5: Member Contribution Activity Chart */}
        <div className="analytics-panel analytics-members-chart">
          <div className="panel-header">
            <h3>📊 Contribution Activity by Member</h3>
            <span className="panel-sub">{memberContributions.length} {memberContributions.length === 1 ? 'contributor' : 'contributors'}</span>
          </div>
          {memberContributions.length === 0 ? (
            <p className="panel-empty">No member contributions recorded yet.</p>
          ) : (
            <div className="member-chart-list">
              {memberContributions.map((member) => {
                const notePct = member.totalContributions > 0 ? ((member.notes || 0) / member.totalContributions) * 100 : 0;
                const filePct = member.totalContributions > 0 ? ((member.files || 0) / member.totalContributions) * 100 : 0;
                const barWidth = Math.max(8, ((member.totalContributions || 0) / maxMemberContributions) * 100);

                return (
                  <div className="member-chart-item" key={member.memberId || member.memberName}>
                    <div className="member-chart-info">
                      <div className="member-avatar-mini">{(member.memberName || '?')[0].toUpperCase()}</div>
                      <span className="member-name">{member.memberName}</span>
                      <small className="member-breakdown">{member.notes || 0} notes · {member.files || 0} files</small>
                      <strong className="member-total">{member.totalContributions || 0}</strong>
                    </div>
                    <div className="member-chart-bar-wrap">
                      <div className="member-chart-bar" style={{ width: `${barWidth}%` }}>
                        <span className="bar-seg notes-seg" style={{ width: `${notePct}%` }} title={`${member.notes || 0} notes`} />
                        <span className="bar-seg files-seg" style={{ width: `${filePct}%` }} title={`${member.files || 0} files`} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="chart-legend">
                <span><i className="legend-dot notes-dot" /> Notes</span>
                <span><i className="legend-dot files-dot" /> Files</span>
              </div>
            </div>
          )}
        </div>

        {/* Feature 5: Member Contribution Detailed Table */}
        <div className="analytics-panel analytics-members-table">
          <div className="panel-header">
            <h3>👥 Member Contribution Breakdown</h3>
          </div>
          {memberContributions.length === 0 ? (
            <p className="panel-empty">No member contributions recorded yet.</p>
          ) : (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th style={{ textAlign: 'center' }}>Notes</th>
                    <th style={{ textAlign: 'center' }}>Files</th>
                    <th style={{ textAlign: 'right' }}>Total Contributions</th>
                  </tr>
                </thead>
                <tbody>
                  {memberContributions.map((member) => (
                    <tr key={member.memberId || member.memberName}>
                      <td>
                        <div className="table-member-cell">
                          <div className="member-avatar-mini">{(member.memberName || '?')[0].toUpperCase()}</div>
                          <span>{member.memberName}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{member.notes || 0}</td>
                      <td style={{ textAlign: 'center' }}>{member.files || 0}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong className="table-total-badge">{member.totalContributions || 0}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Timeline Activity Chart Over Time */}
        <div className="analytics-panel analytics-activity">
          <div className="panel-header">
            <h3>📅 Activity Over Time</h3>
            <span className="panel-sub">{activityList.length} active {activityList.length === 1 ? 'day' : 'days'}</span>
          </div>
          {activityList.length === 0 ? (
            <p className="panel-empty">No activity events recorded over time.</p>
          ) : (
            <div className="activity-timeline-chart">
              {activityList.map((day) => (
                <div className="activity-row" key={day.date}>
                  <span className="activity-date">{day.date}</span>
                  <div className="activity-bar">
                    <i style={{ width: `${Math.min(100, Math.max(12, day.total * 14))}%` }} />
                  </div>
                  <strong className="activity-count">{day.total} {day.total === 1 ? 'act' : 'acts'}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature 5: Recent Contribution Activity Timeline */}
        <div className="analytics-panel analytics-recent">
          <div className="panel-header">
            <h3>⏱️ Recent Contribution Activity</h3>
          </div>
          {recentActivity.length === 0 ? (
            <p className="panel-empty">No recent activity events.</p>
          ) : (
            <div className="recent-activity-list">
              {recentActivity.map((event, index) => {
                const icon = event.type === 'note' ? '📝' : event.type === 'file' ? '📁' : event.type === 'item' ? '🎁' : '🤝';
                return (
                  <div className="recent-activity-item" key={`${event.type}-${event.date}-${index}`}>
                    <span className="recent-icon">{icon}</span>
                    <div className="recent-copy">
                      <strong>{event.label}</strong>
                      <small>{event.type.toUpperCase()} · {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Additional Category & Status Breakdowns */}
        <AnalyticsList title="📦 Items by Category" rows={analytics?.items?.byCategory} suffix="quantity" />
        <AnalyticsList title="🤝 NGO Interest Status" rows={analytics?.interests?.byStatus} suffix="count" />
      </div>
    </section>
  );
};

const AnalyticsList = ({ title, rows = [], suffix }) => (
  <div className="analytics-panel">
    <h3>{title}</h3>
    {!rows || rows.length === 0 ? <p className="panel-empty">No data yet.</p> : rows.map((row) => (
      <div className="analytics-row" key={row._id || 'unknown'}>
        <span>{row._id || 'Unknown'}</span>
        <strong>{row[suffix] ?? row.count ?? 0}</strong>
      </div>
    ))}
  </div>
);

const AiTools = ({ tool, setTool, input, setInput, result, error, loading, onRun, onCopy, project, notes = [] }) => {
  const handleSelectTool = (selected) => {
    setTool(selected);
    if (selected === 'readme' && !input.trim() && project) {
      setInput(`Generate a comprehensive README for "${project.name}":\n${project.description || 'A community donation drive.'}`);
    }
  };

  const loadDriveSummary = () => {
    if (!project) return;
    setInput(`Donation Drive: ${project.name}\nDescription: ${project.description || 'No description'}\nCategory: ${project.category || 'General'}\nRegion: ${project.targetRegion || 'Local'}`);
  };

  const loadActiveNote = () => {
    if (notes.length > 0) {
      const firstNote = notes[0];
      setInput(`Title: ${firstNote.title}\n\nContent:\n${firstNote.content || ''}`);
    }
  };

  return (
    <section className="analytics-panel ai-tools-panel" aria-labelledby="ai-tools-heading">
      <div className="ai-tools-header">
        <div>
          <h3 id="ai-tools-heading">✨ Gemini AI Assistant</h3>
          <p>Use Gemini AI to explain content, produce technical docs, or generate a professional drive README.</p>
        </div>
      </div>

      <div className="ai-tools-actions">
        <button
          className={`btn-ai-tab ${tool === 'explain' ? 'active' : ''}`}
          onClick={() => handleSelectTool('explain')}
        >
          ✨ Explain Content
        </button>
        <button
          className={`btn-ai-tab ${tool === 'docs' ? 'active' : ''}`}
          onClick={() => handleSelectTool('docs')}
        >
          📄 Generate Docs
        </button>
        <button
          className={`btn-ai-tab ${tool === 'readme' ? 'active' : ''}`}
          onClick={() => handleSelectTool('readme')}
        >
          📝 Generate README
        </button>
      </div>

      {tool && (
        <div className="ai-tools-form">
          <div className="ai-tools-prefill-row">
            <span className="prefill-hint">Quick load context:</span>
            <button type="button" className="btn-prefill" onClick={loadDriveSummary}>📥 Drive Summary</button>
            {notes.length > 0 && <button type="button" className="btn-prefill" onClick={loadActiveNote}>📥 Latest Note</button>}
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              tool === 'explain'
                ? 'Paste text, note details, or guidelines to explain with Gemini...'
                : tool === 'docs'
                ? 'Paste project information, API details, or instructions to generate documentation...'
                : 'Provide context for your README (or leave blank to auto-generate from current drive records)...'
            }
            rows={5}
            className="ai-tools-textarea"
          />
          <div className="ai-tools-button-row">
            <button
              className="pd-primary-button btn-generate-ai"
              onClick={onRun}
              disabled={loading || (!input.trim() && tool !== 'readme')}
            >
              {loading ? '⏳ Processing with Gemini…' : `✨ Generate with Gemini`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="ai-tools-error" role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

      {result && (
        <div className="ai-tools-result">
          <div className="ai-result-header">
            <strong>✨ Gemini Generated Result</strong>
            <button className="btn-copy-result" onClick={onCopy}>📋 Copy Result</button>
          </div>
          <pre className="ai-result-content">{result}</pre>
        </div>
      )}
    </section>
  );
};

// =========================================
// OVERVIEW TAB
// =========================================
const OverviewTab = ({ project, members, notes, files }) => {
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="tab-overview">
      <div className="overview-stats">
        <div className="stat-card">
          <div className="stat-number">{members.length}</div>
          <div className="stat-label">Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{notes.length}</div>
          <div className="stat-label">Notes</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{files.length}</div>
          <div className="stat-label">Files</div>
        </div>
      </div>

      <div className="overview-info">
        <div className="info-row">
          <span className="info-label">Owner</span>
          <span className="info-value">{project?.owner?.name} ({project?.owner?.email})</span>
        </div>
        <div className="info-row">
          <span className="info-label">Created</span>
          <span className="info-value">{project?.createdAt ? formatDate(project.createdAt) : '—'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Last Updated</span>
          <span className="info-value">{project?.updatedAt ? formatDate(project.updatedAt) : '—'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Your Role</span>
          <span className="info-value" style={{ textTransform: 'capitalize' }}>{project?.userRole}</span>
        </div>
      </div>
    </div>
  );
};

// =========================================
// MEMBERS TAB
// =========================================
const MembersTab = ({ project, projectId, apiRoot, members, setMembers, isOwner }) => {
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addEmail.trim()) { setAddError('Email is required'); return; }
    try {
      setAdding(true);
      setAddError('');
      setAddSuccess('');
      const { data } = await api.post(`${apiRoot}/members`, { email: addEmail.trim() });
      setMembers((prev) => [...prev, data.member]);
      setAddEmail('');
      setAddSuccess(`${data.member.user?.name || addEmail} added successfully.`);
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from this project?`)) return;
    try {
      await api.delete(`${apiRoot}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m.user?.id !== userId && m.user?._id !== userId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  return (
    <div className="tab-members">
      {isOwner && (
        <div className="add-member-form">
          <h3>Add Member</h3>
          <form onSubmit={handleAddMember} className="add-member-row">
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Enter email address of registered user…"
              className="input-email"
              data-testid="add-member-input"
            />
            <button type="submit" className="btn-add-member" disabled={adding}>
              {adding ? 'Adding…' : '+ Add'}
            </button>
          </form>
          {addError && <p className="field-error">{addError}</p>}
          {addSuccess && <p className="field-success">{addSuccess}</p>}
        </div>
      )}

      <div className="members-list">
        <h3>Team Members ({members.length})</h3>
        {members.length === 0 ? (
          <p className="empty-hint">No members found.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="member-row">
              <div className="member-avatar">{(m.user?.name || '?')[0].toUpperCase()}</div>
              <div className="member-info">
                <span className="member-name">{m.user?.name}</span>
                <span className="member-email">{m.user?.email}</span>
              </div>
              <span className={`member-role-badge ${m.role}`}>{m.role}</span>
              {isOwner && m.role !== 'owner' && (
                <button
                  className="btn-remove-member"
                  onClick={() => handleRemoveMember(m.user?.id || m.user?._id, m.user?.name)}
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// =========================================
// NOTES TAB
// =========================================
const NotesTab = ({ projectId, apiRoot, notes, setNotes, user, isOwner }) => {
  const [selectedNote, setSelectedNote] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [noteError, setNoteError] = useState('');
  const [geminiLoading, setGeminiLoading] = useState('');
  const [geminiResult, setGeminiResult] = useState('');
  const [geminiResultType, setGeminiResultType] = useState('');
  const [showImproveApply, setShowImproveApply] = useState(false);
  const [improvedContent, setImprovedContent] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);

  const openNote = (note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setSaveMsg('');
    setGeminiResult('');
    setGeminiResultType('');
    setShowImproveApply(false);
    setImprovedContent('');
  };

  const openNew = () => {
    setSelectedNote({ _new: true });
    setEditTitle('');
    setEditContent('');
    setSaveMsg('');
    setGeminiResult('');
    setGeminiResultType('');
    setShowImproveApply(false);
    setImprovedContent('');
    setCreatingNew(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) { setNoteError('Title is required'); return; }
    try {
      setSaving(true);
      setNoteError('');
      if (selectedNote?._new) {
        const { data } = await api.post(`${apiRoot}/notes`, { title: editTitle.trim(), content: editContent });
        setNotes((prev) => [data.note, ...prev]);
        setSelectedNote(data.note);
        setCreatingNew(false);
      } else {
        const { data } = await api.put(`${apiRoot}/notes/${selectedNote.id || selectedNote._id}`, { title: editTitle.trim(), content: editContent });
        setNotes((prev) => prev.map((n) => (n.id === selectedNote.id || n._id === selectedNote._id) ? { ...n, ...data.note } : n));
        setSelectedNote((prev) => ({ ...prev, ...data.note }));
      }
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      setNoteError(err.response?.data?.error || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote || selectedNote._new) return;
    if (!window.confirm('Delete this note permanently?')) return;
    try {
      await api.delete(`${apiRoot}/notes/${selectedNote.id || selectedNote._id}`);
      setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id && n._id !== selectedNote._id));
      setSelectedNote(null);
    } catch (err) {
      setNoteError(err.response?.data?.error || 'Failed to delete note');
    }
  };

  const handleGeminiExplain = async () => {
    if (!editContent.trim() && !editTitle.trim()) {
      setNoteError('Write some content first to explain');
      return;
    }
    try {
      setGeminiLoading('explain');
      setNoteError('');
      setGeminiResult('');
      setGeminiResultType('');
      const { data } = await api.post('/gemini/explain', { content: editContent || editTitle });
      setGeminiResult(data.explanation);
      setGeminiResultType('explain');
    } catch (err) {
      setGeminiResult(err.response?.data?.error || 'AI service is temporarily unavailable. Please try again.');
      setGeminiResultType('error');
    } finally {
      setGeminiLoading('');
    }
  };

  const handleGeminiImprove = async () => {
    if (!editContent.trim()) {
      setNoteError('Write some content first to improve');
      return;
    }
    try {
      setGeminiLoading('improve');
      setNoteError('');
      setGeminiResult('');
      setGeminiResultType('');
      setShowImproveApply(false);
      const { data } = await api.post('/gemini/docs', { content: editContent });
      setImprovedContent(data.improved);
      setGeminiResult(data.improved);
      setGeminiResultType('improve');
      setShowImproveApply(true);
    } catch (err) {
      setGeminiResult(err.response?.data?.error || 'AI service is temporarily unavailable. Please try again.');
      setGeminiResultType('error');
    } finally {
      setGeminiLoading('');
    }
  };

  const applyImprovement = () => {
    setEditContent(improvedContent);
    setShowImproveApply(false);
    setGeminiResult('');
    setGeminiResultType('');
    setSaveMsg('Improvement applied — remember to Save!');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const cancelEditing = () => {
    if (selectedNote?._new) {
      setSelectedNote(null);
      setCreatingNew(false);
      return;
    }
    if (selectedNote) openNote(selectedNote);
  };

  const canDelete = selectedNote && !selectedNote._new && (
    isOwner || (selectedNote.createdBy?.id === user?._id || selectedNote.createdBy?._id === user?._id)
  );

  return (
    <div className="tab-notes">
      {/* Note List Sidebar */}
      <div className="notes-sidebar">
        <button className="btn-new-note" onClick={openNew} data-testid="new-note-btn">
          + New Note
        </button>
        {notes.length === 0 && !creatingNew ? (
          <p className="empty-hint">No notes yet. Create the first one!</p>
        ) : (
          <div className="notes-list">
            {creatingNew && selectedNote?._new && (
              <div className="note-item active">
                <span className="note-item-title">Untitled Note</span>
                <span className="note-item-date">New</span>
              </div>
            )}
            {notes.map((note) => (
              <div
                key={note.id || note._id}
                className={`note-item ${(selectedNote?.id === note.id || selectedNote?._id === note._id) ? 'active' : ''}`}
                onClick={() => openNote(note)}
              >
                <span className="note-item-title">{note.title}</span>
                <span className="note-item-preview">{(note.content || 'No content yet').replace(/\s+/g, ' ').slice(0, 72)}</span>
                <span className="note-item-date">
                  {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note Editor */}
      <div className="notes-editor">
        {!selectedNote ? (
          <div className="notes-empty-state">
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📝</div>
            <h3>Select or create a note</h3>
            <p>Your Markdown notes live here. Click a note on the left or create a new one.</p>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📝🎁</div>
            <h3>Select or create a donation note</h3>
            <p>Record donation items, quantity, condition, pickup/drop-off instructions, or drive updates. Use Gemini AI to explain or improve your note.</p>
          </div>
        ) : (
          <>
            <div className="editor-toolbar">
              <div>
                <span className="editor-heading">Markdown note editor</span>
                <span className="editor-subheading">Write on the left, preview on the right</span>
              </div>
              <div className="editor-actions">
                <button
                  className="btn-gemini"
                  onClick={handleGeminiExplain}
                  disabled={!!geminiLoading}
                  title="Explain this donation note with Gemini AI"
                >
                  {geminiLoading === 'explain' ? 'Gemini is analyzing the note…' : '✨ Explain with Gemini'}
                </button>
                <button
                  className="btn-gemini"
                  onClick={handleGeminiImprove}
                  disabled={!!geminiLoading}
                  title="Get an AI-improved formatted version of this note"
                >
                  {geminiLoading === 'improve' ? 'Gemini is improving the note…' : '✨ Improve with Gemini'}
                </button>
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Note'}
                </button>
                <button className="btn-cancel-note" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </button>
                {canDelete && (
                  <button className="btn-delete-note" onClick={handleDelete}>
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>

            {noteError && <div className="note-error">{noteError}</div>}
            {saveMsg && <div className="note-success">{saveMsg}</div>}

            <div className="markdown-editor-grid">
              <div className="markdown-editor-pane">
                <label htmlFor="note-title-input">Title</label>
                <input
                  id="note-title-input"
                  className="note-title-input"
                  type="text"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    setNoteError('');
                  }}
                  placeholder="Winter Relief Drive"
                  maxLength={200}
                  data-testid="note-title-input"
                />
                <label htmlFor="note-content-input">Markdown content</label>
                <textarea
                  id="note-content-input"
                  className="note-textarea"
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setNoteError('');
                  }}
                  placeholder={'# Winter Relief Drive\n\nWe are collecting **winter clothes and blankets**.\n\n## Items\n\n- Winter clothes\n- Blankets\n- Warm jackets'}
                  data-testid="note-content-input"
                />
              </div>
              <div className="markdown-preview-pane">
                <div className="preview-label">Live Markdown Preview</div>
                <div className="note-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(editContent) || '<p class="preview-empty">Your formatted note will appear here.</p>' }} />
              </div>
            </div>

            {/* Gemini Result Panel */}
            {geminiResult && (
              <div className={`gemini-result-panel ${geminiResultType}`}>
                <div className="gemini-result-header">
                  {geminiResultType === 'explain' && '✨ Gemini Explanation'}
                  {geminiResultType === 'improve' && '✨ AI Improved Content (not applied yet)'}
                  {geminiResultType === 'error' && '⚠️ AI Error'}
                  <button className="btn-close-gemini" onClick={() => { setGeminiResult(''); setShowImproveApply(false); }}>✕</button>
                </div>
                <div className="gemini-result-body">
                  {geminiResultType === 'improve' && (
                    <>
                      <strong className="ai-content-label">Original Content</strong>
                      <pre className="gemini-original-text">{editContent}</pre>
                      <strong className="ai-content-label">AI Improved Content</strong>
                      <pre className="gemini-improved-text">{geminiResult}</pre>
                    </>
                  )}
                  {geminiResultType !== 'improve' && <p>{geminiResult}</p>}
                </div>
                {showImproveApply && (
                  <div className="gemini-apply-bar">
                    <span className="gemini-apply-hint">Review the suggestion above before applying.</span>
                    <button className="btn-apply-improvement" onClick={applyImprovement}>
                      ✓ Apply Improvement
                    </button>
                    <button className="btn-dismiss-improvement" onClick={() => { setShowImproveApply(false); setGeminiResult(''); }}>
                      ✕ Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// =========================================
// FILES TAB
// =========================================
const FilesTab = ({ projectId, apiRoot, files, setFiles, user, isOwner }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiExplanation, setGeminiExplanation] = useState('');
  const [geminiError, setGeminiError] = useState('');
  const fileInputRef = useRef(null);

  const loadFileDetails = async (file) => {
    setSelectedFile(file);
    setFileDetails(null);
    setGeminiExplanation('');
    setGeminiError('');
    try {
      setLoadingDetails(true);
      const { data } = await api.get(`${apiRoot}/files/${file.id || file._id}`);
      setFileDetails(data.file);
    } catch (err) {
      setFileDetails({ ...file, loadError: err.response?.data?.error || 'Failed to load file details' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setUploadError('');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('note', uploadNote.trim());
      const { data } = await api.post(`${apiRoot}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFiles((prev) => [data.file, ...prev]);
      setUploadNote('');
      setUploadPreview('');
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId, fileName) => {
    if (!window.confirm(`Delete "${fileName}" permanently?`)) return;
    try {
      await api.delete(`${apiRoot}/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => (f.id || f._id) !== fileId));
      if ((selectedFile?.id || selectedFile?._id) === fileId) {
        setSelectedFile(null);
        setFileDetails(null);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete file');
    }
  };

  const handleGeminiExplain = async (fileId) => {
    try {
      setGeminiLoading(true);
      setGeminiExplanation('');
      setGeminiError('');
      const { data } = await api.post('/gemini/explain', { content: fileDetails?.content || '' });
      setGeminiExplanation(data.explanation);
    } catch (err) {
      setGeminiError(err.response?.data?.error || 'AI explanation failed');
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleDownload = (fileId, originalName) => {
    const file = files.find((entry) => (entry.id || entry._id) === fileId);
    const url = file?.secureUrl || file?.url
      || `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}${apiRoot}/files/${fileId}/download`;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = originalName;
    a.click();
  };

  const canDeleteFile = (file) =>
    isOwner || (file.uploadedBy?.id === user?._id || file.uploadedBy?._id === user?._id);

  const toggleFilePublic = async (event, file) => {
    event.stopPropagation();
    try {
      const { data } = await api.patch(`${apiRoot}/files/${file.id || file._id}/public`, { isPublic: !file.isPublic });
      setFiles((current) => current.map((entry) => (entry.id || entry._id) === (file.id || file._id) ? data.file : entry));
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Unable to update file visibility');
    }
  };

  return (
    <div className="tab-files">
      {/* Upload Bar */}
      <div className="files-upload-bar">
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && isImageFile(file.name)) setUploadPreview(URL.createObjectURL(file));
            handleUpload(e);
          }}
          data-testid="file-upload-input"
          accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.md,.txt,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.h,.hpp,.json,.css,.html,.xml"
        />
        <label htmlFor="file-upload" className={`btn-upload ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Uploading…' : '+ Upload File'}
        </label>
        <span className="upload-hint">Images, documents and code files · max 10 MB</span>
        <textarea
          className="upload-note"
          value={uploadNote}
          onChange={(e) => setUploadNote(e.target.value)}
          placeholder="Add a note about this file (optional)…"
          maxLength={2000}
          rows={2}
        />
        {uploadPreview && <img className="upload-preview" src={uploadPreview} alt="Selected file preview" />}
        {uploadError && <span className="upload-error">{uploadError}</span>}
      </div>

      <div className="files-layout">
        {/* File List */}
        <div className="files-list-panel">
          {files.length === 0 ? (
            <div className="files-empty">
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📁</div>
              <p>No files uploaded yet.</p>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🖼️📦</div>
              <p>No item photos or files uploaded yet. Click Upload above to add photos of items to donate!</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id || file._id}
                className={`file-row ${(selectedFile?.id || selectedFile?._id) === (file.id || file._id) ? 'active' : ''}`}
                onClick={() => loadFileDetails(file)}
              >
                <span className="file-icon">{getFileIcon(file.mimeType, file.originalName)}</span>
                <div className="file-info">
                  <span className="file-name">{file.originalName}</span>
                  <span className="file-meta">{formatBytes(file.size)} · {file.uploadedBy?.name || 'Unknown'}</span>
                  {file.note && <span className="file-note">{file.note}</span>}
                </div>
                {isOwner && <button className="file-public-toggle" onClick={(event) => toggleFilePublic(event, file)}>{file.isPublic ? 'Public' : 'Private'}</button>}
                {canDeleteFile(file) && (
                  <button
                    className="btn-delete-file"
                    onClick={(e) => { e.stopPropagation(); handleDelete(file.id || file._id, file.originalName); }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* File Preview Panel */}
        <div className="file-preview-panel">
          {!selectedFile ? (
            <div className="preview-empty">
              <span style={{ fontSize: '2.5rem' }}>📄</span>
              <p>Select a file to preview</p>
            </div>
          ) : loadingDetails ? (
            <div className="preview-loading"><div className="pd-spinner" /><p>Loading preview…</p></div>
          ) : fileDetails ? (
            <>
              <div className="preview-header">
                <span className="preview-icon">{getFileIcon(fileDetails.mimeType, fileDetails.originalName)}</span>
                <div className="preview-title-group">
                  <h3 className="preview-filename">{fileDetails.originalName}</h3>
                  <span className="preview-meta">{formatBytes(fileDetails.size)} · {fileDetails.mimeType}</span>
                </div>
                <div className="preview-actions">
                  <button className="btn-download" onClick={() => handleDownload(fileDetails.id || fileDetails._id, fileDetails.originalName)}>
                    ⬇️ Download
                  </button>
                  {fileDetails.isTextCode && (
                    <button
                      className="btn-gemini-file"
                      onClick={() => handleGeminiExplain(fileDetails.id || fileDetails._id)}
                      disabled={geminiLoading}
                    >
                      {geminiLoading ? '⏳ Explaining…' : '✨ Explain with Gemini'}
                    </button>
                  )}
                </div>
              </div>

              {/* File Content Preview */}
              <div className="preview-content">
                {fileDetails.loadError ? (
                  <p className="preview-error">{fileDetails.loadError}</p>
                ) : isImageFile(fileDetails.originalName) ? (
                  <div className="preview-image-container">
                    <img
                      src={fileDetails.secureUrl || fileDetails.url}
                      alt={fileDetails.originalName}
                      className="preview-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ) : isPdfFile(fileDetails.originalName) ? (
                  <div className="preview-pdf">
                    <span style={{ fontSize: '3rem' }}>📕</span>
                    <p>Open the PDF preview in a new tab.</p>
                    <a className="btn-download" href={fileDetails.secureUrl || fileDetails.url} target="_blank" rel="noopener noreferrer">
                      ⬇️ Open PDF
                    </a>
                  </div>
                ) : fileDetails.isTextCode && fileDetails.content ? (
                  <pre className="preview-code">{fileDetails.content}</pre>
                ) : fileDetails.isTextCode ? (
                  <p className="preview-hint">File content not available — download to view.</p>
                ) : (
                  <div className="preview-unsupported">
                    <span style={{ fontSize: '2rem' }}>📄</span>
                    <p>Preview not available for this file type.</p>
                    <button className="btn-download" onClick={() => handleDownload(fileDetails.id || fileDetails._id, fileDetails.originalName)}>
                      ⬇️ Download
                    </button>
                  </div>
                )}
              </div>

              {/* Gemini Explanation */}
              {geminiExplanation && (
                <div className="gemini-file-result">
                  <div className="gemini-result-header">
                    ✨ Gemini Explanation
                    <button className="btn-close-gemini" onClick={() => setGeminiExplanation('')}>✕</button>
                  </div>
                  <div className="gemini-result-body">{geminiExplanation}</div>
                </div>
              )}
              {geminiError && (
                <div className="gemini-file-result error">
                  <p>⚠️ {geminiError}</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
