import { NextRequest } from 'next/server';
import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Stage } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient, getTestUserId } from '@/tests/helpers/db-cleanup';
import { GET, POST } from '@/app/api/projects/[projectId]/tickets/[id]/analysis/route';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

vi.mock('@/lib/ai-credentials/workflow', () => ({
  getOwnerCredential: vi.fn(async () => ({ id: 1, userId: 'fake', provider: 'ANTHROPIC' })),
  getMissingCredentialError: () => 'No Anthropic credential.',
}));

vi.mock('@/lib/analysis/dispatch-analysis', () => ({
  dispatchInboxAnalysisWorkflow: vi.fn(async () => undefined),
}));

describe('stale flag (US3)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function getEligibility(ticketId: number) {
    const res = await GET(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticketId}/analysis`,
        { headers: ctx.api.getHeaders() }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticketId),
        }),
      }
    );
    return res.json() as Promise<{ latest: { stale: boolean } | null }>;
  }

  it('flags stale=true when current title or description differs from snapshot', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] stale-test',
      description: 'original description',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();
    await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'success',
        startedAt: new Date(),
        endedAt: new Date(),
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: '[e2e] stale-test',
        descriptionSnapshot: 'original description',
        stackSnapshot: { language: 'typescript', framework: 'nextjs', services: [], testingFramework: null, e2e: false, e2eFramework: null, agent: { cli: 'claude-code', model: null } },
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 80, upper: 95 },
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [],
        },
      },
    });

    let body = await getEligibility(ticket.id);
    expect(body.latest?.stale).toBe(false);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { description: 'edited description with more detail' },
    });
    body = await getEligibility(ticket.id);
    expect(body.latest?.stale).toBe(true);
  });

  it('returns stale=false after revert to original snapshot text', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] stale-revert',
      description: 'original',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();
    await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'success',
        startedAt: new Date(),
        endedAt: new Date(),
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: '[e2e] stale-revert',
        descriptionSnapshot: 'original',
        stackSnapshot: {},
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 80, upper: 95 },
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [],
        },
      },
    });

    await prisma.ticket.update({ where: { id: ticket.id }, data: { description: 'changed' } });
    let body = await getEligibility(ticket.id);
    expect(body.latest?.stale).toBe(true);

    await prisma.ticket.update({ where: { id: ticket.id }, data: { description: 'original' } });
    body = await getEligibility(ticket.id);
    expect(body.latest?.stale).toBe(false);
  });

  it('comments do not affect stale flag (FR-010)', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] stale-comment',
      description: 'original',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();
    await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'success',
        startedAt: new Date(),
        endedAt: new Date(),
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: '[e2e] stale-comment',
        descriptionSnapshot: 'original',
        stackSnapshot: {},
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 80, upper: 95 },
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [],
        },
      },
    });

    await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        userId,
        content: 'a comment that should NOT trigger staleness',
      },
    });

    const body = await getEligibility(ticket.id);
    expect(body.latest?.stale).toBe(false);
  });

  it('re-analyze produces a new row; previous row preserved unchanged', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] re-analyze',
      description: 'original',
      stage: Stage.INBOX,
    });
    const userId = await getTestUserId();
    const first = await prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId,
        status: 'success',
        startedAt: new Date(),
        endedAt: new Date(),
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: '[e2e] re-analyze',
        descriptionSnapshot: 'original',
        stackSnapshot: {},
        output: {
          frictionRisk: 'low',
          qualityGateRange: { lower: 80, upper: 95 },
          recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
          costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
          scopeWarnings: [],
          anchors: [],
        },
      },
    });

    await prisma.ticket.update({ where: { id: ticket.id }, data: { description: 'edited' } });

    const res = await POST(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...ctx.api.getHeaders() },
          body: '{}',
        }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
        }),
      }
    );
    expect(res.status).toBe(202);

    const stillFirst = await prisma.ticketAnalysis.findUnique({ where: { id: first.id } });
    expect(stillFirst?.status).toBe('success');
    expect(stillFirst?.descriptionSnapshot).toBe('original');

    const allRows = await prisma.ticketAnalysis.findMany({ where: { ticketId: ticket.id } });
    expect(allRows.length).toBe(2);
  });
});
