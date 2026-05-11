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
  const start = formatDate(report.periodStart);
  const end = formatDate(report.periodEnd);
  if (report.status !== 'COMPLETED' || report.sessionsCount === null) {
    // Sessions/tickets counts are only meaningful for COMPLETED rows.
    // Rendering "Analyzed 0 … 0 …" for an in-flight or failed row would
    // misrepresent the run as having processed zero items.
    if (report.status === 'RUNNING') {
      return `Analyzing Claude Code sessions for tickets shipped between ${start} and ${end}…`;
    }
    return `Run window: ${start} to ${end} (counts unavailable)`;
  }
  return `Analyzed ${report.sessionsCount} Claude Code sessions across ${
    report.ticketsCount ?? 0
  } tickets shipped between ${start} and ${end}`;
}

function statusBadgeVariant(
  status: ReportListEntry['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

interface Refusal {
  refusalCode: 'ALREADY_RUNNING' | 'NO_NEW_SHIPPED' | 'NO_CLAUDE_JOBS';
  message: string;
}

function computeRefusal(
  canTrigger: boolean,
  latestIsRunning: boolean,
  preflight: PreflightSummary
): Refusal | null {
  if (canTrigger) return null;
  if (latestIsRunning) {
    return {
      refusalCode: 'ALREADY_RUNNING',
      message: 'A run is already in progress.',
    };
  }
  // Mirrors `/api/admin/insights/preflight` and `/trigger`: when no prior
  // run exists AND no shipped Claude tickets are eligible, the API returns
  // NO_CLAUDE_JOBS rather than NO_NEW_SHIPPED. The UI must reflect the same
  // distinction so the message lines up with what a POST would return.
  if (
    preflight.previousRunEnd === null &&
    preflight.shippedSincePreviousRun === 0
  ) {
    return {
      refusalCode: 'NO_CLAUDE_JOBS',
      message: 'No shipped Claude tickets to analyze yet.',
    };
  }
  return {
    refusalCode: 'NO_NEW_SHIPPED',
    message: preflight.previousRunEnd
      ? `No new shipped tickets since last run on ${formatDate(preflight.previousRunEnd)}.`
      : 'No new shipped Claude tickets since the last run.',
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

  // Derive the default display from the live reports list so RUNNING or
  // FAILED entries surface immediately after polling (instead of the
  // empty-state placeholder) when no COMPLETED row exists yet.
  const latestCompleted = useMemo(
    () => reports.find((r) => r.status === 'COMPLETED') ?? null,
    [reports]
  );
  const defaultDisplay = latestCompleted ?? reports[0] ?? latest;
  const display = selected ?? defaultDisplay;

  const latestIsRunning = reports.some((r) => r.status === 'RUNNING');
  const canTrigger =
    !latestIsRunning && preflight.shippedSincePreviousRun > 0;
  const refusal = computeRefusal(canTrigger, latestIsRunning, preflight);

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
