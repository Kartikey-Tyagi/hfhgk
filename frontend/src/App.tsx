import React, { useEffect, useState } from 'react';
import {
  LineChart,
  BarChart3,
  ListOrdered,
  FileText,
  AlertOctagon,
} from 'lucide-react';

import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { MetricCards } from './components/MetricCards';
import { ForecastChart } from './components/ForecastChart';
import { ErrorChart } from './components/ErrorChart';
import { VintageTable } from './components/VintageTable';
import { QualityDetails } from './components/QualityDetails';

import { checkHealth, fetchEvaluation } from './services/api';
import type {
  AlignedEvaluationInterval,
  EvaluationQueryParams,
  EvaluationResponse,
  HealthResponse,
} from './types/api';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [queryParams, setQueryParams] = useState<EvaluationQueryParams>({
    deliveryDateFrom: '2026-01-01',
    deliveryDateTo: '2026-01-31',
    cutoffTimeUtc: '12:00:00',
  });

  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'forecast' | 'error' | 'vintages' | 'quality'>('forecast');

  // Initial health check on mount
  useEffect(() => {
    let isMounted = true;
    checkHealth()
      .then((data) => {
        if (isMounted) {
          setHealth(data);
          setHealthLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setHealthError(err.message || 'Backend connection failed');
          setHealthLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Initial evaluation fetch
  useEffect(() => {
    handleRunEvaluation(queryParams);
  }, []);

  const handleRunEvaluation = async (params: EvaluationQueryParams) => {
    setQueryParams(params);
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchEvaluation(params);
      setEvaluation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve forecast evaluation.');
      setEvaluation(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Collect all intervals across the date range
  const allIntervals: AlignedEvaluationInterval[] = evaluation
    ? evaluation.dailySummaries.flatMap((d) => d.intervals)
    : [];

  return (
    <div className="app-container">
      {/* 1. Header */}
      <Header health={health} healthLoading={healthLoading} healthError={healthError} />

      {/* 2. Controls Panel */}
      <Controls
        queryParams={queryParams}
        onEvaluate={handleRunEvaluation}
        isLoading={isLoading}
      />

      {/* Error Alert */}
      {error && (
        <div className="alert-banner error" role="alert">
          <AlertOctagon size={20} />
          <div>
            <strong>Evaluation Request Failed</strong>
            <p style={{ marginTop: '0.2rem' }}>{error}</p>
          </div>
        </div>
      )}

      {/* 3. Summary Metric Cards */}
      <MetricCards
        metrics={evaluation ? evaluation.overallMetrics : null}
        isLoading={isLoading}
      />

      {/* 4. Tabbed Analysis Workspace */}
      <section className="analysis-card" aria-label="Forecast Analysis Workspace">
        <div className="tabs-header" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'forecast'}
            className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecast')}
          >
            <LineChart size={16} />
            <span>Forecast vs. Actual Outturn</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'error'}
            className={`tab-btn ${activeTab === 'error' ? 'active' : ''}`}
            onClick={() => setActiveTab('error')}
          >
            <BarChart3 size={16} />
            <span>Forecast Error Analysis (Fc − Act)</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'vintages'}
            className={`tab-btn ${activeTab === 'vintages' ? 'active' : ''}`}
            onClick={() => setActiveTab('vintages')}
          >
            <ListOrdered size={16} />
            <span>Vintage Transparency & Intervals ({allIntervals.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'quality'}
            className={`tab-btn ${activeTab === 'quality' ? 'active' : ''}`}
            onClick={() => setActiveTab('quality')}
          >
            <FileText size={16} />
            <span>Data Quality & Assumptions</span>
          </button>
        </div>

        <div className="tab-content">
          {isLoading && !evaluation && (
            <div className="state-container">
              <div className="spinner" />
              <p>Fetching generation actuals & historical forecast vintages from Elexon BMRS...</p>
            </div>
          )}

          {!isLoading && !evaluation && !error && (
            <div className="state-container">
              <p>Select a date range and click Evaluate to analyze forecast accuracy.</p>
            </div>
          )}

          {evaluation && (
            <>
              {activeTab === 'forecast' && <ForecastChart intervals={allIntervals} />}
              {activeTab === 'error' && <ErrorChart intervals={allIntervals} />}
              {activeTab === 'vintages' && (
                <VintageTable
                  intervals={allIntervals}
                  cutoffTimeUtc={evaluation.cutoffTimeUtc}
                />
              )}
              {activeTab === 'quality' && <QualityDetails evaluation={evaluation} />}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default App;
