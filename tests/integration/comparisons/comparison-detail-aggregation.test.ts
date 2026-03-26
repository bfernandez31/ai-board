import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createTestTicket } from '@/tests/helpers/db-setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

function createComparisonWithParticipants(
  projectId: number,
  sourceTicketId: number,
  winnerTicketId: number,
  participantTicketIds: number[]
) {
  const prisma = getPrismaClient();
  return prisma.comparisonRecord.create({
    data: {
      projectId,
      sourceTicketId,
      winnerTicketId,
      compareRunKey: `cmp_agg_${Date.now()}`,
      markdownPath: 'specs/test/comparisons/agg.md',
      summary: 'Aggregation test comparison.',
      overallRecommendation: 'Choose the winner.',
      keyDifferentiators: ['efficiency'],
      generatedAt: new Date(),
      participants: {
        create: participantTicketIds.map((ticketId, index) => ({
          ticketId,
          rank: index + 1,
          score: 90 - index * 10,
          workflowTypeAtComparison: 'FULL',
          rankRationale: `Rank ${index + 1} rationale`,
          metricSnapshot: {
            create: {
              linesAdded: 10,
              linesRemoved: 2,
              linesChanged: 12,
              filesChanged: 2,
              testFilesChanged: 1,
              changedFiles: [],
              bestValueFlags: {},
            },
          },
        })),
      },
      decisionPoints: {
        create: [{
          title: 'Test decision',
          verdictTicketId: winnerTicketId,
          verdictSummary: 'Winner was better.',
          rationale: 'More efficient.',
          participantApproaches: [],
          displayOrder: 0,
        }],
      },
    },
  });
}

describe('Comparison detail aggregation', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('aggregation sums across multiple completed jobs correctly', async () => {
    const prisma = getPrismaClient();
    const ticketA = await createTestTicket(ctx.projectId, {
      title: '[e2e] Ticket A',
      ticketNumber: 201,
      ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE2'}-201`,
      stage: 'VERIFY',
    });
    const ticketB = await createTestTicket(ctx.projectId, {
      title: '[e2e] Ticket B',
      ticketNumber: 202,
      ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE2'}-202`,
      stage: 'VERIFY',
    });

    // Create 3 completed jobs for ticket A
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticketA.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: 'COMPLETED',
          inputTokens: 10000,
          outputTokens: 3000,
          costUsd: 1.0,
          durationMs: 60000,
          model: 'claude-sonnet-4-6',
          startedAt: new Date('2026-03-20T10:00:00Z'),
          completedAt: new Date('2026-03-20T10:01:00Z'),
          updatedAt: new Date(),
        },
        {
          ticketId: ticketA.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: 'COMPLETED',
          inputTokens: 20000,
          outputTokens: 5000,
          costUsd: 1.5,
          durationMs: 90000,
          model: 'claude-opus-4-6',
          startedAt: new Date('2026-03-20T11:00:00Z'),
          completedAt: new Date('2026-03-20T11:01:30Z'),
          updatedAt: new Date(),
        },
        {
          ticketId: ticketA.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: 'COMPLETED',
          inputTokens: 5000,
          outputTokens: 1000,
          costUsd: 0.5,
          durationMs: 30000,
          model: 'claude-sonnet-4-6',
          qualityScore: 87,
          qualityScoreDetails: JSON.stringify({
            dimensions: [
              { name: 'Compliance', agentId: 'compliance', score: 92, weight: 0.4, weightedScore: 36.8 },
              { name: 'Bug Detection', agentId: 'bug-detection', score: 85, weight: 0.3, weightedScore: 25.5 },
              { name: 'Code Comments', agentId: 'code-comments', score: 80, weight: 0.2, weightedScore: 16.0 },
              { name: 'Historical Context', agentId: 'historical-context', score: 75, weight: 0.1, weightedScore: 7.5 },
              { name: 'Spec Sync', agentId: 'spec-sync', score: 90, weight: 0.0, weightedScore: 0.0 },
            ],
            threshold: 'Good',
            computedAt: '2026-03-20T12:00:00.000Z',
          }),
          startedAt: new Date('2026-03-20T12:00:00Z'),
          completedAt: new Date('2026-03-20T12:00:30Z'),
          updatedAt: new Date(),
        },
      ],
    });

    // Create 1 completed job for ticket B
    await prisma.job.createMany({
      data: [{
        ticketId: ticketB.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        inputTokens: 8000,
        outputTokens: 2000,
        costUsd: 0.6,
        durationMs: 45000,
        model: 'claude-sonnet-4-6',
        startedAt: new Date('2026-03-20T10:00:00Z'),
        completedAt: new Date('2026-03-20T10:00:45Z'),
        updatedAt: new Date(),
      }],
    });

    const comparison = await createComparisonWithParticipants(
      ctx.projectId, ticketA.id, ticketA.id, [ticketA.id, ticketB.id]
    );

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        telemetry: {
          inputTokens: { state: string; value: number | null };
          outputTokens: { state: string; value: number | null };
          totalTokens: { state: string; value: number | null };
          durationMs: { state: string; value: number | null };
          costUsd: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
          primaryModel: { state: string; value: string | null };
        };
      }>;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticketA.id}/comparisons/${comparison.id}`);

    expect(response.status).toBe(200);

    // Ticket A: sum of 3 jobs
    const pA = response.data.participants[0]!;
    expect(pA.telemetry.inputTokens).toEqual({ state: 'available', value: 35000 }); // 10k+20k+5k
    expect(pA.telemetry.outputTokens).toEqual({ state: 'available', value: 9000 }); // 3k+5k+1k
    expect(pA.telemetry.totalTokens).toEqual({ state: 'available', value: 44000 });
    expect(pA.telemetry.durationMs).toEqual({ state: 'available', value: 180000 }); // 60k+90k+30k
    expect(pA.telemetry.costUsd).toEqual({ state: 'available', value: 3.0 });
    expect(pA.telemetry.jobCount).toEqual({ state: 'available', value: 3 });

    // Ticket B: 1 job
    const pB = response.data.participants[1]!;
    expect(pB.telemetry.inputTokens).toEqual({ state: 'available', value: 8000 });
    expect(pB.telemetry.totalTokens).toEqual({ state: 'available', value: 10000 });
    expect(pB.telemetry.jobCount).toEqual({ state: 'available', value: 1 });
  });

  it('primary model is from the highest-token job', async () => {
    const prisma = getPrismaClient();
    const ticket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Primary model ticket',
      ticketNumber: 203,
      ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE2'}-203`,
      stage: 'BUILD',
    });

    // Job with small tokens (not primary)
    await prisma.job.createMany({
      data: [
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: 'COMPLETED',
          inputTokens: 1000,
          outputTokens: 500,
          model: 'claude-haiku-4-5',
          startedAt: new Date('2026-03-20T10:00:00Z'),
          completedAt: new Date('2026-03-20T10:00:30Z'),
          updatedAt: new Date(),
        },
        // Job with large tokens (primary)
        {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: 'COMPLETED',
          inputTokens: 50000,
          outputTokens: 15000,
          model: 'claude-opus-4-6',
          startedAt: new Date('2026-03-20T11:00:00Z'),
          completedAt: new Date('2026-03-20T11:05:00Z'),
          updatedAt: new Date(),
        },
      ],
    });

    const comparison = await createComparisonWithParticipants(
      ctx.projectId, ticket.id, ticket.id, [ticket.id]
    );

    const response = await ctx.api.get<{
      participants: Array<{
        telemetry: {
          primaryModel: { state: string; value: string | null };
        };
      }>;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/comparisons/${comparison.id}`);

    expect(response.status).toBe(200);
    expect(response.data.participants[0]!.telemetry.primaryModel).toEqual({
      state: 'available',
      value: 'claude-opus-4-6',
    });
  });

  it('ticket with no completed jobs returns unavailable enrichments', async () => {
    const prisma = getPrismaClient();
    const ticket = await createTestTicket(ctx.projectId, {
      title: '[e2e] No jobs ticket',
      ticketNumber: 204,
      ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE2'}-204`,
      stage: 'INBOX',
    });

    // Create a FAILED job (should not count)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'FAILED',
        inputTokens: 5000,
        outputTokens: 1000,
        startedAt: new Date('2026-03-20T10:00:00Z'),
        completedAt: new Date('2026-03-20T10:01:00Z'),
        updatedAt: new Date(),
      },
    });

    const comparison = await createComparisonWithParticipants(
      ctx.projectId, ticket.id, ticket.id, [ticket.id]
    );

    const response = await ctx.api.get<{
      participants: Array<{
        telemetry: {
          inputTokens: { state: string; value: number | null };
          totalTokens: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
        };
      }>;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/comparisons/${comparison.id}`);

    expect(response.status).toBe(200);
    expect(response.data.participants[0]!.telemetry.inputTokens.state).toBe('unavailable');
    expect(response.data.participants[0]!.telemetry.totalTokens.state).toBe('unavailable');
    expect(response.data.participants[0]!.telemetry.jobCount.state).toBe('unavailable');
  });

  it('ticket with in-progress jobs returns pending enrichments', async () => {
    const prisma = getPrismaClient();
    const ticket = await createTestTicket(ctx.projectId, {
      title: '[e2e] In-progress ticket',
      ticketNumber: 205,
      ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE2'}-205`,
      stage: 'BUILD',
    });

    // Create a RUNNING job (no completed jobs)
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'RUNNING',
        startedAt: new Date('2026-03-20T10:00:00Z'),
        updatedAt: new Date(),
      },
    });

    const comparison = await createComparisonWithParticipants(
      ctx.projectId, ticket.id, ticket.id, [ticket.id]
    );

    const response = await ctx.api.get<{
      participants: Array<{
        telemetry: {
          inputTokens: { state: string; value: number | null };
          totalTokens: { state: string; value: number | null };
          jobCount: { state: string; value: number | null };
        };
      }>;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticket.id}/comparisons/${comparison.id}`);

    expect(response.status).toBe(200);
    expect(response.data.participants[0]!.telemetry.inputTokens.state).toBe('pending');
    expect(response.data.participants[0]!.telemetry.totalTokens.state).toBe('pending');
    expect(response.data.participants[0]!.telemetry.jobCount.state).toBe('pending');
  });

  it('quality breakdown available only for FULL workflow with completed verify', async () => {
    const prisma = getPrismaClient();
    const fullTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Full workflow ticket',
      ticketNumber: 206,
      ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE2'}-206`,
      stage: 'VERIFY',
    });
    const quickTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Quick workflow ticket',
      ticketNumber: 207,
      ticketKey: `${ctx.projectId === 1 ? 'E2E' : 'TE2'}-207`,
      stage: 'BUILD',
    });

    // FULL ticket: verify job with quality details
    await prisma.job.create({
      data: {
        ticketId: fullTicket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        qualityScore: 87,
        qualityScoreDetails: JSON.stringify({
          dimensions: [
            { name: 'Compliance', agentId: 'compliance', score: 92, weight: 0.4, weightedScore: 36.8 },
            { name: 'Bug Detection', agentId: 'bug-detection', score: 85, weight: 0.3, weightedScore: 25.5 },
            { name: 'Code Comments', agentId: 'code-comments', score: 80, weight: 0.2, weightedScore: 16.0 },
            { name: 'Historical Context', agentId: 'historical-context', score: 75, weight: 0.1, weightedScore: 7.5 },
            { name: 'Spec Sync', agentId: 'spec-sync', score: 90, weight: 0.0, weightedScore: 0.0 },
          ],
          threshold: 'Good',
          computedAt: '2026-03-20T12:00:00.000Z',
        }),
        inputTokens: 5000,
        outputTokens: 1000,
        startedAt: new Date('2026-03-20T12:00:00Z'),
        completedAt: new Date('2026-03-20T12:00:30Z'),
        updatedAt: new Date(),
      },
    });

    // QUICK ticket: implement job only, no verify
    await prisma.job.create({
      data: {
        ticketId: quickTicket.id,
        projectId: ctx.projectId,
        command: 'quick-impl',
        status: 'COMPLETED',
        inputTokens: 8000,
        outputTokens: 2000,
        startedAt: new Date('2026-03-20T10:00:00Z'),
        completedAt: new Date('2026-03-20T10:00:45Z'),
        updatedAt: new Date(),
      },
    });

    const comparison = await createComparisonWithParticipants(
      ctx.projectId, fullTicket.id, fullTicket.id, [fullTicket.id, quickTicket.id]
    );

    const response = await ctx.api.get<{
      participants: Array<{
        ticketKey: string;
        quality: { state: string; value: number | null };
        qualityBreakdown: {
          state: string;
          value: {
            dimensions: Array<{ name: string; score: number }>;
            threshold: string;
          } | null;
        };
      }>;
    }>(`/api/projects/${ctx.projectId}/tickets/${fullTicket.id}/comparisons/${comparison.id}`);

    expect(response.status).toBe(200);

    // FULL ticket: quality breakdown available
    const fullP = response.data.participants[0]!;
    expect(fullP.quality).toEqual({ state: 'available', value: 87 });
    expect(fullP.qualityBreakdown.state).toBe('available');
    expect(fullP.qualityBreakdown.value!.dimensions).toHaveLength(5);
    expect(fullP.qualityBreakdown.value!.threshold).toBe('Good');

    // QUICK ticket: no verify job, quality unavailable
    const quickP = response.data.participants[1]!;
    expect(quickP.quality.state).toBe('unavailable');
    expect(quickP.qualityBreakdown.state).toBe('unavailable');
  });
});
