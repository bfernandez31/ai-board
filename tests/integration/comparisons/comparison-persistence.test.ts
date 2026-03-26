import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createTestTicket } from '@/tests/helpers/db-setup';
import {
  createWorkflowComparisonPayloadFixture,
} from '@/tests/helpers/comparison-fixtures';
import { ensureProjectExists, getPrismaClient } from '@/tests/helpers/db-cleanup';

const WORKFLOW_TOKEN = 'test-workflow-token-for-e2e-tests-only';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function postWorkflow<T>(path: string, body: unknown) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    data: (await response.json()) as T,
  };
}

describe('comparison persistence workflow route', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('persists one structured record from a workflow-authenticated POST', async () => {
    const prisma = getPrismaClient();
    const sourceTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source',
      description: 'Source',
      ticketNumber: 201,
      ticketKey: 'TE2-201',
      stage: 'BUILD',
      branch: 'AIB-330-persist-comparison-data',
    });
    const candidateA = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate A',
      description: 'A',
      ticketNumber: 202,
      ticketKey: 'TE2-202',
      stage: 'VERIFY',
    });
    const candidateB = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate B',
      description: 'B',
      ticketNumber: 203,
      ticketKey: 'TE2-203',
      stage: 'PLAN',
    });

    const payload = createWorkflowComparisonPayloadFixture({
      projectId: ctx.projectId,
      branch: 'AIB-330-persist-comparison-data',
      sourceTicket: {
        ticketKey: sourceTicket.ticketKey ?? 'TE2-201',
      },
      participants: [
        { ticketKey: candidateA.ticketKey ?? 'TE2-202' },
        { ticketKey: candidateB.ticketKey ?? 'TE2-203' },
      ],
    });

    const response = await postWorkflow<{
      comparisonId: number;
      compareRunKey: string;
      status: 'created' | 'duplicate';
    }>(
      `/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`,
      payload
    );

    expect(response.status).toBe(201);
    expect(response.data.status).toBe('created');

    const persisted = await prisma.comparisonRecord.findUnique({
      where: { id: response.data.comparisonId },
      include: { participants: true, decisionPoints: true },
    });

    expect(persisted?.compareRunKey).toBe(payload.compareRunKey);
    expect(persisted?.markdownPath).toBe(payload.markdownPath);
    expect(persisted?.participants).toHaveLength(2);
    expect(persisted?.decisionPoints).toHaveLength(2);
    expect(persisted?.decisionPoints[0]).toMatchObject({
      title: 'Telemetry Aggregation Strategy',
      verdictSummary: `${payload.report.metadata.comparedTickets[0]} keeps aggregation in the comparison record layer.`,
      rationale: 'It preserves pending and unavailable telemetry states without spreading comparison-specific logic.',
    });
    expect(persisted?.decisionPoints[0]?.participantApproaches).toEqual([
      {
        ticketId: candidateA.id,
        ticketKey: candidateA.ticketKey,
        summary: 'Uses aggregateJobTelemetry() with a separate in-progress query.',
      },
      {
        ticketId: candidateB.id,
        ticketKey: candidateB.ticketKey,
        summary: 'Moves telemetry logic into a dedicated extractor module.',
      },
    ]);
  });

  it('treats duplicate compare-run submissions as idempotent', async () => {
    const prisma = getPrismaClient();
    const sourceTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source',
      description: 'Source',
      ticketNumber: 211,
      ticketKey: 'TE2-211',
      stage: 'BUILD',
      branch: 'AIB-330-persist-comparison-data',
    });
    const candidateA = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate A',
      description: 'A',
      ticketNumber: 212,
      ticketKey: 'TE2-212',
      stage: 'VERIFY',
    });
    const candidateB = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate B',
      description: 'B',
      ticketNumber: 213,
      ticketKey: 'TE2-213',
      stage: 'PLAN',
    });

    const payload = createWorkflowComparisonPayloadFixture({
      projectId: ctx.projectId,
      branch: 'AIB-330-persist-comparison-data',
      sourceTicket: {
        ticketKey: sourceTicket.ticketKey ?? 'TE2-211',
      },
      participants: [
        { ticketKey: candidateA.ticketKey ?? 'TE2-212' },
        { ticketKey: candidateB.ticketKey ?? 'TE2-213' },
      ],
    });

    const first = await postWorkflow<{ comparisonId: number }>(
      `/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`,
      payload
    );
    const second = await postWorkflow<{
      comparisonId: number;
      status: 'created' | 'duplicate';
    }>(
      `/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`,
      payload
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.data.status).toBe('duplicate');
    expect(second.data.comparisonId).toBe(first.data.comparisonId);

    const records = await prisma.comparisonRecord.findMany({
      where: {
        projectId: ctx.projectId,
        sourceTicketId: sourceTicket.id,
      },
    });

    expect(records).toHaveLength(1);
  });

  it('rejects malformed payloads and wrong-scope participants without writes', async () => {
    const prisma = getPrismaClient();
    const sourceTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source',
      description: 'Source',
      ticketNumber: 221,
      ticketKey: 'TE2-221',
      stage: 'BUILD',
      branch: 'AIB-330-persist-comparison-data',
    });
    const candidateA = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate A',
      description: 'A',
      ticketNumber: 222,
      ticketKey: 'TE2-222',
      stage: 'VERIFY',
    });
    await ensureProjectExists(3);
    const foreignSuffix = Date.now() % 1000000;
    const foreignTicket = await createTestTicket(3, {
      title: '[e2e] Foreign ticket',
      description: 'Foreign',
      ticketNumber: foreignSuffix,
      ticketKey: `TFR-${foreignSuffix}`,
      stage: 'PLAN',
    });

    const payload = createWorkflowComparisonPayloadFixture({
      projectId: ctx.projectId,
      branch: 'AIB-330-persist-comparison-data',
      sourceTicket: {
        ticketKey: sourceTicket.ticketKey ?? 'TE2-221',
      },
      participants: [
        { ticketKey: candidateA.ticketKey ?? 'TE2-222' },
      ],
    });

    const malformedResponse = await postWorkflow<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`,
      {
        ...payload,
        markdownPath: 'bad-path.md',
      }
    );

    const wrongScopeResponse = await postWorkflow<{ code: string }>(
      `/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`,
      {
        ...payload,
        participantTicketKeys: [foreignTicket.ticketKey ?? `TFR-${foreignSuffix}`],
        report: {
          ...payload.report,
          metadata: {
            ...payload.report.metadata,
            comparedTickets: [foreignTicket.ticketKey ?? `TFR-${foreignSuffix}`],
          },
        },
      }
    );

    expect(malformedResponse.status).toBe(400);
    expect(malformedResponse.data.code).toBe('VALIDATION_ERROR');
    expect(wrongScopeResponse.status).toBe(404);
    expect(wrongScopeResponse.data.code).toBe('PARTICIPANT_NOT_FOUND');

    const count = await prisma.comparisonRecord.count({
      where: {
        projectId: ctx.projectId,
        sourceTicketId: sourceTicket.id,
      },
    });

    expect(count).toBe(0);
  });
});
