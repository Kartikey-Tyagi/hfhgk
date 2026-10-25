import { useState, useRef } from 'react';
import { Calendar, Clock, Play, AlertTriangle, Info } from 'lucide-react';
import type { EvaluationQueryParams } from '../types/api';

interface ControlsProps {
  queryParams: EvaluationQueryParams;
  onEvaluate: (params: EvaluationQueryParams) => void;
  isLoading: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  queryParams,
  onEvaluate,
  isLoading,
}) => {
  const [dateFrom, setDateFrom] = useState(queryParams.deliveryDateFrom);
  const [dateTo, setDateTo] = useState(queryParams.deliveryDateTo);
  const [cutoffTime, setCutoffTime] = useState(queryParams.cutoffTimeUtc);
  const [validationError, setValidationError] = useState<string | null>(null);

  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);
  const cutoffRef = useRef<HTMLInputElement>(null);

  const applyPreset = (from: string, to: string, time: string = '12:00:00') => {
    setDateFrom(from);
    setDateTo(to);
    setCutoffTime(time);
    setValidationError(null);
  };

  const isPresetActive = (from: string, to: string) => {
    return dateFrom === from && dateTo === to;
  };

  const handleOpenPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) {
      if (typeof ref.current.showPicker === 'function') {
        try {
          ref.current.showPicker();
        } catch {
          ref.current.focus();
        }
      } else {
        ref.current.focus();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate dates are present
    if (!dateFrom || !dateTo) {
      setValidationError('Both start date and end date are required.');
      return;
    }

    // 2. Validate order
    if (dateTo < dateFrom) {
      setValidationError('End delivery date cannot be earlier than start delivery date.');
      return;
    }

    // 3. Assessment Scope: January 2026 validation
    // Standard 48-settlement-period mapping is only valid for winter GMT days.
    // Transition days (March clock forward / October clock backward) are outside scope.
    if (dateFrom < '2026-01-01' || dateTo > '2026-01-31') {
      setValidationError(
        'Delivery dates must be within January 2026 (1 Jan 2026 – 31 Jan 2026). UK daylight-saving transition days (46 or 50 settlement periods) are outside assessment scope.'
      );
      return;
    }

    // 4. Validate cutoff time (HH:MM or HH:MM:SS)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
    if (!timeRegex.test(cutoffTime.trim())) {
      setValidationError('Decision cutoff time must be in HH:MM or HH:MM:SS format (e.g., 12:00:00).');
      return;
    }

    // Normalize cutoff to HH:MM:SS if user entered HH:MM
    let normalizedCutoff = cutoffTime.trim();
    if (normalizedCutoff.length === 5) {
      normalizedCutoff += ':00';
    }

    setValidationError(null);
    onEvaluate({
      deliveryDateFrom: dateFrom,
      deliveryDateTo: dateTo,
      cutoffTimeUtc: normalizedCutoff,
    });
  };

  return (
    <div className="controls-card">
      <form onSubmit={handleSubmit} noValidate className="controls-form">
        {/* Header row: Presets + Scope limitation note */}
        <div className="controls-header-row">
          <div className="presets-row">
            <span className="presets-label">Evaluation Presets:</span>
            <button
              type="button"
              className={`preset-btn ${isPresetActive('2026-01-01', '2026-01-31') ? 'active' : ''}`}
              onClick={() => applyPreset('2026-01-01', '2026-01-31', '12:00:00')}
            >
              Full January 2026 (744 hours)
            </button>
            <button
              type="button"
              className={`preset-btn ${isPresetActive('2026-01-01', '2026-01-07') ? 'active' : ''}`}
              onClick={() => applyPreset('2026-01-01', '2026-01-07', '12:00:00')}
            >
              First Week (168 hours)
            </button>
            <button
              type="button"
              className={`preset-btn ${isPresetActive('2026-01-01', '2026-01-01') ? 'active' : ''}`}
              onClick={() => applyPreset('2026-01-01', '2026-01-01', '12:00:00')}
              aria-label="Single Day: Jan 1 (24 hours)"
            >
              Single Day: January 1 (24 hours)
            </button>
          </div>

          <div className="scope-badge" title="January 2026 uses standard 48 settlement periods per day (GMT). Clock-change days with 46 or 50 periods are outside scope.">
            <Info size={12} />
            <span>Scope: January 2026 (48 SP/day)</span>
          </div>
        </div>

        {/* Inputs row */}
        <div className="inputs-row">
          {/* Delivery Date From */}
          <div className="input-field">
            <label htmlFor="dateFrom">
              Delivery Date From
            </label>
            <div className="input-wrapper">
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => handleOpenPicker(dateFromRef)}
                aria-label="Open Start Date Picker"
                tabIndex={-1}
              >
                <Calendar size={14} />
              </button>
              <input
                ref={dateFromRef}
                id="dateFrom"
                type="date"
                min="2026-01-01"
                max="2026-01-31"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Delivery Date To */}
          <div className="input-field">
            <label htmlFor="dateTo">
              Delivery Date To
            </label>
            <div className="input-wrapper">
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => handleOpenPicker(dateToRef)}
                aria-label="Open End Date Picker"
                tabIndex={-1}
              >
                <Calendar size={14} />
              </button>
              <input
                ref={dateToRef}
                id="dateTo"
                type="date"
                min="2026-01-01"
                max="2026-01-31"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Day-Ahead Cutoff (Time input with UTC pill) */}
          <div className="input-field">
            <label htmlFor="cutoffTime">
              Day-Ahead Cutoff
            </label>
            <div className="input-wrapper time-input-group">
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => handleOpenPicker(cutoffRef)}
                aria-label="Open Cutoff Time Picker"
                tabIndex={-1}
              >
                <Clock size={14} />
              </button>
              <input
                ref={cutoffRef}
                id="cutoffTime"
                type="time"
                step="1"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                disabled={isLoading}
                required
              />
              <span className="utc-suffix-pill">UTC</span>
            </div>
            <span className="cutoff-help-text">
              Applied on the day before delivery (D−1). The 12:00 UTC cutoff is an assessment baseline.
            </span>
          </div>

          {/* Evaluate Action */}
          <button
            type="submit"
            className="evaluate-btn"
            disabled={isLoading}
            aria-label="Evaluate Forecasts"
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                <span>Evaluate</span>
              </>
            )}
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="alert-banner error" role="alert">
            <AlertTriangle size={16} />
            <span>{validationError}</span>
          </div>
        )}
      </form>
    </div>
  );
};
