'use client';

import { useState } from 'react';
import { HealthHero } from './health-hero';
import { HealthModuleCard } from './health-module-card';
import { ScanDetailDrawer } from './scan-detail-drawer';
import { QualityGateDrawer } from './drawer/quality-gate-drawer';
import { useHealthPolling } from '@/app/lib/hooks/useHealthPolling';
import { useHealthTrends } from '@/app/lib/hooks/useHealthTrends';
import { useTriggerScan } from '@/app/lib/hooks/mutations/useTriggerScan';
import { ACTIVE_SCAN_TYPES } from '@/lib/health/types';
import type { HealthModuleType, TrendDataPoint } from '@/lib/health/types';
import type { HealthScanType } from '@prisma/client';

interface HealthDashboardProps {
  projectId: number;
}

const MODULE_GRID: { type: HealthModuleType; key: keyof NonNullable<ReturnType<typeof useHealthPolling>['data']>['modules'] }[] = [
  { type: 'SECURITY', key: 'security' },
  { type: 'COMPLIANCE', key: 'compliance' },
  { type: 'TESTS', key: 'tests' },
  { type: 'QUALITY_GATE', key: 'qualityGate' },
  { type: 'SPEC_SYNC', key: 'specSync' },
];

const ACTIVE_SCAN_SET = new Set<string>(ACTIVE_SCAN_TYPES);

export function HealthDashboard({ projectId }: HealthDashboardProps) {
  const [selectedModule, setSelectedModule] = useState<HealthModuleType | null>(null);
  const { data, isLoading, error } = useHealthPolling(projectId);
  const { data: trendsData } = useHealthTrends(projectId);
  const triggerScan = useTriggerScan();

  // Build per-module trend lookup from the single trends response
  const moduleTrends: Record<string, TrendDataPoint[]> = {};
  if (trendsData?.trends) {
    for (const [scanType, points] of Object.entries(trendsData.trends)) {
      moduleTrends[scanType] = points;
    }
  }

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
            isScanning={activeScanTypes.has(type as HealthScanType)}
            onTriggerScan={
              ACTIVE_SCAN_SET.has(type)
                ? () => triggerScan.mutate({ projectId, scanType: type as HealthScanType })
                : undefined
            }
            isTriggerPending={triggerScan.isPending}
            onClick={() => setSelectedModule(type)}
            trendData={moduleTrends[type]}
          />
        ))}
      </div>

      {selectedModule && selectedModule !== 'QUALITY_GATE' && (
        <ScanDetailDrawer
          projectId={projectId}
          moduleType={selectedModule}
          moduleStatus={
            data.modules[MODULE_GRID.find(m => m.type === selectedModule)!.key]
          }
          isScanning={activeScanTypes.has(selectedModule as HealthScanType)}
          onClose={() => setSelectedModule(null)}
          onTriggerScan={
            ACTIVE_SCAN_SET.has(selectedModule)
              ? () => triggerScan.mutate({ projectId, scanType: selectedModule as HealthScanType })
              : undefined
          }
          trendData={moduleTrends[selectedModule]}
        />
      )}

      <QualityGateDrawer
        projectId={projectId}
        isOpen={selectedModule === 'QUALITY_GATE'}
        onClose={() => setSelectedModule(null)}
      />

    </div>
  );
}
