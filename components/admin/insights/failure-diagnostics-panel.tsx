'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { ReportListEntry } from '@/app/lib/insights/repository';
import { buildInsightsRunUrl } from '@/lib/admin/insights-github-url';
import { RunAnalysisButton } from '@/components/admin/insights/run-analysis-button';

interface FailureDiagnosticsPanelProps {
  report: ReportListEntry;
  preflight: {
    canTrigger: boolean;
    refusal: { refusalCode: string; message: string } | null;
  };
  latestIsRunning: boolean;
  /** Optional override for the GitHub Actions URL composer — primarily for
   *  tests that need to bypass `process.env`. */
  buildUrl?: typeof buildInsightsRunUrl;
}

const FALLBACK_REASON =
  'Run failed without a recorded reason — open the workflow run for details';

export function FailureDiagnosticsPanel({
  report,
  preflight,
  latestIsRunning,
  buildUrl = buildInsightsRunUrl,
}: FailureDiagnosticsPanelProps) {
  const url = buildUrl(report.workflowRunId);
  const reason = report.errorReason && report.errorReason.trim().length > 0
    ? report.errorReason
    : FALLBACK_REASON;

  return (
    <Card className="aurora-bg-card-blue">
      <CardContent className="flex flex-col gap-4 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">This run failed</p>
        <div className="whitespace-pre-wrap text-sm text-foreground">
          {reason}
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            Open workflow run on GitHub
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            No workflow run is associated with this report
          </p>
        )}
        <div className="flex justify-start">
          <RunAnalysisButton
            preflight={preflight}
            latestIsRunning={latestIsRunning}
            label="Reessayer"
          />
        </div>
      </CardContent>
    </Card>
  );
}
