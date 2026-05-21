/**
 * Translate a per-ticket bulk skip reason into a short human-readable phrase
 * used in the result-summary toast (FR-017).
 */
export function humanizeBulkSkipReason(reason: string): string {
  switch (reason) {
    case 'VERSION_CONFLICT':
      return 'modified by someone else';
    case 'NOT_IN_INBOX':
      return 'no longer in INBOX';
    case 'NOT_FOUND':
      return 'not found';
    case 'ACTIVE_JOB':
      return 'has an active job';
    case 'GITHUB_ERROR':
      return 'branch cleanup failed';
    case 'FORBIDDEN':
      return 'access denied';
    default:
      return reason.toLowerCase().replace(/_/g, ' ');
  }
}

interface BulkSummaryInput {
  successCount: number;
  skipped: Array<{ ticketId: number; reason: string }>;
  verbPast: string;
}

export function formatBulkResultToast({ successCount, skipped, verbPast }: BulkSummaryInput): {
  title: string;
  description?: string;
} {
  if (skipped.length === 0) {
    return {
      title: `${successCount} ${successCount === 1 ? 'ticket' : 'tickets'} ${verbPast}`,
    };
  }
  const reasonCounts = new Map<string, number>();
  for (const s of skipped) {
    reasonCounts.set(s.reason, (reasonCounts.get(s.reason) ?? 0) + 1);
  }
  const reasonText = Array.from(reasonCounts.entries())
    .map(([reason, count]) => `${count} ${humanizeBulkSkipReason(reason)}`)
    .join(', ');

  return {
    title: `${successCount} ${verbPast}, ${skipped.length} skipped`,
    description: reasonText,
  };
}
