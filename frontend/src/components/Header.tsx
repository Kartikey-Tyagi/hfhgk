import { Wind, AlertCircle, Activity } from 'lucide-react';
import type { HealthResponse } from '../types/api';

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
}

export const Header: React.FC<HeaderProps> = ({ health, healthLoading, healthError }) => {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-icon" aria-hidden="true">
          <Wind size={22} strokeWidth={2.2} />
        </div>
        <div className="title-group">
          <div className="title-eyebrow">
            <Activity size={12} />
            <span>UK National Generation Intelligence</span>
          </div>
          <h1>Wind Forecast Intelligence</h1>
          <p>UK National Day-Ahead Wind Generation Forecast Evaluation & Accuracy Analytics</p>
        </div>
      </div>

      <div className="header-status">
        {healthLoading ? (
          <div className="health-pill" title="Checking backend health...">
            <span className="pulse-dot" style={{ color: '#94a3b8' }} />
            <span>Connecting...</span>
          </div>
        ) : healthError ? (
          <div className="health-pill offline" title={healthError}>
            <AlertCircle size={14} />
            <span>Backend Offline</span>
          </div>
        ) : (
          <div
            className="health-pill connected"
            title={`Backend connected (${health?.service}). Timezone: ${health?.internalTimezone} internal / ${health?.userFacingTimezone} user-facing.`}
          >
            <span className="pulse-dot" />
            <span>Elexon BMRS Ready</span>
          </div>
        )}
      </div>
    </header>
  );
};
