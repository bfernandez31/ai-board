'use client';

import { History } from 'lucide-react';
import { getScoreColor } from '@/lib/quality-score';
import { useScanHistory } from '@/app/lib/hooks/useScanHistory';

interface ScanHistorySectionProps {
  projectId: number;
  moduleType: string;
  enabled: boolean;
}

export function ScanHistorySection({ projectId, moduleType, enabled }: ScanHistorySectionProps) {
  const { data, isLoading } = useScanHistory(projectId, moduleType, enabled);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Scan History</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const scans = data?.scans ?? [];

  if (scans.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        Scan History
      </h3>
      <div className="space-y-1">
        {scans.map((scan) => {
          const scoreColors = scan.score !== null ? getScoreColor(scan.score) : null;
          return (
            <div
              key={scan.id}
              className="flex items-center gap-3 p-2 rounded-md aurora-glass text-xs"
            >
              <span className="text-muted-foreground shrink-0">
                {new Date(scan.createdAt).toLocaleDateString()}
              </span>
              {scan.score !== null && scoreColors && (
                <span className={`font-medium ${scoreColors.text} ${scoreColors.bg} rounded px-1.5 py-0.5`}>
                  {scan.score}
                </span>
              )}
              {scan.status === 'FAILED' && (
                <span className="text-ctp-red font-medium">Failed</span>
              )}
              {scan.issuesFound !== null && (
                <span className="text-muted-foreground">
                  {scan.issuesFound} issue{scan.issuesFound !== 1 ? 's' : ''}
                </span>
              )}
              {scan.baseCommit && scan.headCommit && (
                <span className="text-muted-foreground font-mono ml-auto">
                  {scan.baseCommit.slice(0, 7)}..{scan.headCommit.slice(0, 7)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
