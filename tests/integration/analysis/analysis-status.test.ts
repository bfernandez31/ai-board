import { NextRequest } from 'next/server';
import { beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { Stage } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient, getTestUserId } from '@/tests/helpers/db-cleanup';
import { PATCH } from '@/app/api/projects/[projectId]/tickets/[id]/analysis/[analysisId]/status/route';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN ?? 'test-workflow-token-for-e2e-tests-only';

function statusRequest(
  projectId: number,
  ticketId: number,
  analysisId: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return PATCH(
    new NextRequest(
      `http://localhost/api/projects/${projectId}/tickets/${ticketId}/analysis/${analysisId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WORKFLOW_TOKEN}`,
          ...headers,
        },
        body: JSON.stringify(body),
      }
    ),
    {
      params: Promise.resolve({
        projectId: String(projectId),
        id: String(ticketId),
        analysisId: String(analysisId),
      }),
    }
  );
}

async function seedRunningRow(
  prisma: ReturnType<typeof getPrismaClient>,
  projectId: number,
  ticketId: number,
  userId: string,
  anchorIdsAttempted: number[] = []
) {
  return prisma.ticketAnalysis.create({
    data: {
      ticketId,
      projectId,
      userId,
      status: 'running',
      ruleSetVersion: 1,
      agent: 'CLAUDE',
      titleSnapshot: 't',
      descriptionSnapshot: 'd',
      stackSnapshot: { language: 'typescript', framework: 'nextjs', services: [], testingFramework: null, e2e: false, e2eFramework: null, agent: { cli: 'claude-code', model: null } },
      anchorIdsAttempted,
    },
  });
}

const successOutput = {
  frictionRisk: 'medium',
  qualityGateRange: { lower: 70, upper: 85 },
  recommendation: { choice: 'FULL', confidence: 'medium', justification: 'because postgres' },
  costRange: { baselineLowerUsd: 0.1, baselineUpperUsd: 0.2, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.05 },
  scopeWarnings: [],
  anchors: [],
};

describe('PATCH /analysis/:analysisId/status', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function setupRow(anchorIds: number[] = []) {
    const ticket = await ctx.createTicket({
      title: '[e2e] status patch',
      description: 'x',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();
    const row = await seedRunningRow(prisma, ctx.projectId, ticket.id, userId, anchorIds);
    return { ticket, row };
  }

  it('rejects without WORKFLOW_API_TOKEN with 401', async () => {
    const { ticket, row } = await setupRow();
    const res = await PATCH(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis/${row.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'failed', errorReason: 'other' }),
        }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
          analysisId: String(row.id),
        }),
      }
    );
    expect(res.status).toBe(401);
  });

  it('transitions running → success with telemetry', async () => {
    const { ticket, row } = await setupRow();
    const res = await statusRequest(ctx.projectId, ticket.id, row.id, {
      status: 'success',
      output: successOutput,
      telemetry: { costUsd: 0.05, durationMs: 12000 },
    });
    expect(res.status).toBe(200);
    const updated = await prisma.ticketAnalysis.findUnique({ where: { id: row.id } });
    expect(updated?.status).toBe('success');
    expect(updated?.costUsd).toBeCloseTo(0.05, 2);
    expect(updated?.endedAt).not.toBeNull();
  });

  it('returns idempotent 200 on terminal-state re-PATCH', async () => {
    const { ticket, row } = await setupRow();
    await statusRequest(ctx.projectId, ticket.id, row.id, {
      status: 'failed',
      errorReason: 'other',
    });
    const second = await statusRequest(ctx.projectId, ticket.id, row.id, {
      status: 'success',
      output: successOutput,
      telemetry: { costUsd: 0.05, durationMs: 12000 },
    });
    expect(second.status).toBe(200);
    const row2 = await prisma.ticketAnalysis.findUnique({ where: { id: row.id } });
    expect(row2?.status).toBe('failed');
  });

  it('rejects malformed body with 400', async () => {
    const { ticket, row } = await setupRow();
    const res = await statusRequest(ctx.projectId, ticket.id, row.id, {
      status: 'success',
      output: { frictionRisk: 'invalid' },
      telemetry: { costUsd: 0, durationMs: 0 },
    });
    expect(res.status).toBe(400);
  });

  it('rejects when output.anchors[*].ticketId is not in anchorIdsAttempted', async () => {
    const { ticket, row } = await setupRow([42]);
    const badOutput = {
      ...successOutput,
      anchors: [
        { ticketId: 999, ticketKey: 'AIB-999', frictionFree: true, qualityScore: 80, overlapStrength: 1 },
      ],
    };
    const res = await statusRequest(ctx.projectId, ticket.id, row.id, {
      status: 'success',
      output: badOutput,
      telemetry: { costUsd: 0.01, durationMs: 100 },
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 idempotently on race with affected count = 0', async () => {
    const { ticket, row } = await setupRow();
    // Pre-mark terminal to simulate race
    await prisma.ticketAnalysis.update({
      where: { id: row.id },
      data: { status: 'success', endedAt: new Date() },
    });
    const res = await statusRequest(ctx.projectId, ticket.id, row.id, {
      status: 'failed',
      errorReason: 'other',
    });
    expect(res.status).toBe(200);
    const fresh = await prisma.ticketAnalysis.findUnique({ where: { id: row.id } });
    expect(fresh?.status).toBe('success');
  });
});
