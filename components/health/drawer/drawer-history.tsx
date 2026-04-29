'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { History, ChevronDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getScoreColor } from '@/lib/quality-score';
import { queryKeys } from '@/app/lib/query-keys';
import { formatDuration } from '@/lib/health/format';
import { cn } from '@/lib/utils';
import type { HealthModuleType, ScanHistoryItem, ScanHistoryResponse } from '@/lib/health/types';

interface DrawerHistoryProps {
  projectId: number;
  moduleType: HealthModuleType;
  selectedScanId: number | null;
  latestScanId: number | null;
  onSelectScan: (scanId: number | null) => void;
}

function getIssueCountLevel(issuesFound: number | null): 'low' | 'med' | 'high' {
  const count = issuesFound ?? 0;
  if (count === 0) return 'low';
  if (count <= 2) return 'med';
  return 'high';
}

export function DrawerHistory({
  projectId,
  moduleType,
  selectedScanId,
  latestScanId,
  onSelectScan,
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

  const showBackToLatest = selectedScanId !== null && selectedScanId !== latestScanId;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Scan History</h4>
        </div>
        {showBackToLatest && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => onSelectScan(null)}
          >
            Back to latest
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {allScans.map((scan) => (
          <HistoryEntry
            key={scan.id}
            scan={scan}
            isSelected={scan.id === selectedScanId}
            onSelectScan={onSelectScan}
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
  onSelectScan: (scanId: number | null) => void;
}

function HistoryEntry({ scan, isSelected, onSelectScan }: HistoryEntryProps) {
  const scoreColors = scan.score !== null ? getScoreColor(scan.score) : null;
  const date = scan.completedAt ?? scan.createdAt;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.key === ' ') e.preventDefault();
    onSelectScan(scan.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelectScan(scan.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        'aurora-glass rounded-md px-3 py-2 flex items-center justify-between cursor-pointer',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        isSelected && 'ring-2 ring-primary/50 bg-primary/5'
      )}
    >
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
            <Badge variant="attribute" kind="friction" level={getIssueCountLevel(scan.issuesFound)}>
              {scan.issuesFound ?? 0}
            </Badge>
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
    </div>
  );
}
