import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Comparison detail aggregated telemetry', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns aggregated telemetry summed across multiple completed jobs per ticket', async () => {
    const prisma = getPrismaClient();
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    // Add a second completed job to the winner ticket
    await prisma.job.create({
      data: {
        ticketId: fixture.winnerTicket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        inputTokens: 800,
        outputTokens: 200,
        costUsd: 0.04,
        durationMs: 60000,
        startedAt: new Date('2026-03-19T08:00:00.000Z'),
        completedAt: new Date('2026-03-19T08:01:00.000Z'),
        updatedAt: new Date('2026-03-19T08:01:00.000Z'),
      },
    });

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        aggregatedTelemetry: {
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
          costUsd: number;
          durationMs: number;
          jobCount: number;
          model: string | null;
          hasData: boolean;
        } | null;
        qualityDetails: {
          dimensions: Array<{ name: string; score: number }>;
        } | null;
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);

    const winner = response.data.participants.find(
      (p) => p.ticketKey === fixture.winnerTicket.ticketKey
    );
    expect(winner).toBeDefined();
    expect(winner!.aggregatedTelemetry).not.toBeNull();
    // Original verify job: 1200 input + 800 from implement = 2000
    expect(winner!.aggregatedTelemetry!.inputTokens).toBe(2000);
    // Original verify job: 400 output + 200 from implement = 600
    expect(winner!.aggregatedTelemetry!.outputTokens).toBe(600);
    expect(winner!.aggregatedTelemetry!.totalTokens).toBe(2600);
    // 0.08 + 0.04 = 0.12
    expect(winner!.aggregatedTelemetry!.costUsd).toBeCloseTo(0.12, 4);
    // 120000 + 60000 = 180000
    expect(winner!.aggregatedTelemetry!.durationMs).toBe(180000);
    expect(winner!.aggregatedTelemetry!.jobCount).toBe(2);
    expect(winner!.aggregatedTelemetry!.hasData).toBe(true);

    // otherTicket has a completed job but with null telemetry fields
    const other = response.data.participants.find(
      (p) => p.ticketKey === fixture.otherTicket.ticketKey
    );
    expect(other).toBeDefined();
    // The other ticket's job has null telemetry, so aggregation sums to 0
    expect(other!.aggregatedTelemetry).not.toBeNull();
    expect(other!.aggregatedTelemetry!.jobCount).toBe(1);
    expect(other!.aggregatedTelemetry!.hasData).toBe(false);
  });
});
