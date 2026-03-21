import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';

describe('Comparison detail route', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns structured detail payload for a participating ticket', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    const response = await ctx.api.get<{
      id: number;
      winnerTicketKey: string;
      participants: Array<{
        ticketKey: string;
        workflowType: string;
        agent: string | null;
        quality: {
          state: string;
          score: number | null;
          threshold: string | null;
          detailsState: string;
          details: { ticketKey: string } | null;
        };
        operational: {
          totalTokens: { state: string; value: number | null; isBest: boolean };
          model: { label: string | null; mixedModels: boolean };
        };
      }>;
      decisionPoints: Array<{ title: string }>;
      complianceRows: Array<{ principleKey: string }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.otherTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(fixture.comparison.id);
    expect(response.data.winnerTicketKey).toBe(fixture.winnerTicket.ticketKey);
    expect(response.data.participants[0]?.quality).toEqual(
      expect.objectContaining({
        state: 'available',
        score: 91,
        threshold: 'Excellent',
        detailsState: 'available',
        details: expect.objectContaining({ ticketKey: fixture.winnerTicket.ticketKey }),
      })
    );
    expect(response.data.participants[0]?.operational.totalTokens).toEqual(
      expect.objectContaining({ state: 'available', value: 2400, isBest: false })
    );
    expect(response.data.participants[1]?.operational.totalTokens.state).toBe('pending');
    expect(response.data.participants[2]?.workflowType).toBe('QUICK');
    expect(response.data.participants[2]?.agent).toBe('CLAUDE');
    expect(response.data.participants[2]?.quality.detailsState).toBe('summary_only');
    expect(response.data.participants[2]?.operational.model).toEqual(
      expect.objectContaining({ label: 'Multiple models', mixedModels: true })
    );
    expect(response.data.decisionPoints[0]?.title).toBe('State handling');
    expect(response.data.complianceRows[0]?.principleKey).toBe(
      'typescript-first-development'
    );
  });

  it('returns 404 when the ticket is not a participant in the comparison', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);
    const unrelated = await ctx.createTicket({
      title: '[e2e] Unrelated ticket',
      description: 'Does not participate',
    });

    const response = await ctx.api.get<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/${unrelated.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(404);
    expect(response.data.code).toBe('COMPARISON_NOT_FOUND');
  });
});
