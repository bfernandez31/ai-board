import { formatDistanceToNow, format } from 'date-fns';

/**
 * Format timestamp for display
 * - Relative format if < 24 hours (e.g., "2 hours ago")
 * - Absolute format if >= 24 hours (e.g., "2025-09-30 14:30")
 */
export function formatTimestamp(date: Date): string {
  const hoursSince = (Date.now() - date.getTime()) / (1000 * 60 * 60);

  if (hoursSince < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return format(date, 'yyyy-MM-dd HH:mm');
}
