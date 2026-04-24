import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJobLogArtifactKey } from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PUT } from '@/app/api/jobs/[id]/logs/artifact/route';

const { uploadJobLogArtifact } = vi.hoisted(() => ({
  uploadJobLogArtifact: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

vi.mock('@/app/lib/blob/client', () => ({
  uploadJobLogArtifact,
  deleteJobLogArtifact: vi.fn(),
}));

describe('PUT artifact route overwrite observability', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    uploadJobLogArtifact.mockReset();
    uploadJobLogArtifact.mockResolvedValue({ url: 'https://example.test/blob' });

    const ticket = await ctx.createTicket({ title: '[e2e] log-artifact-route' });
    ticketId = ticket.id;
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  it('logs when a retried upload overwrites an existing captured artifact', async () => {
    const artifactKey = buildJobLogArtifactKey(ctx.projectId, ticketId, jobId);
    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'CAPTURED',
        preview: 'preview',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey,
        artifactSize: 50,
      },
    });

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const payload = new Uint8Array([0x1f, 0x8b, 0x08]);

    const response = await PUT(
      new NextRequest(`http://localhost/api/jobs/${jobId}/logs/artifact`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/gzip',
          'Content-Length': String(payload.byteLength),
        },
        body: payload,
      }),
      { params: Promise.resolve({ id: String(jobId) }) }
    );

    expect(response.status).toBe(201);
    expect(uploadJobLogArtifact).toHaveBeenCalledWith(
      artifactKey,
      expect.any(Buffer),
      payload.byteLength
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[PUT /jobs/:id/logs/artifact] Overwriting existing artifact for retried job run',
      expect.objectContaining({ artifactKey, jobId })
    );

    infoSpy.mockRestore();
  });
});
