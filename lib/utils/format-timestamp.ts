/**
 * Format timestamp for tooltip display
 *
 * Converts Date objects or ISO strings into human-readable relative or absolute time.
 *
 * @param timestamp - Date object, ISO string, or null
 * @returns Formatted string (e.g., "2 minutes ago", "Oct 24, 3:42 PM")
 *
 * @example
 * formatTimestamp(new Date()) // "just now"
 * formatTimestamp(new Date('2025-10-24T15:40:00')) // "2 minutes ago"
 * formatTimestamp(new Date('2025-10-23T10:00:00')) // "Oct 23, 10:00 AM"
 * formatTimestamp(null) // "Unknown time"
 */
export function formatTimestamp(timestamp: Date | string | null): string {
  try {
    // Handle null or empty string
    if (!timestamp) {
      return 'Unknown time';
    }

    // Convert to Date object if needed
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // Validate date
    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    // Get browser locale
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

    // < 1 minute: "just now"
    if (diffMinutes < 1) {
      return 'just now';
    }

    // < 1 hour: "X minutes ago"
    if (diffHours < 1) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
      return rtf.format(-diffMinutes, 'minute');
    }

    // Check if same day (< 24 hours and same calendar date)
    const isSameDay =
      diffHours < 24 &&
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isSameDay) {
      // Same day: time only (e.g., "3:42 PM")
      const dtf = new Intl.DateTimeFormat(locale, {
        timeStyle: 'short',
      });
      return dtf.format(date);
    }

    // Older than same day: date + time (e.g., "Oct 24, 3:42 PM")
    const dtf = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return dtf.format(date);
  } catch (error) {
    console.error('formatTimestamp error:', error);
    return 'Unknown time';
  }
}
