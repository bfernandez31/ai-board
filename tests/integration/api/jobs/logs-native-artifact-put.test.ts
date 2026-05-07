import { describe, it, expect, beforeEach } from 'vitest';
import { gzipSync } from 'node:zlib';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

const baseUrl = () => process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function putNativeArtifact(
  url: string,
  body: Buffer,
  contentType: string,
  withAuth: boolean
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': String(body.byteLength),
  };
  if (withAuth) headers['Authorization'] = `Bearer ${WORKFLOW_TOKEN}`;
  return fetch(`${baseUrl()}${url}`, {
    method: 'PUT',
    headers,
    body,
  });
}

describe('PUT /api/jobs/:id/logs/native-artifact', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const ticket = await ctx.createTicket({ title: '[e2e] native-artifact' });
    ticketId = ticket.id;
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  it('returns 401 when no Authorization header', async () => {
    const body = gzipSync(Buffer.from('{}\n'));
    const res = await putNativeArtifact(
      `/api/jobs/${jobId}/logs/native-artifact`,
      body,
      'application/gzip',
      false
    );
    expect(res.status).toBe(401);
  });

  it('returns 415 when Content-Type is not application/gzip', async () => {
    const body = Buffer.from('not gzip');
    const res = await putNativeArtifact(
      `/api/jobs/${jobId}/logs/native-artifact`,
      body,
      'application/json',
      true
    );
    expect(res.status).toBe(415);
  });

  it('returns 413 when body exceeds 25 MB', async () => {
    const oversize = Buffer.alloc(26 * 1024 * 1024, 0);
    const res = await putNativeArtifact(
      `/api/jobs/${jobId}/logs/native-artifact`,
      oversize,
      'application/gzip',
      true
    );
    expect(res.status).toBe(413);
  });

  it('returns 404 for unknown job', async () => {
    const body = gzipSync(Buffer.from('{}\n'));
    const res = await putNativeArtifact(
      `/api/jobs/9999999/logs/native-artifact`,
      body,
      'application/gzip',
      true
    );
    expect(res.status).toBe(404);
  });

  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  it.skipIf(!blobConfigured)(
    'returns 201 with nativeArtifactKey on Blob-configured success',
    async () => {
      const nativeLine = JSON.stringify({
        uuid: 'abc-123',
        parentUuid: null,
        sessionId: 'sess-1',
        type: 'say',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
      });
      const payload = gzipSync(Buffer.from(nativeLine + '\n'));
      const res = await putNativeArtifact(
        `/api/jobs/${jobId}/logs/native-artifact`,
        payload,
        'application/gzip',
        true
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as { nativeArtifactKey: string; nativeArtifactSize: number };
      expect(data.nativeArtifactKey).toBe(
        `logs/${ctx.projectId}/${ticketId}/${jobId}.native.jsonl.gz`
      );
      expect(data.nativeArtifactSize).toBe(payload.byteLength);
    }
  );

  it.skipIf(blobConfigured)(
    'returns 502 BLOB_UPLOAD_FAILED when Blob is not configured',
    async () => {
      const payload = gzipSync(Buffer.from('{}\n'));
      const res = await putNativeArtifact(
        `/api/jobs/${jobId}/logs/native-artifact`,
        payload,
        'application/gzip',
        true
      );
      expect(res.status).toBe(502);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('BLOB_UPLOAD_FAILED');
    }
  );

  it('non-CLAUDE jobs can also upload native artifact (endpoint is agent-agnostic)', async () => {
    const codexJob = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const payload = gzipSync(Buffer.from('{}\n'));
    const res = await putNativeArtifact(
      `/api/jobs/${codexJob.id}/logs/native-artifact`,
      payload,
      'application/gzip',
      true
    );
    // Either 201 (blob configured) or 502 (not configured) — but NOT 4xx
    expect([201, 502]).toContain(res.status);
  });
});
