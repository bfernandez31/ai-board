import { beforeEach, describe, expect, it } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import {
  createStructuredComparisonFixture,
  createWorkflowComparisonPayloadFixture,
} from '@/tests/helpers/comparison-fixtures';
import { createTestTicket } from '@/tests/helpers/db-setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

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

  it('preserves persisted report fidelity and duplicate retry handling', async () => {
    const sourceTicket = await createTestTicket(ctx.projectId, {
      title: '[e2e] Source',
      description: 'Source',
      ticketNumber: 301,
      ticketKey: 'TE2-301',
      stage: 'BUILD',
      branch: 'AIB-330-persist-comparison-data',
    });
    const candidateA = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate A',
      description: 'A',
      ticketNumber: 302,
      ticketKey: 'TE2-302',
      stage: 'VERIFY',
    });
    const candidateB = await createTestTicket(ctx.projectId, {
      title: '[e2e] Candidate B',
      description: 'B',
      ticketNumber: 303,
      ticketKey: 'TE2-303',
      stage: 'PLAN',
    });

    const payload = createWorkflowComparisonPayloadFixture({
      projectId: ctx.projectId,
      branch: 'AIB-330-persist-comparison-data',
      sourceTicket: {
        id: sourceTicket.id,
        ticketKey: sourceTicket.ticketKey ?? 'TE2-301',
      },
      participants: [
        { id: candidateA.id, ticketKey: candidateA.ticketKey ?? 'TE2-302' },
        { id: candidateB.id, ticketKey: candidateB.ticketKey ?? 'TE2-303' },
      ],
    });

    const created = await postWorkflow<{
      comparisonId: number;
      status: 'created' | 'duplicate';
    }>(
      `/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`,
      payload
    );
    const retried = await postWorkflow<{
      comparisonId: number;
      status: 'created' | 'duplicate';
    }>(
      `/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/comparisons`,
      payload
    );
    const detail = await ctx.api.get<{
      winnerTicketKey: string;
      markdownPath: string;
      overallRecommendation: string;
      decisionPoints: Array<{ title: string }>;
      complianceRows: Array<{ principleName: string }>;
      participants: Array<{ ticketKey: string; rank: number }>;
    }>(
      `/api/projects/${ctx.projectId}/tickets/${candidateA.id}/comparisons/${created.data.comparisonId}`
    );

    expect(created.status).toBe(201);
    expect(retried.status).toBe(200);
    expect(retried.data.status).toBe('duplicate');
    expect(retried.data.comparisonId).toBe(created.data.comparisonId);
    expect(detail.status).toBe(200);
    expect(detail.data.winnerTicketKey).toBe(payload.report.metadata.comparedTickets[0]);
    expect(detail.data.markdownPath).toBe(payload.markdownPath);
    expect(detail.data.overallRecommendation).toContain(payload.report.metadata.comparedTickets[0]);
    expect(detail.data.participants.map((participant) => participant.ticketKey)).toEqual(
      payload.report.metadata.comparedTickets
    );
    expect(detail.data.participants.map((participant) => participant.rank)).toEqual([1, 2]);
    expect(detail.data.decisionPoints[0]?.title).toBe('Telemetry Aggregation Strategy');
    expect(detail.data.complianceRows[0]?.principleName).toBe('TypeScript-First Development');
  });
});
