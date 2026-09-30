import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './RecentDonors.css';

const RecentDonors = ({ storyId, limit = 10, pollIntervalMs = 0 }) => {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timer;

    const fetchDonations = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`https://heartmap-donation-backend.onrender.com/api/stories/${storyId}/donations/recent?limit=${limit}`);
        if (!mounted) return;
        setDonations(res.data || []);
      } catch (err) {
        console.error('fetch donations error', err);
        if (mounted) setError('Could not load recent donors');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (storyId) fetchDonations();

    if (pollIntervalMs && pollIntervalMs > 0) {
      timer = setInterval(() => { if (storyId) fetchDonations(); }, pollIntervalMs);
    }

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [storyId, limit, pollIntervalMs]);

  if (loading) return <div className="recent-donors loading">Loading donors…</div>;
  if (error) return <div className="recent-donors error">{error}</div>;

  return (
    <div className="recent-donors">
      <h4>Recent Donors</h4>
      {donations.length === 0 ? (
        <div className="no-donations">Be the first donor — your support matters!</div>
      ) : (
        <ul className="donor-list">
          {donations.map(d => {
            const displayName = d.anonymous ? 'Anonymous' : (d.donorName || 'Supporter');
            const amount = Number(d.amount).toFixed(2);
            const created = new Date(d.createdAt || d.date || d.createdAt).toLocaleString();
            return (
              <li key={d._id} className="donor-row">
                <div className="donor-avatar">{(displayName && displayName[0]) || 'S'}</div>
                <div className="donor-info">
                  <div className="donor-top">
                    <span className="donor-name">{displayName}</span>
                    <span className="donor-amount">${amount}</span>
                  </div>
                  {d.message && <div className="donor-message">“{d.message}”</div>}
                  <div className="donor-time">{created}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default RecentDonors;
