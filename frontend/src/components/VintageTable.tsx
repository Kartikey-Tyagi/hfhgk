import { useState } from 'react';
import { ShieldCheck, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AlignedEvaluationInterval } from '../types/api';
import {
  formatUkLocalInterval,
  formatUtcInterval,
  formatPublicationTimestamp,
  formatCutoffShort,
} from '../utils/formatters';

interface VintageTableProps {
  intervals: AlignedEvaluationInterval[];
  cutoffTimeUtc: string;
}

export const VintageTable: React.FC<VintageTableProps> = ({ intervals, cutoffTimeUtc }) => {
  const [filterText, setFilterText] = useState('');
  const [showOnlyGaps, setShowOnlyGaps] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 24; // 1 delivery day (24 hours) per page

  const filtered = intervals.filter((itv) => {
    if (showOnlyGaps && itv.isCovered) return false;
    if (!filterText) return true;
    const search = filterText.toLowerCase();
    const ldnFormatted = formatUkLocalInterval(itv.startTime).toLowerCase();
    const utcFormatted = formatUtcInterval(itv.startTime).toLowerCase();
    const pubFormatted = itv.forecastPublishTime
      ? formatPublicationTimestamp(itv.forecastPublishTime).toLowerCase()
      : '';
    return (
      itv.settlementDate.toLowerCase().includes(search) ||
      ldnFormatted.includes(search) ||
      utcFormatted.includes(search) ||
      pubFormatted.includes(search)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentIntervals = filtered.slice((page - 1) * pageSize, page * pageSize);

  const formatMw = (val: number | null): string => {
    if (val === null) return '—';
    return val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  return (
    <div>
      {/* Table Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search date or time..."
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setPage(1);
              }}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.85rem 0.45rem 2.2rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
                minWidth: '220px',
              }}
            />
            <Search
              size={14}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showOnlyGaps}
              onChange={(e) => {
                setShowOnlyGaps(e.target.checked);
                setPage(1);
              }}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span>Show missing/gap intervals only</span>
          </label>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Showing <strong>{filtered.length}</strong> of {intervals.length} hourly intervals
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Delivery Interval (London)</th>
              <th>Delivery (UTC)</th>
              <th style={{ textAlign: 'right' }}>Forecast (MW)</th>
              <th style={{ textAlign: 'right' }}>Actual Outturn (MW)</th>
              <th style={{ textAlign: 'right' }}>Error (Fc - Act)</th>
              <th>Selected Forecast Published At</th>
              <th>Cutoff Compliance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentIntervals.map((itv) => {
              const isGap = !itv.isCovered;
              return (
                <tr key={itv.startTime} className={isGap ? 'gap-row' : ''}>
                  <td>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatUkLocalInterval(itv.startTime)}</strong>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatUtcInterval(itv.startTime)}</td>
                  <td style={{ textAlign: 'right', color: itv.forecastGeneration !== null ? '#2563eb' : 'var(--text-muted)', fontWeight: 600 }}>
                    {formatMw(itv.forecastGeneration)}
                  </td>
                  <td style={{ textAlign: 'right', color: itv.actualGeneration !== null ? '#059669' : 'var(--text-muted)', fontWeight: 600 }}>
                    {formatMw(itv.actualGeneration)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      color:
                        itv.error === null
                          ? 'var(--text-muted)'
                          : itv.error > 0
                          ? '#d97706'
                          : itv.error < 0
                          ? '#7c3aed'
                          : 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    {itv.error !== null
                      ? `${itv.error > 0 ? '+' : ''}${itv.error.toFixed(1)} MW`
                      : '—'}
                  </td>
                  <td>
                    {itv.forecastPublishTime ? (
                      <span title={`Raw publishTime UTC: ${itv.forecastPublishTime}`} style={{ color: 'var(--text-secondary)' }}>
                        {formatPublicationTimestamp(itv.forecastPublishTime)}
                      </span>
                    ) : (
                      <span style={{ color: '#dc2626' }}>No vintage published before cutoff</span>
                    )}
                  </td>
                  <td>
                    {itv.forecastPublishTime ? (
                      <span className="status-pill compliant" title={`Selected forecast published prior to cutoff ${formatCutoffShort(cutoffTimeUtc)}`}>
                        <ShieldCheck size={12} /> Eligible (≤ Cutoff)
                      </span>
                    ) : (
                      <span className="status-pill missing">
                        <AlertCircle size={12} /> No Eligible Run
                      </span>
                    )}
                  </td>
                  <td>
                    {itv.isCovered ? (
                      <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>Valid Pair</span>
                    ) : itv.actualGeneration === null ? (
                      <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>Missing Actual</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>Missing Forecast</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            className="preset-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="preset-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
