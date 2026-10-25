import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QualityDetails } from '../components/QualityDetails';
import type { EvaluationResponse } from '../types/api';

const mockEvaluation: EvaluationResponse = {
  deliveryDateFrom: '2026-01-01',
  deliveryDateTo: '2026-01-31',
  cutoffTimeUtc: '12:00:00',
  expectedTotalIntervals: 744,
  overallMetrics: {
    expectedIntervals: 744,
    validPairs: 740,
    coveragePercentage: 99.46,
    mae: 2017.92,
    rmse: 2477.04,
    me: 1806.23,
  },
  dailySummaries: [],
};

describe('QualityDetails Component', () => {
  it('renders null when evaluation is null', () => {
    const { container } = render(<QualityDetails evaluation={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders data availability metrics and coverage disclaimer', () => {
    render(<QualityDetails evaluation={mockEvaluation} />);
    expect(screen.getByText('Data Availability Breakdown')).toBeInTheDocument();
    expect(screen.getByText('744 hours')).toBeInTheDocument();
    expect(screen.getByText('740 hours')).toBeInTheDocument();
    expect(screen.getByText('4 hours')).toBeInTheDocument(); // 744 - 740
    expect(screen.getByText('99.46%')).toBeInTheDocument();
    expect(screen.getByText(/Data availability only; does not reflect forecast accuracy/i)).toBeInTheDocument();
  });

  it('renders operational assumptions and Elexon dataset rules', () => {
    render(<QualityDetails evaluation={mockEvaluation} />);
    expect(screen.getByText('Operational Assumptions & Rules')).toBeInTheDocument();
    expect(screen.getByText('1 Jan 2026 – 31 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('12:00 UTC on D−1 (day before delivery)')).toBeInTheDocument();
    expect(screen.getByText('Data Integrity Guarantee')).toBeInTheDocument();
    expect(screen.getByText(/Elexon FUELHH \(filtered to fuelType = WIND\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Elexon WINDFOR \(hourly national forecast\)/i)).toBeInTheDocument();
  });

  it('renders scope and procurement notice disclaimer', () => {
    render(<QualityDetails evaluation={mockEvaluation} />);
    expect(screen.getByText('Scope & Procurement Notice')).toBeInTheDocument();
    expect(screen.getByText('No purchasing recommendations')).toBeInTheDocument();
    expect(screen.getByText(/Electricity prices, consumer demand, and other fuel generation are strictly outside data scope/i)).toBeInTheDocument();
    expect(screen.getByText(/assessment assumption, not an operational trading policy/i)).toBeInTheDocument();
  });
});
