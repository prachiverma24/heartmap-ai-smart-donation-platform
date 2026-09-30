import React, { useEffect, useState } from 'react';
import api from '../api';
import './AdminDashboardPage.css';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => { setIsLoading(true); setError(''); try { const { data } = await api.get('/admin/users'); setUsers(data.users || []); } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to load users.'); } finally { setIsLoading(false); } };
  useEffect(() => { load(); }, []);
  const update = async (id, path, body) => { try { await api.patch(`/admin/users/${id}/${path}`, body); setMessage('User updated.'); await load(); } catch (requestError) { setError(requestError.response?.data?.error || 'Unable to update user.'); } };
  if (isLoading) return <main className="admin-dashboard"><div className="admin-state">Loading users...</div></main>;
  return <main className="admin-dashboard"><header className="admin-dashboard-header"><div><p className="eyebrow">ADMINISTRATION</p><h1>Manage users</h1><p>Change roles and deactivate accounts when moderation requires it.</p></div><button type="button" onClick={load}>Refresh</button></header>{message && <div className="admin-success">{message}</div>}{error && <div className="admin-error" role="alert">{error}</div>}<section className="admin-panel"><div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{users.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td><select value={user.role} onChange={(event) => update(user._id, 'role', { role: event.target.value })}><option value="user">user</option><option value="ngo">ngo</option><option value="admin">admin</option></select></td><td><select value={String(user.isActive)} onChange={(event) => update(user._id, 'status', { isActive: event.target.value === 'true' })}><option value="true">active</option><option value="false">inactive</option></select></td><td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>{users.length === 0 && <div className="admin-state">No users found.</div>}</section></main>;
};

export default AdminUsersPage;
