import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createStructuredComparisonFixture } from '@/tests/helpers/comparison-fixtures';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createTestTicket } from '@/tests/helpers/db-setup';

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
        quality: { state: string; value: number | null };
        telemetry: {
          inputTokens: { state: string; value: number | null };
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
    expect(response.data.participants[0]?.quality).toEqual({
      state: 'available',
      value: 91,
    });
    expect(response.data.participants[1]?.telemetry.inputTokens.state).toBe('pending');
    expect(response.data.decisionPoints[0]?.title).toBe('State handling');
    expect(response.data.complianceRows[0]?.principleKey).toBe(
      'typescript-first-development'
    );
  });

  it('returns aggregated telemetry across multiple jobs', async () => {
    const prisma = getPrismaClient();
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    // Add a second completed job for winnerTicket
    await prisma.job.create({
      data: {
        ticketId: fixture.winnerTicket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        inputTokens: 800,
        outputTokens: 300,
        costUsd: 0.04,
        durationMs: 60000,
        startedAt: new Date('2026-03-19T09:00:00.000Z'),
        completedAt: new Date('2026-03-19T09:01:00.000Z'),
        updatedAt: new Date('2026-03-19T09:01:00.000Z'),
      },
    });

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        telemetry: {
          inputTokens: { state: string; value: number | null };
          outputTokens: { state: string; value: number | null };
          totalTokens: { state: string; value: number | null };
          costUsd: { state: string; value: number | null };
          durationMs: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
          hasPartialData: boolean;
        };
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    const winner = response.data.participants.find(
      (p) => p.ticketKey === fixture.winnerTicket.ticketKey
    );
    expect(winner?.telemetry.inputTokens).toEqual({ state: 'available', value: 2000 }); // 1200 + 800
    expect(winner?.telemetry.outputTokens).toEqual({ state: 'available', value: 700 }); // 400 + 300
    expect(winner?.telemetry.costUsd).toEqual({ state: 'available', value: 0.12 }); // 0.08 + 0.04
    expect(winner?.telemetry.durationMs).toEqual({ state: 'available', value: 180000 }); // 120000 + 60000
  });

  it('returns totalTokens as computed sum and jobCount per participant', async () => {
    const prisma = getPrismaClient();
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    await prisma.job.create({
      data: {
        ticketId: fixture.winnerTicket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        inputTokens: 800,
        outputTokens: 300,
        costUsd: 0.04,
        durationMs: 60000,
        startedAt: new Date('2026-03-19T09:00:00.000Z'),
        completedAt: new Date('2026-03-19T09:01:00.000Z'),
        updatedAt: new Date('2026-03-19T09:01:00.000Z'),
      },
    });

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        telemetry: {
          totalTokens: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
        };
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    const winner = response.data.participants.find(
      (p) => p.ticketKey === fixture.winnerTicket.ticketKey
    );
    expect(winner?.telemetry.totalTokens).toEqual({ state: 'available', value: 2700 }); // (1200+800) + (400+300)
    expect(winner?.telemetry.jobCount).toEqual({ state: 'available', value: 2 });
  });

  it('returns primary model per participant', async () => {
    const prisma = getPrismaClient();
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    // Update the existing job's model and create another with a different model
    await prisma.job.updateMany({
      where: { ticketId: fixture.winnerTicket.id },
      data: { model: 'claude-sonnet-4-6' },
    });
    await prisma.job.create({
      data: {
        ticketId: fixture.winnerTicket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        model: 'claude-sonnet-4-6',
        inputTokens: 500,
        outputTokens: 200,
        startedAt: new Date('2026-03-19T09:00:00.000Z'),
        completedAt: new Date('2026-03-19T09:01:00.000Z'),
        updatedAt: new Date('2026-03-19T09:01:00.000Z'),
      },
    });

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        model: string | null;
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    const winner = response.data.participants.find(
      (p) => p.ticketKey === fixture.winnerTicket.ticketKey
    );
    expect(winner?.model).toBe('claude-sonnet-4-6');
  });

  it('marks hasPartialData when jobs in progress', async () => {
    const prisma = getPrismaClient();
    const fixture = await createStructuredComparisonFixture(ctx.projectId);

    // Add a RUNNING job for winnerTicket
    await prisma.job.create({
      data: {
        ticketId: fixture.winnerTicket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'RUNNING',
        startedAt: new Date('2026-03-19T12:00:00.000Z'),
        updatedAt: new Date('2026-03-19T12:00:00.000Z'),
      },
    });

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        telemetry: {
          hasPartialData: boolean;
        };
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${fixture.winnerTicket.id}/comparisons/${fixture.comparison.id}`
    );

    expect(response.status).toBe(200);
    const winner = response.data.participants.find(
      (p) => p.ticketKey === fixture.winnerTicket.ticketKey
    );
    expect(winner?.telemetry.hasPartialData).toBe(true);
  });

  it('returns unavailable telemetry when no jobs', async () => {
    const prisma = getPrismaClient();
    // Create a comparison where one ticket has no jobs at all
    const sourceTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] No-jobs source',
      description: 'Source ticket',
      ticketNumber: 201,
      ticketKey: 'TE2-201',
      stage: 'BUILD',
    });
    const noJobTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] No-jobs ticket',
      description: 'No jobs here',
      ticketNumber: 202,
      ticketKey: 'TE2-202',
      stage: 'INBOX',
    });

    const comparison = await prisma.comparisonRecord.create({
      data: {
        projectId: ctx.projectId,
        sourceTicketId: sourceTicket.id,
        winnerTicketId: noJobTicket.id,
        markdownPath: 'specs/test/comparisons/no-jobs.md',
        summary: 'Test no jobs.',
        overallRecommendation: 'N/A',
        keyDifferentiators: [],
        generatedAt: new Date('2026-03-21T00:00:00.000Z'),
        participants: {
          create: [
            {
              ticketId: noJobTicket.id,
              rank: 1,
              score: 50,
              workflowTypeAtComparison: 'FULL',
              rankRationale: 'Only participant.',
              metricSnapshot: {
                create: {
                  linesAdded: null,
                  linesRemoved: null,
                  linesChanged: null,
                  filesChanged: null,
                  testFilesChanged: null,
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
      participants: Array<{
        ticketKey: string;
        telemetry: {
          inputTokens: { state: string; value: number | null };
          totalTokens: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
          hasPartialData: boolean;
        };
      }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${noJobTicket.id}/comparisons/${comparison.id}`
    );

    expect(response.status).toBe(200);
    const participant = response.data.participants[0];
    expect(participant?.telemetry.inputTokens.state).toBe('unavailable');
    expect(participant?.telemetry.totalTokens.state).toBe('unavailable');
    expect(participant?.telemetry.jobCount.state).toBe('unavailable');
    expect(participant?.telemetry.hasPartialData).toBe(false);
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
