import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import { createTestTicket } from '@/tests/helpers/db-setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

// Must match WORKFLOW_API_TOKEN set in scripts/run-integration-tests.sh for the dev server
const WORKFLOW_TOKEN = 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

function buildValidPayload(
  projectId: number,
  sourceTicket: { id: number; ticketKey: string; title: string },
  participants: Array<{ id: number; ticketKey: string; title: string }>
) {
  const allTicketKeys = participants.map((p) => p.ticketKey);
  return {
    projectId,
    sourceTicket: {
      id: sourceTicket.id,
      ticketKey: sourceTicket.ticketKey,
      title: sourceTicket.title,
      stage: 'BUILD' as const,
      workflowType: 'FULL' as const,
      agent: 'CLAUDE' as const,
    },
    participants: participants.map((p) => ({
      id: p.id,
      ticketKey: p.ticketKey,
      title: p.title,
      stage: 'VERIFY' as const,
      workflowType: 'FULL' as const,
      agent: 'CLAUDE' as const,
    })),
    markdownPath: 'specs/test-branch/comparisons/20260321-120000-vs-TEST.md',
    report: {
      metadata: {
        generatedAt: '2026-03-21T12:00:00.000Z',
        sourceTicket: sourceTicket.ticketKey,
        comparedTickets: allTicketKeys,
        filePath: 'specs/test-branch/comparisons/20260321-120000-vs-TEST.md',
      },
      summary: 'Test comparison summary',
      alignment: {
        overall: 85,
        dimensions: { requirements: 90, scenarios: 80, entities: 85, keywords: 80 },
        isAligned: true,
        matchingRequirements: ['FR-001'],
        matchingEntities: ['Ticket'],
      },
      implementation: Object.fromEntries(
        allTicketKeys.map((key) => [
          key,
          {
            ticketKey: key,
            linesAdded: 100,
            linesRemoved: 20,
            linesChanged: 120,
            filesChanged: 5,
            changedFiles: ['app/page.tsx'],
            testFilesChanged: 1,
            hasData: true,
          },
        ])
      ),
      compliance: Object.fromEntries(
        allTicketKeys.map((key) => [
          key,
          {
            overall: 90,
            totalPrinciples: 6,
            passedPrinciples: 5,
            principles: [
              { name: 'TypeScript-First Development', section: 'I', passed: true, notes: 'Good' },
              { name: 'Component-Driven Architecture', section: 'II', passed: true, notes: 'Good' },
              { name: 'Test-Driven Development', section: 'III', passed: true, notes: 'Good' },
              { name: 'Security-First Design', section: 'IV', passed: true, notes: 'Good' },
              { name: 'Database Integrity', section: 'V', passed: true, notes: 'Good' },
              { name: 'AI-First Development Model', section: 'VI', passed: false, notes: 'Minor' },
            ],
          },
        ])
      ),
      telemetry: Object.fromEntries(
        allTicketKeys.map((key) => [
          key,
          {
            ticketKey: key,
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            costUsd: 0.15,
            durationMs: 45000,
            model: 'opus',
            toolsUsed: [],
            jobCount: 1,
            hasData: true,
          },
        ])
      ),
      recommendation: 'Ship it',
      warnings: [],
    },
  };
}

describe('POST /api/projects/:projectId/comparisons', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    workflowApi = createWorkflowClient();

    // Clean up comparison records for this project
    const prisma = getPrismaClient();
    await prisma.decisionPointEvaluation.deleteMany({
      where: { comparisonRecord: { projectId: ctx.projectId } },
    });
    await prisma.complianceAssessment.deleteMany({
      where: { comparisonParticipant: { comparisonRecord: { projectId: ctx.projectId } } },
    });
    await prisma.ticketMetricSnapshot.deleteMany({
      where: { comparisonParticipant: { comparisonRecord: { projectId: ctx.projectId } } },
    });
    await prisma.comparisonParticipant.deleteMany({
      where: { comparisonRecord: { projectId: ctx.projectId } },
    });
    await prisma.comparisonRecord.deleteMany({
      where: { projectId: ctx.projectId },
    });
  });

  it('should create a comparison record and return 201 with id and generatedAt', async () => {
    const source = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source Ticket',
      stage: 'BUILD',
    });
    const participant = await createTestTicket(ctx.projectId, {
      title: '[e2e] Participant Ticket',
      stage: 'VERIFY',
    });

    const payload = buildValidPayload(
      ctx.projectId,
      { id: source.id, ticketKey: source.ticketKey!, title: source.title },
      [{ id: participant.id, ticketKey: participant.ticketKey!, title: participant.title }]
    );

    const response = await workflowApi.post<{ id: number; generatedAt: string }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      payload
    );

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('generatedAt');
    expect(typeof response.data.id).toBe('number');
  });

  it('should create all related entities (participants, metrics, compliance, decision points)', async () => {
    const prisma = getPrismaClient();
    const source = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source for entities',
      stage: 'BUILD',
    });
    const participantA = await createTestTicket(ctx.projectId, {
      title: '[e2e] Participant A',
      stage: 'VERIFY',
    });
    const participantB = await createTestTicket(ctx.projectId, {
      title: '[e2e] Participant B',
      stage: 'VERIFY',
    });

    const payload = buildValidPayload(
      ctx.projectId,
      { id: source.id, ticketKey: source.ticketKey!, title: source.title },
      [
        { id: participantA.id, ticketKey: participantA.ticketKey!, title: participantA.title },
        { id: participantB.id, ticketKey: participantB.ticketKey!, title: participantB.title },
      ]
    );

    const response = await workflowApi.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      payload
    );

    expect(response.status).toBe(201);

    const record = await prisma.comparisonRecord.findUnique({
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

    expect(record).not.toBeNull();
    expect(record!.participants).toHaveLength(2);
    expect(record!.decisionPoints.length).toBeGreaterThan(0);

    // Each participant should have metric snapshot and compliance assessments
    for (const participant of record!.participants) {
      expect(participant.metricSnapshot).not.toBeNull();
      expect(participant.complianceAssessments.length).toBeGreaterThan(0);
    }
  });

  it('should return 401 when Authorization header is missing', async () => {
    // Uses default test auth override to reach the handler, but no workflow Bearer token
    const noWorkflowAuthApi = createAPIClient();

    const response = await noWorkflowAuthApi.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      { projectId: ctx.projectId }
    );

    expect(response.status).toBe(401);
    expect(response.data).toHaveProperty('error');
  });

  it('should return 401 when token is invalid', async () => {
    const badTokenApi = createAPIClient({
      defaultHeaders: {
        Authorization: 'Bearer invalid-token-value',
      },
    });

    const response = await badTokenApi.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      { projectId: ctx.projectId }
    );

    expect(response.status).toBe(401);
    expect(response.data).toHaveProperty('error');
  });

  it('should return 400 when payload has missing required fields', async () => {
    const response = await workflowApi.post<{ error: string; details: unknown }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      { projectId: ctx.projectId }
    );

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error', 'Validation failed');
    expect(response.data).toHaveProperty('details');
  });

  it('should return 400 when payload has wrong types', async () => {
    const response = await workflowApi.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      {
        projectId: 'not-a-number',
        sourceTicket: 'not-an-object',
        participants: 'not-an-array',
        markdownPath: 123,
        report: 'not-an-object',
      }
    );

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error', 'Validation failed');
  });

  it('should return 400 when projectId in body does not match URL', async () => {
    const source = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source mismatch',
      stage: 'BUILD',
    });
    const participant = await createTestTicket(ctx.projectId, {
      title: '[e2e] Participant mismatch',
      stage: 'VERIFY',
    });

    const payload = buildValidPayload(
      999999, // Mismatched projectId
      { id: source.id, ticketKey: source.ticketKey!, title: source.title },
      [{ id: participant.id, ticketKey: participant.ticketKey!, title: participant.title }]
    );

    const response = await workflowApi.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      payload
    );

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('Project ID');
  });

  it('should return 400 when ticket IDs do not exist', async () => {
    const payload = buildValidPayload(
      ctx.projectId,
      { id: 999998, ticketKey: 'TST-998', title: 'Non-existent source' },
      [{ id: 999999, ticketKey: 'TST-999', title: 'Non-existent participant' }]
    );

    const response = await workflowApi.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      payload
    );

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error');
  });

  it('should create separate records for multiple POSTs with same tickets (point-in-time snapshots)', async () => {
    const prisma = getPrismaClient();
    const source = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source snapshot',
      stage: 'BUILD',
    });
    const participant = await createTestTicket(ctx.projectId, {
      title: '[e2e] Participant snapshot',
      stage: 'VERIFY',
    });

    const payload = buildValidPayload(
      ctx.projectId,
      { id: source.id, ticketKey: source.ticketKey!, title: source.title },
      [{ id: participant.id, ticketKey: participant.ticketKey!, title: participant.title }]
    );

    const response1 = await workflowApi.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      payload
    );
    const response2 = await workflowApi.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/comparisons`,
      payload
    );

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);
    expect(response1.data.id).not.toBe(response2.data.id);

    const records = await prisma.comparisonRecord.findMany({
      where: { projectId: ctx.projectId, sourceTicketId: source.id },
    });

    expect(records).toHaveLength(2);
  });
});
