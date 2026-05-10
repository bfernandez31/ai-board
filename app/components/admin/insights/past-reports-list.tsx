'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface InsightsReportSummary {
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  periodStart: string;
  periodEnd: string;
  sessionsCount: number | null;
  ticketsCount: number | null;
  errorReason: string | null;
  triggeredByEmail: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface PastReportsListProps {
  reports: InsightsReportSummary[];
  selectedReportId?: number | null;
  onSelect?: (id: number) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function StatusBadge({
  status,
}: {
  status: InsightsReportSummary['status'];
}): JSX.Element {
  if (status === 'RUNNING') {
    return (
      <Badge variant="status" status="running">
        Running
      </Badge>
    );
  }
  if (status === 'FAILED') {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return (
    <Badge variant="status" status="ok">
      Completed
    </Badge>
  );
}

export function PastReportsList({
  reports,
  selectedReportId,
  onSelect,
}: PastReportsListProps): JSX.Element {
  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No analysis has been run yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul
      className="flex flex-col gap-2"
      aria-label="Past insights reports"
      data-testid="insights-past-reports-list"
    >
      {reports.map((r) => {
        const selectable = r.status === 'COMPLETED' && Boolean(onSelect);
        const isSelected = selectedReportId === r.id;
        return (
          <li key={r.id}>
            <button
              type="button"
              disabled={!selectable}
              onClick={selectable ? () => onSelect?.(r.id) : undefined}
              data-testid={`insights-report-row-${r.id}`}
              data-report-id={r.id}
              data-report-status={r.status}
              aria-pressed={isSelected}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition',
                isSelected ? 'border-primary bg-accent' : 'border-border',
                selectable
                  ? 'cursor-pointer hover:bg-accent'
                  : 'cursor-default opacity-90'
              )}
            >
              <span className="flex flex-col">
                <span className="font-medium">
                  {formatDate(r.createdAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {r.sessionsCount ?? '—'} sessions · {r.ticketsCount ?? '—'}{' '}
                  tickets
                </span>
                <StatusBadge status={r.status} />
              </span>
            </button>
            {r.status === 'FAILED' && r.errorReason ? (
              <p className="px-4 py-1 text-xs text-destructive">
                {r.errorReason}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
