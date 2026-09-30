import React, { useEffect, useRef, useState, useCallback } from 'react';
import './OrbitImages.css';

const OrbitImages = ({
  items = [],
  radiusX = 260,
  radiusY = 95,
  duration = 24, // seconds per full revolution
  direction = 'normal', // 'normal' | 'reverse'
  showPath = true,
  pathColor = 'rgba(255, 179, 128, 0.32)',
  itemSize = 72,
  centerContent = null,
  pauseOnHover = true,
  onItemClick = null
}) => {
  const containerRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 480 });
  const [dimensions, setDimensions] = useState({ rx: radiusX, ry: radiusY });
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Responsive radius adjustment matching the exact pixel coordinate space
  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 480;
    setContainerSize({ width, height });

    if (width < 480) {
      setDimensions({
        rx: Math.min(radiusX, width * 0.38),
        ry: Math.min(radiusY, height * 0.28)
      });
    } else if (width < 768) {
      setDimensions({
        rx: Math.min(radiusX, width * 0.42),
        ry: Math.min(radiusY, height * 0.32)
      });
    } else {
      const maxAvailableRx = Math.max(160, (width / 2) - itemSize - 24);
      const maxAvailableRy = Math.max(100, (height / 2) - (itemSize / 2) - 20);
      setDimensions({
        rx: Math.min(radiusX, maxAvailableRx),
        ry: Math.min(radiusY, maxAvailableRy)
      });
    }
  }, [radiusX, radiusY, itemSize]);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        updateDimensions();
      });
      ro.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (ro) ro.disconnect();
    };
  }, [updateDimensions]);

  // Smooth animation loop
  useEffect(() => {
    const speed = (360 / (duration * 1000)) * (direction === 'reverse' ? -1 : 1);

    const animate = (time) => {
      if (lastTimeRef.current != null) {
        const delta = time - lastTimeRef.current;
        if (!isHovered || !pauseOnHover) {
          setRotation((prev) => (prev + speed * delta) % 360);
        }
      }
      lastTimeRef.current = time;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [duration, direction, isHovered, pauseOnHover]);

  const count = items.length;
  const currentRx = dimensions.rx;
  const currentRy = dimensions.ry;

  return (
    <div
      className="orbit-container"
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredIndex(null);
      }}
    >
      {/* SVG Orbit Track with 1:1 CSS pixel alignment */}
      {showPath && (
        <svg
          className="orbit-svg-track"
          viewBox={`-${containerSize.width / 2} -${containerSize.height / 2} ${containerSize.width} ${containerSize.height}`}
        >
          <defs>
            <linearGradient id="orbitLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97736" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#ffb380" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0.45" />
            </linearGradient>
            <filter id="orbitGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <ellipse
            cx="0"
            cy="0"
            rx={currentRx}
            ry={currentRy}
            fill="none"
            stroke="url(#orbitLineGrad)"
            strokeWidth="2"
            strokeDasharray="6 6"
            filter="url(#orbitGlow)"
          />
        </svg>
      )}

      {/* Center Content Node */}
      {centerContent && (
        <div className="orbit-center-anchor">
          {centerContent}
        </div>
      )}

      {/* Orbiting Elements - Exactly centered on the ellipse line */}
      <div className="orbit-items-layer">
        {items.map((item, index) => {
          // Calculate angle on ellipse
          const baseAngle = (360 / count) * index;
          const currentAngleDeg = (rotation + baseAngle) % 360;
          const currentAngleRad = (currentAngleDeg * Math.PI) / 180;

          // Elliptical coordinate calculation
          const x = currentRx * Math.cos(currentAngleRad);
          const y = currentRy * Math.sin(currentAngleRad);

          // 3D Depth effect: y corresponds to vertical tilt
          const normalizedDepth = (Math.sin(currentAngleRad) + 1) / 2; // 0 (back) to 1 (front)
          const scale = 0.84 + normalizedDepth * 0.28; // 0.84 to 1.12
          const opacity = 0.82 + normalizedDepth * 0.18; // 0.82 to 1
          const zIndex = Math.round(normalizedDepth * 100) + 10;

          const isItemHovered = hoveredIndex === index;

          return (
            <div
              key={item.id || index}
              className={`orbit-item-wrap ${isItemHovered ? 'is-active-hover' : ''}`}
              style={{
                transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${isItemHovered ? scale * 1.15 : scale})`,
                opacity: isItemHovered ? 1 : opacity,
                zIndex: isItemHovered ? 200 : zIndex,
                width: `${itemSize}px`,
                height: `${itemSize}px`
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onItemClick && onItemClick(item, index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onItemClick) onItemClick(item, index);
              }}
            >
              <div className="orbit-thumbnail-frame">
                <img
                  src={item.image}
                  alt={item.title || item.alt || `Donation item ${index + 1}`}
                  className="orbit-thumbnail-img"
                />
                <div className="orbit-thumb-glare" />
              </div>

              {/* Floating Tooltip Pill */}
              {item.title && (
                <div className={`orbit-tooltip-tag ${isItemHovered ? 'tooltip-visible' : ''}`}>
                  {item.icon && <span className="tooltip-icon">{item.icon}</span>}
                  <span className="tooltip-text">{item.title}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrbitImages;
