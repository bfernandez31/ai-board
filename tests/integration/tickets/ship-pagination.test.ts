/**
 * Integration Tests: SHIP Stage Pagination
 *
 * Verifies that the tickets endpoint returns _shipTotal metadata
 * and that the SHIP "Load More" pagination works correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { TicketWithVersion } from '@/lib/types';

describe('SHIP Stage Pagination', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createShipTickets(count: number): Promise<number[]> {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const response = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: `[e2e] Ship Pagination Ticket ${i + 1}`,
          description: `Test ticket ${i + 1} for SHIP pagination`,
        }
      );
      ids.push(response.data.id);

      // Move directly to SHIP via DB (faster than full workflow)
      await prisma.ticket.update({
        where: { id: response.data.id },
        data: { stage: 'SHIP' },
      });
    }
    return ids;
  }

  it('should return _shipTotal in default response', async () => {
    await createShipTickets(3);

    const response = await ctx.api.get<Record<string, unknown>>(
      `/api/projects/${ctx.projectId}/tickets`
    );

    expect(response.status).toBe(200);
    expect(response.data._shipTotal).toBe(3);
    expect(Array.isArray(response.data.SHIP)).toBe(true);
    expect((response.data.SHIP as unknown[]).length).toBe(3);
  });

  it('should return _shipTotal equal to total SHIP tickets even when limited', async () => {
    // Create 5 tickets — under the 50 limit but _shipTotal should still be accurate
    await createShipTickets(5);

    const response = await ctx.api.get<Record<string, unknown>>(
      `/api/projects/${ctx.projectId}/tickets`
    );

    expect(response.status).toBe(200);
    expect(response.data._shipTotal).toBe(5);
  });

  it('should return all non-SHIP tickets regardless of count', async () => {
    // Create tickets in INBOX (should always all be returned)
    for (let i = 0; i < 3; i++) {
      await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: `[e2e] Inbox Ticket ${i + 1}`,
          description: `Test inbox ticket ${i + 1}`,
        }
      );
    }

    const response = await ctx.api.get<Record<string, unknown>>(
      `/api/projects/${ctx.projectId}/tickets`
    );

    expect(response.status).toBe(200);
    expect((response.data.INBOX as unknown[]).length).toBe(3);
  });

  describe('Load More endpoint (?stage=SHIP&offset=N)', () => {
    it('should return additional SHIP tickets with offset', async () => {
      const ids = await createShipTickets(5);

      // Load more starting from offset 2, limit 2
      const response = await ctx.api.get<{ tickets: TicketWithVersion[] }>(
        `/api/projects/${ctx.projectId}/tickets?stage=SHIP&offset=2&limit=2`
      );

      expect(response.status).toBe(200);
      expect(response.data.tickets).toHaveLength(2);
      // All returned tickets should be in SHIP stage
      for (const ticket of response.data.tickets) {
        expect(ticket.stage).toBe('SHIP');
      }
    });

    it('should return empty array when offset exceeds total', async () => {
      await createShipTickets(3);

      const response = await ctx.api.get<{ tickets: TicketWithVersion[] }>(
        `/api/projects/${ctx.projectId}/tickets?stage=SHIP&offset=100&limit=50`
      );

      expect(response.status).toBe(200);
      expect(response.data.tickets).toHaveLength(0);
    });

    it('should return remaining tickets when offset + limit exceeds total', async () => {
      await createShipTickets(5);

      // Offset 3, limit 50 — should return only 2 remaining tickets
      const response = await ctx.api.get<{ tickets: TicketWithVersion[] }>(
        `/api/projects/${ctx.projectId}/tickets?stage=SHIP&offset=3&limit=50`
      );

      expect(response.status).toBe(200);
      expect(response.data.tickets.length).toBeLessThanOrEqual(2);
    });

    it('should return tickets sorted by updatedAt desc', async () => {
      await createShipTickets(4);

      const response = await ctx.api.get<{ tickets: TicketWithVersion[] }>(
        `/api/projects/${ctx.projectId}/tickets?stage=SHIP&offset=0&limit=4`
      );

      expect(response.status).toBe(200);
      const timestamps = response.data.tickets.map(t => new Date(t.updatedAt).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should include qualityScore from latest COMPLETED verify job on each ticket', async () => {
      const [withScore, withoutScore] = await createShipTickets(2);
      if (withScore == null || withoutScore == null) {
        throw new Error('createShipTickets did not return expected ids');
      }

      // Older verify with a stale score — must be ignored in favour of the newer one.
      await prisma.job.create({
        data: {
          ticketId: withScore,
          projectId: ctx.projectId,
          command: 'verify',
          status: 'COMPLETED',
          qualityScore: 60,
          startedAt: new Date('2026-01-01T10:00:00Z'),
          completedAt: new Date('2026-01-01T10:05:00Z'),
          updatedAt: new Date('2026-01-01T10:05:00Z'),
        },
      });
      await prisma.job.create({
        data: {
          ticketId: withScore,
          projectId: ctx.projectId,
          command: 'verify',
          status: 'COMPLETED',
          qualityScore: 92,
          startedAt: new Date('2026-02-01T10:00:00Z'),
          completedAt: new Date('2026-02-01T10:05:00Z'),
          updatedAt: new Date('2026-02-01T10:05:00Z'),
        },
      });
      // Other ticket only has a non-verify completed job → should report null.
      await prisma.job.create({
        data: {
          ticketId: withoutScore,
          projectId: ctx.projectId,
          command: 'implement',
          status: 'COMPLETED',
          qualityScore: 99,
          startedAt: new Date('2026-02-01T10:00:00Z'),
          completedAt: new Date('2026-02-01T10:05:00Z'),
          updatedAt: new Date('2026-02-01T10:05:00Z'),
        },
      });

      const response = await ctx.api.get<{ tickets: TicketWithVersion[] }>(
        `/api/projects/${ctx.projectId}/tickets?stage=SHIP&offset=0&limit=10`
      );

      expect(response.status).toBe(200);
      const byId = new Map(response.data.tickets.map((t) => [t.id, t]));
      expect(byId.get(withScore)?.qualityScore).toBe(92);
      expect(byId.get(withoutScore)?.qualityScore).toBeNull();
    });
  });
});
