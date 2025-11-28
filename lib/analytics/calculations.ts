/**
 * Analytics calculation utilities
 *
 * Pure functions for calculating metrics from telemetry data
 */

/**
 * Calculates cache efficiency as percentage of input tokens served from cache.
 * Formula: (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100
 *
 * @param inputTokens - Non-cached input tokens
 * @param cacheReadTokens - Cached input tokens
 * @returns Efficiency percentage (0-100), or 0 if no tokens
 */
export function calculateCacheEfficiency(
  inputTokens: number,
  cacheReadTokens: number
): number {
  const total = inputTokens + cacheReadTokens;
  if (total === 0) return 0;
  return (cacheReadTokens / total) * 100;
}

/**
 * Calculates success rate as percentage of completed jobs vs terminal jobs.
 * Formula: (COMPLETED / (COMPLETED + FAILED + CANCELLED)) * 100
 *
 * @param completed - Number of COMPLETED jobs
 * @param failed - Number of FAILED jobs
 * @param cancelled - Number of CANCELLED jobs
 * @returns Success rate percentage (0-100), or null if no terminal jobs
 */
export function calculateSuccessRate(
  completed: number,
  failed: number,
  cancelled: number
): number | null {
  const total = completed + failed + cancelled;
  if (total === 0) return null;
  return (completed / total) * 100;
}

/**
 * Formats duration in milliseconds to human-readable format
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration (e.g., "2m 34s" or "45s")
 */
export function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
