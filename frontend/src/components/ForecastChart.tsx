import { useState } from 'react';
import type { AlignedEvaluationInterval } from '../types/api';
import { formatUkLocalInterval, formatChartAxisTick } from '../utils/formatters';

interface ForecastChartProps {
  intervals: AlignedEvaluationInterval[];
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ intervals }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!intervals || intervals.length === 0) {
    return (
      <div className="state-container">
        <p>No evaluation intervals available for the selected date range.</p>
      </div>
    );
  }

  // Dimensions
  const width = 1000;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 75 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Determine Y domain (MW)
  const validGenerations: number[] = [];
  intervals.forEach((itv) => {
    if (itv.actualGeneration !== null) validGenerations.push(itv.actualGeneration);
    if (itv.forecastGeneration !== null) validGenerations.push(itv.forecastGeneration);
  });

  const maxGen = validGenerations.length > 0 ? Math.max(...validGenerations) : 10000;
  const yMax = Math.ceil((maxGen * 1.1) / 2000) * 2000; // rounded up to nearest 2,000 MW with headroom
  const yMin = 0;

  const n = intervals.length;
  const getX = (idx: number) => padding.left + (idx / Math.max(n - 1, 1)) * chartW;
  const getY = (val: number | null) => {
    if (val === null) return null;
    return padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
  };

  // Build SVG path segments with gaps for null values
  const buildDisjointPath = (accessor: (d: AlignedEvaluationInterval) => number | null) => {
    const paths: string[] = [];
    let currentSegment: string[] = [];

    intervals.forEach((itv, idx) => {
      const val = accessor(itv);
      const x = getX(idx);
      const y = getY(val);

      if (y !== null) {
        if (currentSegment.length === 0) {
          currentSegment.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
        } else {
          currentSegment.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
      } else {
        if (currentSegment.length > 0) {
          paths.push(currentSegment.join(' '));
          currentSegment = [];
        }
      }
    });

    if (currentSegment.length > 0) {
      paths.push(currentSegment.join(' '));
    }

    return paths;
  };

  const actualPaths = buildDisjointPath((d) => d.actualGeneration);
  const forecastPaths = buildDisjointPath((d) => d.forecastGeneration);

  // Grid tick intervals (5 evenly spaced ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((pct) => Math.round(yMin + pct * (yMax - yMin)));

  // X-axis ticks (sample 7 to 9 readable labels across horizon)
  const step = Math.max(1, Math.floor(n / 7));
  const xTicks = intervals.filter((_, idx) => idx % step === 0 || idx === n - 1);

  const hoveredItem = hoverIndex !== null ? intervals[hoverIndex] : null;

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-swatch actual" style={{ backgroundColor: '#059669' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Actual Wind Generation (FUELHH average MW)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch forecast" style={{ backgroundColor: '#2563eb' }} />
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Eligible Forecast (WINDFOR latest MW)</span>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          Horizon: <strong>{n} hours</strong> | Peak Outturn: <strong>{maxGen.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW</strong>
        </div>
      </div>

      <svg
        className="svg-chart"
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Wind Generation Forecast vs Actual Time Series Chart"
      >
        {/* Y Axis Gridlines & Labels */}
        {yTicks.map((tickVal) => {
          const y = getY(tickVal)!;
          return (
            <g key={tickVal}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 12}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#64748b"
                fontFamily="var(--font-mono)"
                fontWeight={500}
              >
                {tickVal.toLocaleString()} MW
              </text>
            </g>
          );
        })}

        {/* X Axis Baseline */}
        <line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={width - padding.right}
          y2={padding.top + chartH}
          stroke="#cbd5e1"
          strokeWidth={1.5}
        />

        {/* X Axis Labels */}
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

        {/* Actual Lines (Emerald #059669) */}
        {actualPaths.map((p, idx) => (
          <path
            key={`act-${idx}`}
            d={p}
            fill="none"
            stroke="#059669"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Forecast Lines (Blue #2563eb) */}
        {forecastPaths.map((p, idx) => (
          <path
            key={`fc-${idx}`}
            d={p}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Interactive Vertical Hover Crosshair */}
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

        {/* Interactive Hover Hit Zones */}
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

      {/* Floating Hover Tooltip (High-Contrast Floating Dark Slate Surface) */}
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
            <span style={{ color: '#93c5fd' }}>Forecast (WINDFOR):</span>
            <strong>
              {hoveredItem.forecastGeneration !== null
                ? `${hoveredItem.forecastGeneration.toLocaleString()} MW`
                : 'Missing'}
            </strong>
          </div>
          <div className="tooltip-row">
            <span style={{ color: '#6ee7b7' }}>Actual (FUELHH):</span>
            <strong>
              {hoveredItem.actualGeneration !== null
                ? `${hoveredItem.actualGeneration.toLocaleString()} MW`
                : 'Missing'}
            </strong>
          </div>
          <div className="tooltip-row">
            <span style={{ color: '#cbd5e1' }}>Error (Fc - Act):</span>
            <strong
              style={{
                color:
                  hoveredItem.error === null
                    ? '#94a3b8'
                    : hoveredItem.error > 0
                    ? '#fbbf24'
                    : hoveredItem.error < 0
                    ? '#c084fc'
                    : '#ffffff',
              }}
            >
              {hoveredItem.error !== null
                ? `${hoveredItem.error > 0 ? '+' : ''}${hoveredItem.error.toLocaleString()} MW`
                : 'N/A'}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};
