'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { ReportViewer } from './report-viewer';
import { Button } from '@/components/ui/button';
import { Play, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface InsightsRun {
  id: number;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  sessionCount: number | null;
  ticketCount: number | null;
  reportKey: string | null;
  reportUrl?: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface LatestResponse {
  run: InsightsRun | null;
  activeRun: { id: number; status: string; startedAt: string | null; createdAt: string } | null;
}

interface RunsListResponse {
  runs: InsightsRun[];
  nextCursor: number | null;
  hasMore: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function InsightsDashboard({
  initialLatest,
}: {
  initialLatest?: LatestResponse;
}) {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const { data: latestData } = useQuery<LatestResponse>({
    queryKey: queryKeys.admin.insights.latest,
    queryFn: async () => {
      const res = await fetch('/api/admin/insights/latest');
      if (!res.ok) throw new Error('Failed to fetch latest');
      return res.json();
    },
    ...(initialLatest ? { initialData: initialLatest } : {}),
    refetchInterval: (query) => (query.state.data?.activeRun ? 5000 : 30000),
  });

  const { data: runsData } = useQuery<RunsListResponse>({
    queryKey: queryKeys.admin.insights.runs(),
    queryFn: async () => {
      const res = await fetch('/api/admin/insights/runs?limit=50&status=COMPLETED');
      if (!res.ok) throw new Error('Failed to fetch runs');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/insights/runs', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to trigger analysis');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.insights.latest });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.insights.runs() });
    },
  });

  const activeRun = latestData?.activeRun;
  const latestRun = latestData?.run;
  const isRunning = !!activeRun;
  const completedRuns = runsData?.runs ?? [];

  const displayRun = selectedRunId
    ? completedRuns.find((r) => r.id === selectedRunId) ?? latestRun
    : latestRun;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Claude Code session analysis reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <div className="flex items-center gap-2 rounded-md aurora-bg-tint px-3 py-1.5 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-ctp-mauve" />
              <span className="text-ctp-mauve">Analysis running...</span>
            </div>
          )}
          <Button
            onClick={() => triggerMutation.mutate()}
            disabled={isRunning || triggerMutation.isPending}
            className="aurora-btn-default"
          >
            {triggerMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run new analysis
          </Button>
        </div>
      </div>

      {triggerMutation.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            {triggerMutation.error?.message}
          </span>
        </div>
      )}

      {!displayRun && !isRunning && (
        <div className="flex flex-col items-center justify-center rounded-lg aurora-bg-section p-12 text-center">
          <div className="mb-4 rounded-full aurora-bg-tint p-3">
            <CheckCircle2 className="h-6 w-6 text-ctp-mauve" />
          </div>
          <h2 className="mb-2 text-lg font-medium text-foreground">
            No reports yet
          </h2>
          <p className="mb-4 max-w-md text-sm text-muted-foreground">
            Run your first analysis to generate insights from Claude Code
            sessions across shipped tickets.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_1fr]">
        {completedRuns.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Past Reports</h3>
            <div className="space-y-1">
              {completedRuns.map((run) => {
                const isSelected = selectedRunId
                  ? run.id === selectedRunId
                  : run.id === latestRun?.id;
                return (
                  <button
                    key={run.id}
                    onClick={() =>
                      setSelectedRunId(
                        run.id === latestRun?.id ? null : run.id
                      )
                    }
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'aurora-bg-tint text-ctp-mauve border border-ctp-mauve/20'
                        : 'text-muted-foreground hover:aurora-bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{formatDate(run.completedAt)}</span>
                    </div>
                    {run.periodStart && run.periodEnd && (
                      <div className="mt-0.5 pl-5.5 text-xs opacity-60">
                        {formatDate(run.periodStart)} &ndash;{' '}
                        {formatDate(run.periodEnd)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {displayRun && (
          <div className={completedRuns.length > 0 ? '' : 'col-span-full'}>
            <ReportViewer
              runId={displayRun.id}
              periodStart={displayRun.periodStart}
              periodEnd={displayRun.periodEnd}
              sessionCount={displayRun.sessionCount}
              ticketCount={displayRun.ticketCount}
              completedAt={displayRun.completedAt}
            />
          </div>
        )}
      </div>
    </div>
  );
}
