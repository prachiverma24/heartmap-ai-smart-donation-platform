import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import './PublicDonationDrivePage.css';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType, originalName) => {
  if (!mimeType && !originalName) return '📄';
  const ext = (originalName || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📕';
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp'].includes(ext)) return '💻';
  if (['md', 'txt'].includes(ext)) return '📝';
  return '📁';
};

const copyToClipboard = async (text) => {
  if (!text) return false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback
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
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
};

const PublicDonationDrivePage = () => {
  const { driveId } = useParams();
  const [drive, setDrive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setIsPrivate(false);

    api.get(`/public/donation-drives/${driveId}`)
      .then(({ data }) => {
        if (active) setDrive(data.drive);
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.data?.isPrivate || err.response?.status === 403) {
          setIsPrivate(true);
        } else if (err.response?.status === 404) {
          if (err.response?.data?.isPrivate) {
            setIsPrivate(true);
          } else {
            setError('Donation Drive not found');
          }
        } else {
          setError(err.response?.data?.error || 'Unable to load this Donation Drive.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [driveId]);

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <main className="public-drive-page">
        <div className="public-drive-state">
          <div className="pd-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading Donation Drive...</p>
        </div>
      </main>
    );
  }

  if (isPrivate) {
    return (
      <main className="public-drive-page">
        <div className="public-drive-state public-drive-private-card" role="alert">
          <div className="private-icon">🔒</div>
          <h2>Project is currently private</h2>
          <p>
            The organizer has disabled public sharing for this donation drive.
            If you are a team member, please log in to access the collaboration workspace.
          </p>
          <div className="public-drive-actions">
            <Link to="/login" className="btn-public-primary">Log In</Link>
            <Link to="/" className="btn-public-secondary">Return Home</Link>
          </div>
        </div>
      </main>
    );
  }

  if (error || !drive) {
    return (
      <main className="public-drive-page">
        <div className="public-drive-state public-drive-error" role="alert">
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <h2>Donation Drive Not Found</h2>
          <p>{error || 'This donation drive does not exist or may have been removed.'}</p>
          <div className="public-drive-actions" style={{ marginTop: 16 }}>
            <Link to="/" className="btn-public-secondary">Return Home</Link>
          </div>
        </div>
      </main>
    );
  }

  const items = Array.isArray(drive.items) ? drive.items : [];
  const files = Array.isArray(drive.files) ? drive.files : [];
  const summary = drive.contributionSummary || {};

  return (
    <main className="public-drive-page">
      {/* Hero / Header */}
      <header className="public-drive-hero">
        <div className="public-drive-brand-row">
          <span className="public-drive-brand">🧡 HeartMap</span>
          <div className="public-drive-header-badges">
            <span className="public-badge-pill">🌐 Public View (Read-Only)</span>
            <button className="btn-copy-share" onClick={handleCopyLink}>
              {copied ? '✓ Link Copied!' : '🔗 Copy Share Link'}
            </button>
          </div>
        </div>

        {drive.coverImage && (
          <img src={drive.coverImage} alt={drive.name} className="public-drive-cover" />
        )}

        <div className="public-drive-hero-copy">
          <span className="public-drive-eyebrow">HeartMap Community Donation Drive</span>
          <h1>{drive.name}</h1>
          {drive.description && <p className="public-drive-desc">{drive.description}</p>}

          <div className="public-drive-meta">
            {drive.creator && (
              <span className="public-meta-tag creator">👤 Organizer: <strong>{drive.creator}</strong></span>
            )}
            {drive.category && (
              <span className="public-meta-tag">🏷️ Category: <strong>{drive.category}</strong></span>
            )}
            {drive.targetRegion && (
              <span className="public-meta-tag">📍 Region: <strong>{drive.targetRegion}</strong></span>
            )}
            {drive.status && (
              <span className={`public-meta-tag status-${drive.status}`}>Status: <strong>{drive.status}</strong></span>
            )}
            {drive.goal !== undefined && drive.goal !== null && drive.goal > 0 && (
              <span className="public-meta-tag goal">🎯 Goal: <strong>{drive.goal} items</strong></span>
            )}
          </div>

          {/* Quick Summary Cards */}
          <div className="public-summary-row">
            <div className="public-stat-box">
              <span className="stat-value">{summary.memberCount ?? 1}</span>
              <span className="stat-label">👥 Team Members</span>
            </div>
            <div className="public-stat-box">
              <span className="stat-value">{summary.itemCount ?? items.length}</span>
              <span className="stat-label">🎁 Donation Items</span>
            </div>
            <div className="public-stat-box">
              <span className="stat-value">{summary.fileCount ?? files.length}</span>
              <span className="stat-label">📁 Public Resources</span>
            </div>
          </div>
        </div>
      </header>

      {/* Donation Items Section */}
      <section className="public-drive-content" aria-labelledby="public-items-heading">
        <div className="section-header">
          <h2 id="public-items-heading">Donation Items Needed</h2>
          <span className="section-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
        </div>

        {items.length === 0 ? (
          <p className="public-drive-empty">No donation items listed for this drive yet.</p>
        ) : (
          <div className="public-drive-items">
            {items.map((item) => (
              <article className="public-drive-item" key={item._id || item.id}>
                {item.image && (
                  <img
                    src={item.image.startsWith('http') ? item.image : `${api.defaults.baseURL}/uploads/public/${item.image}`}
                    alt={item.title}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="public-item-body">
                  <span className="public-drive-item-category">{item.category}</span>
                  <h3>{item.title}</h3>
                  {item.description && <p>{item.description}</p>}
                  <div className="public-item-footer">
                    <strong>Quantity: {item.quantity}</strong>
                    <span className="item-condition-badge">Condition: {item.condition}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Public Files Section */}
      {files.length > 0 && (
        <section className="public-drive-content" aria-labelledby="public-files-heading">
          <div className="section-header">
            <h2 id="public-files-heading">Public Files & Resources</h2>
            <span className="section-count">{files.length} {files.length === 1 ? 'resource' : 'resources'}</span>
          </div>
          <div className="public-files-grid">
            {files.map((file) => (
              <div className="public-file-card" key={file._id || file.id}>
                <span className="file-icon">{getFileIcon(file.mimeType, file.originalName)}</span>
                <div className="public-file-info">
                  <h4>{file.originalName}</h4>
                  <span className="file-size">{formatBytes(file.size)}</span>
                  {file.note && <p className="file-note">{file.note}</p>}
                </div>
                {(file.secureUrl || file.url) && (
                  <a
                    href={file.secureUrl || file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-view-file"
                  >
                    View / Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Public Footer Notice */}
      <footer className="public-drive-footer">
        <p>
          🧡 This is an official public donation drive powered by <strong>HeartMap</strong>.
          Interested in organizing your own community drive? <Link to="/register">Join HeartMap</Link>.
        </p>
      </footer>
    </main>
  );
};

export default PublicDonationDrivePage;
