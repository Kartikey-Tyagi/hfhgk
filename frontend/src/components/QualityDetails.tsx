import { Database, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { EvaluationResponse } from '../types/api';
import { formatDateRange, formatCutoffDisplay, formatCutoffShort } from '../utils/formatters';

interface QualityDetailsProps {
  evaluation: EvaluationResponse | null;
}

export const QualityDetails: React.FC<QualityDetailsProps> = ({ evaluation }) => {
  if (!evaluation) return null;

  const metrics = evaluation.overallMetrics;
  const missingCount = metrics.expectedIntervals - metrics.validPairs;

  return (
    <div className="quality-grid">
      {/* Card 1: Data Availability Breakdown */}
      <div className="quality-card">
        <h3>
          <Database size={16} color="#2563eb" /> Data Availability Breakdown
        </h3>
        <ul>
          <li>
            Expected Hourly Intervals: <strong>{metrics.expectedIntervals} hours</strong>
          </li>
          <li>
            Valid Observation Pairs: <strong>{metrics.validPairs} hours</strong>
          </li>
          <li>
            Missing / Incomplete Intervals: <strong>{missingCount} hours</strong>
          </li>
          <li>
            Overall Coverage: <strong>{metrics.coveragePercentage.toFixed(2)}%</strong>
          </li>
          <li>
            Coverage Meaning: <em>Data availability only; does not reflect forecast accuracy.</em>
          </li>
        </ul>
      </div>

      {/* Card 2: Decision Cutoff & Rules */}
      <div className="quality-card">
        <h3>
          <Info size={16} color="#0d9488" /> Operational Assumptions & Rules
        </h3>
        <ul>
          <li>
            Delivery Range: <strong>{formatDateRange(evaluation.deliveryDateFrom, evaluation.deliveryDateTo)}</strong>
          </li>
          <li>
            Day-Ahead Purchasing Cutoff: <strong>{formatCutoffDisplay(evaluation.cutoffTimeUtc)}</strong>
          </li>
          <li>
            Cutoff Policy: <em>Strict historical exclusion (never admits publishTime &gt; cutoff).</em>
          </li>
          <li>
            Vintage Selection: <em>Latest eligible forecast published at or before cutoff on D−1 (day before delivery).</em>
          </li>
          <li>
            Temporal Aggregation: <em>Hourly actual is the arithmetic mean of two 30-min settlement periods.</em>
          </li>
        </ul>
      </div>

      {/* Card 3: Elexon Datasets & Integrity */}
      <div className="quality-card">
        <h3>
          <CheckCircle2 size={16} color="#059669" /> Data Integrity Guarantee
        </h3>
        <ul>
          <li>
            Actuals Dataset: <strong>Elexon FUELHH (filtered to fuelType = WIND)</strong>
          </li>
          <li>
            Forecast Dataset: <strong>Elexon WINDFOR (hourly national forecast)</strong>
          </li>
          <li>
            Missing Data Rule: <em>Preserved as gaps; missing actuals or forecasts are never silently zeroed.</em>
          </li>
          <li>
            Zero Generation: <em>0.0 MW generation treated as valid observations.</em>
          </li>
          <li>
            Authentication: <em>Official Elexon Insights Solution public API.</em>
          </li>
        </ul>
      </div>

      {/* Card 4: Assessment Scope & Procurement Notice */}
      <div className="quality-card">
        <h3>
          <ShieldAlert size={16} color="#7c3aed" /> Scope & Procurement Notice
        </h3>
        <ul>
          <li>
            Cutoff Policy: <em>The {formatCutoffShort(evaluation.cutoffTimeUtc)} cutoff is an assessment assumption, not an operational trading policy.</em>
          </li>
          <li>
            Forecast Eligibility: <em>Uses historical forecast vintages published strictly at or before the applicable cutoff.</em>
          </li>
          <li>
            Procurement Guidance: <strong>No purchasing recommendations</strong> <em>are possible or implied. Electricity prices, consumer demand, and other fuel generation are strictly outside data scope.</em>
          </li>
          <li>
            Metric Definitions: <em>MAE and RMSE quantify error magnitude in MW; positive ME indicates systematic over-forecasting.</em>
          </li>
        </ul>
      </div>
    </div>
  );
};
