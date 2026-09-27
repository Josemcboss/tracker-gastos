import { useState } from 'react';
import './DonutChart.css';

export default function DonutChart({
  data = [],
  total = 0,
  size = 220,
  strokeWidth = 32,
  activeIndex = null,
  onActiveChange,
}) {
  const [internalHoverIndex, setInternalHoverIndex] = useState(null);

  // Controlled or internal active index
  const hoveredIndex = activeIndex !== undefined && activeIndex !== null
    ? activeIndex
    : internalHoverIndex;

  const handleHover = (idx) => {
    setInternalHoverIndex(idx);
    if (onActiveChange) onActiveChange(idx);
  };

  const handleLeave = () => {
    setInternalHoverIndex(null);
    if (onActiveChange) onActiveChange(null);
  };

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build segments
  let cumulativeLength = 0;
  const segments = data.map((item, idx) => {
    const percentage = total > 0 ? item.total / total : 0;
    const segmentLength = circumference * percentage;
    const offset = cumulativeLength;
    cumulativeLength += segmentLength;
    return { ...item, index: idx, segmentLength, offset, percentage };
  });

  const activeSegment = hoveredIndex !== null && segments[hoveredIndex] ? segments[hoveredIndex] : null;

  const formattedTotal = total.toLocaleString('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const formattedActiveAmount = activeSegment
    ? activeSegment.total.toLocaleString('es-DO', {
        style: 'currency',
        currency: 'DOP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    : formattedTotal;

  return (
    <div className="donut-container">
      {/* Floating Tooltip Pill */}
      <div className={`donut-tooltip ${activeSegment ? 'visible' : ''}`}>
        {activeSegment && (
          <>
            <span className="donut-tooltip-dot" style={{ backgroundColor: activeSegment.color }} />
            <span className="donut-tooltip-name">{activeSegment.name}</span>
            <span className="donut-tooltip-pct">{(activeSegment.percentage * 100).toFixed(1)}%</span>
          </>
        )}
      </div>

      <div className="donut-svg-wrapper">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="donut-svg"
          onMouseLeave={handleLeave}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth={strokeWidth - 6}
            opacity="0.3"
          />

          {/* Data segments */}
          {segments.map((seg, i) => {
            const isHovered = hoveredIndex === i;
            const isAnyHovered = hoveredIndex !== null;
            const currentStroke = isHovered ? strokeWidth + 6 : (isAnyHovered ? strokeWidth - 2 : strokeWidth);

            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={currentStroke}
                strokeDasharray={`${seg.segmentLength} ${circumference - seg.segmentLength}`}
                strokeDashoffset={-seg.offset}
                transform={`rotate(-90 ${center} ${center})`}
                className={`donut-segment ${isHovered ? 'active' : ''}`}
                style={{
                  animationDelay: `${i * 80}ms`,
                  opacity: isAnyHovered ? (isHovered ? 1 : 0.35) : 1,
                  cursor: 'pointer',
                  filter: isHovered ? `drop-shadow(0 0 10px ${seg.color}99)` : 'none',
                }}
                onMouseEnter={() => handleHover(i)}
                onTouchStart={() => handleHover(hoveredIndex === i ? null : i)}
                onClick={() => handleHover(hoveredIndex === i ? null : i)}
              />
            );
          })}
        </svg>

        {/* Center label with smooth transition */}
        <div
          className={`donut-center ${activeSegment ? 'hover-active' : ''}`}
          onClick={handleLeave}
          style={{ cursor: activeSegment ? 'pointer' : 'default' }}
        >
          <span
            className="donut-amount"
            style={{ color: activeSegment ? activeSegment.color : 'var(--text-primary)' }}
          >
            {formattedActiveAmount}
          </span>
          <span className="donut-label">
            {activeSegment ? activeSegment.name : 'Total'}
          </span>
        </div>
      </div>
    </div>
  );
}
