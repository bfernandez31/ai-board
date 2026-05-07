import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildJobLogRawArtifactKey,
  buildJobLogRawNativeUrl,
} from '@/app/lib/logs/artifact-key';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route';

const { streamJobLogArtifact } = vi.hoisted(() => ({
  streamJobLogArtifact: vi.fn(),
}));

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyTicketAccess: vi.fn(async () => ({ ticketKey: 'AIB-776' })),
}));

vi.mock('@/app/lib/blob/client', () => ({
  streamJobLogArtifact,
}));

describe('GET /api/projects/.../logs/raw-native (AIB-776)', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    streamJobLogArtifact.mockReset();

    const ticket = await ctx.createTicket({ title: '[e2e] log-raw-native' });
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

  function callGet(searchParams: string = ''): Promise<Response | NextResponse> {
    const url = `http://localhost${buildJobLogRawNativeUrl(ctx.projectId, ticketId, jobId)}${searchParams}`;
    return GET(new NextRequest(url), {
      params: Promise.resolve({
        projectId: String(ctx.projectId),
        id: String(ticketId),
        jobId: String(jobId),
      }),
    }) as Promise<Response | NextResponse>;
  }

  it('returns 404 when no rawArtifactKey is recorded', async () => {
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
      },
    });
    const res = await callGet();
    expect(res.status).toBe(404);
    expect(streamJobLogArtifact).not.toHaveBeenCalled();
  });

  it('returns 500 with ARTIFACT_KEY_MISMATCH when stored rawArtifactKey is not canonical', async () => {
    const canonical = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
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
        rawArtifactKey: canonical.replace(`logs/${ctx.projectId}/`, 'logs/999/'),
        rawArtifactSize: 50,
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await callGet();
    expect(res.status).toBe(500);
    await expect((res as Response).json()).resolves.toMatchObject({
      code: 'ARTIFACT_KEY_MISMATCH',
    });
    expect(streamJobLogArtifact).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('streams the raw native artifact and sets Content-Disposition for ?format=jsonl', async () => {
    const canonical = buildJobLogRawArtifactKey(ctx.projectId, ticketId, jobId);
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
        rawArtifactKey: canonical,
        rawArtifactSize: 50,
      },
    });

    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x1f, 0x8b]));
        controller.close();
      },
    });
    streamJobLogArtifact.mockResolvedValueOnce({ stream: fakeStream, size: 2 });

    const res = await callGet('?format=jsonl');
    expect(res.status).toBe(200);
    expect(streamJobLogArtifact).toHaveBeenCalledWith(canonical);
    expect(res.headers.get('content-type')).toBe('application/gzip');
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toContain('attachment');
    expect(disposition).toMatch(/\.native\.jsonl\.gz/);
  });
});
