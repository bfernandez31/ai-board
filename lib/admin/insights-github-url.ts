/**
 * Composes the GitHub Actions workflow run URL for a given Insights report's
 * underlying job. Returns null when any input is missing or invalid so callers
 * can render a fallback message instead of a broken link (FR-013).
 */
export function buildInsightsRunUrl(
  workflowRunId: string | null,
  owner?: string,
  repo?: string
): string | null {
  if (!workflowRunId || !/^[0-9]+$/.test(workflowRunId)) return null;
  const resolvedOwner = owner ?? process.env.GITHUB_OWNER;
  const resolvedRepo = repo ?? process.env.GITHUB_REPO;
  if (!resolvedOwner || !resolvedRepo) return null;
  return `https://github.com/${resolvedOwner}/${resolvedRepo}/actions/runs/${workflowRunId}`;
}
