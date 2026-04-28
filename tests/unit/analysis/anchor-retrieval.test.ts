import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ticketOutcome: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/db/client';
import { selectAnchors } from '@/lib/analysis/anchor-retrieval';

interface OutcomeRow {
  ticketId: number;
  ticket: { ticketKey: string };
  domains: string[];
  frictionFree: boolean;
  qualityScore: number | null;
  touchedDbSchema: boolean;
  touchedTests: boolean;
  touchedCi: boolean;
  shippedAt: Date;
}

function row(partial: Partial<OutcomeRow>): OutcomeRow {
  return {
    ticketId: 1,
    ticket: { ticketKey: 'AIB-1' },
    domains: [],
    frictionFree: false,
    qualityScore: 80,
    touchedDbSchema: false,
    touchedTests: false,
    touchedCi: false,
    shippedAt: new Date('2026-04-01'),
    ...partial,
  };
}

const mockedFindMany = prisma.ticketOutcome.findMany as unknown as ReturnType<typeof vi.fn>;

describe('selectAnchors', () => {
  beforeEach(() => {
    mockedFindMany.mockReset();
  });

  it('scores by domain overlap (>1 wins)', async () => {
    mockedFindMany.mockResolvedValueOnce([
      row({ ticketId: 1, ticket: { ticketKey: 'AIB-1' }, domains: ['app'] }),
      row({ ticketId: 2, ticket: { ticketKey: 'AIB-2' }, domains: ['app', 'lib'] }),
      row({ ticketId: 3, ticket: { ticketKey: 'AIB-3' }, domains: ['app', 'lib', 'tests'] }),
    ]);

    const r = await selectAnchors(7, ['app', 'lib', 'tests']);
    expect(r.coldStart).toBe(false);
    expect(r.anchors[0].ticketKey).toBe('AIB-3');
    expect(r.anchors[0].overlapStrength).toBe(3);
  });

  it('breaks ties on tagOverlap', async () => {
    mockedFindMany.mockResolvedValueOnce([
      row({ ticketId: 1, ticket: { ticketKey: 'AIB-1' }, domains: ['app'], touchedTests: false, shippedAt: new Date('2026-04-10') }),
      row({ ticketId: 2, ticket: { ticketKey: 'AIB-2' }, domains: ['app'], touchedTests: true, shippedAt: new Date('2026-04-09') }),
      row({ ticketId: 3, ticket: { ticketKey: 'AIB-3' }, domains: ['app'], touchedTests: false, shippedAt: new Date('2026-04-08') }),
    ]);

    const r = await selectAnchors(7, ['app'], { tagHints: { touchesTests: true } });
    expect(r.anchors[0].ticketKey).toBe('AIB-2');
  });

  it('breaks remaining ties on recency (shippedAt DESC)', async () => {
    mockedFindMany.mockResolvedValueOnce([
      row({ ticketId: 1, ticket: { ticketKey: 'AIB-1' }, domains: ['app'], shippedAt: new Date('2026-04-09') }),
      row({ ticketId: 2, ticket: { ticketKey: 'AIB-2' }, domains: ['app'], shippedAt: new Date('2026-04-10') }),
      row({ ticketId: 3, ticket: { ticketKey: 'AIB-3' }, domains: ['app'], shippedAt: new Date('2026-04-08') }),
    ]);

    const r = await selectAnchors(7, ['app']);
    expect(r.anchors[0].ticketKey).toBe('AIB-2');
  });

  it('filters out outcomes with overlap < 1', async () => {
    mockedFindMany.mockResolvedValueOnce([
      row({ ticketId: 1, ticket: { ticketKey: 'AIB-1' }, domains: ['app'] }),
      row({ ticketId: 2, ticket: { ticketKey: 'AIB-2' }, domains: ['unrelated'] }),
      row({ ticketId: 3, ticket: { ticketKey: 'AIB-3' }, domains: ['app'] }),
      row({ ticketId: 4, ticket: { ticketKey: 'AIB-4' }, domains: ['app'] }),
    ]);

    const r = await selectAnchors(7, ['app']);
    expect(r.coldStart).toBe(false);
    expect(r.anchors.map((a) => a.ticketKey)).not.toContain('AIB-2');
  });

  it('returns coldStart=true when fewer than 3 qualifying anchors', async () => {
    mockedFindMany.mockResolvedValueOnce([
      row({ ticketId: 1, ticket: { ticketKey: 'AIB-1' }, domains: ['app'] }),
      row({ ticketId: 2, ticket: { ticketKey: 'AIB-2' }, domains: ['unrelated'] }),
    ]);

    const r = await selectAnchors(7, ['app']);
    expect(r.coldStart).toBe(true);
    expect(r.reason).toBe('insufficient_comparable_history');
    expect(r.anchors).toEqual([]);
  });

  it('queries only non-partial outcomes (FR-012/FR-013)', async () => {
    mockedFindMany.mockResolvedValueOnce([]);
    await selectAnchors(7, ['app']);
    expect(mockedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: 7, partial: false }),
      })
    );
  });

  it('persists candidate ticket ids for downstream PATCH validation', async () => {
    mockedFindMany.mockResolvedValueOnce([
      row({ ticketId: 1, ticket: { ticketKey: 'AIB-1' }, domains: ['app'] }),
      row({ ticketId: 2, ticket: { ticketKey: 'AIB-2' }, domains: ['app'] }),
      row({ ticketId: 3, ticket: { ticketKey: 'AIB-3' }, domains: ['app'] }),
      row({ ticketId: 4, ticket: { ticketKey: 'AIB-4' }, domains: ['lib'] }),
    ]);

    const r = await selectAnchors(7, ['app']);
    expect(r.candidateTicketIds).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(r.candidateTicketIds.length).toBeLessThanOrEqual(50);
  });
});
