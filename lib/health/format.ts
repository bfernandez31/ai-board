/** Format cost in USD with 2 decimal places */
export function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(2)}`;
}

/** Format token count with k/M abbreviation */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return String(tokens);
}

/** Format duration from ms to human-readable */
export function formatDuration(ms: number): string {
  if (ms >= 60_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1_000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${(ms / 1_000).toFixed(1)}s`;
}
