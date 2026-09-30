import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import AISearchSection from '../components/AISearchSection';
import AIRecommendationsSection from '../components/AIRecommendationsSection';
import './NGODirectoryPage.css';

const NGO_DEFAULT_PHOTOS = {
  'Goonj': 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
  'Indian Red Cross Society, District Branch Mandi': 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
  'Sahyog Bal Shrawan and Viklang Kalyan Samiti': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
  'Sakar Society for Differently Abled Persons': 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80',
  'Disaster Relief': 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
  'Clothes': 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
  'Community': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
  'Education': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
  'Food': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
  'Books': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
  'default': 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80'
};

const getNgoPhoto = (ngo) => {
  if (ngo.logo && !ngo.logo.includes('placeholder')) return ngo.logo;
  if (Array.isArray(ngo.images) && ngo.images.length > 0 && ngo.images[0]) return ngo.images[0];
  const name = ngo.name || ngo.organizationName || '';
  if (NGO_DEFAULT_PHOTOS[name]) return NGO_DEFAULT_PHOTOS[name];
  const cat = ngo.category || '';
  if (NGO_DEFAULT_PHOTOS[cat]) return NGO_DEFAULT_PHOTOS[cat];
  return NGO_DEFAULT_PHOTOS.default;
};

const NGODirectoryPage = () => {
  const [filters, setFilters] = useState({ search: '', category: '', city: '', donationType: '', lat: '', lng: '', radiusKm: '' });
  const [ngos, setNgos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim()));
        const { data } = await api.get('/ngo/public', { params });
        setNgos(data.profiles || []);
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Unable to load NGOs right now.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [filters]);

  const updateFilter = (event) => setFilters({ ...filters, [event.target.name]: event.target.value });
  const findNearby = () => {
    if (!navigator.geolocation) {
      setError('Location search is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setFilters({ ...filters, lat: String(coords.latitude), lng: String(coords.longitude), radiusKm: '25' }),
      () => setError('Unable to access your location. You can still search by city or state.')
    );
  };

  return (
    <main className="ngo-directory">
      <header className="directory-header">
        <p className="eyebrow">DISCOVER ORGANIZATIONS</p>
        <h1>Find a place where your donation can help.</h1>
        <p>Search verified NGO profiles by name, cause, location, or accepted donation type. Verification status is shown as provided by the platform.</p>
      </header>

      {/* Feature 3: AI Search Section */}
      <AISearchSection />

      {/* Feature 2: AI Recommendations Section */}
      <AIRecommendationsSection />

      <div className="ngo-filters">
        <input name="search" value={filters.search} onChange={updateFilter} placeholder="Search by NGO name or cause" aria-label="Search NGOs" />
        <input name="category" value={filters.category} onChange={updateFilter} placeholder="Category" aria-label="Filter by category" />
        <input name="city" value={filters.city} onChange={updateFilter} placeholder="City" aria-label="Filter by city" />
        <input name="donationType" value={filters.donationType} onChange={updateFilter} placeholder="Accepted donation type" aria-label="Filter by donation type" />
        <button className="nearby-button" type="button" onClick={findNearby}>Find nearby NGOs</button>
      </div>
      {isLoading ? (
        <div className="ngo-state">Loading NGO profiles...</div>
      ) : error ? (
        <div className="ngo-state ngo-error" role="alert">{error}</div>
      ) : ngos.length === 0 ? (
        <div className="ngo-state">No verified NGO profiles match those filters.</div>
      ) : (
        <div className="ngo-grid">
          {ngos.map((ngo) => (
            <article className="ngo-card" key={ngo._id}>
              <div className="ngo-card-image-wrap">
                <img
                  src={getNgoPhoto(ngo)}
                  alt={ngo.name || ngo.organizationName}
                  className="ngo-logo"
                  onError={(e) => { e.target.onerror = null; e.target.src = NGO_DEFAULT_PHOTOS.default; }}
                />
                <span className="ngo-card-badge">
                  ✓ Verified
                </span>
              </div>
              <div className="ngo-card-body">
                <span className="ngo-status">Verification status: {ngo.verificationStatus}</span>
                <h2>{ngo.name || ngo.organizationName}</h2>
                {(ngo.category || ngo.city) && (
                  <div className="ngo-card-tags">
                    {ngo.category && <span className="ngo-tag-category">{ngo.category}</span>}
                    {ngo.city && <span className="ngo-tag-city">📍 {ngo.city}</span>}
                  </div>
                )}
                <p>{ngo.description || 'Community support organization'}</p>
                <p className="ngo-location">{[ngo.city, ngo.state].filter(Boolean).join(', ') || ngo.address || 'Location not listed'}</p>
                <Link to={`/ngos/${ngo._id}`}>View NGO profile <span>→</span></Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};

export default NGODirectoryPage;
