import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJobLogRawArtifactKey } from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PUT, DELETE } from '@/app/api/jobs/[id]/logs/artifact-raw/route';

const { uploadJobLogArtifact, deleteJobLogArtifact } = vi.hoisted(() => ({
  uploadJobLogArtifact: vi.fn(),
  deleteJobLogArtifact: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth: vi.fn(() => ({ isValid: true })),
}));

vi.mock('@/app/lib/blob/client', () => ({
  uploadJobLogArtifact,
  deleteJobLogArtifact,
}));

describe('PUT /api/jobs/:id/logs/artifact-raw (AIB-776)', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    uploadJobLogArtifact.mockReset();
    uploadJobLogArtifact.mockResolvedValue({ url: 'https://example.test/blob' });
    deleteJobLogArtifact.mockReset();
    deleteJobLogArtifact.mockResolvedValue({ deleted: true });

    const ticket = await ctx.createTicket({ title: '[e2e] log-artifact-raw' });
    ticketId = ticket.id;
    // Default project's defaultAgent is CLAUDE, ticket.agent is null → effectiveAgent CLAUDE.
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

  function gzipBytes(): Uint8Array {
    return new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00]);
  }

  async function putRaw(targetJobId: number, body: Uint8Array, contentType = 'application/gzip'): Promise<Response> {
    return PUT(
      new NextRequest(`http://localhost/api/jobs/${targetJobId}/logs/artifact-raw`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': contentType,
          'Content-Length': String(body.byteLength),
        },
        body,
      }),
      { params: Promise.resolve({ id: String(targetJobId) }) }
    );
  }

  it('uploads the native artifact under the canonical .native.jsonl.gz key', async () => {
    const body = gzipBytes();
    const res = await putRaw(jobId, body);
    expect(res.status).toBe(201);
    const expectedKey = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
    expect(uploadJobLogArtifact).toHaveBeenCalledWith(
      expectedKey,
      expect.any(Buffer),
      body.byteLength
    );
    await expect(res.json()).resolves.toMatchObject({
      rawArtifactKey: expectedKey,
      rawArtifactSize: body.byteLength,
    });
  });

  it('returns 415 when Content-Type is not application/gzip', async () => {
    const res = await putRaw(jobId, gzipBytes(), 'application/json');
    expect(res.status).toBe(415);
    expect(uploadJobLogArtifact).not.toHaveBeenCalled();
  });

  it('returns 422 for non-CLAUDE jobs (Codex)', async () => {
    // Override ticket-level agent so effectiveAgent becomes CODEX.
    await prisma.ticket.update({ where: { id: ticketId }, data: { agent: 'CODEX' } });
    const res = await putRaw(jobId, gzipBytes());
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ code: 'AGENT_NOT_SUPPORTED' });
    expect(uploadJobLogArtifact).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown job', async () => {
    const res = await putRaw(9_999_999, gzipBytes());
    expect(res.status).toBe(404);
  });

  it('returns 502 when Blob upload throws', async () => {
    uploadJobLogArtifact.mockRejectedValueOnce(new Error('blob down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await putRaw(jobId, gzipBytes());
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ code: 'BLOB_UPLOAD_FAILED' });
    errSpy.mockRestore();
  });

  it('logs an info message when overwriting an existing native artifact key', async () => {
    const expectedKey = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'CAPTURED',
        preview: 'preview',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
        artifactSize: 100,
        rawArtifactKey: expectedKey,
        rawArtifactSize: 50,
      },
    });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await putRaw(jobId, gzipBytes());
    expect(res.status).toBe(201);
    expect(infoSpy).toHaveBeenCalledWith(
      '[PUT /jobs/:id/logs/artifact-raw] Overwriting existing native artifact for retried job run',
      expect.objectContaining({ jobId, rawArtifactKey: expectedKey })
    );
    infoSpy.mockRestore();
  });

  it('DELETE removes the native artifact', async () => {
    const res = await DELETE(
      new NextRequest(`http://localhost/api/jobs/${jobId}/logs/artifact-raw`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      }),
      { params: Promise.resolve({ id: String(jobId) }) }
    );
    expect(res.status).toBe(200);
    const expectedKey = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
    expect(deleteJobLogArtifact).toHaveBeenCalledWith(expectedKey);
  });
});
