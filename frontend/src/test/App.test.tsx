import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import * as api from '../services/api';
import { EvaluationResponse, HealthResponse } from '../types/api';

vi.mock('../services/api');

describe('App Integration Component', () => {
  const mockHealth: HealthResponse = {
    status: 'ok',
    service: 'Wind Forecast Intelligence API',
    defaultCutoffTimeUtc: '12:00:00',
    internalTimezone: 'UTC',
    userFacingTimezone: 'Europe/London',
  };

  const mockEvaluation: EvaluationResponse = {
    deliveryDateFrom: '2026-01-01',
    deliveryDateTo: '2026-01-01',
    cutoffTimeUtc: '12:00:00',
    expectedTotalIntervals: 24,
    overallMetrics: {
      expectedIntervals: 24,
      validPairs: 24,
      coveragePercentage: 100.0,
      mae: 500.0,
      rmse: 600.0,
      me: 350.0,
    },
    dailySummaries: [
      {
        deliveryDate: '2026-01-01',
        cutoffTimeUtc: '12:00:00',
        metrics: {
          expectedIntervals: 24,
          validPairs: 24,
          coveragePercentage: 100.0,
          mae: 500.0,
          rmse: 600.0,
          me: 350.0,
        },
        intervals: [
          {
            startTime: '2026-01-01T00:00:00Z',
            startTimeLondon: '2026-01-01 00:00 GMT',
            settlementDate: '2026-01-01',
            hour: 0,
            forecastGeneration: 10500.0,
            actualGeneration: 10000.0,
            forecastPublishTime: '2025-12-31T11:30:00Z',
            forecastPublishTimeLondon: '2025-12-31 11:30 GMT',
            error: 500.0,
            isCovered: true,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.checkHealth).mockResolvedValue(mockHealth);
  });

  it('renders application header and displays live evaluation data on success', async () => {
    vi.mocked(api.fetchEvaluation).mockResolvedValue(mockEvaluation);

    render(<App />);

    expect(screen.getByText('Wind Forecast Intelligence')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Elexon BMRS Ready')).toBeInTheDocument();
      expect(screen.getByText('500.0')).toBeInTheDocument();
      expect(screen.getByText('600.0')).toBeInTheDocument();
      expect(screen.getByText('+350.0')).toBeInTheDocument();
      expect(screen.getByText(/Over-forecasting on average/i)).toBeInTheDocument();
      expect(screen.getByText(/Complete Data Availability/i)).toBeInTheDocument();
    });
  });

  it('displays error banner when evaluation request fails', async () => {
    vi.mocked(api.fetchEvaluation).mockRejectedValue(
      new Error('Failed to retrieve forecast evaluation from backend.')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Evaluation Request Failed')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to retrieve forecast evaluation from backend.')
      ).toBeInTheDocument();
    });
  });
});
