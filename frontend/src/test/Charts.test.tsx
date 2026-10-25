import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ForecastChart } from '../components/ForecastChart';
import { ErrorChart } from '../components/ErrorChart';
import { AlignedEvaluationInterval } from '../types/api';

describe('Charts Components', () => {
  const sampleIntervals: AlignedEvaluationInterval[] = [
    {
      startTime: '2026-01-01T00:00:00Z',
      startTimeLondon: '2026-01-01 00:00 GMT',
      settlementDate: '2026-01-01',
      hour: 0,
      forecastGeneration: 10000.0,
      actualGeneration: 9500.0,
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
      forecastGeneration: null, // missing gap
      actualGeneration: 9800.0,
      forecastPublishTime: null,
      forecastPublishTimeLondon: null,
      error: null,
      isCovered: false,
    },
    {
      startTime: '2026-01-01T02:00:00Z',
      startTimeLondon: '2026-01-01 02:00 GMT',
      settlementDate: '2026-01-01',
      hour: 2,
      forecastGeneration: 11000.0,
      actualGeneration: 11200.0,
      forecastPublishTime: '2025-12-31T11:30:00Z',
      forecastPublishTimeLondon: '2025-12-31 11:30 GMT',
      error: -200.0,
      isCovered: true,
    },
  ];

  it('renders ForecastChart with SVG, legend, and formatted axis ticks', () => {
    render(<ForecastChart intervals={sampleIntervals} />);

    expect(
      screen.getByText(/Actual Wind Generation \(FUELHH average MW\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Eligible Forecast \(WINDFOR latest MW\)/i)
    ).toBeInTheDocument();

    const svg = screen.getByRole('img', {
      name: /Wind Generation Forecast vs Actual Time Series Chart/i,
    });
    expect(svg).toBeInTheDocument();

    // Verify axis ticks are formatted
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('renders ForecastChart empty state when intervals are empty', () => {
    render(<ForecastChart intervals={[]} />);
    expect(
      screen.getByText(/No evaluation intervals available/i)
    ).toBeInTheDocument();
  });

  it('renders ErrorChart with zero reference line, legend, and formatted axis ticks', () => {
    render(<ErrorChart intervals={sampleIntervals} />);

    expect(screen.getByText(/Over-forecasting \(Error > 0 MW\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Under-forecasting \(Error < 0 MW\)/i)).toBeInTheDocument();

    const svg = screen.getByRole('img', {
      name: /Forecast Error Residuals Time Series Chart/i,
    });
    expect(svg).toBeInTheDocument();

    // Verify axis ticks are formatted
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});

