'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getScoreColor } from '@/lib/quality-score';
import { queryKeys } from '@/app/lib/query-keys';
import type { HealthModuleType, ScanHistoryItem, ScanHistoryResponse } from '@/lib/health/types';

interface DrawerHistoryProps {
  projectId: number;
  moduleType: HealthModuleType;
}

export function DrawerHistory({ projectId, moduleType }: DrawerHistoryProps) {
  const [allScans, setAllScans] = useState<ScanHistoryItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isInitial, setIsInitial] = useState(true);

  const { isLoading } = useQuery({
    queryKey: [...queryKeys.health.scanHistory(projectId, moduleType), 'drawer', cursor],
    queryFn: async (): Promise<ScanHistoryResponse> => {
      const params = new URLSearchParams({
        type: moduleType,
        limit: '10',
      });
      if (cursor) params.set('cursor', String(cursor));

      const response = await fetch(
        `/api/projects/${projectId}/health/scans?${params}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ScanHistoryResponse = await response.json();

      setAllScans((prev) => {
        // Avoid duplicates when re-fetching initial page
        if (!cursor) return data.scans;
        return [...prev, ...data.scans];
      });
      setHasMore(data.hasMore);
      setIsInitial(false);

      return data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  if (isInitial && isLoading) {
    return null;
  }

  if (allScans.length === 0) {
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

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            const last = allScans[allScans.length - 1];
            if (last) setCursor(last.id);
          }}
          disabled={isLoading}
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
        {scan.issuesFound !== null && (
          <span className="text-xs text-muted-foreground">
            {scan.issuesFound} issue{scan.issuesFound !== 1 ? 's' : ''}
          </span>
        )}
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
