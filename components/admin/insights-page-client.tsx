'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

interface ReportSummary {
  id: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  periodStart: string | null;
  periodEnd: string | null;
  sessionCount: number;
  ticketCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface InsightsListResponse {
  reports: ReportSummary[];
  latest: ReportSummary | null;
  active: ReportSummary | null;
  scope: {
    previousRunAt: string | null;
    newTicketCount: number;
    hasNewTickets: boolean;
  };
}

interface ReportDetailResponse {
  report: ReportSummary & { html: string | null };
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
  }
  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    if (json && typeof json === 'object' && 'error' in json) {
      errorMessage = String((json as { error: unknown }).error);
    }
    const error = new Error(errorMessage) as Error & {
      status?: number;
      code?: string;
      payload?: unknown;
    };
    error.status = res.status;
    if (json && typeof json === 'object' && 'code' in json) {
      error.code = String((json as { code: unknown }).code);
    }
    error.payload = json;
    throw error;
  }
  return (json as T) ?? ({} as T);
}

export function InsightsPageClient(): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery<InsightsListResponse>({
    queryKey: ['admin', 'insights', 'list'],
    queryFn: () => fetchJson<InsightsListResponse>('/api/admin/insights'),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.active ? 5_000 : false;
    },
  });

  const list = listQuery.data;
  const viewedReportId = selectedId ?? list?.latest?.id ?? null;

  const reportQuery = useQuery<ReportDetailResponse>({
    queryKey: ['admin', 'insights', 'report', viewedReportId],
    queryFn: () =>
      fetchJson<ReportDetailResponse>(
        `/api/admin/insights/${viewedReportId}`
      ),
    enabled: viewedReportId !== null,
  });

  const runMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ reportId: number }>('/api/admin/insights/run', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      setActionError(null);
      setActionMessage('Analysis started.');
      setSelectedId(data.reportId);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'insights'] });
    },
    onError: (error: Error) => {
      setActionMessage(null);
      setActionError(error.message);
    },
  });

  const hasNewTickets = list?.scope.hasNewTickets ?? false;
  const isRunning = !!list?.active;
  const triggerDisabled = isRunning || !hasNewTickets || runMutation.isPending;
  const triggerHint = useMemo(() => {
    if (isRunning) return 'An analysis is already running.';
    if (!hasNewTickets) {
      const last = list?.scope.previousRunAt;
      return last
        ? `No new shipped tickets since last run on ${formatDate(last)}.`
        : 'No shipped tickets are available to analyze yet.';
    }
    if (list) {
      return `${list.scope.newTicketCount} new shipped ticket(s) since last run.`;
    }
    return null;
  }, [hasNewTickets, isRunning, list]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Claude Code Insights
        </h1>
        <p className="text-sm text-muted-foreground">
          Run Claude Code&apos;s built-in <code>/insights</code> analyzer
          across AI-Board&apos;s shipped Claude sessions to surface usage
          patterns, frictions, and suggested CLAUDE.md additions.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-4">
        <Button
          onClick={() => {
            setActionMessage(null);
            setActionError(null);
            runMutation.mutate();
          }}
          disabled={triggerDisabled}
          aria-busy={runMutation.isPending}
        >
          {runMutation.isPending || isRunning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          )}
          {isRunning ? 'Running…' : 'Run new analysis'}
        </Button>
        {triggerHint && (
          <p className="text-sm text-muted-foreground">{triggerHint}</p>
        )}
        {actionMessage && (
          <p className="text-sm text-emerald-500" role="status">
            {actionMessage}
          </p>
        )}
        {actionError && (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside aria-label="Past reports">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Past reports
          </h2>
          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : list && list.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reports yet. Run the first analysis to populate this list.
            </p>
          ) : (
            <ul className="space-y-1">
              {list?.reports.map((report) => {
                const isSelected = viewedReportId === report.id;
                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(report.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {formatDate(
                            report.completedAt ?? report.startedAt
                          )}
                        </span>
                        <StatusBadge status={report.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {report.sessionCount} sessions · {report.ticketCount}{' '}
                        tickets
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <article aria-label="Insights report" className="min-h-[24rem]">
          <ReportViewer
            isLoading={reportQuery.isLoading}
            error={reportQuery.error}
            data={reportQuery.data?.report}
          />
        </article>
      </section>
    </div>
  );
}

function statusBadgeClass(status: ReportSummary['status']): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-500/15 text-emerald-500';
    case 'FAILED':
      return 'bg-destructive/15 text-destructive';
    case 'RUNNING':
      return 'bg-amber-500/15 text-amber-500';
  }
}

function StatusBadge({
  status,
}: {
  status: ReportSummary['status'];
}): JSX.Element {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(status)}`}
    >
      {status}
    </span>
  );
}

interface ReportData {
  id: number;
  status: ReportSummary['status'];
  periodStart: string | null;
  periodEnd: string | null;
  sessionCount: number;
  ticketCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  html: string | null;
}

function reportTitle(data: ReportData): string {
  switch (data.status) {
    case 'COMPLETED':
      return `Analyzed ${data.sessionCount} Claude Code sessions across ${data.ticketCount} tickets`;
    case 'RUNNING':
      return 'Analysis in progress';
    case 'FAILED':
      return 'Analysis failed';
  }
}

function ReportBody({ data }: { data: ReportData }): JSX.Element {
  if (data.status === 'COMPLETED' && data.html) {
    return (
      <iframe
        title={`Claude Code Insights report #${data.id}`}
        srcDoc={data.html}
        sandbox=""
        className="h-[80vh] w-full rounded-lg border border-border bg-background"
      />
    );
  }
  if (data.status === 'RUNNING') {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Generating report… this can take a few minutes. The page will refresh
        automatically when the analysis finishes.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
      Report artifact unavailable.
    </div>
  );
}

function ReportViewer({
  isLoading,
  error,
  data,
}: {
  isLoading: boolean;
  error: unknown;
  data: ReportData | undefined;
}): JSX.Element {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Loading report…
      </div>
    );
  }
  if (error instanceof Error) {
    return (
      <div
        className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive"
        role="alert"
      >
        Failed to load report: {error.message}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        No report selected yet. Trigger an analysis to generate the first
        report.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-lg border border-border bg-card/40 p-4 text-sm">
        <h2 className="text-base font-semibold">{reportTitle(data)}</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-medium">Generated:</dt>{' '}
            <dd className="inline">
              {formatDate(data.completedAt ?? data.startedAt)}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Period:</dt>{' '}
            <dd className="inline">
              {formatDate(data.periodStart)} → {formatDate(data.periodEnd)}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Sessions:</dt>{' '}
            <dd className="inline">{data.sessionCount}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Tickets:</dt>{' '}
            <dd className="inline">{data.ticketCount}</dd>
          </div>
        </dl>
        {data.errorMessage && (
          <p className="mt-2 text-xs text-destructive">
            {data.errorMessage}
          </p>
        )}
      </header>
      <ReportBody data={data} />
    </div>
  );
}
