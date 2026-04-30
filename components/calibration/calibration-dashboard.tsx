'use client';

import { useCalibrationDashboard } from '@/app/lib/hooks/queries/useCalibration';
import type { CalibrationDashboardData } from '@/lib/calibration/types';
import { CalibrationEmptyState } from './empty-state';
import { ConfusionMatrixTable } from './confusion-matrix-table';
import { RecommendationPanel } from './recommendation-panel';
import { VerdictDistributionChart } from './verdict-distribution-chart';
import { AdoptionCounter } from './adoption-counter';

interface CalibrationDashboardProps {
  projectId: number;
  initialData: CalibrationDashboardData;
}

export function CalibrationDashboard({
  projectId,
  initialData,
}: CalibrationDashboardProps) {
  const { data } = useCalibrationDashboard(projectId, initialData);
  const dashboard: CalibrationDashboardData = data ?? initialData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Analysis calibration
        </h1>
        <p className="text-sm text-muted-foreground">
          {`${dashboard.windowSize} of ${dashboard.totalRows} shipped+analyzed tickets paired (most recent first).`}
        </p>
      </div>

      <AdoptionCounter adoption={dashboard.adoption} />

      {dashboard.warmingUp ? (
        <CalibrationEmptyState totalRows={dashboard.totalRows} />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConfusionMatrixTable matrix={dashboard.confusionMatrix} />
        <RecommendationPanel
          data={dashboard.recommendation}
          windowSize={dashboard.windowSize}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VerdictDistributionChart
          title="Quality verdict distribution"
          distribution={dashboard.qualityDistribution}
          naTooltip='N/A applies when the actual quality score is null (e.g. QUICK or verify-without-score tickets).'
        />
        <VerdictDistributionChart
          title="Cost verdict distribution"
          distribution={dashboard.costDistribution}
          naTooltip='N/A applies when every job had a null costUsd telemetry value.'
        />
      </div>
    </div>
  );
}
