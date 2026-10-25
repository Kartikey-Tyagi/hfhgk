import { HelpCircle, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle } from 'lucide-react';
import type { EvaluationMetrics } from '../types/api';

interface MetricCardsProps {
  metrics: EvaluationMetrics | null;
  isLoading: boolean;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics, isLoading }) => {
  const formatMw = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return 'N/A';
    return val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const mae = metrics?.mae;
  const rmse = metrics?.rmse;
  const me = metrics?.me;
  const coverage = metrics?.coveragePercentage;
  const validPairs = metrics?.validPairs ?? 0;
  const expected = metrics?.expectedIntervals ?? 0;

  // Mean Error direction badge
  let meBadge = null;
  let meCardClass = 'me-neutral';

  if (me !== null && me !== undefined) {
    if (me > 0) {
      meCardClass = 'me-over';
      meBadge = (
        <span className="metric-badge over" title="Forecast was higher than actual generation on average">
          <ArrowUpRight size={13} /> Over-forecasting on average
        </span>
      );
    } else if (me < 0) {
      meCardClass = 'me-under';
      meBadge = (
        <span className="metric-badge under" title="Forecast was lower than actual generation on average">
          <ArrowDownRight size={13} /> Under-forecasting on average
        </span>
      );
    } else {
      meBadge = (
        <span className="metric-badge neutral">
          Zero bias on average
        </span>
      );
    }
  }

  // Coverage badge
  let coverageBadge = null;
  if (coverage !== null && coverage !== undefined) {
    if (coverage >= 99.0) {
      coverageBadge = (
        <span className="metric-badge coverage-full">
          <CheckCircle2 size={13} /> Complete Data Availability
        </span>
      );
    } else {
      coverageBadge = (
        <span className="metric-badge coverage-partial">
          <AlertCircle size={13} /> Partial Data Coverage
        </span>
      );
    }
  }

  return (
    <div className="metrics-grid">
      {/* 1. MAE Card */}
      <div className="metric-card mae">
        <div>
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-label">Mean Absolute Error</span>
              <span className="metric-abbr">(MAE)</span>
            </div>
            <button
              type="button"
              className="metric-info-btn"
              title="Formula: (1/N) * Σ |forecast - actual|. Measures average magnitude of forecast error without regard to direction."
              aria-label="MAE formula and details"
            >
              <HelpCircle size={14} />
            </button>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{isLoading ? '...' : formatMw(mae)}</span>
            {mae !== null && mae !== undefined && <span className="metric-unit">MW</span>}
          </div>
        </div>
        <p className="metric-description">
          Average absolute forecast error, ignoring direction.
        </p>
      </div>

      {/* 2. RMSE Card */}
      <div className="metric-card rmse">
        <div>
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-label">Root Mean Squared Error</span>
              <span className="metric-abbr">(RMSE)</span>
            </div>
            <button
              type="button"
              className="metric-info-btn"
              title="Formula: sqrt((1/N) * Σ (forecast - actual)²). Quadatrically penalizes larger deviations more heavily."
              aria-label="RMSE formula and details"
            >
              <HelpCircle size={14} />
            </button>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{isLoading ? '...' : formatMw(rmse)}</span>
            {rmse !== null && rmse !== undefined && <span className="metric-unit">MW</span>}
          </div>
        </div>
        <p className="metric-description">
          Measures forecast error while penalizing larger errors more heavily than MAE.
        </p>
      </div>

      {/* 3. ME Card */}
      <div className={`metric-card ${meCardClass}`}>
        <div>
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-label">Mean Error</span>
              <span className="metric-abbr">(ME)</span>
            </div>
            <button
              type="button"
              className="metric-info-btn"
              title="Formula: (1/N) * Σ (forecast - actual). Positive = over-forecasting, negative = under-forecasting."
              aria-label="ME formula and details"
            >
              <HelpCircle size={14} />
            </button>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">
              {isLoading
                ? '...'
                : me !== null && me !== undefined
                ? (me > 0 ? `+${formatMw(me)}` : formatMw(me))
                : 'N/A'}
            </span>
            {me !== null && me !== undefined && <span className="metric-unit">MW</span>}
          </div>
          {meBadge}
        </div>
        <p className="metric-description">
          Average signed forecast error (forecast − actual). Positive values indicate over-forecasting; negative values indicate under-forecasting.
        </p>
      </div>

      {/* 4. Coverage Card */}
      <div className="metric-card coverage">
        <div>
          <div className="metric-header">
            <div className="metric-label-group">
              <span className="metric-label">Data Coverage</span>
              <span className="metric-abbr">(Availability)</span>
            </div>
            <button
              type="button"
              className="metric-info-btn"
              title="Formula: (valid forecast-actual observation pairs / total expected hourly intervals) * 100%."
              aria-label="Data coverage formula and details"
            >
              <HelpCircle size={14} />
            </button>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">
              {isLoading
                ? '...'
                : coverage !== null && coverage !== undefined
                ? `${coverage.toFixed(1)}%`
                : 'N/A'}
            </span>
            {expected > 0 && (
              <span className="metric-count">
                {validPairs} of {expected} hours
              </span>
            )}
          </div>
          {coverageBadge}
        </div>
        <p className="metric-description">
          Percentage of expected hourly intervals with valid forecast and actual values. Measures data completeness, not forecast accuracy.
        </p>
      </div>
    </div>
  );
};
