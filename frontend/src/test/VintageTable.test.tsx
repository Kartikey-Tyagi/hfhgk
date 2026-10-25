import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VintageTable } from '../components/VintageTable';
import { AlignedEvaluationInterval } from '../types/api';

describe('VintageTable Component', () => {
  const sampleIntervals: AlignedEvaluationInterval[] = [
    {
      startTime: '2026-01-01T00:00:00Z',
      startTimeLondon: '2026-01-01 00:00 GMT',
      settlementDate: '2026-01-01',
      hour: 0,
      forecastGeneration: 13000.0,
      actualGeneration: 12500.0,
      forecastPublishTime: '2025-12-31T11:30:00Z',
      forecastPublishTimeLondon: '2025-12-31 11:30 GMT',
      error: 500.0,
      isCovered: true,
    },
    {
      startTime: '2026-01-01T01:00:00Z',
      startTimeLondon: '2026-01-01 01:00 GMT',
      settlementDate: '2026-01-01',
      hour: 1,
      forecastGeneration: null,
      actualGeneration: 12800.0,
      forecastPublishTime: null,
      forecastPublishTimeLondon: null,
      error: null,
      isCovered: false, // Gap / missing forecast
    },
  ];

  it('renders table headers and delivery intervals', () => {
    render(<VintageTable intervals={sampleIntervals} cutoffTimeUtc="12:00:00" />);

    expect(screen.getByText('Delivery Interval (London)')).toBeInTheDocument();
    expect(screen.getByText('Delivery (UTC)')).toBeInTheDocument();
    expect(screen.getByText('Selected Forecast Published At')).toBeInTheDocument();
    expect(screen.getByText('1 Jan 2026, 00:00 GMT')).toBeInTheDocument();
    expect(screen.getByText('1 Jan 2026, 01:00 GMT')).toBeInTheDocument();
    expect(screen.getByText('1 Jan 2026, 00:00 UTC')).toBeInTheDocument();
  });

  it('displays forecast vintage publication timestamp and compliance badge', () => {
    render(<VintageTable intervals={sampleIntervals} cutoffTimeUtc="12:00:00" />);

    expect(screen.getByText('31 Dec 2025, 11:30 UTC (11:30 GMT)')).toBeInTheDocument();
    expect(screen.getByText(/Eligible \(≤ Cutoff\)/i)).toBeInTheDocument();
  });

  it('identifies missing intervals and allows filtering for gaps', () => {
    render(<VintageTable intervals={sampleIntervals} cutoffTimeUtc="12:00:00" />);

    expect(screen.getByText(/Missing Forecast/i)).toBeInTheDocument();

    const gapFilter = screen.getByLabelText(/Show missing\/gap intervals only/i);
    fireEvent.click(gapFilter);

    // After filtering for gaps, the valid interval should be hidden
    expect(screen.queryByText('1 Jan 2026, 00:00 GMT')).not.toBeInTheDocument();
    expect(screen.getByText('1 Jan 2026, 01:00 GMT')).toBeInTheDocument();
  });
});
