import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './ProjectsPage.css';

const ProjectsPage = ({ variant = 'projects' }) => {
  const isDonationDrive = variant === 'donation-drives';
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', category: '', targetRegion: '', goal: '', coverImage: '', isPublic: false });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const { data } = await api.get(isDonationDrive ? '/donation-drives' : '/projects');
      setProjects(isDonationDrive ? (data.drives || []) : (data.projects || []));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [isDonationDrive]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Project name is required');
      return;
    }
    try {
      setCreating(true);
      setCreateError('');
      const { data } = await api.post(isDonationDrive ? '/donation-drives' : '/projects', {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        ...(isDonationDrive ? {
          category: createForm.category.trim(),
          targetRegion: createForm.targetRegion.trim(),
          goal: createForm.goal === '' ? undefined : Number(createForm.goal),
          coverImage: createForm.coverImage.trim(),
          isPublic: createForm.isPublic
        } : {})
      });
      const created = isDonationDrive ? data.drive : data.project;
      setProjects((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', category: '', targetRegion: '', goal: '', coverImage: '', isPublic: false });
      navigate(`/${isDonationDrive ? 'donation-drives' : 'projects'}/${created.id || created._id}`);
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const getRoleColor = (role) => {
    return role === 'owner' ? '#0d9488' : '#059669';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="projects-page">
      <div className="projects-hero">
        <div className="projects-hero-content">
          <div className="projects-eyebrow"><span>01</span> COMMUNITY WORKSPACE</div>
          <h1 className="projects-title">{isDonationDrive ? 'Donation Drives' : 'Project Hub'}</h1>
          <p className="projects-subtitle">
            {isDonationDrive
              ? 'Coordinate giving campaigns with your team, keep every resource together, and turn generosity into measurable impact.'
              : 'Create, collaborate, and make an impact through HeartMap initiatives and donation drives.'}
          </p>
          <button
            className="btn-create-project"
            onClick={() => setShowCreateModal(true)}
            data-testid="create-project-btn"
          >
            <span>+</span> New {isDonationDrive ? 'Donation Drive' : 'Project'}
          </button>
        </div>
      </div>

      <div className="projects-container">
        {isLoading ? (
          <div className="projects-loading">
            <div className="loading-spinner" />
            <p>Loading projects…</p>
          </div>
        ) : error ? (
          <div className="projects-error">
            <span>⚠️</span> {error}
            <button onClick={loadProjects} className="btn-retry">Retry</button>
          </div>
        ) : projects.length === 0 ? (
          <div className="projects-empty">
            <div className="empty-icon">📁</div>
            <h3>No {isDonationDrive ? 'donation drives' : 'projects'} yet</h3>
            <p>Create your first {isDonationDrive ? 'drive' : 'project'} to start collaborating with your team.</p>
            <button className="btn-create-project" onClick={() => setShowCreateModal(true)} data-testid="create-project-btn">
              <span>+</span> Create {isDonationDrive ? 'Donation Drive' : 'Project'}
            </button>
          </div>
        ) : (
          <>
            <div className="projects-header-row">
              <h2 className="projects-count">{projects.length} {isDonationDrive ? 'Donation Drive' : 'Project'}{projects.length !== 1 ? 's' : ''}</h2>
            </div>
            <div className="projects-grid" data-testid="projects-grid">
              {projects.map((project) => (
                <div key={project.id} className="project-card" data-testid="project-card">
                  {isDonationDrive && project.coverImage && <img className="drive-card-cover" src={project.coverImage} alt="" />}
                  <div className="project-card-header">
                    <div className="project-card-icon">♥</div>
                    <span
                      className="project-role-badge"
                      style={{ backgroundColor: getRoleColor(project.userRole) }}
                    >
                      {project.userRole === 'owner' ? (
                        <>My project · <span>owner</span></>
                      ) : 'Shared with me'}
                    </span>
                  </div>
                  <h3 className="project-name">{project.name}</h3>
                  {isDonationDrive && (project.category || project.targetRegion) && (
                    <div className="drive-card-tags">
                      {project.category && <span>{project.category}</span>}
                      {project.targetRegion && <span>📍 {project.targetRegion}</span>}
                    </div>
                  )}
                  {isDonationDrive && project.goal > 0 && <div className="drive-card-goal">Goal: ₹{Number(project.goal).toLocaleString('en-IN')}</div>}
                  {project.description && (
                    <p className="project-description">{project.description}</p>
                  )}
                  <div className="project-meta">
                    <div className="project-meta-item">
                      <span className="meta-label">Organizer</span>
                      <span className="meta-value">{project.owner?.name || 'Unknown'}</span>
                    </div>
                    <div className="project-meta-item">
                      <span className="meta-label">Team members</span>
                      <span className="meta-value">{project.memberCount}</span>
                    </div>
                    <div className="project-meta-item">
                      <span className="meta-label">Created</span>
                      <span className="meta-value">{formatDate(project.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    className="btn-open-project"
                    onClick={() => navigate(`/${isDonationDrive ? 'donation-drives' : 'projects'}/${project.id}`)}
                  >
                    Open {isDonationDrive ? 'Donation Drive' : 'Project'} →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal-box" data-testid="create-project-modal">
            <div className="modal-header">
              <h2>Create New {isDonationDrive ? 'Donation Drive' : 'Project'}</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateProject} className="create-project-form">
              {createError && <div className="form-error">{createError}</div>}
              <div className="form-group">
                <label htmlFor="project-name">Project Name *</label>
                <input
                  id="project-name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={isDonationDrive ? 'e.g. Winter essentials drive' : 'e.g. HeartMap Phase 8'}
                  maxLength={120}
                  required
                  data-testid="project-name-input"
                />
              </div>
              {isDonationDrive && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="project-category">Donation category</label>
                      <input id="project-category" value={createForm.category} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Winter essentials" maxLength={80} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="project-region">Target location</label>
                      <input id="project-region" value={createForm.targetRegion} onChange={(e) => setCreateForm((f) => ({ ...f, targetRegion: e.target.value }))} placeholder="e.g. Delhi NCR" maxLength={160} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="project-goal">Fundraising goal (₹)</label>
                      <input id="project-goal" type="number" min="0" value={createForm.goal} onChange={(e) => setCreateForm((f) => ({ ...f, goal: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="project-cover">Cover image URL</label>
                      <input id="project-cover" type="url" value={createForm.coverImage} onChange={(e) => setCreateForm((f) => ({ ...f, coverImage: e.target.value }))} placeholder="https://…" />
                    </div>
                  </div>
                  <label className="public-drive-toggle">
                    <input type="checkbox" checked={createForm.isPublic} onChange={(e) => setCreateForm((f) => ({ ...f, isPublic: e.target.checked }))} />
                    Make this Donation Drive publicly shareable
                  </label>
                </>
              )}
              <div className="form-group">
                <label htmlFor="project-desc">Description</label>
                <textarea
                  id="project-desc"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional project description…"
                  maxLength={2000}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={creating}>
                  {creating ? `Creating… Create ${isDonationDrive ? 'Drive' : 'Project'}` : `Create ${isDonationDrive ? 'Donation Drive' : 'Project'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
