import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildJobLogRawArtifactKey,
  buildJobLogRawNativeUrl,
} from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route';

const { streamJobLogArtifact, verifyTicketAccess } = vi.hoisted(() => ({
  streamJobLogArtifact: vi.fn(),
  verifyTicketAccess: vi.fn(),
}));

vi.mock('@/lib/db/auth-helpers', () => ({ verifyTicketAccess }));
vi.mock('@/app/lib/blob/client', () => ({ streamJobLogArtifact }));

const TICKET_KEY_FALLBACK = 'AIB-783';

async function seedClaudeJob(
  ctx: TestContext,
  rawArtifactKey: string | null,
  captureStatus: 'CAPTURED' | 'UNAVAILABLE' = 'CAPTURED',
): Promise<{ ticketId: number; jobId: number }> {
  const prisma = getPrismaClient();
  const ticket = await ctx.createTicket({ title: '[e2e] log-raw-native' });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { agent: 'CLAUDE' } });
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
  await prisma.jobLog.create({
    data: {
      jobId: job.id,
      captureStatus,
      preview: 'p',
      schemaVersion: 1,
      eventCount: 1,
      errorCount: 0,
      artifactKey: `logs/${ctx.projectId}/${ticket.id}/${job.id}.jsonl.gz`,
      artifactSize: 50,
      rawArtifactKey,
      rawArtifactSize: rawArtifactKey ? 80 : null,
    },
  });
  return { ticketId: ticket.id, jobId: job.id };
}

function makeRequest(ctx: TestContext, ticketId: number, jobId: number, format?: string) {
  const search = format ? `?format=${format}` : '';
  return new NextRequest(
    `http://localhost${buildJobLogRawNativeUrl(ctx.projectId, ticketId, jobId)}${search}`,
  );
}

describe('GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw-native', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    streamJobLogArtifact.mockReset();
    verifyTicketAccess.mockReset();
    verifyTicketAccess.mockResolvedValue({ ticketKey: TICKET_KEY_FALLBACK });
  });

  it('returns 400 for non-finite path parameters', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/projects/abc/tickets/0/jobs/-1/logs/raw-native'),
      { params: Promise.resolve({ projectId: 'abc', id: '0', jobId: '-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('maps verifyTicketAccess Unauthorized to 401', async () => {
    verifyTicketAccess.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(makeRequest(ctx, 1, 1), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: '1',
        jobId: '1',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('maps verifyTicketAccess Ticket not found to 403', async () => {
    verifyTicketAccess.mockRejectedValueOnce(new Error('Ticket not found'));
    const res = await GET(makeRequest(ctx, 1, 1), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: '1',
        jobId: '1',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-Claude tickets (no information leak)', async () => {
    const prisma = getPrismaClient();
    const ticket = await ctx.createTicket({ title: '[e2e] log-raw-codex' });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { agent: 'CODEX' } });
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
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        captureStatus: 'CAPTURED',
        preview: 'p',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: `logs/${ctx.projectId}/${ticket.id}/${job.id}.jsonl.gz`,
        artifactSize: 50,
      },
    });

    const res = await GET(makeRequest(ctx, ticket.id, job.id), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticket.id),
        jobId: String(job.id),
      }),
    });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Artifact not available' });
    expect(streamJobLogArtifact).not.toHaveBeenCalled();
  });

  it('returns 404 when JobLog.rawArtifactKey is null', async () => {
    const { ticketId, jobId } = await seedClaudeJob(ctx, null);
    const res = await GET(makeRequest(ctx, ticketId, jobId), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticketId),
        jobId: String(jobId),
      }),
    });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Artifact not available' });
  });

  it('returns 500 ARTIFACT_KEY_MISMATCH when stored key is wrong', async () => {
    const prisma = getPrismaClient();
    const ticket = await ctx.createTicket({ title: '[e2e] log-raw-mismatch' });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { agent: 'CLAUDE' } });
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
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        captureStatus: 'CAPTURED',
        preview: 'p',
        schemaVersion: 1,
        eventCount: 1,
        errorCount: 0,
        artifactKey: `logs/${ctx.projectId}/${ticket.id}/${job.id}.jsonl.gz`,
        artifactSize: 50,
        rawArtifactKey: `raw-logs/999/${ticket.id}/${job.id}.jsonl.gz`,
        rawArtifactSize: 80,
      },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(makeRequest(ctx, ticket.id, job.id), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticket.id),
        jobId: String(job.id),
      }),
    });
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ code: 'ARTIFACT_KEY_MISMATCH' });
    expect(streamJobLogArtifact).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns 502 BLOB_UNREACHABLE when blob client throws', async () => {
    const { ticketId, jobId } = await seedClaudeJob(
      ctx,
      buildJobLogRawArtifactKey(ctx.projectId, 0, 0),
    );
    const prisma = getPrismaClient();
    await prisma.jobLog.update({
      where: { jobId },
      data: { rawArtifactKey: buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId) },
    });
    streamJobLogArtifact.mockRejectedValueOnce(new Error('blob down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(makeRequest(ctx, ticketId, jobId), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticketId),
        jobId: String(jobId),
      }),
    });
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ code: 'BLOB_UNREACHABLE' });
    errorSpy.mockRestore();
  });

  it('returns 404 when blob stream returns null', async () => {
    const prisma = getPrismaClient();
    const { ticketId, jobId } = await seedClaudeJob(
      ctx,
      buildJobLogRawArtifactKey(ctx.projectId, 0, 0),
    );
    await prisma.jobLog.update({
      where: { jobId },
      data: { rawArtifactKey: buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId) },
    });
    streamJobLogArtifact.mockResolvedValueOnce(null);
    const res = await GET(makeRequest(ctx, ticketId, jobId), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticketId),
        jobId: String(jobId),
      }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 streamed gzip on happy path', async () => {
    const prisma = getPrismaClient();
    const { ticketId, jobId } = await seedClaudeJob(
      ctx,
      buildJobLogRawArtifactKey(ctx.projectId, 0, 0),
    );
    await prisma.jobLog.update({
      where: { jobId },
      data: { rawArtifactKey: buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId) },
    });
    const fakeStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0x1f, 0x8b]));
        controller.close();
      },
    });
    streamJobLogArtifact.mockResolvedValueOnce({ stream: fakeStream, size: 1024 });
    const res = await GET(makeRequest(ctx, ticketId, jobId), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticketId),
        jobId: String(jobId),
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/gzip');
    expect(res.headers.get('Content-Length')).toBe('1024');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
    expect(res.headers.get('Content-Encoding')).toBeNull();
    expect(res.headers.get('Content-Disposition')).toBeNull();
  });

  it('adds Content-Disposition with -raw infix when ?format=jsonl', async () => {
    const prisma = getPrismaClient();
    const { ticketId, jobId } = await seedClaudeJob(
      ctx,
      buildJobLogRawArtifactKey(ctx.projectId, 0, 0),
    );
    await prisma.jobLog.update({
      where: { jobId },
      data: { rawArtifactKey: buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId) },
    });
    streamJobLogArtifact.mockResolvedValueOnce({
      stream: new ReadableStream({ start: (c) => c.close() }),
      size: 0,
    });
    const res = await GET(makeRequest(ctx, ticketId, jobId, 'jsonl'), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticketId),
        jobId: String(jobId),
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toBe(
      `attachment; filename="${TICKET_KEY_FALLBACK}-job-${jobId}-raw.jsonl.gz"`,
    );
  });
});
