import type { TicketWithVersion } from '@/lib/types';

/** Number of SHIP tickets fetched per batch (matches the SSR initial page size). */
export const SHIP_BATCH_SIZE = 50;

/**
 * Append a fetched SHIP batch to the flat tickets cache, discarding any ticket whose id
 * is already cached (in any stage) or repeated within the batch itself.
 *
 * @returns The merged ticket list and how many batch tickets were actually appended
 */
export function appendShipBatch(
  current: TicketWithVersion[],
  batch: TicketWithVersion[]
): { tickets: TicketWithVersion[]; addedCount: number } {
  const seen = new Set(current.map((ticket) => ticket.id));
  const added: TicketWithVersion[] = [];

  for (const ticket of batch) {
    if (seen.has(ticket.id)) continue;
    seen.add(ticket.id);
    added.push(ticket);
  }

  return {
    tickets: added.length > 0 ? [...current, ...added] : current,
    addedCount: added.length,
  };
}

/**
 * Merge a background refresh with the previous cache so SHIP tickets loaded by scrolling survive.
 * `fresh` wins for every id it contains; previous SHIP tickets absent from `fresh` are appended
 * (preserving their order) until the SHIP count reaches `shipTotal`.
 */
export function mergeRefreshedTickets(
  previous: TicketWithVersion[] | undefined,
  fresh: TicketWithVersion[],
  shipTotal: number
): TicketWithVersion[] {
  if (!previous) return fresh;

  const freshIds = new Set(fresh.map((ticket) => ticket.id));
  let shipCount = fresh.filter((ticket) => ticket.stage === 'SHIP').length;
  const retained: TicketWithVersion[] = [];

  for (const ticket of previous) {
    if (shipCount >= shipTotal) break;
    if (ticket.stage !== 'SHIP' || freshIds.has(ticket.id)) continue;
    freshIds.add(ticket.id);
    retained.push(ticket);
    shipCount++;
  }

  return retained.length > 0 ? [...fresh, ...retained] : fresh;
}
