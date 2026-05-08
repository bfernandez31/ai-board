import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJobLogArtifactKey, buildJobLogRawArtifactKey } from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST } from '@/app/api/jobs/[id]/logs/route';

const { validateWorkflowAuth } = vi.hoisted(() => ({
  validateWorkflowAuth: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth,
}));

describe('POST /api/jobs/:id/logs', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });

    const ticket = await ctx.createTicket({ title: '[e2e] log-post' });
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

  function buildArtifactKey(targetJobId: number): string {
    return buildJobLogArtifactKey(ctx.projectId, ticketId, targetJobId);
  }

  async function postLog(targetJobId: number, body: unknown): Promise<Response> {
    return POST(
      new NextRequest(`http://localhost/api/jobs/${targetJobId}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: String(targetJobId) }) }
    );
  }

  it('returns 401 when Authorization header is missing', async () => {
    validateWorkflowAuth.mockReturnValue({ isValid: false });
    const res = await POST(
      new NextRequest(`http://localhost/api/jobs/${jobId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureStatus: 'CAPTURED',
          preview: 'ok',
          schemaVersion: 1,
          eventCount: 1,
          errorCount: 0,
          artifactKey: buildArtifactKey(jobId),
          artifactSize: 100,
        }),
      }),
      { params: Promise.resolve({ id: String(jobId) }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization token is invalid', async () => {
    validateWorkflowAuth.mockReturnValue({ isValid: false });
    const res = await postLog(jobId, {
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when payload fails Zod validation', async () => {
    const res = await postLog(jobId, {
      captureStatus: 'CAPTURED',
      preview: '',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Validation failed' });
  });

  it('rejects artifactKey when captureStatus is UNAVAILABLE', async () => {
    const res = await postLog(jobId, {
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
      artifactKey: buildArtifactKey(jobId),
      artifactSize: 100,
    });
    expect(res.status).toBe(400);
  });

  it('upserts the JobLog row idempotently', async () => {
    const body = {
      captureStatus: 'CAPTURED' as const,
      preview: 'first preview',
      schemaVersion: 1,
      eventCount: 5,
      errorCount: 0,
      artifactKey: buildArtifactKey(jobId),
      artifactSize: 1234,
    };
    const first = await postLog(jobId, body);
    expect(first.status).toBe(200);
    const second = await postLog(jobId, {
      ...body,
      preview: 'second preview',
      eventCount: 6,
    });
    expect(second.status).toBe(200);

    const rows = await prisma.jobLog.findMany({ where: { jobId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.preview).toBe('second preview');
    expect(rows[0]?.eventCount).toBe(6);
  });

  it('re-redacts before truncation so partial secrets are not stored', async () => {
    // Secret spans input positions [257, 281), crossing the 280-char truncation
    // boundary. A naive `.slice(0, 280)` of the raw input would leak the first
    // 23 characters of the secret. The server must redact first (replacing the
    // 24-char secret with the 23-char `[REDACTED:github_token]` marker), then
    // truncate — preserving the full marker within the first 280 characters.
    // Total input length stays within PREVIEW_INPUT_MAX_CHARS (320).
    const longPrefix = `${'x'.repeat(256)} `;
    const secret = 'ghp_1234567890abcdefghij';
    const trailing = 'y'.repeat(36);
    const preview = `${longPrefix}${secret}${trailing}`;
    expect(preview.length).toBe(317);
    const res = await postLog(jobId, {
      captureStatus: 'CAPTURED',
      preview,
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey: buildArtifactKey(jobId),
      artifactSize: 100,
    });

    expect(res.status).toBe(200);
    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row.preview).toContain('[REDACTED:github_token]');
    expect(row.preview).not.toContain(secret);
    expect(row.preview.length).toBeLessThanOrEqual(280);
  });

  it('returns 404 for unknown job', async () => {
    const res = await postLog(9999999, {
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
    });
    expect(res.status).toBe(404);
  });

  function buildRawArtifactKey(targetJobId: number): string {
    return buildJobLogRawArtifactKey(ctx.projectId, ticketId, targetJobId);
  }

  it('persists rawArtifactKey + rawArtifactSize when both are submitted', async () => {
    const body = {
      captureStatus: 'CAPTURED' as const,
      preview: 'with raw',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey: buildArtifactKey(jobId),
      artifactSize: 100,
      rawArtifactKey: buildRawArtifactKey(jobId),
      rawArtifactSize: 222,
    };
    const res = await postLog(jobId, body);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rawArtifactSize).toBe(222);
    expect(data.rawNativeUrl).toContain(`/jobs/${jobId}/logs/raw-native`);

    const row = await prisma.jobLog.findUniqueOrThrow({ where: { jobId } });
    expect(row.rawArtifactKey).toBe(body.rawArtifactKey);
    expect(row.rawArtifactSize).toBe(222);
  });

  it('omits rawNativeUrl when raw fields are absent (back-compat)', async () => {
    const res = await postLog(jobId, {
      captureStatus: 'CAPTURED',
      preview: 'no raw',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey: buildArtifactKey(jobId),
      artifactSize: 100,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rawNativeUrl).toBeNull();
    expect(data.rawArtifactSize).toBeNull();
  });

  it('rejects rawArtifactKey without rawArtifactSize', async () => {
    const res = await postLog(jobId, {
      captureStatus: 'CAPTURED',
      preview: 'mismatch',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey: buildArtifactKey(jobId),
      artifactSize: 100,
      rawArtifactKey: buildRawArtifactKey(jobId),
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects raw fields when captureStatus is not CAPTURED', async () => {
    const res = await postLog(jobId, {
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
      rawArtifactKey: buildRawArtifactKey(jobId),
      rawArtifactSize: 222,
    });
    expect(res.status).toBe(400);
  });
});
