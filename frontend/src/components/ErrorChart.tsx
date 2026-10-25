import { useState } from 'react';
import type { AlignedEvaluationInterval } from '../types/api';
import { formatUkLocalInterval, formatChartAxisTick } from '../utils/formatters';

interface ErrorChartProps {
  intervals: AlignedEvaluationInterval[];
}

export const ErrorChart: React.FC<ErrorChartProps> = ({ intervals }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!intervals || intervals.length === 0) {
    return (
      <div className="state-container">
        <p>No evaluation intervals available to compute errors.</p>
      </div>
    );
  }

  // Dimensions
  const width = 1000;
  const height = 370;
  const padding = { top: 30, right: 30, bottom: 50, left: 75 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Extract valid errors
  const validErrors: number[] = [];
  intervals.forEach((itv) => {
    if (itv.error !== null) validErrors.push(itv.error);
  });

  const maxAbsError = validErrors.length > 0 ? Math.max(...validErrors.map(Math.abs)) : 5000;
  const yLimit = Math.ceil((maxAbsError * 1.15) / 1000) * 1000;
  const yMax = yLimit;
  const yMin = -yLimit;

  const n = intervals.length;
  const getX = (idx: number) => padding.left + (idx / Math.max(n - 1, 1)) * chartW;
  const getY = (val: number | null) => {
    if (val === null) return null;
    return padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
  };

  const zeroY = getY(0)!;

  // Build error paths (disjoint lines)
  const buildErrorPaths = () => {
    const segments: string[] = [];
    let current: string[] = [];

    intervals.forEach((itv, idx) => {
      const err = itv.error;
      const x = getX(idx);
      const y = getY(err);

      if (y !== null) {
        if (current.length === 0) {
          current.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
        } else {
          current.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
      } else {
        if (current.length > 0) {
          segments.push(current.join(' '));
          current = [];
        }
      }
    });

    if (current.length > 0) segments.push(current.join(' '));
    return segments;
  };

  const errorPaths = buildErrorPaths();

  // Summary statistics for display
  const maxOver = validErrors.length > 0 ? Math.max(0, ...validErrors) : 0;
  const maxUnder = validErrors.length > 0 ? Math.min(0, ...validErrors) : 0;
  const overCount = validErrors.filter((e) => e > 0).length;
  const underCount = validErrors.filter((e) => e < 0).length;

  const hoveredItem = hoverIndex !== null ? intervals[hoverIndex] : null;

  // Y-axis ticks (-limit, -limit/2, 0, limit/2, limit)
  const yTicks = [-yLimit, -yLimit / 2, 0, yLimit / 2, yLimit];

  const step = Math.max(1, Math.floor(n / 7));
  const xTicks = intervals.filter((_, idx) => idx % step === 0 || idx === n - 1);

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-swatch error-over" style={{ backgroundColor: '#d97706' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Over-forecasting (Error &gt; 0 MW)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch error-under" style={{ backgroundColor: '#7c3aed' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Under-forecasting (Error &lt; 0 MW)</span>
          </div>
        </div>

        {/* Quick Summary Pill */}
        <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          <span>
            Max Over: <strong style={{ color: '#d97706' }}>+{maxOver.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW</strong>
          </span>
          <span>
            Max Under: <strong style={{ color: '#7c3aed' }}>{maxUnder.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW</strong>
          </span>
          <span>
            Split: <strong style={{ color: '#0f172a' }}>{overCount} over / {underCount} under</strong> ({n} hrs)
          </span>
        </div>
      </div>

      <svg
        className="svg-chart"
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Forecast Error Residuals Time Series Chart"
      >
        {/* Y Gridlines */}
        {yTicks.map((tickVal) => {
          const y = getY(tickVal)!;
          const isZero = tickVal === 0;
          return (
            <g key={tickVal}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={isZero ? '#64748b' : '#e2e8f0'}
                strokeWidth={isZero ? 1.75 : 1}
                strokeDasharray={isZero ? undefined : '4 4'}
              />
              <text
                x={padding.left - 12}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill={isZero ? '#0f172a' : '#64748b'}
                fontWeight={isZero ? 700 : 500}
                fontFamily="var(--font-mono)"
              >
                {tickVal > 0 ? `+${tickVal.toLocaleString()}` : tickVal.toLocaleString()} MW
              </text>
            </g>
          );
        })}

        {/* X Ticks */}
        {xTicks.map((itv) => {
          const originalIdx = intervals.indexOf(itv);
          const x = getX(originalIdx);
          const label = formatChartAxisTick(itv.settlementDate, itv.hour, n);

          return (
            <g key={itv.startTime}>
              <line
                x1={x}
                y1={padding.top + chartH}
                x2={x}
                y2={padding.top + chartH + 5}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
              <text
                x={x}
                y={padding.top + chartH + 20}
                textAnchor="middle"
                fontSize={10.5}
                fill="#64748b"
                fontFamily="var(--font-mono)"
                fontWeight={500}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Error Bars */}
        {intervals.map((itv, idx) => {
          if (itv.error === null) return null;
          const x = getX(idx);
          const y = getY(itv.error)!;
          const color = itv.error >= 0 ? '#d97706' : '#7c3aed';
          const barW = Math.max(2, Math.min(6, chartW / n - 2));

          return (
            <rect
              key={`err-bar-${idx}`}
              x={x - barW / 2}
              y={Math.min(y, zeroY)}
              width={barW}
              height={Math.max(1.5, Math.abs(y - zeroY))}
              fill={color}
              opacity={0.88}
              rx={1}
            />
          );
        })}

        {/* Error Line connecting points */}
        {errorPaths.map((p, idx) => (
          <path
            key={`err-line-${idx}`}
            d={p}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        ))}

        {/* Crosshair */}
        {hoverIndex !== null && (
          <line
            x1={getX(hoverIndex)}
            y1={padding.top}
            x2={getX(hoverIndex)}
            y2={padding.top + chartH}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}

        {/* Interactive Hit Zones */}
        {intervals.map((_, idx) => {
          const x = getX(idx);
          const colW = chartW / Math.max(n, 1);
          return (
            <rect
              key={idx}
              x={x - colW / 2}
              y={padding.top}
              width={colW}
              height={chartH}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHoverIndex(idx)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredItem && hoverIndex !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(getX(hoverIndex) / width) * 100}%`,
            top: `${(padding.top / height) * 100}%`,
            zIndex: 99999,
          }}
        >
          <div className="tooltip-time">{formatUkLocalInterval(hoveredItem.startTime)}</div>
          <div className="tooltip-row">
            <span style={{ color: '#cbd5e1' }}>Residual Error:</span>
            <strong
              style={{
                color:
                  hoveredItem.error === null
                    ? '#94a3b8'
                    : hoveredItem.error > 0
                    ? '#fde68a'
                    : hoveredItem.error < 0
                    ? '#ddd6fe'
                    : '#ffffff',
              }}
            >
              {hoveredItem.error !== null
                ? `${hoveredItem.error > 0 ? '+' : ''}${hoveredItem.error.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW`
                : 'Missing (N/A)'}
            </strong>
          </div>
          <div className="tooltip-row">
            <span style={{ color: '#94a3b8' }}>Direction:</span>
            <span style={{ fontWeight: 600, color: hoveredItem.error && hoveredItem.error > 0 ? '#fde68a' : hoveredItem.error && hoveredItem.error < 0 ? '#ddd6fe' : '#ffffff' }}>
              {hoveredItem.error === null
                ? 'N/A'
                : hoveredItem.error > 0
                ? 'Over-forecast (Fc > Act)'
                : hoveredItem.error < 0
                ? 'Under-forecast (Fc < Act)'
                : 'Exact match (0 MW)'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
