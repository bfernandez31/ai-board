import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('comparison history persistence', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('preserves repeated runs for overlapping participant sets', async () => {
    const prisma = getPrismaClient();
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    await prisma.comparisonRecord.create({
      data: {
        projectId: ctx.projectId,
        sourceTicketId: fixture.sourceTicket.id,
        winnerTicketId: fixture.otherTicket.id,
        markdownPath: 'specs/example/comparisons/second.md',
        summary: 'Second run changed the winner.',
        overallRecommendation: 'Choose TE2-103 for follow-up.',
        keyDifferentiators: ['smaller follow-up diff'],
        generatedAt: new Date('2026-03-21T09:00:00.000Z'),
        participants: {
          create: [
            {
              ticketId: fixture.winnerTicket.id,
              rank: 2,
              score: 70,
              workflowTypeAtComparison: 'FULL',
              rankRationale: 'Regression in second pass.',
              metricSnapshot: {
                create: {
                  linesAdded: 12,
                  linesRemoved: 2,
                  linesChanged: 14,
                  filesChanged: 2,
                  testFilesChanged: 1,
                  changedFiles: [],
                  bestValueFlags: {},
                },
              },
            },
            {
              ticketId: fixture.otherTicket.id,
              rank: 1,
              score: 88,
              workflowTypeAtComparison: 'FULL',
              rankRationale: 'Improved follow-up implementation.',
              metricSnapshot: {
                create: {
                  linesAdded: 8,
                  linesRemoved: 1,
                  linesChanged: 9,
                  filesChanged: 1,
                  testFilesChanged: 1,
                  changedFiles: [],
                  bestValueFlags: {},
                },
              },
            },
          ],
        },
      },
    });

    const response = await ctx.api.get<{
      comparisons: Array<{ winnerTicketKey: string; generatedAt: string }>;
      total: number;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.otherTicket.id}/comparisons`
    );

    expect(response.status).toBe(200);
    expect(response.data.total).toBe(2);
    expect(response.data.comparisons.map((comparison) => comparison.winnerTicketKey)).toEqual([
      fixture.otherTicket.ticketKey,
      fixture.winnerTicket.ticketKey,
    ]);
  });
});
