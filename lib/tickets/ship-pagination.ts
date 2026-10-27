import type { TicketWithVersion } from '@/lib/types';

/** Number of SHIP tickets loaded per batch (initial page and each infinite-scroll batch). */
export const SHIP_BATCH_SIZE = 50;

/** Upper bound on SHIP tickets requested by a background refetch. */
export const SHIP_REFETCH_MAX = 1000;

/**
 * Appends incoming tickets whose id is not already present in `existing` (any stage).
 * Inputs are not mutated.
 */
export function appendUniqueTickets(
  existing: readonly TicketWithVersion[],
  incoming: readonly TicketWithVersion[]
): { tickets: TicketWithVersion[]; addedCount: number } {
  const seen = new Set(existing.map((ticket) => ticket.id));
  const added: TicketWithVersion[] = [];

  for (const ticket of incoming) {
    if (seen.has(ticket.id)) continue;
    seen.add(ticket.id);
    added.push(ticket);
  }

  return { tickets: [...existing, ...added], addedCount: added.length };
}

/** SHIP limit to request on background refetch so the loaded depth is preserved. */
export function computeShipRefetchLimit(loadedShipCount: number): number {
  return Math.min(SHIP_REFETCH_MAX, Math.max(SHIP_BATCH_SIZE, loadedShipCount));
}

/** Count of SHIP-stage tickets in a flat ticket array. */
export function countShipTickets(tickets: readonly TicketWithVersion[] | undefined): number {
  if (!tickets) return 0;
  let count = 0;
  for (const ticket of tickets) {
    if (ticket.stage === 'SHIP') count++;
  }
  return count;
}
