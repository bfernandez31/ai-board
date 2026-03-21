import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import {
  buildGeneratedComparisonArtifactPayload,
  createStructuredComparisonFixture,
} from '@/tests/helpers/comparison-fixtures';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { getWorkflowHeaders } from '@/tests/helpers/workflow-auth';

type ComparisonFixture = Awaited<ReturnType<typeof createStructuredComparisonFixture>>;

function buildPersistencePayload(
  fixture: ComparisonFixture
): ReturnType<typeof buildGeneratedComparisonArtifactPayload> {
  return buildGeneratedComparisonArtifactPayload({
    branch: 'AIB-331-copy-of-persist',
    sourceTicket: {
      id: fixture.sourceTicket.id,
      ticketKey: fixture.sourceTicket.ticketKey ?? 'TE2-101',
      title: fixture.sourceTicket.title,
      stage: fixture.sourceTicket.stage,
      workflowType: fixture.sourceTicket.workflowType,
      agent: fixture.sourceTicket.agent,
    },
    participants: [fixture.winnerTicket, fixture.otherTicket].map((ticket) => ({
      id: ticket.id,
      ticketKey: ticket.ticketKey ?? '',
      title: ticket.title,
      stage: ticket.stage,
      workflowType: ticket.workflowType,
      agent: ticket.agent,
    })),
  });
}

describe('Comparisons API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createAPIClient({
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
      defaultHeaders: getWorkflowHeaders(),
    });
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

  describe('POST /api/projects/:projectId/tickets/:id/comparisons', () => {
    it('persists generated comparison artifacts via workflow token', async () => {
      const fixture = await createStructuredComparisonFixture(ctx.projectId);
      const payload = buildPersistencePayload(fixture);

      const response = await workflowApi.post<{ id: number; markdownPath: string }>(
        `/api/projects/${ctx.projectId}/tickets/${fixture.sourceTicket.id}/comparisons`,
        payload
      );

      expect(response.status).toBe(201);
      expect(response.data.markdownPath).toBe(
        'specs/AIB-331-copy-of-persist/comparisons/20260320-090000-vs-TE2-102-TE2-103.md'
      );

      const persisted = await prisma.comparisonRecord.findUnique({
        where: { id: response.data.id },
        include: {
          participants: {
            include: {
              metricSnapshot: true,
              complianceAssessments: true,
            },
          },
          decisionPoints: true,
        },
      });

      expect(persisted?.sourceTicketId).toBe(fixture.sourceTicket.id);
      expect(persisted?.participants).toHaveLength(2);
      expect(persisted?.decisionPoints).toHaveLength(2);
      const winnerParticipant = persisted?.participants.find(
        (participant) => participant.ticketId === fixture.winnerTicket.id
      );
      expect(winnerParticipant?.metricSnapshot?.changedFiles).toEqual([
        'app/a.ts',
        'tests/a.test.ts',
      ]);
    });

    it('rejects unauthenticated persistence requests', async () => {
      const fixture = await createStructuredComparisonFixture(ctx.projectId);
      const payload = buildPersistencePayload(fixture);

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${fixture.sourceTicket.id}/comparisons`,
        payload,
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {},
        }
      );

      expect(response.status).toBe(401);
      expect(response.data.error).toContain('Unauthorized');
    });
  });
});
