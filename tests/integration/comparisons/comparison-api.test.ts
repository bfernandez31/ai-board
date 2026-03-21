import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';

describe('Comparisons API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons', () => {
    it('returns structured comparison history for any participant ticket', async () => {
      const fixture = await createStructuredComparisonFixture(ctx.projectId);

      const response = await ctx.api.get<{
        comparisons: Array<{
          id: number;
          sourceTicketKey: string;
          participantTicketKeys: string[];
          winnerTicketKey: string;
        }>;
        total: number;
        limit: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${fixture.otherTicket.id}/comparisons`);

      expect(response.status).toBe(200);
      expect(response.data.total).toBe(1);
      expect(response.data.comparisons[0]).toMatchObject({
        id: fixture.comparison.id,
        sourceTicketKey: fixture.sourceTicket.ticketKey,
        winnerTicketKey: fixture.winnerTicket.ticketKey,
      });
      expect(response.data.comparisons[0]?.participantTicketKeys).toEqual([
        fixture.winnerTicket.ticketKey,
        fixture.otherTicket.ticketKey,
      ]);
    });

    it('respects the limit parameter', async () => {
      const fixture = await createStructuredComparisonFixture(ctx.projectId);

      const response = await ctx.api.get<{ limit: number; total: number }>(
        `/api/projects/${ctx.projectId}/tickets/${fixture.otherTicket.id}/comparisons?limit=1`
      );

      expect(response.status).toBe(200);
      expect(response.data.limit).toBe(1);
      expect(response.data.total).toBe(1);
    });

    it('returns 400 for invalid ticket ID', async () => {
      const response = await ctx.api.get<{ code: string }>(
        `/api/projects/${ctx.projectId}/tickets/invalid/comparisons`
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/projects/:projectId/tickets/:id/comparisons/check', () => {
    it('returns latestComparisonId and count for participant tickets', async () => {
      const fixture = await createStructuredComparisonFixture(ctx.projectId);

      const response = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
        latestComparisonId: number | null;
      }>(`/api/projects/${ctx.projectId}/tickets/${fixture.otherTicket.id}/comparisons/check`);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        hasComparisons: true,
        count: 1,
        latestComparisonId: fixture.comparison.id,
      });
    });

    it('returns no history for a ticket without comparison participation', async () => {
      const ticket = await ctx.createTicket({
        title: '[e2e] No comparison ticket',
        description: 'No structured comparison record',
      });

      const response = await ctx.api.get<{
        hasComparisons: boolean;
        count: number;
        latestComparisonId: number | null;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/comparisons/check`);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        hasComparisons: false,
        count: 0,
        latestComparisonId: null,
      });
    });
  });
});
