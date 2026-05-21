import type { TicketAttachment } from '@/app/lib/types/ticket';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { TicketWithVersion } from '@/lib/types';

/**
 * Compute the next selection after a click at `clickedId`.
 *
 * - When `shiftKey` is false (or there is no anchor yet), toggle just the clicked id.
 * - When `shiftKey` is true and an anchor exists, add every ticket between the
 *   anchor and the clicked id (inclusive, in `allTickets` order) to the current
 *   selection without clearing prior selections.
 */
export function computeRangeSelection(
  allTickets: ReadonlyArray<{ id: number }>,
  anchorId: number | null,
  clickedId: number,
  currentSelection: ReadonlySet<number>,
  shiftKey: boolean,
): Set<number> {
  const next = new Set(currentSelection);
  const toggleClicked = (): Set<number> => {
    if (next.has(clickedId)) next.delete(clickedId);
    else next.add(clickedId);
    return next;
  };

  if (!shiftKey || anchorId == null || anchorId === clickedId) {
    return toggleClicked();
  }

  const anchorIndex = allTickets.findIndex((t) => t.id === anchorId);
  const clickedIndex = allTickets.findIndex((t) => t.id === clickedId);

  if (anchorIndex === -1 || clickedIndex === -1) {
    return toggleClicked();
  }

  const start = Math.min(anchorIndex, clickedIndex);
  const end = Math.max(anchorIndex, clickedIndex);

  for (let i = start; i <= end; i += 1) {
    const id = allTickets[i]?.id;
    if (typeof id === 'number') next.add(id);
  }

  return next;
}

function extractAttachments(ticket: TicketWithVersion): TicketAttachment[] {
  if (!ticket.attachments) return [];
  return isTicketAttachmentArray(ticket.attachments) ? ticket.attachments : [];
}

/**
 * Merge the attachments from the selected tickets:
 * anchor first, then absorbed tickets in ascending-id order, dedup by URL,
 * and clip to `cap` items. Returns the merged list plus the count dropped.
 */
export function mergeAttachments(
  tickets: ReadonlyArray<TicketWithVersion>,
  anchorId: number,
  cap: number,
): { merged: TicketAttachment[]; clippedCount: number } {
  const anchor = tickets.find((t) => t.id === anchorId);
  const others = tickets
    .filter((t) => t.id !== anchorId)
    .slice()
    .sort((a, b) => a.id - b.id);
  const ordered = anchor ? [anchor, ...others] : others;

  const seen = new Set<string>();
  const collected: TicketAttachment[] = [];

  for (const ticket of ordered) {
    for (const attachment of extractAttachments(ticket)) {
      if (seen.has(attachment.url)) continue;
      seen.add(attachment.url);
      collected.push(attachment);
    }
  }

  if (collected.length <= cap) {
    return { merged: collected, clippedCount: 0 };
  }

  return {
    merged: collected.slice(0, cap),
    clippedCount: collected.length - cap,
  };
}

/**
 * Build the fusion description string per FR-009:
 *   anchor body
 *   followed by, for each absorbed ticket in ascending-id order:
 *     "\n\n---\n\n## [TICKET-KEY] <title>\n\n<description>"
 *
 * Empty/null descriptions are treated as empty strings.
 */
export function buildFusionDescription(
  tickets: ReadonlyArray<TicketWithVersion>,
  anchorId: number,
): string {
  const anchor = tickets.find((t) => t.id === anchorId);
  const others = tickets
    .filter((t) => t.id !== anchorId)
    .slice()
    .sort((a, b) => a.id - b.id);

  const parts: string[] = [anchor?.description ?? ''];
  for (const t of others) {
    parts.push(`\n\n---\n\n## [${t.ticketKey}] ${t.title}\n\n${t.description ?? ''}`);
  }
  return parts.join('');
}
