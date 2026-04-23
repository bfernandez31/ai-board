import { describe, it, expect, beforeEach } from 'vitest';
import { gzipSync } from 'node:zlib';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

const baseUrl = () => process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function putArtifact(
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

describe('PUT /api/jobs/:id/logs/artifact', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const ticket = await ctx.createTicket({ title: '[e2e] log-artifact' });
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

  it('returns 401 when no Authorization header', async () => {
    const body = gzipSync(Buffer.from('{}\n'));
    const res = await putArtifact(
      `/api/jobs/${jobId}/logs/artifact`,
      body,
      'application/gzip',
      false
    );
    expect(res.status).toBe(401);
  });

  it('returns 415 when Content-Type is not application/gzip', async () => {
    const body = Buffer.from('not gzip');
    const res = await putArtifact(
      `/api/jobs/${jobId}/logs/artifact`,
      body,
      'application/json',
      true
    );
    expect(res.status).toBe(415);
  });

  it('returns 413 when body exceeds 25 MB', async () => {
    const oversize = Buffer.alloc(26 * 1024 * 1024, 0);
    const res = await putArtifact(
      `/api/jobs/${jobId}/logs/artifact`,
      oversize,
      'application/gzip',
      true
    );
    expect(res.status).toBe(413);
  });

  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  it.skipIf(!blobConfigured)(
    'returns 201 with derived artifactKey on Blob-configured success',
    async () => {
      const payload = gzipSync(Buffer.from(JSON.stringify({ schemaVersion: 1 }) + '\n'));
      const res = await putArtifact(
        `/api/jobs/${jobId}/logs/artifact`,
        payload,
        'application/gzip',
        true
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as { artifactKey: string; artifactSize: number };
      expect(data.artifactKey).toBe(`logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`);
      expect(data.artifactSize).toBe(payload.byteLength);
    }
  );

  it.skipIf(blobConfigured)(
    'returns 502 BLOB_UPLOAD_FAILED when Blob is not configured',
    async () => {
      const payload = gzipSync(Buffer.from(JSON.stringify({ schemaVersion: 1 }) + '\n'));
      const res = await putArtifact(
        `/api/jobs/${jobId}/logs/artifact`,
        payload,
        'application/gzip',
        true
      );
      expect(res.status).toBe(502);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('BLOB_UPLOAD_FAILED');
    }
  );
});
