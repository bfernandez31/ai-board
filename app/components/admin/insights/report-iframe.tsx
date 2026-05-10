'use client';

export interface ReportIframeProps {
  reportId: number;
}

export function ReportIframe({ reportId }: ReportIframeProps): JSX.Element {
  const src = `/api/admin/insights/reports/${reportId}/html`;
  return (
    <div className="flex min-h-[60vh] flex-1">
      <iframe
        key={reportId}
        src={src}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title="Claude Code Insights report"
        data-testid="insights-report-iframe"
        className="h-full min-h-[60vh] w-full rounded-lg border bg-card"
      />
    </div>
  );
}
