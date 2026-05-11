'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  useInsightsReports,
} from '@/app/lib/hooks/queries/use-insights-reports';
import type { ReportListEntry } from '@/app/lib/insights/repository';
import { ReportErrorPlaceholder } from '@/components/admin/insights/report-error-placeholder';
import { RunAnalysisButton } from '@/components/admin/insights/run-analysis-button';

interface PreflightSummary {
  shippedSincePreviousRun: number;
  previousRunEnd: string | null;
}

interface InsightsReportViewProps {
  reports: ReportListEntry[];
  latest: ReportListEntry | null;
  preflight: PreflightSummary;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function formatMetadataPhrasing(report: ReportListEntry): string {
  const sessions = report.sessionsCount ?? 0;
  const tickets = report.ticketsCount ?? 0;
  return `Analyzed ${sessions} Claude Code sessions across ${tickets} tickets shipped between ${formatDate(
    report.periodStart
  )} and ${formatDate(report.periodEnd)}`;
}

function statusBadgeVariant(
  status: ReportListEntry['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

interface Refusal {
  refusalCode: 'ALREADY_RUNNING' | 'NO_NEW_SHIPPED';
  message: string;
}

function computeRefusal(canTrigger: boolean, latestIsRunning: boolean): Refusal | null {
  if (canTrigger) return null;
  if (latestIsRunning) {
    return {
      refusalCode: 'ALREADY_RUNNING',
      message: 'A run is already in progress.',
    };
  }
  return {
    refusalCode: 'NO_NEW_SHIPPED',
    message: 'No new shipped Claude tickets since the last run.',
  };
}

function renderReportBody(display: ReportListEntry): React.ReactNode {
  if (display.status === 'COMPLETED') {
    return (
      <iframe
        title={`Insights report ${display.id}`}
        sandbox="allow-scripts"
        src={`/api/admin/insights/reports/${display.id}/html`}
        className="h-[70vh] w-full rounded-lg border border-border bg-background"
      />
    );
  }
  if (display.status === 'FAILED') {
    return (
      <ReportErrorPlaceholder
        title="This run failed"
        detail={display.errorReason}
      />
    );
  }
  // RUNNING
  return (
    <ReportErrorPlaceholder
      title="Run in progress"
      detail={`Started ${formatDate(display.createdAt)}`}
    />
  );
}

export function InsightsReportView({
  reports: initialReports,
  latest,
  preflight,
}: InsightsReportViewProps) {
  const { data: reports = initialReports } = useInsightsReports(initialReports);
  const [selectedId, setSelectedId] = useState<number | null>(
    latest?.id ?? null
  );

  const selected = useMemo(() => {
    if (selectedId === null) return null;
    return reports.find((r) => r.id === selectedId) ?? null;
  }, [reports, selectedId]);

  const display = selected ?? latest;

  const latestIsRunning = reports.some((r) => r.status === 'RUNNING');
  const canTrigger =
    !latestIsRunning && preflight.shippedSincePreviousRun > 0;
  const refusal = computeRefusal(canTrigger, latestIsRunning);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Claude Code Insights</h1>
          <p className="text-sm text-muted-foreground">
            Shipped Claude tickets since previous run:{' '}
            <strong className="text-foreground">
              {preflight.shippedSincePreviousRun}
            </strong>
            {preflight.previousRunEnd
              ? ` (last analyzed up to ${formatDate(preflight.previousRunEnd)})`
              : ' (no prior run on record)'}
          </p>
        </div>
        <RunAnalysisButton
          preflight={{ canTrigger, refusal }}
          latestIsRunning={latestIsRunning}
        />
      </header>

      {display ? (
        <Card className="aurora-bg-card-blue">
          <CardContent className="p-5">
            <p className="text-sm text-foreground">
              {formatMetadataPhrasing(display)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Report #{display.id} — generated {formatDate(display.generatedAt)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {display ? (
        renderReportBody(display)
      ) : (
        <ReportErrorPlaceholder
          title="No Insights reports yet"
          detail="Trigger a run to generate the first report."
        />
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Past reports
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prior runs.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {reports.map((entry) => {
              const isSelected = entry.id === (selected?.id ?? latest?.id);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(entry.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-accent/40"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {formatDate(entry.generatedAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.periodStart)} → {formatDate(entry.periodEnd)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {entry.sessionsCount !== null ? (
                        <span className="text-xs text-muted-foreground">
                          {entry.sessionsCount} sessions / {entry.ticketsCount ?? 0} tickets
                        </span>
                      ) : null}
                      <Badge variant={statusBadgeVariant(entry.status)}>
                        {entry.status}
                      </Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
