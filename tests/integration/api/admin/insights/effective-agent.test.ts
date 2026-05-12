import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus, WorkflowType } from '@prisma/client';
import {
  countShippedClaudeTicketsSince,
  listShippedClaudeJobsForWindow,
} from '@/app/lib/insights/predicate';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { validateWorkflowAuth } = vi.hoisted(() => ({
  validateWorkflowAuth: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateWorkflowAuth };
});

import { GET } from '@/app/api/admin/insights/jobs/route';

describe('FR-025: pre-flight count and workflow enumeration agree (US3)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
  });

  it('mixed-agent window: count and enumeration agree on the Claude tickets', async () => {
    const start = new Date('2026-04-01T00:00:00Z');
    const end = new Date('2026-06-01T00:00:00Z');

    const tCla = await ctx.createTicket({ title: '[e2e] claude-ticket' });
    const tInh = await ctx.createTicket({ title: '[e2e] claude-inherit' });
    const tCod = await ctx.createTicket({ title: '[e2e] codex-ticket' });

    await prisma.ticket.update({ where: { id: tCla.id }, data: { agent: 'CLAUDE' } });
    await prisma.ticket.update({ where: { id: tInh.id }, data: { agent: null } });
    await prisma.ticket.update({ where: { id: tCod.id }, data: { agent: 'CODEX' } });
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: 'CLAUDE' },
    });

    const baseShipped = new Date('2026-05-05T00:00:00Z');
    for (const t of [tCla, tInh, tCod]) {
      const job = await prisma.job.create({
        data: {
          ticketId: t.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: baseShipped,
          completedAt: baseShipped,
          updatedAt: baseShipped,
        },
      });
      // Predicate gates on JobLog.rawArtifactKey presence: the analyzer
      // corpus is the set of sessions the workflow can actually fetch.
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          captureStatus: 'CAPTURED',
          preview: '',
          rawArtifactKey: `raw-logs/${ctx.projectId}/${t.id}/${job.id}.jsonl.gz`,
          rawArtifactSize: 1,
        },
      });
      await prisma.ticketOutcome.create({
        data: {
          ticketId: t.id,
          projectId: ctx.projectId,
          workflowType: WorkflowType.FULL,
          ruleSetVersion: 1,
          shippedAt: baseShipped,
        },
      });
    }

    const count = await countShippedClaudeTicketsSince(start);
    expect(count).toBe(2);

    const direct = await listShippedClaudeJobsForWindow(start, end);
    expect(new Set(direct.map((j) => j.ticketId))).toEqual(new Set([tCla.id, tInh.id]));

    const req = new NextRequest(
      `http://localhost/api/admin/insights/jobs?periodStart=${start.toISOString()}&periodEnd=${end.toISOString()}`,
      { headers: { Authorization: 'Bearer test-token' } }
    );
    const res = await GET(req);
    const body = (await res.json()) as { jobs: { ticketId: number }[] };
    expect(new Set(body.jobs.map((j) => j.ticketId))).toEqual(
      new Set([tCla.id, tInh.id])
    );
  });
});
