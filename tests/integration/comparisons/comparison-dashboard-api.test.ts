import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import {
  createStructuredComparisonFixture,
  createWideComparisonFixture,
} from '@/tests/helpers/comparison-fixtures';

describe('Comparison dashboard API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns ranking, metrics, decision points, and compliance rows', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    const response = await ctx.api.get<{
      summary: string;
      overallRecommendation: string;
      participants: Array<{
        rank: number;
        metrics: {
          bestValueFlags: Record<string, boolean>;
        };
      }>;
      decisionPoints: Array<{
        participantApproaches: Array<{ ticketKey: string }>;
      }>;
      complianceRows: Array<{
        assessments: Array<{ status: string }>;
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.summary).toContain('best test coverage');
    expect(response.data.overallRecommendation).toContain('TE2-102');
    expect(response.data.participants.map((participant) => participant.rank)).toEqual([1, 2]);
    expect(response.data.participants[0]?.metrics.bestValueFlags.linesChanged).toBe(true);
    expect(response.data.decisionPoints[0]?.participantApproaches).toHaveLength(2);
    expect(response.data.complianceRows[0]?.assessments.map((entry) => entry.status)).toEqual([
      'pass',
      'mixed',
    ]);
  });

  it('returns 2-6 participant headers with scroll-ready operational payloads', async () => {
    const fixture = await createWideComparisonFixture(ctx.projectId, 6);

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        workflowType: string;
        agent: string | null;
        operational: {
          primaryModel: string | null;
          totalTokens: { state: string; value: number | null };
          bestValueFlags: Record<string, boolean>;
        };
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.participants[0]!.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.participants).toHaveLength(6);
    expect(response.data.participants.map((participant) => participant.ticketKey)).toEqual(
      fixture.participants.map((ticket) => ticket.ticketKey)
    );
    expect(response.data.participants.every((participant) => participant.workflowType === 'FULL')).toBe(
      true
    );
    expect(response.data.participants[0]?.operational.primaryModel).toBeTruthy();
    expect(response.data.participants[0]?.operational.totalTokens.state).toBe('available');
    expect(response.data.participants[0]?.operational.bestValueFlags.totalTokens).toBe(true);
    expect(response.data.participants[5]?.agent).toBe('CODEX');
  });
});
