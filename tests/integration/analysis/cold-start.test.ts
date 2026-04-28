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

describe('Cold-start branch (US2)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('persists status=cold_start with coldStartReason and reduced output', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] cold start',
      description: 'a brand new project',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();
    const row = await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'running',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: 't',
        descriptionSnapshot: 'd',
        stackSnapshot: { language: 'typescript', framework: 'nextjs', services: [], testingFramework: null, e2e: false, e2eFramework: null, agent: { cli: 'claude-code', model: null } },
      },
    });

    const res = await PATCH(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis/${row.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WORKFLOW_TOKEN}`,
          },
          body: JSON.stringify({
            status: 'cold_start',
            coldStartReason: 'insufficient_comparable_history',
            output: { scopeWarnings: [{ category: 'other', message: 'thin description' }] },
            telemetry: { costUsd: 0.01, durationMs: 1000 },
          }),
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
    expect(res.status).toBe(200);

    const updated = await prisma.ticketAnalysis.findUnique({ where: { id: row.id } });
    expect(updated?.status).toBe('cold_start');
    expect(updated?.coldStartReason).toBe('insufficient_comparable_history');
    expect(updated?.output).toMatchObject({ scopeWarnings: expect.any(Array) });
  });

  it('rejects cold_start payloads missing coldStartReason', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] cold start invalid',
      description: 'x',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();
    const row = await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'running',
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: 't',
        descriptionSnapshot: 'd',
        stackSnapshot: {},
      },
    });
    const res = await PATCH(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis/${row.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WORKFLOW_TOKEN}`,
          },
          body: JSON.stringify({
            status: 'cold_start',
            output: { scopeWarnings: [] },
            telemetry: { costUsd: 0.01, durationMs: 1000 },
          }),
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
    expect(res.status).toBe(400);
  });
});
