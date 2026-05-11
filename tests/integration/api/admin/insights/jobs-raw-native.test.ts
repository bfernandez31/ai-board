import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { streamJobLogArtifact, validateWorkflowAuth } = vi.hoisted(() => ({
  streamJobLogArtifact: vi.fn(),
  validateWorkflowAuth: vi.fn(),
}));

vi.mock('@/app/lib/blob/client', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, streamJobLogArtifact };
});

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateWorkflowAuth };
});

import { GET } from '@/app/api/admin/insights/jobs/[jobId]/raw-native/route';

function streamFromBytes(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function makeJobForAgent(
  ctx: TestContext,
  ticketAgent: string | null
): Promise<number> {
  const prisma = getPrismaClient();
  const ticket = await ctx.createTicket({ title: '[e2e] rn-job' });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { agent: ticketAgent },
  });
  await prisma.project.update({
    where: { id: ctx.projectId },
    data: { defaultAgent: 'CLAUDE' },
  });
  const job = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: ctx.projectId,
      command: 'implement',
      status: JobStatus.COMPLETED,
      startedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return job.id;
}

describe('GET /api/admin/insights/jobs/:jobId/raw-native (US3)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    streamJobLogArtifact.mockReset();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
  });

  it('returns 401 when workflow auth fails', async () => {
    validateWorkflowAuth.mockReturnValueOnce({ isValid: false });
    const res = await GET(
      new NextRequest('http://localhost/api/admin/insights/jobs/1/raw-native'),
      { params: Promise.resolve({ jobId: '1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('streams the raw artifact for a Claude job', async () => {
    const jobId = await makeJobForAgent(ctx, 'CLAUDE');
    const bytes = new TextEncoder().encode('gzipped-bytes');
    streamJobLogArtifact.mockResolvedValueOnce({
      stream: streamFromBytes(bytes),
      size: bytes.byteLength,
    });

    const res = await GET(
      new NextRequest(`http://localhost/api/admin/insights/jobs/${jobId}/raw-native`),
      { params: Promise.resolve({ jobId: String(jobId) }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/gzip');
    const got = await res.arrayBuffer();
    expect(new Uint8Array(got)).toEqual(bytes);
  });

  it('returns 404 for a Codex job (effective-agent predicate)', async () => {
    const jobId = await makeJobForAgent(ctx, 'CODEX');
    const res = await GET(
      new NextRequest(`http://localhost/api/admin/insights/jobs/${jobId}/raw-native`),
      { params: Promise.resolve({ jobId: String(jobId) }) }
    );
    expect(res.status).toBe(404);
  });
});
