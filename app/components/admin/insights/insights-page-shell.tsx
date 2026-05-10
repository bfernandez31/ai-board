'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MetadataHeader } from './metadata-header';
import { ReportIframe } from './report-iframe';
import {
  PastReportsList,
  type InsightsReportSummary,
} from './past-reports-list';
import { TriggerRunButton } from './trigger-run-button';
import {
  useAdminInsightsList,
  type AdminInsightsListResponse,
} from '@/app/hooks/admin/use-admin-insights-list';

export interface InsightsPageShellProps {
  initialData: AdminInsightsListResponse;
}

function pickDefaultSelected(
  reports: InsightsReportSummary[]
): number | null {
  const latestCompleted = reports.find((r) => r.status === 'COMPLETED');
  return latestCompleted?.id ?? null;
}

export function InsightsPageShell({
  initialData,
}: InsightsPageShellProps): JSX.Element {
  const query = useAdminInsightsList(initialData);
  const data = query.data ?? initialData;

  const reports = data.reports;
  const defaultSelected = useMemo(() => pickDefaultSelected(reports), [reports]);
  const [selectedId, setSelectedId] = useState<number | null>(defaultSelected);

  const effectiveSelectedId =
    selectedId !== null && reports.some((r) => r.id === selectedId)
      ? selectedId
      : defaultSelected;

  const selectedReport =
    effectiveSelectedId !== null
      ? reports.find((r) => r.id === effectiveSelectedId) ?? null
      : null;

  if (reports.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex justify-end">
          <TriggerRunButton runningReportId={data.runningReportId} />
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No analysis has been run yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="insights-page-shell">
      <div className="flex justify-end">
        <TriggerRunButton runningReportId={data.runningReportId} />
      </div>
      {selectedReport && selectedReport.status === 'COMPLETED' ? (
        <>
          <MetadataHeader
            sessionsCount={selectedReport.sessionsCount ?? 0}
            ticketsCount={selectedReport.ticketsCount ?? 0}
            periodStart={selectedReport.periodStart}
            periodEnd={selectedReport.periodEnd}
          />
          <ReportIframe reportId={selectedReport.id} />
        </>
      ) : selectedReport && selectedReport.status === 'FAILED' ? (
        <Card>
          <CardContent className="pt-6">
            <p
              className="text-sm text-destructive"
              data-testid="insights-failed-placeholder"
            >
              Failed: {selectedReport.errorReason ?? 'unknown error'}
            </p>
          </CardContent>
        </Card>
      ) : selectedReport && selectedReport.status === 'RUNNING' ? (
        <Card>
          <CardContent className="pt-6">
            <p
              className="text-sm text-muted-foreground"
              data-testid="insights-running-placeholder"
            >
              Running…
            </p>
          </CardContent>
        </Card>
      ) : null}
      <PastReportsList
        reports={reports}
        selectedReportId={effectiveSelectedId}
        onSelect={(id) => setSelectedId(id)}
      />
    </div>
  );
}
