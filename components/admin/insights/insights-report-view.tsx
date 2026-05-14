'use client';

import { useMemo, useState } from 'react';
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
import { PastReportsTable } from '@/components/admin/insights/past-reports-table';
import { FailureDiagnosticsPanel } from '@/components/admin/insights/failure-diagnostics-panel';

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

function formatMetadataPhrasing(report: ReportListEntry): string {
  const start = formatDate(report.periodStart);
  const end = formatDate(report.periodEnd);
  if (report.status === 'RUNNING') {
    return `Analyzing Claude Code sessions for tickets shipped between ${start} and ${end}…`;
  }
  // Sessions/tickets counts are only meaningful for COMPLETED rows — rendering
  // "Analyzed 0 … 0 …" for a failed row would misrepresent the run.
  if (report.status !== 'COMPLETED' || report.sessionsCount === null) {
    return `Run window: ${start} to ${end} (counts unavailable)`;
  }
  return `Analyzed ${report.sessionsCount} Claude Code sessions across ${
    report.ticketsCount ?? 0
  } tickets shipped between ${start} and ${end}`;
}

function renderReportBody(
  display: ReportListEntry,
  preflight: { canTrigger: boolean; refusal: { refusalCode: string; message: string } | null },
  latestIsRunning: boolean
): React.ReactNode {
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
      <FailureDiagnosticsPanel
        report={display}
        preflight={preflight}
        latestIsRunning={latestIsRunning}
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
  // Live preflight refreshes off the server's authoritative refusal logic
  // so the trigger button re-enables automatically when a RUNNING report
  // transitions and `shippedSincePreviousRun` rolls forward.
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

  // Derive the default display from the live reports list so RUNNING or
  // FAILED entries surface immediately after polling (instead of the
  // empty-state placeholder) when no COMPLETED row exists yet.
  const latestCompleted = useMemo(
    () => reports.find((r) => r.status === 'COMPLETED') ?? null,
    [reports]
  );
  const defaultDisplay = latestCompleted ?? reports[0] ?? latest;
  const display = selected ?? defaultDisplay;
  const effectiveSelectedId = display?.id ?? null;

  const canTrigger = preflight.canTrigger && !latestIsRunning;
  // The API returns refusal messages with ISO timestamps; format them for
  // display while preserving the structured refusalCode contract.
  const refusal = useMemo(() => {
    if (!preflight.refusal) return null;
    const { refusalCode } = preflight.refusal;
    if (refusalCode === 'ALREADY_RUNNING' && preflight.runningSince) {
      return {
        refusalCode,
        message: `A run is already in progress (started ${formatDate(preflight.runningSince)}).`,
      };
    }
    if (refusalCode === 'NO_NEW_SHIPPED' && preflight.previousRunEnd) {
      return {
        refusalCode,
        message: `No new shipped tickets since last run on ${formatDate(preflight.previousRunEnd)}.`,
      };
    }
    return preflight.refusal;
  }, [preflight.refusal, preflight.previousRunEnd, preflight.runningSince]);

  const panelPreflight = { canTrigger, refusal };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Past reports</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prior runs.</p>
        ) : (
          <PastReportsTable
            rows={reports}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
          />
        )}
      </aside>

      <section className="flex flex-col gap-4">
        <header className="flex items-start justify-end gap-4">
          <RunAnalysisButton
            preflight={panelPreflight}
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
          renderReportBody(display, panelPreflight, latestIsRunning)
        ) : (
          <ReportErrorPlaceholder
            title="No Insights reports yet"
            detail="Trigger a run to generate the first report."
          />
        )}
      </section>
    </div>
  );
}
