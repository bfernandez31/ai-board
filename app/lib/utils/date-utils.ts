// Date formatting utilities for notifications

import { formatDistanceToNow, format, differenceInDays } from 'date-fns';

/**
 * Format notification timestamp for display
 * - Recent (<3 days): Relative time ("2 hours ago", "just now")
 * - Older (>=3 days): Absolute date ("Nov 20, 2025")
 *
 * @param date - Date object or ISO string to format
 * @returns Formatted time string
 *
 * @example
 * formatNotificationTime(new Date()) // "just now"
 * formatNotificationTime(new Date(Date.now() - 2 * 60 * 60 * 1000)) // "2 hours ago"
 * formatNotificationTime(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)) // "Nov 19, 2025"
 */
export function formatNotificationTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const daysAgo = differenceInDays(new Date(), dateObj);

  if (daysAgo < 3) {
    // Recent: "2 hours ago", "just now"
    const distance = formatDistanceToNow(dateObj, { addSuffix: true });
    return distance === 'less than a minute ago' ? 'just now' : distance;
  }

  // Older: "Nov 20, 2025"
  return format(dateObj, 'MMM d, yyyy');
}
