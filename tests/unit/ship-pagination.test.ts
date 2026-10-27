import { describe, it, expect } from 'vitest';
import {
  SHIP_BATCH_SIZE,
  SHIP_REFETCH_MAX,
  appendUniqueTickets,
  computeShipRefetchLimit,
  countShipTickets,
} from '@/lib/tickets/ship-pagination';
import type { TicketWithVersion } from '@/lib/types';

function makeTicket(id: number, stage: string = 'SHIP'): TicketWithVersion {
  return { id, stage, ticketKey: `AIB-${id}` } as unknown as TicketWithVersion;
}

describe('ship-pagination constants', () => {
  it('uses a batch size of 50 and a refetch cap of 1000', () => {
    expect(SHIP_BATCH_SIZE).toBe(50);
    expect(SHIP_REFETCH_MAX).toBe(1000);
  });
});

describe('appendUniqueTickets', () => {
  it('appends new tickets after existing ones, preserving order', () => {
    const existing = [makeTicket(1), makeTicket(2)];
    const incoming = [makeTicket(3), makeTicket(4)];

    const result = appendUniqueTickets(existing, incoming);

    expect(result.tickets.map((t) => t.id)).toEqual([1, 2, 3, 4]);
    expect(result.addedCount).toBe(2);
  });

  it('drops incoming tickets whose id already exists in any stage', () => {
    const existing = [makeTicket(1, 'INBOX'), makeTicket(2)];
    const incoming = [makeTicket(1), makeTicket(2), makeTicket(5)];

    const result = appendUniqueTickets(existing, incoming);

    expect(result.tickets.map((t) => t.id)).toEqual([1, 2, 5]);
    expect(result.tickets[0]?.stage).toBe('INBOX');
    expect(result.addedCount).toBe(1);
  });

  it('dedupes repeated ids within the incoming batch', () => {
    const result = appendUniqueTickets([], [makeTicket(7), makeTicket(7)]);
    expect(result.tickets.map((t) => t.id)).toEqual([7]);
    expect(result.addedCount).toBe(1);
  });

  it('reports 0 added when everything is a duplicate or incoming is empty', () => {
    const existing = [makeTicket(1)];
    expect(appendUniqueTickets(existing, [makeTicket(1)]).addedCount).toBe(0);
    expect(appendUniqueTickets(existing, []).addedCount).toBe(0);
  });

  it('does not mutate its inputs', () => {
    const existing = [makeTicket(1)];
    const incoming = [makeTicket(2)];

    appendUniqueTickets(existing, incoming);

    expect(existing.map((t) => t.id)).toEqual([1]);
    expect(incoming.map((t) => t.id)).toEqual([2]);
  });
});

describe('computeShipRefetchLimit', () => {
  it.each([
    [0, 50],
    [49, 50],
    [120, 120],
    [1000, 1000],
    [5000, 1000],
  ])('maps %i loaded tickets to a limit of %i', (loaded, expected) => {
    expect(computeShipRefetchLimit(loaded)).toBe(expected);
  });
});

describe('countShipTickets', () => {
  it('returns 0 for undefined or empty input', () => {
    expect(countShipTickets(undefined)).toBe(0);
    expect(countShipTickets([])).toBe(0);
  });

  it('counts only SHIP-stage tickets', () => {
    const tickets = [makeTicket(1), makeTicket(2, 'INBOX'), makeTicket(3), makeTicket(4, 'VERIFY')];
    expect(countShipTickets(tickets)).toBe(2);
  });
});
