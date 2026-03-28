'use client';

import { HealthHero } from './health-hero';
import { HealthModuleCard } from './health-module-card';
import { useHealthPolling } from '@/app/lib/hooks/useHealthPolling';
import type { HealthModuleType } from '@/lib/health/types';

interface HealthDashboardProps {
  projectId: number;
}

const MODULE_GRID: { type: HealthModuleType; key: keyof NonNullable<ReturnType<typeof useHealthPolling>['data']>['modules'] }[] = [
  { type: 'SECURITY', key: 'security' },
  { type: 'COMPLIANCE', key: 'compliance' },
  { type: 'TESTS', key: 'tests' },
  { type: 'QUALITY_GATE', key: 'qualityGate' },
  { type: 'SPEC_SYNC', key: 'specSync' },
  { type: 'LAST_CLEAN', key: 'lastClean' },
];

export function HealthDashboard({ projectId }: HealthDashboardProps) {
  const { data, isLoading, error } = useHealthPolling(projectId);

  if (isLoading) {
    return (
      <div className="aurora-bg-section rounded-xl p-12 flex items-center justify-center">
        <p className="text-muted-foreground">Loading health data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aurora-bg-section rounded-xl p-12 flex items-center justify-center">
        <p className="text-ctp-red">Failed to load health data.</p>
      </div>
    );
  }

  if (!data) return null;

  const activeScanTypes = new Set(
    data.activeScans
      .filter(s => s.status === 'PENDING' || s.status === 'RUNNING')
      .map(s => s.scanType)
  );

  return (
    <div className="space-y-6">
      <HealthHero
        globalScore={data.globalScore}
        modules={data.modules}
        lastFullScanDate={data.lastFullScanDate}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULE_GRID.map(({ type, key }) => (
          <HealthModuleCard
            key={type}
            moduleType={type}
            module={data.modules[key]}
            isScanning={activeScanTypes.has(type as 'SECURITY' | 'COMPLIANCE' | 'TESTS' | 'SPEC_SYNC')}
          />
        ))}
      </div>
    </div>
  );
}
