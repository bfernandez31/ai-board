import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';

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
        workflowType: string;
        agent: string | null;
        quality: { state: string; value: number | null };
        metrics: {
          bestValueFlags: Record<string, boolean>;
        };
        telemetry: {
          totalTokens: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
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
    expect(response.data.participants[0]?.workflowType).toBe('FULL');
    expect(response.data.participants[0]?.agent).toBe('CODEX');
    expect(response.data.participants[0]?.quality.value).toBe(91);
    expect(response.data.participants[0]?.telemetry.totalTokens.value).toBe(2000);
    expect(response.data.participants[0]?.telemetry.jobCount.value).toBe(2);
    expect(response.data.participants[0]?.metrics.bestValueFlags.linesChanged).toBe(true);
    expect(response.data.decisionPoints[0]?.participantApproaches).toHaveLength(2);
    expect(response.data.complianceRows[0]?.assessments.map((entry) => entry.status)).toEqual([
      'pass',
      'mixed',
    ]);
  });
});
