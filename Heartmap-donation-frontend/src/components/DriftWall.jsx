import React, { useState } from 'react';
import './DriftWall.css';

const DriftWall = ({
  stories = [],
  onSelectStory = null,
  columns = 4,
  speed = 40,
  tilt = 12,
  turn = -8,
  perspective = 1200,
  pauseOnHover = true
}) => {
  const [hoveredStoryId, setHoveredStoryId] = useState(null);

  // Distribute stories into columns
  const columnData = Array.from({ length: columns }, () => []);
  stories.forEach((story, index) => {
    columnData[index % columns].push(story);
  });

  // Staggered speed variations for each column
  const columnSpeeds = [speed, speed * 1.15, speed * 0.9, speed * 1.1, speed * 0.95];
  const columnDirections = ['up', 'down', 'up', 'down', 'up'];

  return (
    <div className="drift-wall-wrapper">
      {/* Top & Bottom seamless gradient masks */}
      <div className="drift-wall-vignette-top" />
      <div className="drift-wall-vignette-bottom" />

      {/* Perspective Stage */}
      <div
        className="drift-wall-stage"
        style={{
          perspective: `${perspective}px`
        }}
      >
        <div
          className="drift-wall-canvas"
          style={{
            transform: `rotateX(${tilt}deg) rotateY(${turn}deg)`
          }}
        >
          {columnData.map((colStories, colIdx) => {
            // Need at least 2 duplicates for infinite vertical seamless loop
            const duplicatedStories = [...colStories, ...colStories, ...colStories];
            const colSpeed = columnSpeeds[colIdx % columnSpeeds.length];
            const direction = columnDirections[colIdx % columnDirections.length];

            return (
              <div
                key={`col-${colIdx}`}
                className={`drift-column drift-dir-${direction}`}
                style={{
                  '--col-duration': `${colSpeed}s`,
                  '--col-pause': pauseOnHover ? 'paused' : 'running'
                }}
              >
                {duplicatedStories.map((story, itemIdx) => {
                  const uniqueKey = `${story.id}-col${colIdx}-idx${itemIdx}`;
                  const isHovered = hoveredStoryId === uniqueKey;

                  return (
                    <article
                      key={uniqueKey}
                      className={`drift-card ${isHovered ? 'is-hovered' : ''}`}
                      onMouseEnter={() => setHoveredStoryId(uniqueKey)}
                      onMouseLeave={() => setHoveredStoryId(null)}
                      onClick={() => onSelectStory && onSelectStory(story)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && onSelectStory) onSelectStory(story);
                      }}
                      aria-label={`Story: ${story.title} in ${story.location}`}
                    >
                      <div className="drift-card-image-box">
                        <img
                          src={story.image}
                          alt={story.title}
                          className="drift-card-photo"
                          loading="lazy"
                        />
                        <div className="drift-card-gradient-veil" />
                      </div>

                      {/* Header tags */}
                      <div className="drift-card-header">
                        <span className="drift-cat-tag">
                          {story.categoryIcon && <span>{story.categoryIcon}</span>}
                          <span>{story.category}</span>
                        </span>
                        {story.verified && (
                          <span className="drift-verified-dot" title="Verified community initiative">✓</span>
                        )}
                      </div>

                      {/* Bottom story teaser */}
                      <div className="drift-card-info">
                        <span className="drift-location-pin">⌖ {story.location}</span>
                        <h4 className="drift-card-title">{story.title}</h4>
                        <p className="drift-card-snippet">{story.shortDescription}</p>

                        <div className="drift-card-action">
                          <span>View Story</span>
                          <span className="drift-arrow">↗</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DriftWall;
