import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricCards } from '../components/MetricCards';
import { EvaluationMetrics } from '../types/api';

describe('MetricCards Component', () => {
  it('renders metric cards with valid numbers correctly', () => {
    const metrics: EvaluationMetrics = {
      expectedIntervals: 744,
      validPairs: 744,
      coveragePercentage: 100.0,
      mae: 2017.9,
      rmse: 2477.0,
      me: 1806.2,
    };

    render(<MetricCards metrics={metrics} isLoading={false} />);

    expect(screen.getByText('2,017.9')).toBeInTheDocument();
    expect(screen.getByText('2,477.0')).toBeInTheDocument();
    expect(screen.getByText('+1,806.2')).toBeInTheDocument();
    expect(screen.getByText('744 of 744 hours')).toBeInTheDocument();
    expect(screen.getByText(/Average absolute forecast error, ignoring direction/i)).toBeInTheDocument();
    expect(screen.getByText(/penalizing larger errors more heavily than MAE/i)).toBeInTheDocument();
  });

  it('renders N/A for null values and never substitutes zero', () => {
    const metrics: EvaluationMetrics = {
      expectedIntervals: 24,
      validPairs: 0,
      coveragePercentage: 0.0,
      mae: null,
      rmse: null,
      me: null,
    };

    render(<MetricCards metrics={metrics} isLoading={false} />);

    const naElements = screen.getAllByText('N/A');
    // MAE, RMSE, and ME should display N/A, NOT 0.0
    expect(naElements.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('0.0 MW')).not.toBeInTheDocument();
  });

  it('displays over-forecasting badge when Mean Error is positive', () => {
    const metrics: EvaluationMetrics = {
      expectedIntervals: 24,
      validPairs: 24,
      coveragePercentage: 100.0,
      mae: 500.0,
      rmse: 600.0,
      me: 350.0,
    };

    render(<MetricCards metrics={metrics} isLoading={false} />);

    expect(screen.getByText('+350.0')).toBeInTheDocument();
    expect(screen.getByText(/Over-forecasting on average/i)).toBeInTheDocument();
  });

  it('displays under-forecasting badge when Mean Error is negative', () => {
    const metrics: EvaluationMetrics = {
      expectedIntervals: 24,
      validPairs: 24,
      coveragePercentage: 100.0,
      mae: 400.0,
      rmse: 500.0,
      me: -250.0,
    };

    render(<MetricCards metrics={metrics} isLoading={false} />);

    expect(screen.getByText('-250.0')).toBeInTheDocument();
    expect(screen.getByText(/Under-forecasting on average/i)).toBeInTheDocument();
  });

  it('displays loading state placeholder', () => {
    render(<MetricCards metrics={null} isLoading={true} />);
    const placeholders = screen.getAllByText('...');
    expect(placeholders.length).toBe(4);
  });
});
