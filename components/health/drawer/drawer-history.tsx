'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { History, ChevronDown, AlertTriangle, Coins, Zap, Clock, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { getScoreColor } from '@/lib/quality-score';
import { queryKeys } from '@/app/lib/query-keys';
import { formatAbbreviatedNumber, formatCost, formatDuration } from '@/lib/analytics/aggregations';
import type { HealthModuleType, ScanHistoryItem, ScanHistoryResponse } from '@/lib/health/types';

interface DrawerHistoryProps {
  projectId: number;
  moduleType: HealthModuleType;
}

export function DrawerHistory({ projectId, moduleType }: DrawerHistoryProps) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: [...queryKeys.health.scanHistory(projectId, moduleType), 'drawer'],
    queryFn: async ({ pageParam }): Promise<ScanHistoryResponse> => {
      const params = new URLSearchParams({
        type: moduleType,
        limit: '10',
      });
      if (pageParam) params.set('cursor', String(pageParam));

      const response = await fetch(
        `/api/projects/${projectId}/health/scans?${params}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  const allScans = data?.pages.flatMap((page) => page.scans) ?? [];

  if (isLoading || allScans.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-sm font-medium text-foreground">Scan History</h4>
      </div>

      <div className="space-y-1.5">
        {allScans.map((scan) => (
          <HistoryEntry key={scan.id} scan={scan} />
        ))}
      </div>

      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          <ChevronDown className="h-3 w-3 mr-1" />
          Load more
        </Button>
      )}
    </div>
  );
}

function HistoryEntry({ scan }: { scan: ScanHistoryItem }) {
  const scoreColors = scan.score !== null ? getScoreColor(scan.score) : null;
  const date = scan.completedAt ?? scan.createdAt;

  return (
    <div className="aurora-glass rounded-md px-3 py-2 flex items-center justify-between">
      <div className="space-y-0.5">
        <p className="text-xs text-foreground">
          {new Date(date).toLocaleDateString()}
        </p>
        {scan.baseCommit && scan.headCommit && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {scan.baseCommit.slice(0, 7)}..{scan.headCommit.slice(0, 7)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <MetricIcon
            icon={AlertTriangle}
            value={scan.issuesFound !== null ? String(scan.issuesFound) : null}
            tooltip="Issues found during scan"
          />
          <MetricIcon
            icon={Coins}
            value={scan.costUsd !== null ? formatCost(scan.costUsd) : null}
            tooltip="Cost in USD"
          />
          <MetricIcon
            icon={Zap}
            value={scan.tokensUsed !== null ? formatAbbreviatedNumber(scan.tokensUsed) : null}
            tooltip="Tokens consumed"
          />
          <MetricIcon
            icon={Clock}
            value={scan.durationMs !== null ? formatDuration(scan.durationMs) : null}
            tooltip="Execution time"
          />
        </div>
        {scan.score !== null && scoreColors ? (
          <span className={`text-xs font-medium ${scoreColors.text} ${scoreColors.bg} rounded-md px-2 py-0.5`}>
            {scan.score}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function MetricIcon({
  icon: Icon,
  value,
  tooltip,
}: {
  icon: LucideIcon;
  value: string | null;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-0.5 text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span className="text-[10px]">{value ?? '—'}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
