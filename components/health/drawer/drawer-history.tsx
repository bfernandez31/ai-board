'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { History, ChevronDown, AlertTriangle, Coins, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getScoreColor } from '@/lib/quality-score';
import { queryKeys } from '@/app/lib/query-keys';
import { formatCost, formatTokens, formatDuration } from '@/lib/health/format';
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
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <div className="flex items-center gap-2">
            {scan.issuesFound !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    {scan.issuesFound}
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Issues found</p></TooltipContent>
              </Tooltip>
            )}
            {scan.costUsd !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Coins className="h-3 w-3" />
                    {formatCost(scan.costUsd)}
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Cost in USD</p></TooltipContent>
              </Tooltip>
            )}
            {scan.tokensUsed !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {formatTokens(scan.tokensUsed)}
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Tokens consumed</p></TooltipContent>
              </Tooltip>
            )}
            {scan.durationMs !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(scan.durationMs)}
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Execution time</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
        <ScanBadge status={scan.status} score={scan.score} scoreColors={scoreColors} />
      </div>
    </div>
  );
}

function ScanBadge({
  status,
  score,
  scoreColors,
}: {
  status: string;
  score: number | null;
  scoreColors: ReturnType<typeof getScoreColor> | null;
}) {
  if (status === 'SKIPPED') {
    return (
      <span className="text-xs font-medium text-muted-foreground bg-muted rounded-md px-2 py-0.5">
        Skipped
      </span>
    );
  }

  if (score !== null && scoreColors) {
    return (
      <span className={`text-xs font-medium ${scoreColors.text} ${scoreColors.bg} rounded-md px-2 py-0.5`}>
        {score}
      </span>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}
