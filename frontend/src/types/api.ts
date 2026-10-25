/**
 * TypeScript types matching backend FastAPI & Pydantic schemas.
 */

export interface HealthResponse {
  status: string;
  service: string;
  defaultCutoffTimeUtc: string;
  internalTimezone: string;
  userFacingTimezone: string;
}

export interface AlignedEvaluationInterval {
  startTime: string; // UTC ISO string
  startTimeLondon: string; // e.g., '2026-01-01 12:00 GMT'
  settlementDate: string; // 'YYYY-MM-DD'
  hour: number; // 0..23
  forecastGeneration: number | null;
  actualGeneration: number | null;
  forecastPublishTime: string | null;
  forecastPublishTimeLondon: string | null;
  error: number | null; // forecast - actual
  isCovered: boolean; // true only if both forecast and actual are valid numbers
}

export interface EvaluationMetrics {
  expectedIntervals: number;
  validPairs: number;
  coveragePercentage: number;
  mae: number | null; // Mean Absolute Error in MW
  rmse: number | null; // Root Mean Squared Error in MW
  me: number | null; // Mean Error in MW (forecast - actual; >0 means over-forecasting)
}

export interface DailyEvaluationSummary {
  deliveryDate: string;
  cutoffTimeUtc: string;
  metrics: EvaluationMetrics;
  intervals: AlignedEvaluationInterval[];
}

export interface EvaluationResponse {
  deliveryDateFrom: string;
  deliveryDateTo: string;
  cutoffTimeUtc: string;
  expectedTotalIntervals: number;
  overallMetrics: EvaluationMetrics;
  dailySummaries: DailyEvaluationSummary[];
}

export interface EvaluationQueryParams {
  deliveryDateFrom: string;
  deliveryDateTo: string;
  cutoffTimeUtc: string;
}
