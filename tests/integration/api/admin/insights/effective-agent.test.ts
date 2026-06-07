import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus } from '@prisma/client';
import {
  countEligibleUnanalyzedSessions,
  listEligibleUnanalyzedSessions,
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

describe('effective-agent gate under any-outcome eligibility (AIB-856 US3)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
  });

  it('selects only effective-Claude sessions, with NO TicketOutcome dependency', async () => {
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

    const base = new Date('2026-05-05T00:00:00Z');
    // No TicketOutcome rows created — eligibility is now decoupled from
    // shippedAt (D-3). Sessions of never-shipped tickets must still be picked.
    for (const t of [tCla, tInh, tCod]) {
      const job = await prisma.job.create({
        data: {
          ticketId: t.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: base,
          completedAt: base,
          updatedAt: base,
        },
      });
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          captureStatus: 'CAPTURED',
          preview: '',
          rawArtifactKey: `raw-logs/${ctx.projectId}/${t.id}/${job.id}.jsonl.gz`,
          rawArtifactSize: 1,
        },
      });
    }

    const count = await countEligibleUnanalyzedSessions();
    expect(count).toBe(2);

    const direct = await listEligibleUnanalyzedSessions();
    expect(new Set(direct.map((j) => j.ticketId))).toEqual(
      new Set([tCla.id, tInh.id])
    );

    // Enumeration endpoint agrees with the library predicate (P-2 no-drift).
    const req = new NextRequest('http://localhost/api/admin/insights/jobs', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const res = await GET(req);
    const body = (await res.json()) as { jobs: { ticketId: number }[] };
    expect(new Set(body.jobs.map((j) => j.ticketId))).toEqual(
      new Set([tCla.id, tInh.id])
    );
  });
});
