import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJobLogArtifactKey, buildJobLogRawUrl } from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw/route';

const { streamJobLogArtifact } = vi.hoisted(() => ({
  streamJobLogArtifact: vi.fn(),
}));

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyTicketAccess: vi.fn(async () => ({ ticketKey: 'AIB-724' })),
}));

vi.mock('@/app/lib/blob/client', () => ({
  streamJobLogArtifact,
}));

describe('GET raw log route hardening', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    streamJobLogArtifact.mockReset();

    const ticket = await ctx.createTicket({ title: '[e2e] log-raw-route' });
    ticketId = ticket.id;

    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'specify',
        status: 'FAILED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  it('rejects a stored artifactKey that does not match the canonical job path', async () => {
    const canonicalArtifactKey = buildJobLogArtifactKey(ctx.projectId, ticketId, jobId);

    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'CAPTURED',
        preview: 'preview',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: canonicalArtifactKey.replace(
          `logs/${ctx.projectId}/`,
          'logs/999/'
        ),
        artifactSize: 42,
      },
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(
      new NextRequest(
        `http://localhost${buildJobLogRawUrl(ctx.projectId, ticketId, jobId)}`
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticketId),
          jobId: String(jobId),
        }),
      }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'ARTIFACT_KEY_MISMATCH' });
    expect(streamJobLogArtifact).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
