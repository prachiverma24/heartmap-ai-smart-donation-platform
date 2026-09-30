import React, { useEffect, useState, useMemo } from 'react';
import api from '../api';
import './NGODonationsPage.css';

const categories = ['All', 'Clothes', 'Food', 'Books', 'Toys', 'Electronics', 'Furniture', 'Money', 'Other'];

const NGODonationsPage = () => {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPickup, setSelectedPickup] = useState('All');

  const fetchAvailableDonations = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get('/donations');
      setListings(data.listings || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load available donation listings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableDonations();
  }, []);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const matchesCategory =
        selectedCategory === 'All' || listing.type?.toLowerCase() === selectedCategory.toLowerCase();

      const matchesPickup =
        selectedPickup === 'All' ||
        (selectedPickup === 'pickup' && listing.pickupAvailable) ||
        (selectedPickup === 'dropoff' && !listing.pickupAvailable);

      const query = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !query ||
        listing.item?.toLowerCase().includes(query) ||
        listing.title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query) ||
        listing.location?.address?.toLowerCase().includes(query);

      return matchesCategory && matchesPickup && matchesSearch;
    });
  }, [listings, selectedCategory, selectedPickup, searchTerm]);

  return (
    <main className="ngo-donations-page">
      <header className="ngo-donations-header">
        <p className="eyebrow">DONATION OPPORTUNITIES</p>
        <h1>Available Community Donations</h1>
        <p className="ngo-donations-subtitle">
          Discover items offered by donors in your community. Review specifications, condition, and pickup availability to fulfill your organization's needs.
        </p>
      </header>

      {/* Filter and Search Bar */}
      <section className="ngo-donations-controls" aria-label="Filters and Search">
        <div className="search-box-wrapper">
          <input
            type="search"
            placeholder="Search items, description or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ngo-search-input"
          />
        </div>

        <div className="filters-group">
          <label className="filter-item">
            <span>Category</span>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-item">
            <span>Availability</span>
            <select value={selectedPickup} onChange={(e) => setSelectedPickup(e.target.value)}>
              <option value="All">All Types</option>
              <option value="pickup">Pickup Available</option>
              <option value="dropoff">Drop-off / Self-pickup</option>
            </select>
          </label>

          <button
            type="button"
            className="btn-refresh"
            onClick={fetchAvailableDonations}
            disabled={isLoading}
            title="Refresh listings"
          >
            ↻ Refresh
          </button>
        </div>
      </section>

      {/* Content Area */}
      {isLoading ? (
        <div className="ngo-donations-state" role="status">
          <div className="spinner-dot" />
          <p>Loading available donation listings...</p>
        </div>
      ) : error ? (
        <div className="ngo-donations-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={fetchAvailableDonations}>
            Try again
          </button>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="ngo-donations-empty" role="status">
          <span className="empty-icon">📦</span>
          <h2>No donation listings found</h2>
          <p>
            {listings.length === 0
              ? 'There are currently no community donations posted. Please check back later.'
              : 'No donation listings match your current filters. Try resetting the search or category filter.'}
          </p>
          {(searchTerm || selectedCategory !== 'All' || selectedPickup !== 'All') && (
            <button
              type="button"
              className="btn-reset-filters"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedPickup('All');
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <section className="ngo-donations-results" aria-label="Listings Grid">
          <div className="results-count">
            Showing <strong>{filteredListings.length}</strong> donation listing{filteredListings.length === 1 ? '' : 's'}
          </div>

          <div className="ngo-donations-grid">
            {filteredListings.map((listing) => (
              <article className="donation-card" key={listing._id}>
                {listing.images && listing.images.length > 0 ? (
                  <div className="card-media-gallery">
                    <img
                      src={listing.images[0]}
                      alt={listing.title || listing.item}
                      className="card-main-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    {listing.images.length > 1 && (
                      <span className="photo-count-badge">+{listing.images.length - 1} photos</span>
                    )}
                  </div>
                ) : (
                  <div className="card-media-placeholder">
                    <span>{listing.type}</span>
                  </div>
                )}

                <div className="card-body">
                  <div className="card-badges">
                    <span className="badge-pill badge-type">{listing.type}</span>
                    <span className="badge-pill badge-condition">{listing.condition}</span>
                    <span
                      className={`badge-pill ${
                        listing.pickupAvailable ? 'badge-pickup-yes' : 'badge-pickup-no'
                      }`}
                    >
                      {listing.pickupAvailable ? '🚚 Pickup Available' : '📦 Drop-off Only'}
                    </span>
                  </div>

                  <h2 className="card-title">{listing.title || listing.item}</h2>

                  <div className="card-meta">
                    <div className="meta-item">
                      <span className="meta-label">Item:</span>
                      <span className="meta-value">{listing.item}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Quantity:</span>
                      <span className="meta-value">{listing.quantity}</span>
                    </div>
                  </div>

                  <p className="card-desc">{listing.description}</p>

                  <div className="card-location">
                    <span className="loc-icon">📍</span>
                    <span className="loc-text">{listing.location?.address || 'Location provided upon match'}</span>
                  </div>

                  {listing.images && listing.images.length > 1 && (
                    <div className="card-extra-thumbnails">
                      {listing.images.slice(1, 5).map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt={`${listing.item} ${i + 2}`}
                          className="extra-thumb"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <footer className="card-footer">
                    <div className="card-donor-info">
                      <span>Offered by <strong>{listing.owner?.name || 'Community Donor'}</strong></span>
                      <small>Posted on {new Date(listing.createdAt).toLocaleDateString()}</small>
                    </div>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default NGODonationsPage;

