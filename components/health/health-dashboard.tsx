'use client';

import { useHealthPolling } from '@/app/lib/hooks/useHealthPolling';
import { GlobalScoreCard } from './global-score-card';
import { ModuleCard } from './module-card';
import { HEALTH_MODULES } from '@/lib/health/constants';
import type { HealthScoreResponse } from '@/lib/health/types';

interface HealthDashboardProps {
  projectId: number;
  initialData?: HealthScoreResponse;
}

export function HealthDashboard({ projectId, initialData }: HealthDashboardProps) {
  const { data } = useHealthPolling(projectId, initialData);

  const healthData = data ?? initialData;

  if (!healthData) {
    return <div className="text-muted-foreground">Loading health data...</div>;
  }

  return (
    <div className="space-y-6">
      <GlobalScoreCard
        globalScore={healthData.globalScore}
        modules={healthData.modules}
        lastScanAt={healthData.lastScanAt}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {HEALTH_MODULES.map((config) => {
          const moduleData = healthData.modules.find((m) => m.type === config.type);
          if (!moduleData) return null;

          return (
            <ModuleCard
              key={config.type}
              config={config}
              module={moduleData}
            />
          );
        })}
      </div>
    </div>
  );
}
