import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJobLogRawArtifactKey } from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PUT, DELETE } from '@/app/api/jobs/[id]/logs/raw-artifact/route';

const { uploadJobLogArtifact, deleteJobLogArtifact, validateWorkflowAuth } = vi.hoisted(() => ({
  uploadJobLogArtifact: vi.fn(),
  deleteJobLogArtifact: vi.fn(),
  validateWorkflowAuth: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth,
}));

vi.mock('@/app/lib/blob/client', () => ({
  uploadJobLogArtifact,
  deleteJobLogArtifact,
}));

const GZIP_PAYLOAD = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00]);

async function createJobForAgent(
  ctx: TestContext,
  agent: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI',
  title: string,
): Promise<{ ticketId: number; jobId: number }> {
  const prisma = getPrismaClient();
  const ticket = await ctx.createTicket({ title });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { agent } });
  const job = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: ctx.projectId,
      command: 'specify',
      status: 'COMPLETED',
      startedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return { ticketId: ticket.id, jobId: job.id };
}

function buildRequest(
  jobId: number,
  body: Uint8Array | null,
  contentType: string | null,
  contentLength: number | null,
): NextRequest {
  const headers: Record<string, string> = { Authorization: 'Bearer test-token' };
  if (contentType) headers['Content-Type'] = contentType;
  if (contentLength !== null) headers['Content-Length'] = String(contentLength);
  return new NextRequest(`http://localhost/api/jobs/${jobId}/logs/raw-artifact`, {
    method: 'PUT',
    headers,
    body: body ?? undefined,
  });
}

describe('PUT /api/jobs/:id/logs/raw-artifact', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    uploadJobLogArtifact.mockReset();
    deleteJobLogArtifact.mockReset();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
    uploadJobLogArtifact.mockResolvedValue({ url: 'https://example.test/blob' });
    deleteJobLogArtifact.mockResolvedValue({ deleted: true });
  });

  it('returns 401 when workflow token is missing', async () => {
    validateWorkflowAuth.mockReturnValue({ isValid: false });
    const { jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-401');
    const res = await PUT(
      buildRequest(jobId, GZIP_PAYLOAD, 'application/gzip', GZIP_PAYLOAD.byteLength),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-finite job ID', async () => {
    const res = await PUT(
      buildRequest(0, GZIP_PAYLOAD, 'application/gzip', GZIP_PAYLOAD.byteLength),
      { params: Promise.resolve({ id: 'not-a-number' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 415 for non-gzip content-type', async () => {
    const { jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-415');
    const res = await PUT(
      buildRequest(jobId, GZIP_PAYLOAD, 'application/json', GZIP_PAYLOAD.byteLength),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(415);
    await expect(res.json()).resolves.toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('returns 413 when Content-Length exceeds 25 MB without reading body', async () => {
    const { jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-413');
    const res = await PUT(
      buildRequest(jobId, GZIP_PAYLOAD, 'application/gzip', 26 * 1024 * 1024),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(uploadJobLogArtifact).not.toHaveBeenCalled();
  });

  it('returns 404 when the job does not exist', async () => {
    const res = await PUT(
      buildRequest(9_999_999, GZIP_PAYLOAD, 'application/gzip', GZIP_PAYLOAD.byteLength),
      { params: Promise.resolve({ id: '9999999' }) },
    );
    expect(res.status).toBe(404);
  });

  it.each([['CODEX'], ['MISTRAL'], ['GEMINI']] as const)(
    'returns 409 AGENT_NOT_CLAUDE for %s ticket',
    async (agent) => {
      const { jobId } = await createJobForAgent(ctx, agent, `[e2e] raw-${agent}`);
      const res = await PUT(
        buildRequest(jobId, GZIP_PAYLOAD, 'application/gzip', GZIP_PAYLOAD.byteLength),
        { params: Promise.resolve({ id: String(jobId) }) },
      );
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({ code: 'AGENT_NOT_CLAUDE' });
      expect(uploadJobLogArtifact).not.toHaveBeenCalled();
    },
  );

  it('returns 502 BLOB_UPLOAD_FAILED when blob client throws', async () => {
    uploadJobLogArtifact.mockRejectedValueOnce(new Error('blob down'));
    const { jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-502');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await PUT(
      buildRequest(jobId, GZIP_PAYLOAD, 'application/gzip', GZIP_PAYLOAD.byteLength),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ code: 'BLOB_UPLOAD_FAILED' });
    errorSpy.mockRestore();
  });

  it('returns 201 with rawArtifactKey + rawArtifactSize on success', async () => {
    const prisma = getPrismaClient();
    const { ticketId, jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-201');
    const expectedKey = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
    const res = await PUT(
      buildRequest(jobId, GZIP_PAYLOAD, 'application/gzip', GZIP_PAYLOAD.byteLength),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { rawArtifactKey: string; rawArtifactSize: number };
    expect(data.rawArtifactKey).toBe(expectedKey);
    expect(data.rawArtifactSize).toBe(GZIP_PAYLOAD.byteLength);
    expect(uploadJobLogArtifact).toHaveBeenCalledWith(
      expectedKey,
      expect.any(Buffer),
      GZIP_PAYLOAD.byteLength,
    );

    // Sanity: row not auto-mutated by PUT (server only writes Blob, not JobLog).
    const log = await prisma.jobLog.findUnique({ where: { jobId } });
    expect(log).toBeNull();
  });

  it('emits overwrite info log when JobLog.rawArtifactKey already matches', async () => {
    const prisma = getPrismaClient();
    const { ticketId, jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-overwrite');
    const key = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'CAPTURED',
        preview: 'p',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
        artifactSize: 50,
        rawArtifactKey: key,
        rawArtifactSize: 80,
      },
    });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await PUT(
      buildRequest(jobId, GZIP_PAYLOAD, 'application/gzip', GZIP_PAYLOAD.byteLength),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(201);
    expect(infoSpy).toHaveBeenCalledWith(
      '[PUT /jobs/:id/logs/raw-artifact] Overwriting existing raw artifact for retried job run',
      expect.objectContaining({ jobId, artifactKey: key }),
    );
    infoSpy.mockRestore();
  });
});

describe('DELETE /api/jobs/:id/logs/raw-artifact', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    uploadJobLogArtifact.mockReset();
    deleteJobLogArtifact.mockReset();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
  });

  it('returns 200 { deleted: true } on Blob success', async () => {
    deleteJobLogArtifact.mockResolvedValueOnce({ deleted: true });
    const { ticketId, jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-del-ok');
    const expectedKey = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
    const res = await DELETE(
      new NextRequest(`http://localhost/api/jobs/${jobId}/logs/raw-artifact`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      }),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ deleted: true });
    expect(deleteJobLogArtifact).toHaveBeenCalledWith(expectedKey);
  });

  it('returns 200 { deleted: false } when Blob says 404 (idempotent)', async () => {
    deleteJobLogArtifact.mockResolvedValueOnce({ deleted: false });
    const { jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-del-404');
    const res = await DELETE(
      new NextRequest(`http://localhost/api/jobs/${jobId}/logs/raw-artifact`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      }),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ deleted: false });
  });

  it('returns 502 BLOB_DELETE_FAILED on unexpected Blob error', async () => {
    deleteJobLogArtifact.mockRejectedValueOnce(new Error('boom'));
    const { jobId } = await createJobForAgent(ctx, 'CLAUDE', '[e2e] raw-del-502');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await DELETE(
      new NextRequest(`http://localhost/api/jobs/${jobId}/logs/raw-artifact`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      }),
      { params: Promise.resolve({ id: String(jobId) }) },
    );
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ code: 'BLOB_DELETE_FAILED' });
    errorSpy.mockRestore();
  });

  it('returns 404 when the job does not exist', async () => {
    const res = await DELETE(
      new NextRequest(`http://localhost/api/jobs/9999999/logs/raw-artifact`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      }),
      { params: Promise.resolve({ id: '9999999' }) },
    );
    expect(res.status).toBe(404);
  });
});
