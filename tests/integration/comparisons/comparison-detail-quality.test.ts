import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';

describe('Comparison detail quality payload', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns eligible and ineligible comparison quality payloads in the same detail response', async () => {
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        quality: {
          score: { state: string; value: number | null };
          thresholdLabel: string | null;
          detailAvailable: boolean;
          breakdown: null | {
            thresholdLabel: string;
            dimensions: Array<{ agentId: string }>;
          };
        };
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.participants[0]).toMatchObject({
      ticketKey: fixture.winnerTicket.ticketKey,
      quality: {
        score: { state: 'available', value: 91 },
        thresholdLabel: 'Excellent',
        detailAvailable: true,
      },
    });
    expect(response.data.participants[0]?.quality.breakdown?.thresholdLabel).toBe(
      'Excellent'
    );
    expect(response.data.participants[0]?.quality.breakdown?.dimensions).toHaveLength(5);
    expect(response.data.participants[1]).toMatchObject({
      ticketKey: fixture.otherTicket.ticketKey,
      quality: {
        score: { state: 'pending', value: null },
        thresholdLabel: null,
        detailAvailable: false,
        breakdown: null,
      },
    });
  });
});
