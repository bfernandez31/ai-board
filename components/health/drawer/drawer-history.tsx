'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { History, ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/quality-score';
import { queryKeys } from '@/app/lib/query-keys';
import { formatDuration } from '@/lib/health/format';
import { frictionLevelForIssueCount } from '@/lib/health/issue-friction';
import type { HealthModuleType, ScanHistoryItem, ScanHistoryResponse } from '@/lib/health/types';

interface DrawerHistoryProps {
  projectId: number;
  moduleType: HealthModuleType;
  selectedScanId: number | null;
  latestScanId: number | null;
  onSelect: (scanId: number | null) => void;
}

export function DrawerHistory({
  projectId,
  moduleType,
  selectedScanId,
  latestScanId,
  onSelect,
}: DrawerHistoryProps) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Scan History</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          onClick={() => onSelect(null)}
          disabled={selectedScanId === null}
          aria-label="Return to latest scan"
        >
          Latest
        </Button>
      </div>

      <div className="space-y-1.5">
        {allScans.map((scan) => (
          <HistoryEntry
            key={scan.id}
            scan={scan}
            isSelected={
              scan.id === selectedScanId ||
              (selectedScanId === null && scan.id === latestScanId)
            }
            onSelect={onSelect}
          />
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

interface HistoryEntryProps {
  scan: ScanHistoryItem;
  isSelected: boolean;
  onSelect: (scanId: number) => void;
}

function HistoryEntry({ scan, isSelected, onSelect }: HistoryEntryProps) {
  const scoreColors = scan.score !== null ? getScoreColor(scan.score) : null;
  const date = scan.completedAt ?? scan.createdAt;
  const dateLabel = new Date(date).toLocaleDateString();
  const frictionLevel = frictionLevelForIssueCount(scan.issuesFound);

  return (
    <button
      type="button"
      onClick={() => onSelect(scan.id)}
      aria-pressed={isSelected}
      aria-label={`Scan from ${dateLabel}`}
      className={cn(
        'aurora-glass w-full rounded-md px-3 py-2 flex items-center justify-between text-left',
        'border-l-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
        isSelected && 'aurora-bg-selected border-accent'
      )}
    >
      <div className="space-y-0.5">
        <p className={cn('text-xs text-foreground', isSelected && 'font-medium')}>
          {dateLabel}
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
            {scan.issuesFound !== null && frictionLevel !== null && (
              <Badge
                variant="attribute-tc"
                kind="friction"
                level={frictionLevel}
                aria-label={`${scan.issuesFound} issue${scan.issuesFound === 1 ? '' : 's'}`}
              >
                <AlertTriangle className="h-3 w-3" />
                {scan.issuesFound}
              </Badge>
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
        {scan.score !== null && scoreColors ? (
          <span className={`text-xs font-medium ${scoreColors.text} ${scoreColors.bg} rounded-md px-2 py-0.5`}>
            {scan.score}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </button>
  );
}
