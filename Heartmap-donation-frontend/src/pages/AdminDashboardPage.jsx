import React, { useEffect, useState } from 'react';
import api from '../api';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
  const [data, setData] = useState({ analytics: null, users: [], ngos: [], listings: [], requests: [], reports: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [analytics, users, ngos, listings, requests, reports] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/users'),
        api.get('/admin/ngos'),
        api.get('/admin/donations'),
        api.get('/admin/help-requests'),
        api.get('/reports')
      ]);
      setData({
        analytics: analytics.data.analytics,
        users: users.data.users || [],
        ngos: ngos.data.profiles || [],
        listings: listings.data.listings || [],
        requests: requests.data.requests || [],
        reports: reports.data.reports || []
      });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load the admin dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (path, body, success) => {
    setError('');
    try {
      await api.patch(path, body);
      setMessage(success);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to update this record.');
    }
  };

  const remove = async (path, success) => {
    setError('');
    try {
      await api.delete(path);
      setMessage(success);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to remove this record.');
    }
  };

  if (isLoading)
    return (
      <main className="admin-dashboard">
        <div className="admin-state">Loading live dashboard data...</div>
      </main>
    );

  if (!data.analytics)
    return (
      <main className="admin-dashboard">
        <div className="admin-error">{error || 'Dashboard data is unavailable.'}</div>
      </main>
    );

  const { analytics } = data;
  const cards = [
    ['Users', analytics.users],
    ['NGOs', analytics.ngos],
    ['Reviewed NGO profiles', analytics.reviewedNgos],
    ['Pending verification', analytics.pendingVerifications],
    ['Donation listings', analytics.listings],
    ['Active help requests', analytics.activeHelpRequests],
    ['Reports', analytics.reports],
    ['Completed/closed requests', analytics.closedHelpRequests]
  ];

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>HeartMap operations</h1>
          <p>Live database views for trust, community support, and moderation. No placeholder metrics are shown.</p>
        </div>
        <div className="admin-header-actions">
          <a href="/admin/users" className="admin-action-btn">
            Manage Users
          </a>
          <a href="/admin/trust" className="admin-action-btn">
            Trust & Reports
          </a>
          <button type="button" onClick={load}>
            Refresh data
          </button>
        </div>
      </header>

      {message && <div className="admin-success">{message}</div>}
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      {/* Analytics Metric Cards */}
      <section className="metric-grid">
        {cards.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      {/* Analytics Distributions */}
      <div className="admin-columns">
        <section className="admin-panel">
          <h2>Donation categories</h2>
          {analytics.donationCategories.length ? (
            analytics.donationCategories.map((item) => (
              <div className="bar-row" key={item._id}>
                <span>{item._id}</span>
                <strong>{item.count}</strong>
                <i
                  style={{
                    width: `${Math.max(
                      8,
                      (item.count / Math.max(...analytics.donationCategories.map((entry) => entry.count))) * 100
                    )}%`
                  }}
                />
              </div>
            ))
          ) : (
            <div className="admin-state">No donation listings yet.</div>
          )}
        </section>

        <section className="admin-panel">
          <h2>Verification statuses</h2>
          {analytics.verificationStatuses.length ? (
            analytics.verificationStatuses.map((item) => (
              <div className="status-row" key={item._id}>
                <span>{item._id}</span>
                <strong>{item.count}</strong>
              </div>
            ))
          ) : (
            <div className="admin-state">No NGO profiles yet.</div>
          )}
        </section>
      </div>

      {/* User Management Section */}
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>User management</h2>
          <a href="/admin/users">Open dedicated users page →</a>
        </div>
        {data.users.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(event) =>
                          update(`/admin/users/${user._id}/role`, { role: event.target.value }, 'User role updated')
                        }
                      >
                        <option value="user">user</option>
                        <option value="ngo">ngo</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={String(user.isActive)}
                        onChange={(event) =>
                          update(
                            `/admin/users/${user._id}/status`,
                            { isActive: event.target.value === 'true' },
                            'User status updated'
                          )
                        }
                      >
                        <option value="true">active</option>
                        <option value="false">inactive</option>
                      </select>
                    </td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-state">No users to manage.</div>
        )}
      </section>

      {/* NGO Verification Management */}
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>NGO verification</h2>
          <a href="/admin/trust">Open trust review</a>
        </div>
        {data.ngos.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.ngos.map((ngo) => (
                  <tr key={ngo._id}>
                    <td>{ngo.name || ngo.organizationName}</td>
                    <td>{ngo.verificationStatus}</td>
                    <td>{ngo.reviewedAt ? new Date(ngo.reviewedAt).toLocaleDateString() : 'Not reviewed'}</td>
                    <td>
                      <select
                        value={ngo.verificationStatus}
                        onChange={(event) =>
                          update(
                            `/admin/ngos/${ngo._id}/verification`,
                            { verificationStatus: event.target.value, isPublished: event.target.value === 'verified' },
                            'NGO verification updated'
                          )
                        }
                      >
                        <option value="pending">pending</option>
                        <option value="verified">verified</option>
                        <option value="rejected">rejected</option>
                        <option value="flagged">flagged</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-state">No NGOs to manage.</div>
        )}
      </section>

      {/* Donation Listings Management */}
      <section className="admin-panel">
        <h2>Donation listings</h2>
        {data.listings.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.listings.map((listing) => (
                  <tr key={listing._id}>
                    <td>
                      {listing.quantity} × {listing.item}
                    </td>
                    <td>{listing.owner?.name || 'Unknown'}</td>
                    <td>{listing.status}</td>
                    <td>
                      <select
                        value={listing.status}
                        onChange={(event) =>
                          update(`/admin/donations/${listing._id}`, { status: event.target.value }, 'Donation listing updated')
                        }
                      >
                        <option value="available">available</option>
                        <option value="matched">matched</option>
                        <option value="closed">closed</option>
                      </select>
                      <button
                        className="table-danger"
                        type="button"
                        onClick={() => remove(`/admin/donations/${listing._id}`, 'Donation listing removed')}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-state">No donation listings to manage.</div>
        )}
      </section>

      {/* Help Requests Management */}
      <section className="admin-panel">
        <h2>Help requests</h2>
        {data.requests.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((request) => (
                  <tr key={request._id}>
                    <td>{request.title}</td>
                    <td>{request.owner?.name || 'Unknown'}</td>
                    <td>{request.status}</td>
                    <td>
                      <select
                        value={request.status}
                        onChange={(event) =>
                          update(`/admin/help-requests/${request._id}`, { status: event.target.value }, 'Help request updated')
                        }
                      >
                        <option value="open">open</option>
                        <option value="fulfilled">fulfilled</option>
                        <option value="closed">closed</option>
                      </select>
                      <button
                        className="table-danger"
                        type="button"
                        onClick={() => remove(`/admin/help-requests/${request._id}`, 'Help request removed')}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-state">No help requests to manage.</div>
        )}
      </section>

      {/* Reports Management */}
      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Reports</h2>
          <a href="/admin/trust">Open report review</a>
        </div>
        {data.reports.length ? (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((report) => (
                  <tr key={report._id}>
                    <td>{report.reason}</td>
                    <td>{report.targetType}</td>
                    <td>{report.status}</td>
                    <td>
                      <select
                        value={report.status}
                        onChange={(event) =>
                          update(
                            `/reports/${report._id}`,
                            { status: event.target.value, adminNotes: 'Reviewed from dashboard' },
                            'Report updated'
                          )
                        }
                      >
                        <option value="open">open</option>
                        <option value="reviewed">reviewed</option>
                        <option value="dismissed">dismissed</option>
                        <option value="actioned">actioned</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-state">No reports to review.</div>
        )}
      </section>
    </main>
  );
};

export default AdminDashboardPage;
