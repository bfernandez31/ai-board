/**
 * Build the deterministic Vercel Blob key for an Insights report HTML
 * artifact (AIB-791, D-1). Mirrors `app/lib/logs/artifact-key.ts`.
 *
 * The key is derived from the `InsightsReport.id` primary key so the
 * `<reportId>` → blob mapping is inferable without a lookup column. The
 * row's `artifactKey` column still stores the resolved key explicitly so a
 * future key-shape change does not break old rows.
 */
export function buildInsightsReportKey(reportId: number): string {
  return `insights/reports/${reportId}.html`;
}
