import React, { useEffect, useState } from 'react';
import api from '../api';
import './TrustAdminPage.css';

const TrustAdminPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try { const [verification, reportResponse] = await Promise.all([api.get('/admin/verification-requests?status=pending'), api.get('/reports')]); setProfiles(verification.data.profiles || []); setReports(reportResponse.data.reports || []); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Unable to load trust reviews.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const reviewNgo = async (id, verificationStatus) => { const reviewNotes = window.prompt('Review notes (optional):') || ''; try { await api.patch(`/admin/ngos/${id}/verification`, { verificationStatus, reviewNotes, isPublished: verificationStatus === 'verified' }); setMessage(`NGO marked ${verificationStatus}.`); await load(); } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to update verification.'); } };
  const reviewReport = async (id, status) => { const adminNotes = window.prompt('Admin notes (optional):') || ''; try { await api.patch(`/reports/${id}`, { status, adminNotes }); setMessage('Report updated.'); await load(); } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to update report.'); } };

  if (loading) return <main className="trust-admin"><div className="trust-state">Loading reviews...</div></main>;
  return <main className="trust-admin"><header><p className="eyebrow">ADMIN TRUST REVIEW</p><h1>Verification and reports</h1><p>Review submitted information and evidence. A verified status means the submitted information was reviewed by an administrator; it is not a guarantee that an organization is completely genuine.</p></header>{message && <div className="trust-success">{message}</div>}{error && <div className="trust-error" role="alert">{error}</div>}<section className="trust-section"><h2>Pending NGO verification</h2>{profiles.length === 0 ? <div className="trust-state">No pending verification requests.</div> : <div className="trust-grid">{profiles.map((profile) => <article className="trust-card" key={profile._id}><span className="trust-status">{profile.verificationStatus}</span><h3>{profile.name || profile.organizationName}</h3><p>{profile.description || 'No description submitted.'}</p><p>{profile.registrationInformation || 'No registration information submitted.'}</p><button type="button" onClick={() => setSelected(profile)}>Open details</button><div className="trust-actions"><button type="button" onClick={() => reviewNgo(profile._id, 'verified')}>Approve</button><button type="button" onClick={() => reviewNgo(profile._id, 'rejected')}>Reject</button><button type="button" onClick={() => reviewNgo(profile._id, 'flagged')}>Flag</button></div></article>)}</div>}</section><section className="trust-section"><h2>Reports</h2>{reports.length === 0 ? <div className="trust-state">No reports submitted.</div> : <div className="trust-grid">{reports.map((report) => <article className="trust-card" key={report._id}><span className="trust-status">{report.status}</span><h3>{report.reason}</h3><p>Target: {report.targetType} / {report.targetId}</p><p>{report.details || 'No additional details.'}</p><div className="trust-actions"><button type="button" onClick={() => reviewReport(report._id, 'reviewed')}>Mark reviewed</button><button type="button" onClick={() => reviewReport(report._id, 'dismissed')}>Dismiss</button><button type="button" onClick={() => reviewReport(report._id, 'actioned')}>Actioned</button></div></article>)}</div>}</section>{selected && <div className="trust-modal" role="dialog"><div><button type="button" className="modal-close" onClick={() => setSelected(null)}>Close</button><h2>{selected.name || selected.organizationName}</h2><p>{selected.address}, {selected.city}, {selected.state}</p><p>Contact: {selected.email || selected.phone || 'Not supplied'}</p><p>Website: {selected.website || 'Not supplied'}</p><p>Registration: {selected.registrationInformation || 'Not supplied'}</p><p>Verification information: {selected.verificationInformation || 'Not supplied'}</p><h3>Submitted evidence</h3>{selected.documents?.length ? <ul>{selected.documents.map((document) => <li key={document.url}><a href={document.url} target="_blank" rel="noreferrer">{document.originalName || document.kind}</a></li>)}</ul> : <p>No documents submitted.</p>}{selected.images?.length ? <div className="evidence-images">{selected.images.map((image) => <img key={image} src={image} alt="NGO activity" />)}</div> : <p>No activity photographs submitted.</p>}</div></div>}</main>;
};

export default TrustAdminPage;
