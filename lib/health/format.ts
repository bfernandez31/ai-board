/** Format issue count for display */
export function formatIssues(value: number | null): string {
  if (value === null) return '—';
  return String(value);
}

/** Format cost in USD for display */
export function formatCost(value: number | null): string {
  if (value === null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

/** Format token count with compact notation */
export function formatTokens(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(value);
}

/** Format duration from milliseconds to human-readable */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return '< 1s';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
