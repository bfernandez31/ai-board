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
        operational: {
          totalTokens: { state: string; value: number | null };
          inputTokens: { state: string; value: number | null };
          outputTokens: { state: string; value: number | null };
          durationMs: { state: string; value: number | null };
          costUsd: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
          primaryModel: string | null;
          bestValueFlags: Record<string, boolean>;
        };
        quality: {
          score: { state: string; value: number | null };
          thresholdLabel: string | null;
          detailAvailable: boolean;
          breakdown: null | {
            overallScore: number;
            dimensions: Array<{ agentId: string; score: number }>;
          };
          isBestValue: boolean;
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
    expect(response.data.participants[0]?.workflowType).toBe('FULL');
    expect(response.data.participants[0]?.agent).toBe('CLAUDE');
    expect(response.data.participants[0]?.operational.totalTokens).toEqual({
      state: 'available',
      value: 2500,
    });
    expect(response.data.participants[0]?.operational.primaryModel).toBe('gpt-5.4');
    expect(response.data.participants[0]?.operational.bestValueFlags.costUsd).toBe(true);
    expect(response.data.participants[0]?.quality.score).toEqual({
      state: 'available',
      value: 91,
    });
    expect(response.data.participants[0]?.quality.thresholdLabel).toBe('Excellent');
    expect(response.data.participants[0]?.quality.detailAvailable).toBe(true);
    expect(response.data.participants[0]?.quality.breakdown?.dimensions).toHaveLength(5);
    expect(response.data.participants[1]?.operational.inputTokens.state).toBe('pending');
    expect(response.data.participants[1]?.quality.score.state).toBe('pending');
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
