import { describe, it, expect } from 'vitest';
import {
  SHIP_BATCH_SIZE,
  appendShipBatch,
  mergeRefreshedTickets,
} from '@/lib/tickets/ship-pagination';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(id: number, stage: string = 'SHIP'): TicketWithVersion {
  return { id, stage, ticketKey: `AIB-${id}`, title: `Ticket ${id}` } as unknown as TicketWithVersion;
}

const ids = (tickets: TicketWithVersion[]) => tickets.map((t) => t.id);

describe('SHIP_BATCH_SIZE', () => {
  it('is 50', () => {
    expect(SHIP_BATCH_SIZE).toBe(50);
  });
});

describe('appendShipBatch', () => {
  it('appends unseen batch tickets after current, preserving order', () => {
    const result = appendShipBatch([makeTicket(1), makeTicket(2)], [makeTicket(3), makeTicket(4)]);
    expect(ids(result.tickets)).toEqual([1, 2, 3, 4]);
    expect(result.addedCount).toBe(2);
  });

  it('drops batch tickets already cached in any stage', () => {
    const current = [makeTicket(1), makeTicket(2, 'VERIFY')];
    const result = appendShipBatch(current, [makeTicket(2), makeTicket(3)]);
    expect(ids(result.tickets)).toEqual([1, 2, 3]);
    expect(result.tickets[1]?.stage).toBe('VERIFY');
    expect(result.addedCount).toBe(1);
  });

  it('leaves tickets unchanged when the whole batch is duplicated', () => {
    const current = [makeTicket(1), makeTicket(2)];
    const result = appendShipBatch(current, [makeTicket(1), makeTicket(2)]);
    expect(ids(result.tickets)).toEqual([1, 2]);
    expect(result.addedCount).toBe(0);
  });

  it('reports zero added for an empty batch', () => {
    const result = appendShipBatch([makeTicket(1)], []);
    expect(ids(result.tickets)).toEqual([1]);
    expect(result.addedCount).toBe(0);
  });

  it('adds duplicates inside the batch only once', () => {
    const result = appendShipBatch([], [makeTicket(5), makeTicket(5), makeTicket(6)]);
    expect(ids(result.tickets)).toEqual([5, 6]);
    expect(result.addedCount).toBe(2);
  });
});

describe('mergeRefreshedTickets', () => {
  it('returns fresh when there is no previous cache', () => {
    const fresh = [makeTicket(1)];
    expect(mergeRefreshedTickets(undefined, fresh, 10)).toBe(fresh);
  });

  it('appends previous SHIP tickets missing from fresh, in previous order', () => {
    const previous = [makeTicket(1), makeTicket(2), makeTicket(3), makeTicket(4)];
    const fresh = [makeTicket(1), makeTicket(2)];
    expect(ids(mergeRefreshedTickets(previous, fresh, 10))).toEqual([1, 2, 3, 4]);
  });

  it('uses the fresh copy when a ticket is in both lists', () => {
    const previous = [makeTicket(1), makeTicket(2)];
    const fresh = [makeTicket(1), makeTicket(2, 'VERIFY')];
    const result = mergeRefreshedTickets(previous, fresh, 10);
    expect(ids(result)).toEqual([1, 2]);
    expect(result[1]?.stage).toBe('VERIFY');
  });

  it('caps retained SHIP tickets so the SHIP count does not exceed shipTotal', () => {
    const previous = [makeTicket(1), makeTicket(2), makeTicket(3), makeTicket(4)];
    const fresh = [makeTicket(1)];
    expect(ids(mergeRefreshedTickets(previous, fresh, 3))).toEqual([1, 2, 3]);
  });

  it('does not retain previous non-SHIP tickets absent from fresh', () => {
    const previous = [makeTicket(1, 'INBOX'), makeTicket(2, 'BUILD'), makeTicket(3)];
    const fresh = [makeTicket(4, 'INBOX')];
    expect(ids(mergeRefreshedTickets(previous, fresh, 10))).toEqual([4, 3]);
  });

  it('returns unique ids', () => {
    const previous = [makeTicket(1), makeTicket(2), makeTicket(2), makeTicket(3)];
    const fresh = [makeTicket(1)];
    const result = ids(mergeRefreshedTickets(previous, fresh, 10));
    expect(new Set(result).size).toBe(result.length);
  });
});
