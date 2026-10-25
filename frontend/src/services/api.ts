/**
 * Dedicated API service layer for Wind Forecast Intelligence.
 */

import type { EvaluationQueryParams, EvaluationResponse, HealthResponse } from '../types/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Check backend health and default configuration.
 */
export async function checkHealth(): Promise<HealthResponse> {
  const url = `${API_BASE}/api/health`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new ApiError(`Health check failed with status ${res.status}`, res.status);
    }
    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(`Unable to connect to backend service at ${url}: ${err.message || err}`, 0);
  }
}

/**
 * Fetch forecast evaluation for the given date range and cutoff.
 */
export async function fetchEvaluation(params: EvaluationQueryParams): Promise<EvaluationResponse> {
  const query = new URLSearchParams({
    deliveryDateFrom: params.deliveryDateFrom,
    deliveryDateTo: params.deliveryDateTo,
    cutoffTimeUtc: params.cutoffTimeUtc,
  });

  const url = `${API_BASE}/api/evaluation?${query.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          errorDetail = errorJson.detail;
        }
      } catch {
        const text = await res.text();
        if (text) errorDetail = text;
      }
      throw new ApiError(errorDetail, res.status);
    }

    const data: EvaluationResponse = await res.json();
    return data;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(`Network error while fetching evaluation: ${err.message || err}`, 0);
  }
}
