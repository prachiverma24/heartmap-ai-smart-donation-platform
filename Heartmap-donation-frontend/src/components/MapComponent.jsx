// HeartMap Interactive Topographic Map
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './MapComponent.css';

const getCoordinates = (entity) => {
  const lat = entity?.latitude ?? entity?.location?.lat;
  const lng = entity?.longitude ?? entity?.location?.lng;
  if (lat === undefined || lat === null || lng === undefined || lng === null || lat === '' || lng === '') {
    return null;
  }
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng) || !isFinite(numLat) || !isFinite(numLng)) {
    return null;
  }
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return null;
  }
  return { lat: numLat, lng: numLng };
};

const getCityName = (address, fallbackCity) => {
  if (fallbackCity && typeof fallbackCity === 'string') return fallbackCity;
  if (!address || typeof address !== 'string') return '';
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase();
    if (last === 'india' || last === 'in') return parts[parts.length - 2];
    return parts[0];
  }
  return parts[0] || '';
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const MapComponent = ({ stories = [], ngos = [], onMarkerClick, onNgoClick }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ngos' | 'stories'
  const [viewMode, setViewMode] = useState('india'); // 'india' | 'world'
  const [regionFilter, setRegionFilter] = useState('all'); // 'all' | 'north' | 'west' | 'south' | 'east'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const getMarkerColor = (story) => {
    const percentage = story.goalAmount > 0 ? (story.totalDonations / story.goalAmount) * 100 : 0;
    if (percentage >= 75) return '#2d6a4f'; // Soft green - high progress
    if (percentage >= 40) return '#d97736'; // Warm amber - steady progress
    return '#c2593f'; // Warm terracotta - early stage
  };

  const handleMarkerClick = (story) => {
    setSelectedItem({ type: 'story', data: story });
    if (onMarkerClick) {
      onMarkerClick(story._id);
    }
  };

  const handleNgoClick = (ngo) => {
    setSelectedItem({ type: 'ngo', data: ngo });
    if (onNgoClick) {
      onNgoClick(ngo._id);
    }
  };

  // Convert lat/lng to stylized percentage coordinates
  const latLngToPixel = (lat, lng) => {
    const numLat = Number(lat);
    const numLng = Number(lng);

    if (viewMode === 'india') {
      // Subcontinent geographic bounding box (68°E to 96°E, 8°N to 36°N)
      // Provides wide, spacious regional placement across India
      const x = Math.max(10, Math.min(90, ((numLng - 68) / 28) * 65 + 18));
      const y = Math.max(8, Math.min(92, ((36 - numLat) / 28) * 80 + 10));
      return { x, y };
    }

    // Global Mercator projection
    const x = Math.max(5, Math.min(95, ((numLng + 180) / 360) * 100));
    const y = Math.max(8, Math.min(92, ((90 - numLat) / 180) * 100));
    return { x, y };
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.8, Math.round((z + 0.25) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.9, Math.round((z - 0.25) * 100) / 100));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setRegionFilter('all');
    setSearchQuery('');
  };

  const handleFindNearby = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
        setActiveTab('ngos');
      },
      () => {
        setGeoError('Unable to access your location. You can filter by name or city.');
        setIsLocating(false);
      }
    );
  };

  const handleResetLocation = () => {
    setUserCoords(null);
    setSearchQuery('');
    setGeoError('');
  };

  // Extract only real NGOs with valid coordinates from MongoDB
  const ngosWithCoords = useMemo(() => {
    return ngos
      .map((ngo) => {
        const coords = getCoordinates(ngo);
        return coords ? { ...ngo, _coords: coords } : null;
      })
      .filter(Boolean);
  }, [ngos]);

  // Apply search query, radius, and region filtering
  const filteredNgosByLocation = useMemo(() => {
    return ngosWithCoords.filter((ngo) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (ngo.name || ngo.organizationName || '').toLowerCase();
        const city = (ngo.city || '').toLowerCase();
        const state = (ngo.state || '').toLowerCase();
        const address = (ngo.address || '').toLowerCase();
        const category = (ngo.category || '').toLowerCase();
        const matches = name.includes(q) || city.includes(q) || state.includes(q) || address.includes(q) || category.includes(q);
        if (!matches) return false;
      }
      if (regionFilter !== 'all') {
        const lat = ngo._coords.lat;
        const lng = ngo._coords.lng;
        if (regionFilter === 'north' && (lat < 24 || lng > 83)) return false;
        if (regionFilter === 'west' && (lat < 15 || lat > 26 || lng > 77)) return false;
        if (regionFilter === 'south' && lat > 16) return false;
        if (regionFilter === 'east' && lng < 80) return false;
      }
      if (userCoords) {
        const dist = calculateDistanceKm(userCoords.lat, userCoords.lng, ngo._coords.lat, ngo._coords.lng);
        ngo._distanceKm = Math.round(dist * 10) / 10;
        if (dist > radiusKm) return false;
      }
      return true;
    });
  }, [ngosWithCoords, searchQuery, regionFilter, userCoords, radiusKm]);

  const filteredStoriesBySearch = useMemo(() => {
    return stories.filter((story) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = (story.title || '').toLowerCase();
        const addr = (story.location?.address || '').toLowerCase();
        if (!title.includes(q) && !addr.includes(q)) return false;
      }
      if (regionFilter !== 'all' && story.location?.lat) {
        const lat = story.location.lat;
        const lng = story.location.lng;
        if (regionFilter === 'north' && (lat < 24 || lng > 83)) return false;
        if (regionFilter === 'west' && (lat < 15 || lat > 26 || lng > 77)) return false;
        if (regionFilter === 'south' && lat > 16) return false;
        if (regionFilter === 'east' && lng < 80) return false;
      }
      return true;
    });
  }, [stories, searchQuery, regionFilter]);

  const filteredNgos = activeTab === 'stories' ? [] : filteredNgosByLocation;
  const filteredStories = activeTab === 'ngos' ? [] : filteredStoriesBySearch;

  // Collision offset: when pins are too close to each other, fan them out slightly
  const offsetPins = (items, getLat, getLng) => {
    const keyMap = {};
    return items.map((item) => {
      const lat = getLat(item);
      const lng = getLng(item);
      if (lat === null || lng === null) return { ...item, _offX: 0, _offY: 0 };
      const coordKey = `${Math.round(lat * 5) / 5}_${Math.round(lng * 5) / 5}`;
      const index = keyMap[coordKey] || 0;
      keyMap[coordKey] = index + 1;
      if (index === 0) return { ...item, _offX: 0, _offY: 0 };
      const angle = (index * 75) * (Math.PI / 180);
      return {
        ...item,
        _offX: Math.cos(angle) * 18,
        _offY: Math.sin(angle) * 18
      };
    });
  };

  const displayStories = offsetPins(filteredStories, (s) => s.location?.lat, (s) => s.location?.lng);
  const displayNgos = offsetPins(filteredNgos, (n) => n._coords.lat, (n) => n._coords.lng);

  return (
    <div className="map-showcase-wrapper">
      {/* Top Toolbar */}
      <div className="map-toolbar">
        <div className="map-filter-pills">
          <button
            type="button"
            className={`map-pill ${activeTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Locations ({filteredNgos.length + filteredStories.length})
          </button>
          <button
            type="button"
            className={`map-pill ${activeTab === 'ngos' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ngos')}
          >
            NGO Hubs ({filteredNgos.length})
          </button>
          <button
            type="button"
            className={`map-pill ${activeTab === 'stories' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('stories')}
          >
            Community Needs ({filteredStories.length})
          </button>
        </div>

        {/* View Mode & Region Selectors */}
        <div className="map-view-switcher">
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'india' ? 'active' : ''}`}
            onClick={() => setViewMode('india')}
            title="Focus map on India & South Asia subcontinent"
          >
            🇮🇳 India Subcontinent
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'world' ? 'active' : ''}`}
            onClick={() => setViewMode('world')}
            title="Switch to global view"
          >
            🌍 Global
          </button>
        </div>

        {/* Search, Filter, and Controls */}
        <div className="map-controls-group">
          <div className="map-search-bar">
            <input
              type="text"
              placeholder="Search city or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="map-search-input"
              aria-label="Filter map by city or name"
            />
            {searchQuery && (
              <button
                type="button"
                className="map-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear filter"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className={`map-nearby-btn ${userCoords ? 'is-active' : ''}`}
            onClick={userCoords ? handleResetLocation : handleFindNearby}
            disabled={isLocating}
          >
            {isLocating ? 'Locating...' : userCoords ? `Near Me (${radiusKm}km) ✕` : '📍 Find Nearby'}
          </button>

          {userCoords && (
            <select
              className="map-radius-select"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              aria-label="Filter radius"
            >
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
            </select>
          )}

          {/* Quick Region Selector */}
          <div className="region-pills-row">
            {['all', 'north', 'west', 'south', 'east'].map((reg) => (
              <button
                key={reg}
                type="button"
                className={`region-pill ${regionFilter === reg ? 'active' : ''}`}
                onClick={() => setRegionFilter(reg)}
              >
                {reg.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="map-legend-inline">
          <div className="legend-chip">
            <span className="dot dot-ngo" />
            <span>Verified NGO Hub</span>
          </div>
          <div className="legend-chip">
            <span className="dot dot-story-active" />
            <span>Community Drive</span>
          </div>
          <div className="legend-chip">
            <span className="dot dot-funded" />
            <span>Goal Reached</span>
          </div>
        </div>
      </div>

      {geoError && <div className="map-geo-error" role="alert">{geoError}</div>}

      {/* Main Interactive Map Canvas */}
      <div className="map-canvas-container">
        {/* Zoom Controls Overlay */}
        <div className="map-zoom-controls" aria-label="Zoom controls">
          <button type="button" onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">+</button>
          <button type="button" onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">−</button>
          <button type="button" onClick={handleResetZoom} title="Reset zoom and filters" aria-label="Reset">⟲</button>
        </div>

        {/* Compass Rose */}
        <div className="map-compass" title="North orientation">
          <span className="compass-arrow">▲</span>
          <span className="compass-n">N</span>
        </div>

        {/* Scalable Canvas Wrapper */}
        <div
          className="map-zoomable-stage"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: '50% 50%',
            transition: 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1)'
          }}
        >
          {/* Detailed SVG Map Vector Layer */}
          <svg
            className="map-vector-graphic"
            viewBox="0 0 1000 700"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0a2024" />
                <stop offset="50%" stopColor="#0e2a2e" />
                <stop offset="100%" stopColor="#081b1e" />
              </linearGradient>

              <linearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#184347" />
                <stop offset="50%" stopColor="#14393d" />
                <stop offset="100%" stopColor="#102e32" />
              </linearGradient>

              <radialGradient id="highlightGlow" cx="42%" cy="45%" r="50%">
                <stop offset="0%" stopColor="rgba(217, 119, 54, 0.12)" />
                <stop offset="70%" stopColor="rgba(45, 106, 79, 0.05)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>

              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Ocean Base */}
            <rect width="1000" height="700" fill="url(#oceanGrad)" />
            <rect width="1000" height="700" fill="url(#highlightGlow)" />

            {/* Subtle Graticule Grid Lines (Lat / Long) */}
            <g className="graticule-grid" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" strokeWidth="1">
              <line x1="120" y1="160" x2="900" y2="160" />
              <line x1="120" y1="280" x2="900" y2="280" />
              <line x1="120" y1="400" x2="900" y2="400" />
              <line x1="120" y1="520" x2="900" y2="520" />
              <line x1="120" y1="640" x2="900" y2="640" />

              <line x1="260" y1="40" x2="260" y2="660" />
              <line x1="400" y1="40" x2="400" y2="660" />
              <line x1="540" y1="40" x2="540" y2="660" />
              <line x1="680" y1="40" x2="680" y2="660" />
              <line x1="820" y1="40" x2="820" y2="660" />
            </g>

            {/* Geographic Graticule Coordinate Labels */}
            <g className="graticule-labels" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace">
              <text x="30" y="165">30°N</text>
              <text x="30" y="285">25°N</text>
              <text x="30" y="405">20°N</text>
              <text x="30" y="525">15°N</text>
              <text x="30" y="645">10°N</text>

              <text x="250" y="685">70°E</text>
              <text x="390" y="685">75°E</text>
              <text x="530" y="685">80°E</text>
              <text x="670" y="685">85°E</text>
              <text x="810" y="685">90°E</text>
            </g>

            {/* Indian Subcontinent Main Geographic Landmass Polygon */}
            {viewMode === 'india' ? (
              <g className="india-topography-layer">
                {/* Peninsular Subcontinent Body */}
                <path
                  d="M 370 85 
                     C 390 90, 420 110, 450 120
                     C 490 135, 540 180, 580 190
                     C 610 198, 640 170, 680 160
                     C 720 150, 770 170, 780 200
                     C 785 220, 750 250, 730 260
                     C 710 270, 690 275, 680 295
                     C 670 320, 650 360, 630 400
                     C 610 440, 580 480, 550 530
                     C 520 570, 480 610, 450 635
                     C 435 640, 425 630, 420 610
                     C 405 570, 380 520, 350 460
                     C 320 400, 290 360, 280 340
                     C 255 330, 220 335, 210 320
                     C 200 300, 225 285, 250 275
                     C 270 265, 260 245, 250 235
                     C 260 215, 285 190, 305 160
                     C 325 130, 345 100, 370 85 Z"
                  fill="url(#landGrad)"
                  stroke="#276166"
                  strokeWidth="2.5"
                  filter="url(#glowFilter)"
                />

                {/* Subcontinent Elevation & Relief Contours */}
                <path
                  d="M 350 130 Q 420 150 470 180 T 570 240 Q 520 350 450 450 T 435 590"
                  fill="none"
                  stroke="rgba(217, 119, 54, 0.18)"
                  strokeWidth="1.5"
                  strokeDasharray="4 6"
                />
                <path
                  d="M 290 320 Q 340 380 370 480 T 430 610"
                  fill="none"
                  stroke="rgba(56, 142, 108, 0.25)"
                  strokeWidth="2"
                  strokeDasharray="2 4"
                />

                {/* Sri Lanka Anchor */}
                <ellipse
                  cx="485"
                  cy="660"
                  rx="18"
                  ry="26"
                  fill="#153b3f"
                  stroke="#2d6a4f"
                  strokeWidth="1.5"
                />
                <text x="475" y="692" fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="600">SRI LANKA</text>

                {/* Andaman & Nicobar Archipelagos */}
                <g fill="#184347" stroke="#2d6a4f" strokeWidth="1">
                  <ellipse cx="790" cy="490" rx="4" ry="12" />
                  <ellipse cx="795" cy="530" rx="3.5" ry="10" />
                  <ellipse cx="802" cy="580" rx="4" ry="14" />
                </g>
                <text x="760" y="605" fill="rgba(255,255,255,0.25)" fontSize="8" fontWeight="600">ANDAMAN &amp; NICOBAR</text>

                {/* Lakshadweep Islands */}
                <g fill="#2d6a4f">
                  <circle cx="330" cy="570" r="3" />
                  <circle cx="335" cy="590" r="2.5" />
                  <circle cx="340" cy="615" r="3" />
                </g>
                <text x="260" y="605" fill="rgba(255,255,255,0.25)" fontSize="8" fontWeight="600">LAKSHADWEEP</text>

                {/* Water Body Badges */}
                <text x="140" y="470" fill="rgba(255,255,255,0.2)" fontSize="16" fontFamily="Georgia, serif" fontStyle="italic" letterSpacing="4">
                  ARABIAN SEA
                </text>
                <text x="680" y="440" fill="rgba(255,255,255,0.2)" fontSize="16" fontFamily="Georgia, serif" fontStyle="italic" letterSpacing="4">
                  BAY OF BENGAL
                </text>
                <text x="410" y="685" fill="rgba(255,255,255,0.2)" fontSize="14" fontFamily="Georgia, serif" fontStyle="italic" letterSpacing="5">
                  INDIAN OCEAN
                </text>
                <text x="460" y="105" fill="rgba(255,255,255,0.25)" fontSize="13" fontFamily="Georgia, serif" fontStyle="italic" letterSpacing="6">
                  H I M A L A Y A S
                </text>

                {/* Major City Coordinate Reference Landmarks */}
                <g className="city-anchor-nodes">
                  {/* Delhi NCR */}
                  <g className="city-anchor" transform="translate(397, 204)">
                    <circle r="4" fill="#d97736" opacity="0.6" />
                    <circle r="1.5" fill="#ffffff" />
                    <text x="8" y="4" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="600">Delhi NCR</text>
                  </g>
                  {/* Mandi */}
                  <g className="city-anchor" transform="translate(389, 144)">
                    <circle r="3" fill="#d97736" opacity="0.5" />
                    <circle r="1.2" fill="#ffffff" />
                    <text x="7" y="3" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="600">Mandi</text>
                  </g>
                  {/* Mumbai */}
                  <g className="city-anchor" transform="translate(285, 394)">
                    <circle r="4" fill="#2d6a4f" opacity="0.6" />
                    <circle r="1.5" fill="#ffffff" />
                    <text x="-48" y="4" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="600">Mumbai</text>
                  </g>
                  {/* Pune */}
                  <g className="city-anchor" transform="translate(305, 415)">
                    <circle r="3" fill="#2d6a4f" opacity="0.5" />
                    <circle r="1.2" fill="#ffffff" />
                    <text x="7" y="4" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="600">Pune</text>
                  </g>
                  {/* Bengaluru */}
                  <g className="city-anchor" transform="translate(406, 516)">
                    <circle r="4" fill="#2d6a4f" opacity="0.6" />
                    <circle r="1.5" fill="#ffffff" />
                    <text x="8" y="4" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="600">Bengaluru</text>
                  </g>
                  {/* Chennai */}
                  <g className="city-anchor" transform="translate(460, 520)">
                    <circle r="3.5" fill="#2d6a4f" opacity="0.5" />
                    <circle r="1.2" fill="#ffffff" />
                    <text x="7" y="4" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="600">Chennai</text>
                  </g>
                  {/* Kolkata */}
                  <g className="city-anchor" transform="translate(683, 324)">
                    <circle r="4" fill="#d97736" opacity="0.6" />
                    <circle r="1.5" fill="#ffffff" />
                    <text x="8" y="4" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="600">Kolkata</text>
                  </g>
                  {/* Hyderabad */}
                  <g className="city-anchor" transform="translate(435, 435)">
                    <circle r="3.5" fill="#2d6a4f" opacity="0.5" />
                    <circle r="1.2" fill="#ffffff" />
                    <text x="7" y="4" fill="rgba(255,255,255,0.4)" fontSize="9" fontWeight="600">Hyderabad</text>
                  </g>
                </g>
              </g>
            ) : (
              /* Global World Map Topography Layer */
              <g className="world-topography-layer" fill="url(#landGrad)" stroke="#276166" strokeWidth="1.5">
                {/* Americas */}
                <path d="M 120 140 Q 180 160 220 230 Q 190 320 230 420 Q 250 500 240 600 L 190 560 Q 160 440 130 350 Z" />
                {/* Europe & Africa */}
                <path d="M 440 150 Q 520 140 540 220 Q 550 320 540 440 Q 480 560 460 610 L 420 550 Q 410 380 430 250 Z" />
                {/* Asia & Australia */}
                <path d="M 570 160 Q 720 140 840 220 Q 820 380 750 460 L 680 420 Q 640 320 590 260 Z" />
                <path d="M 760 480 Q 840 470 870 540 Q 820 620 750 580 Z" />
              </g>
            )}
          </svg>

          {/* Markers Layer */}
          <div className="markers-layer">
            {/* Story Markers */}
            {displayStories.map((story, index) => {
              const position = story.location?.lat && story.location?.lng
                ? latLngToPixel(story.location.lat, story.location.lng)
                : { x: 38 + (index * 15) % 40, y: 30 + (index * 18) % 45 };

              const isSelected = selectedItem?.type === 'story' && selectedItem?.data?._id === story._id;
              const cityName = getCityName(story.location?.address);

              return (
                <motion.div
                  key={`story-${story._id || index}`}
                  className={`custom-pin story-pin ${isSelected ? 'pin-selected' : ''}`}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    '--pin-accent': getMarkerColor(story),
                    transform: `translate(calc(-50% + ${story._offX || 0}px), calc(-50% + ${story._offY || 0}px))`
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: isSelected ? 1.25 : 1, opacity: 1 }}
                  transition={{ delay: index * 0.06, type: 'spring', stiffness: 280, damping: 22 }}
                  whileHover={{ scale: 1.28, zIndex: 70 }}
                  onClick={() => handleMarkerClick(story)}
                  title={story.title}
                >
                  <div className="pin-marker-head">
                    <span className="pin-glyph">♥</span>
                  </div>
                  <div className="pin-pulse" />

                  {/* Always-visible city badge for quick geographical recognition */}
                  {cityName && (
                    <div className="pin-city-pill">
                      <span>{cityName}</span>
                    </div>
                  )}

                  {/* Rich hover tooltip */}
                  <div className="pin-quick-tooltip">
                    <span className="pin-type-tag">Community Drive</span>
                    <strong>{story.title}</strong>
                    <span className="pin-loc">📍 {story.location?.address || 'Location listed'}</span>
                    {story.goalAmount > 0 && (
                      <div className="pin-mini-progress">
                        <div
                          className="pin-mini-bar"
                          style={{ width: `${Math.min(100, (story.totalDonations / story.goalAmount) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Real MongoDB NGO Markers */}
            {displayNgos.map((ngo, index) => {
              const position = latLngToPixel(ngo._coords.lat, ngo._coords.lng);
              const isSelected = selectedItem?.type === 'ngo' && selectedItem?.data?._id === ngo._id;
              const cityName = getCityName(ngo.address, ngo.city);

              return (
                <motion.div
                  key={`ngo-${ngo._id || index}`}
                  className={`custom-pin ngo-pin ${isSelected ? 'pin-selected' : ''}`}
                  style={{
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    transform: `translate(calc(-50% + ${ngo._offX || 0}px), calc(-50% + ${ngo._offY || 0}px))`
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: isSelected ? 1.25 : 1, opacity: 1 }}
                  transition={{ delay: (displayStories.length + index) * 0.05, type: 'spring', stiffness: 280, damping: 22 }}
                  whileHover={{ scale: 1.28, zIndex: 70 }}
                  onClick={() => handleNgoClick(ngo)}
                  title={ngo.name || ngo.organizationName}
                >
                  <div className="pin-marker-head pin-head-ngo">
                    <span className="pin-glyph">🏢</span>
                  </div>
                  <div className="pin-pulse pin-pulse-ngo" />

                  {/* Always-visible city badge */}
                  {cityName && (
                    <div className="pin-city-pill pin-city-ngo">
                      <span>{cityName}</span>
                    </div>
                  )}

                  <div className="pin-quick-tooltip">
                    <span className="pin-type-tag tag-ngo">Verified NGO Hub</span>
                    <strong>{ngo.name || ngo.organizationName}</strong>
                    <span className="pin-loc">⌖ {[ngo.city, ngo.state].filter(Boolean).join(', ') || ngo.address || 'Address on profile'}</span>
                    {ngo._distanceKm !== undefined && (
                      <span className="pin-distance">📍 {ngo._distanceKm} km away</span>
                    )}
                    {ngo.acceptedDonationTypes?.length > 0 && (
                      <span className="pin-accepts">Accepts: {ngo.acceptedDonationTypes.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Informative Watermark Overlay */}
        <div className="map-watermark-overlay">
          <span className="map-hint">
            {viewMode === 'india' ? '🇮🇳 Indian Subcontinent View • Click pins to inspect' : '🌍 World View • Click pins to inspect'}
          </span>
        </div>

        {/* Empty States */}
        {activeTab === 'all' && filteredStories.length === 0 && filteredNgos.length === 0 && (
          <div className="map-empty-notice" role="status">
            <h4>No active map points yet</h4>
            <p>
              {searchQuery.trim() || userCoords || regionFilter !== 'all'
                ? 'No locations match the active search or region filter.'
                : 'Locations will appear here as community stories and NGOs are published.'}
            </p>
            {(searchQuery.trim() || userCoords || regionFilter !== 'all') && (
              <button type="button" className="btn-reset-map-filter" onClick={handleResetLocation}>
                Reset Filter
              </button>
            )}
          </div>
        )}

        {activeTab === 'ngos' && filteredNgos.length === 0 && (
          <div className="map-empty-notice" role="status">
            <h4>No verified NGO locations found</h4>
            <p>
              {userCoords
                ? `No verified NGO hubs found within ${radiusKm}km of your location.`
                : searchQuery.trim()
                ? `No verified NGO hubs match "${searchQuery}".`
                : regionFilter !== 'all'
                ? `No verified NGO hubs currently found in the ${regionFilter.toUpperCase()} zone.`
                : 'There are no verified NGO hubs with coordinates published right now.'}
            </p>
            {(searchQuery.trim() || userCoords || regionFilter !== 'all') && (
              <button
                type="button"
                className="btn-reset-map-filter"
                onClick={() => {
                  handleResetLocation();
                  setRegionFilter('all');
                }}
              >
                Reset Filter
              </button>
            )}
          </div>
        )}

        {activeTab === 'stories' && filteredStories.length === 0 && (
          <div className="map-empty-notice" role="status">
            <h4>No community drives found</h4>
            <p>
              {searchQuery.trim()
                ? `No community drives match "${searchQuery}".`
                : regionFilter !== 'all'
                ? `No community drives found in the ${regionFilter.toUpperCase()} zone.`
                : 'Active community drives will appear here as stories are published.'}
            </p>
            {(searchQuery.trim() || regionFilter !== 'all') && (
              <button
                type="button"
                className="btn-reset-map-filter"
                onClick={() => {
                  setSearchQuery('');
                  setRegionFilter('all');
                }}
              >
                Reset Filter
              </button>
            )}
          </div>
        )}

        {/* Selected Item Floating Card */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div
              className="map-selection-card"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.96 }}
              transition={{ duration: 0.25 }}
            >
              <button
                type="button"
                className="selection-close-btn"
                onClick={() => setSelectedItem(null)}
                aria-label="Close card"
              >
                ✕
              </button>

              {selectedItem.type === 'story' ? (
                <div className="selection-card-inner">
                  <div className="selection-badge">
                    <span className="badge-dot" /> Community Impact Drive
                  </div>
                  <h3>{selectedItem.data.title}</h3>
                  <p className="selection-address">📍 {selectedItem.data.location?.address || 'Location on file'}</p>
                  <p className="selection-desc">{selectedItem.data.description}</p>
                  <button
                    type="button"
                    className="selection-action-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onMarkerClick) onMarkerClick(selectedItem.data._id);
                    }}
                  >
                    View Full Story Details <span>→</span>
                  </button>
                </div>
              ) : (
                <div className="selection-card-inner">
                  <div className="selection-badge badge-verified">
                    <span className="badge-check">✓</span> Verified Organization
                  </div>
                  <h3>{selectedItem.data.name || selectedItem.data.organizationName}</h3>
                  <p className="selection-address">⌖ {[selectedItem.data.city, selectedItem.data.state].filter(Boolean).join(', ') || selectedItem.data.address || 'Location on profile'}</p>
                  {selectedItem.data._distanceKm !== undefined && (
                    <p className="selection-dist">Distance: {selectedItem.data._distanceKm} km</p>
                  )}
                  <p className="selection-desc">{selectedItem.data.description || selectedItem.data.category || 'Registered community nonprofit organization.'}</p>
                  <button
                    type="button"
                    className="selection-action-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onNgoClick) onNgoClick(selectedItem.data._id);
                    }}
                  >
                    View NGO Profile <span>→</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nearby Organization Cards Showcase */}
      <div className="nearby-orgs-showcase">
        <div className="nearby-orgs-header">
          <h4>Featured Organizations Nearby</h4>
          <span className="nearby-count">{filteredNgosByLocation.length} organizations active</span>
        </div>

        {filteredNgosByLocation.length === 0 ? (
          <div className="nearby-orgs-empty" role="status">
            <p>
              {userCoords
                ? `No verified NGO hubs found within ${radiusKm}km of your location.`
                : searchQuery.trim()
                ? `No verified organizations match "${searchQuery}".`
                : regionFilter !== 'all'
                ? `No verified organizations found in ${regionFilter.toUpperCase()} zone.`
                : 'No verified NGO hubs currently listed with location data. Real organizations will appear here as they register and publish coordinates.'}
            </p>
          </div>
        ) : (
          <div className="nearby-cards-slider">
            {filteredNgosByLocation.slice(0, 4).map((ngo) => {
              const name = ngo.name || ngo.organizationName;
              const locationStr = [ngo.city, ngo.state].filter(Boolean).join(', ') || ngo.address || 'Location on profile';
              return (
                <div
                  key={`nearby-${ngo._id}`}
                  className="nearby-card"
                  onClick={() => {
                    setSelectedItem({ type: 'ngo', data: ngo });
                    if (onNgoClick) onNgoClick(ngo._id);
                  }}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSelectedItem({ type: 'ngo', data: ngo });
                      if (onNgoClick) onNgoClick(ngo._id);
                    }
                  }}
                >
                  <div className="nearby-card-top">
                    {ngo.logo ? (
                      <img src={ngo.logo} alt="" className="nearby-logo" />
                    ) : (
                      <div className="nearby-logo-fallback">🏢</div>
                    )}
                    <span className="nearby-verified-tag">✓ Verified</span>
                  </div>
                  <h5>{name}</h5>
                  <p className="nearby-loc">⌖ {locationStr}</p>
                  {ngo._distanceKm !== undefined && (
                    <span className="nearby-distance">📍 {ngo._distanceKm} km away</span>
                  )}
                  <div className="nearby-tags">
                    {ngo.acceptedDonationTypes?.slice(0, 2).map((type) => (
                      <span key={type} className="mini-tag">{type}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapComponent;
