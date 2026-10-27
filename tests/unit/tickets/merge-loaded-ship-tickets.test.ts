import { describe, it, expect } from 'vitest';
import { mergeLoadedShipTickets } from '@/app/lib/hooks/queries/useTickets';
import type { TicketWithVersion } from '@/app/lib/types/query-types';

function t(id: number, stage: string = 'SHIP'): TicketWithVersion {
  return { id, stage } as unknown as TicketWithVersion;
}

describe('mergeLoadedShipTickets', () => {
  it('returns the fresh list when there is no previous cache', () => {
    const fresh = [t(1, 'INBOX'), t(2)];
    expect(mergeLoadedShipTickets(fresh, undefined, 2)).toBe(fresh);
  });

  it('keeps SHIP tickets loaded by infinite scroll across a refetch', () => {
    const previous = [t(1, 'INBOX'), t(2), t(3), t(4), t(5)];
    const fresh = [t(1, 'INBOX'), t(2), t(3)]; // first SHIP batch only
    const merged = mergeLoadedShipTickets(fresh, previous, 4);
    expect(merged.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('never duplicates tickets already in the fresh response', () => {
    const previous = [t(2), t(3), t(4)];
    const fresh = [t(9), t(2), t(3)]; // ticket 9 newly shipped, 4 shifted out of first batch
    const merged = mergeLoadedShipTickets(fresh, previous, 4);
    expect(merged.map((x) => x.id)).toEqual([9, 2, 3, 4]);
    expect(new Set(merged.map((x) => x.id)).size).toBe(merged.length);
  });

  it('does not keep previous tickets that are no longer SHIP in the cache', () => {
    const previous = [t(2), t(3, 'CLOSED')];
    const fresh = [t(2)];
    expect(mergeLoadedShipTickets(fresh, previous, 5).map((x) => x.id)).toEqual([2]);
  });

  it('caps retained tickets so SHIP count never exceeds the total', () => {
    const previous = [t(1), t(2), t(3), t(4)];
    const fresh = [t(1), t(2)];
    expect(mergeLoadedShipTickets(fresh, previous, 3).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(mergeLoadedShipTickets(fresh, previous, 2)).toBe(fresh);
  });
});
