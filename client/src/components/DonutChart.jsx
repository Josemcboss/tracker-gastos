import './DonutChart.css';

export default function DonutChart({ data, total, size = 200, strokeWidth = 30 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build segments
  let cumulativeLength = 0;
  const segments = data.map((item) => {
    const percentage = total > 0 ? item.total / total : 0;
    const segmentLength = circumference * percentage;
    const offset = cumulativeLength;
    cumulativeLength += segmentLength;
    return { ...item, segmentLength, offset, percentage };
  });

  const formattedTotal = total.toLocaleString('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <div className="donut-container">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="donut-svg"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth - 4}
        />

        {/* Data segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.segmentLength} ${circumference - seg.segmentLength}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${center} ${center})`}
            className="donut-segment"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </svg>

      {/* Center label */}
      <div className="donut-center">
        <span className="donut-amount">{formattedTotal}</span>
        <span className="donut-label">Total</span>
      </div>
    </div>
  );
}
