/**
 * Format a duration in milliseconds to human-readable string.
 * Returns 'N/A' for zero or negative values.
 *
 * Examples: "500ms", "45s", "3m 20s", "2h 15m"
 */
export function formatDurationMs(ms: number): string {
  if (ms <= 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
