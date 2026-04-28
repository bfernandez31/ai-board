import { NextRequest } from 'next/server';
import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Stage } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient, getTestUserId } from '@/tests/helpers/db-cleanup';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

vi.mock('@/lib/ai-credentials/workflow', () => ({
  getOwnerCredential: vi.fn(async () => ({ id: 1, userId: 'fake', provider: 'ANTHROPIC' })),
  getMissingCredentialError: () => 'No credential.',
}));

vi.mock('@/lib/analysis/dispatch-analysis', () => ({
  dispatchInboxAnalysisWorkflow: vi.fn(async () => undefined),
}));

import { POST } from '@/app/api/projects/[projectId]/tickets/[id]/analysis/route';

describe('Rate limit (US6 / FR-019)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function postFor(ticketId: number) {
    return POST(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticketId}/analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...ctx.api.getHeaders() },
          body: '{}',
        }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticketId),
        }),
      }
    );
  }

  async function seedTerminalRow(opts: {
    userId: string;
    status: 'success' | 'cold_start' | 'failed';
    endedAtMinutesAgo: number;
  }) {
    const ticket = await ctx.createTicket({
      title: `[e2e] rate-${Math.random().toString(36).slice(2, 7)}`,
      description: 'x',
      stage: Stage.SHIP,
    });
    return prisma.ticketAnalysis.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        userId: opts.userId,
        status: opts.status,
        startedAt: new Date(Date.now() - opts.endedAtMinutesAgo * 60_000 - 1000),
        endedAt: new Date(Date.now() - opts.endedAtMinutesAgo * 60_000),
        ruleSetVersion: 1,
        agent: 'CLAUDE',
        titleSnapshot: 't',
        descriptionSnapshot: 'd',
        stackSnapshot: {},
      },
    });
  }

  it('rejects 11th attempt with 429 RATE_LIMIT_EXCEEDED', async () => {
    const userId = await getTestUserId();
    for (let i = 0; i < 10; i++) {
      await seedTerminalRow({
        userId,
        status: 'success',
        endedAtMinutesAgo: i * 2,
      });
    }
    const ticket = await ctx.createTicket({
      title: '[e2e] rate-eleventh',
      description: 'x',
      stage: Stage.INBOX,
    });
    const res = await postFor(ticket.id);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { code: string; nextResetAt: string };
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.nextResetAt).toBeTruthy();
  });

  it('cold_start runs do NOT count against the budget', async () => {
    const userId = await getTestUserId();
    for (let i = 0; i < 15; i++) {
      await seedTerminalRow({ userId, status: 'cold_start', endedAtMinutesAgo: i });
    }
    const ticket = await ctx.createTicket({
      title: '[e2e] rate-coldstart',
      description: 'x',
      stage: Stage.INBOX,
    });
    const res = await postFor(ticket.id);
    expect(res.status).toBe(202);
  });

  it('failed runs do NOT count against the budget', async () => {
    const userId = await getTestUserId();
    for (let i = 0; i < 15; i++) {
      await seedTerminalRow({ userId, status: 'failed', endedAtMinutesAgo: i });
    }
    const ticket = await ctx.createTicket({
      title: '[e2e] rate-failures',
      description: 'x',
      stage: Stage.INBOX,
    });
    const res = await postFor(ticket.id);
    expect(res.status).toBe(202);
  });

  it('rolling window: rows older than 1 hour do NOT count', async () => {
    const userId = await getTestUserId();
    for (let i = 0; i < 10; i++) {
      await seedTerminalRow({
        userId,
        status: 'success',
        endedAtMinutesAgo: 65 + i,
      });
    }
    const ticket = await ctx.createTicket({
      title: '[e2e] rate-rolling',
      description: 'x',
      stage: Stage.INBOX,
    });
    const res = await postFor(ticket.id);
    expect(res.status).toBe(202);
  });
});
