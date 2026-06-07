'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  useInsightsReports,
} from '@/app/lib/hooks/queries/use-insights-reports';
import {
  useInsightsPreflight,
  type InsightsPreflight,
} from '@/app/lib/hooks/queries/use-insights-preflight';
import type { ReportListEntry } from '@/app/lib/insights/repository';
import { ReportErrorPlaceholder } from '@/components/admin/insights/report-error-placeholder';
import { RunAnalysisButton } from '@/components/admin/insights/run-analysis-button';
import { ExternalLink } from 'lucide-react';

interface InsightsReportViewProps {
  reports: ReportListEntry[];
  latest: ReportListEntry | null;
  preflight: InsightsPreflight;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function formatDuration(createdAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  if (ms < 0 || Number.isNaN(ms)) return null;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function compactPeriod(start: string, end: string): string {
  return `${formatDate(start)} → ${formatDate(end)}`;
}

function formatMetadataPhrasing(report: ReportListEntry): string {
  const start = formatDate(report.periodStart);
  const end = formatDate(report.periodEnd);
  if (report.status !== 'COMPLETED' || report.sessionsCount === null) {
    if (report.status === 'RUNNING') {
      return `Analyzing Claude Code sessions between ${start} and ${end}…`;
    }
    return `Run window: ${start} to ${end} (counts unavailable)`;
  }
  // AIB-852 (FR-011/012): analyzed-vs-expected sessions. When the expected
  // count is unknown (legacy COMPLETED rows predating this feature) fall back
  // to the analyzed count alone.
  const analyzed = report.sessionsCount;
  const expected = report.expectedSessionsCount ?? analyzed;
  const tickets = report.ticketsCount ?? 0;
  return `Analyzed ${analyzed} of ${expected} Claude Code sessions across ${tickets} tickets between ${start} and ${end}`;
}

function statusBadgeVariant(
  status: ReportListEntry['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
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
  preflight: initialPreflight,
}: InsightsReportViewProps) {
  const { data: reports = initialReports } = useInsightsReports(initialReports);
  const latestIsRunning = reports.some((r) => r.status === 'RUNNING');
  const { data: preflight = initialPreflight } = useInsightsPreflight(
    initialPreflight,
    latestIsRunning
  );

  const [selectedId, setSelectedId] = useState<number | null>(
    latest?.id ?? null
  );

  const selected = useMemo(() => {
    if (selectedId === null) return null;
    return reports.find((r) => r.id === selectedId) ?? null;
  }, [reports, selectedId]);

  const latestCompleted = useMemo(
    () => reports.find((r) => r.status === 'COMPLETED') ?? null,
    [reports]
  );
  const defaultDisplay = latestCompleted ?? reports[0] ?? latest;
  const display = selected ?? defaultDisplay;

  const canTrigger = preflight.canTrigger && !latestIsRunning;
  const refusal = useMemo(() => {
    if (!preflight.refusal) return null;
    const { refusalCode } = preflight.refusal;
    if (refusalCode === 'ALREADY_RUNNING' && preflight.runningSince) {
      return {
        refusalCode,
        message: `A run is already in progress (started ${formatDate(preflight.runningSince)}).`,
      };
    }
    if (refusalCode === 'NO_NEW_SESSIONS' && preflight.previousRunEnd) {
      return {
        refusalCode,
        message: `No new Claude sessions since last run on ${formatDate(preflight.previousRunEnd)}.`,
      };
    }
    return preflight.refusal;
  }, [preflight.refusal, preflight.previousRunEnd, preflight.runningSince]);

  // Retries bypass NO_CLAUDE_SESSIONS / NO_NEW_SESSIONS on the server (the
  // original run already proved eligibility for that window). Only the
  // concurrency gate and the latestIsRunning short-circuit apply here, so
  // the retry button stays enabled even when the header is gated by
  // shipped-count refusals. The message is also reworded so the admin can
  // tell which button is blocked.
  const retryRefusalCode = preflight.refusal?.refusalCode ?? null;
  const retryCanTrigger =
    !latestIsRunning && retryRefusalCode !== 'ALREADY_RUNNING';
  const retryRefusal =
    retryRefusalCode === 'ALREADY_RUNNING'
      ? {
          refusalCode: 'ALREADY_RUNNING',
          message: preflight.runningSince
            ? `Another analysis is running (started ${formatDate(preflight.runningSince)}) — retry will be available when it finishes.`
            : 'Another analysis is running — retry will be available when it finishes.',
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Analyzable Claude sessions since previous run:{' '}
          <strong className="text-foreground">
            {preflight.analyzableSessions}
          </strong>
          {preflight.previousRunEnd
            ? ` (last analyzed up to ${formatDate(preflight.previousRunEnd)})`
            : ' (no prior run on record)'}
        </p>
        <RunAnalysisButton
          preflight={{ canTrigger, refusal }}
          latestIsRunning={latestIsRunning}
        />
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        <aside className="w-full md:w-[280px] md:shrink-0">
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prior runs.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {reports.map((entry) => {
                const isSelected = entry.id === (display?.id ?? null);
                // FR-006/FR-007: duration is a COMPLETED-only column. FAILED
                // rows also have `completedAt` (set by `markFailed`), but
                // showing wall-clock time on a failure is misleading.
                const duration =
                  entry.status === 'COMPLETED'
                    ? formatDuration(entry.createdAt, entry.completedAt)
                    : null;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`Report ${formatDate(entry.generatedAt)} ${entry.status}`}
                      onClick={() => setSelectedId(entry.id)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent/40 ${
                        isSelected
                          ? 'bg-accent/50 border-l-2 border-primary'
                          : ''
                      }`}
                    >
                      <span className="truncate font-medium text-foreground">
                        {formatDate(entry.generatedAt)}
                      </span>
                      <span className="hidden truncate text-muted-foreground sm:inline">
                        {compactPeriod(entry.periodStart, entry.periodEnd)}
                      </span>
                      {duration && (
                        <span className="text-muted-foreground">{duration}</span>
                      )}
                      <Badge
                        variant={statusBadgeVariant(entry.status)}
                        className="ml-auto text-[10px] px-1.5 py-0"
                      >
                        {entry.status}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="flex-1 min-w-0">
          {display ? (
            <div className="flex flex-col gap-4">
              <Card className="aurora-bg-card-blue">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-foreground">
                      {formatMetadataPhrasing(display)}
                    </p>
                    {display.coverageGapReason && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-500/50 text-amber-600 dark:text-amber-400"
                      >
                        Coverage gap
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Report #{display.id} — generated {formatDate(display.generatedAt)}
                  </p>
                </CardContent>
              </Card>
              {display.status === 'FAILED' && (
                <div className="flex items-center gap-3">
                  {display.githubActionsUrl && (
                    <a
                      href={display.githubActionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View GitHub Actions run
                    </a>
                  )}
                  <RunAnalysisButton
                    preflight={{
                      canTrigger: retryCanTrigger,
                      refusal: retryRefusal,
                    }}
                    latestIsRunning={latestIsRunning}
                    retryPeriod={{
                      periodStart: display.periodStart,
                      periodEnd: display.periodEnd,
                    }}
                  />
                </div>
              )}
              {renderReportBody(display)}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <ReportErrorPlaceholder
                title="No Insights reports yet"
                detail="Trigger a run to generate the first report."
              />
              <RunAnalysisButton
                preflight={{ canTrigger, refusal }}
                latestIsRunning={latestIsRunning}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
