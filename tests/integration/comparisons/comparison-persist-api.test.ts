import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import { getWorkflowHeaders } from '@/tests/helpers/workflow-auth';
import { createTestTicket } from '@/tests/helpers/db-setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

function buildComparisonPayload(opts: {
  sourceTicket: { id: number; ticketKey: string; title: string };
  participants: Array<{ id: number; ticketKey: string; title: string }>;
  branch: string;
}) {
  return {
    sourceTicket: {
      id: opts.sourceTicket.id,
      ticketKey: opts.sourceTicket.ticketKey,
      title: opts.sourceTicket.title,
      stage: 'BUILD',
      workflowType: 'FULL',
      agent: 'CLAUDE',
    },
    participants: opts.participants.map((p) => ({
      id: p.id,
      ticketKey: p.ticketKey,
      title: p.title,
      stage: 'VERIFY',
      workflowType: 'FULL',
      agent: 'CLAUDE',
    })),
    branch: opts.branch,
    report: {
      metadata: {
        generatedAt: '2026-03-21T12:00:00.000Z',
        sourceTicket: opts.sourceTicket.ticketKey,
        comparedTickets: opts.participants.map((p) => p.ticketKey),
        filePath: '20260321-120000-vs-test.md',
      },
      summary: 'Test comparison summary',
      alignment: {
        overall: 75,
        dimensions: { requirements: 80, scenarios: 70, entities: 60, keywords: 50 },
        isAligned: true,
        matchingRequirements: ['FR-001'],
        matchingEntities: ['Ticket'],
      },
      implementation: Object.fromEntries(
        opts.participants.map((p) => [
          p.ticketKey,
          {
            ticketKey: p.ticketKey,
            linesAdded: 100,
            linesRemoved: 20,
            linesChanged: 120,
            filesChanged: 5,
            changedFiles: ['app/file.ts'],
            testFilesChanged: 1,
            hasData: true,
          },
        ])
      ),
      compliance: Object.fromEntries(
        opts.participants.map((p) => [
          p.ticketKey,
          {
            overall: 85,
            totalPrinciples: 5,
            passedPrinciples: 4,
            principles: [
              {
                name: 'TypeScript-First Development',
                section: 'I',
                passed: true,
                notes: 'Good types',
              },
            ],
          },
        ])
      ),
      telemetry: Object.fromEntries(
        opts.participants.map((p) => [
          p.ticketKey,
          {
            ticketKey: p.ticketKey,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            costUsd: 0,
            durationMs: 0,
            model: null,
            toolsUsed: [],
            jobCount: 0,
            hasData: false,
          },
        ])
      ),
      recommendation: 'Ship test ticket',
      warnings: [],
    },
  };
}

describe('POST /api/projects/:projectId/tickets/:id/comparisons', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('persists comparison data with workflow token auth', async () => {
    const source = await createTestTicket(ctx.projectId, {
      title: '[e2e] Persist Source',
      description: 'Source ticket',
      ticketNumber: 301,
      ticketKey: 'TE2-301',
      stage: 'BUILD',
    });
    const participant = await createTestTicket(ctx.projectId, {
      title: '[e2e] Persist Participant',
      description: 'Participant ticket',
      ticketNumber: 302,
      ticketKey: 'TE2-302',
      stage: 'VERIFY',
    });

    const payload = buildComparisonPayload({
      sourceTicket: { id: source.id, ticketKey: 'TE2-301', title: '[e2e] Persist Source' },
      participants: [
        { id: participant.id, ticketKey: 'TE2-302', title: '[e2e] Persist Participant' },
      ],
      branch: 'TE2-301-test-branch',
    });

    const workflowClient = createAPIClient({
      defaultHeaders: getWorkflowHeaders(),
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });

    const response = await workflowClient.post<{ id: number; markdownPath: string }>(
      `/api/projects/${ctx.projectId}/tickets/${source.id}/comparisons`,
      payload
    );

    expect(response.status).toBe(201);
    expect(response.data.id).toBeGreaterThan(0);
    expect(response.data.markdownPath).toContain('comparisons/');

    // Verify DB record was created
    const prisma = getPrismaClient();
    const record = await prisma.comparisonRecord.findUnique({
      where: { id: response.data.id },
      include: { participants: true, decisionPoints: true },
    });

    expect(record).not.toBeNull();
    expect(record!.sourceTicketId).toBe(source.id);
    expect(record!.summary).toBe('Test comparison summary');
    expect(record!.participants).toHaveLength(1);
  });

  it('returns 401 without workflow token', async () => {
    const source = await createTestTicket(ctx.projectId, {
      title: '[e2e] No Auth Source',
      description: 'Source ticket',
      ticketNumber: 303,
      ticketKey: 'TE2-303',
      stage: 'BUILD',
    });

    const payload = buildComparisonPayload({
      sourceTicket: { id: source.id, ticketKey: 'TE2-303', title: '[e2e] No Auth Source' },
      participants: [{ id: source.id, ticketKey: 'TE2-303', title: '[e2e] No Auth Source' }],
      branch: 'TE2-303-test',
    });

    // Use client without workflow headers (regular user auth)
    const response = await ctx.api.post<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/${source.id}/comparisons`,
      payload
    );

    expect(response.status).toBe(401);
    expect(response.data.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid comparison data', async () => {
    const source = await createTestTicket(ctx.projectId, {
      title: '[e2e] Invalid Data Source',
      description: 'Source ticket',
      ticketNumber: 304,
      ticketKey: 'TE2-304',
      stage: 'BUILD',
    });

    const workflowClient = createAPIClient({
      defaultHeaders: getWorkflowHeaders(),
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });

    const response = await workflowClient.post<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/${source.id}/comparisons`,
      { invalid: 'data' }
    );

    expect(response.status).toBe(400);
    expect(response.data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for non-existent ticket', async () => {
    const workflowClient = createAPIClient({
      defaultHeaders: getWorkflowHeaders(),
      includeTestUserHeader: false,
      enableTestAuthOverride: false,
    });

    const response = await workflowClient.post<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/999999/comparisons`,
      { sourceTicket: {} }
    );

    expect(response.status).toBe(404);
    expect(response.data.code).toBe('TICKET_NOT_FOUND');
  });
});
