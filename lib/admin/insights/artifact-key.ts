export function buildInsightsReportArtifactKey(reportId: number): string {
  if (!Number.isFinite(reportId) || reportId <= 0 || !Number.isInteger(reportId)) {
    throw new Error(`Invalid report id: ${reportId}`);
  }
  return `insights/reports/${reportId}.html`;
}
