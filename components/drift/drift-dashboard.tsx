'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { DriftDashboardSnapshot, DriftFilters } from '@/lib/drift/types';
import { ConfusionMatrix } from './confusion-matrix';
import { RangeHitPanel } from './range-hit-panel';
import { UsagePanel } from './usage-panel';
import { EmptyState } from '@/components/analytics/empty-state';

interface DriftDashboardProps {
  projectId: number;
  initialData: DriftDashboardSnapshot;
  filters?: DriftFilters;
}

async function fetchDrift(projectId: number, filters: DriftFilters = {}): Promise<DriftDashboardSnapshot> {
  const params = new URLSearchParams();
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  const response = await fetch(`/api/projects/${projectId}/drift${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error('Failed to fetch drift data');
  }
  return response.json();
}

export function DriftDashboard({ projectId, initialData, filters = {} }: DriftDashboardProps) {
  const { data } = useQuery({
    queryKey: queryKeys.drift.data(projectId, filters),
    queryFn: () => fetchDrift(projectId, filters),
    initialData,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const snap = data ?? initialData;

  if (snap.sampleSize === 0) {
    return (
      <EmptyState
        title="No drift data"
        description="Drift data will appear after tickets with stored analyses are shipped. Run analyses on your inbox tickets and ship them to see calibration metrics."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Sample size: <span className="font-mono font-semibold">{snap.sampleSize}</span> paired records
        {snap.unpairedCount > 0 && (
          <span className="ml-2">· {snap.unpairedCount} unpaired</span>
        )}
        {snap.pendingCount > 0 && (
          <span className="ml-2">· {snap.pendingCount} pending</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="aurora-card rounded-lg border p-4">
          <ConfusionMatrix
            tp={snap.friction.matrix.tp}
            fp={snap.friction.matrix.fp}
            tn={snap.friction.matrix.tn}
            fn={snap.friction.matrix.fn}
            precision={snap.friction.precision}
            recall={snap.friction.recall}
          />
        </div>

        <div className="aurora-card rounded-lg border p-4">
          <RangeHitPanel title="Cost Range" data={snap.cost} />
        </div>

        <div className="aurora-card rounded-lg border p-4">
          <RangeHitPanel title="Quality Gate Range" data={snap.quality} />
        </div>

        <div>
          <UsagePanel
            analysedShipped={snap.usage.analysedShipped}
            leftInbox={snap.usage.leftInbox}
            ratio={snap.usage.ratio}
          />
        </div>
      </div>
    </div>
  );
}
