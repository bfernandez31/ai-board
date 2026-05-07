import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    const ticket = await ctx.createTicket({ title: '[e2e] log-get' });
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
    await prisma.jobLog.create({
      data: {
        jobId,
        captureStatus: 'CAPTURED',
        preview: 'Bash command failed: exit 1',
        schemaVersion: 1,
        eventCount: 7,
        errorCount: 1,
        artifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}.jsonl.gz`,
        artifactSize: 4321,
      },
    });
  });

  it('owner can read; rawUrl populated for CAPTURED', async () => {
    const res = await ctx.api.get<{
      captureStatus: string;
      preview: string;
      rawUrl: string | null;
      artifactSize: number | null;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`);
    expect(res.status).toBe(200);
    expect(res.data.captureStatus).toBe('CAPTURED');
    expect(res.data.preview).toBe('Bash command failed: exit 1');
    expect(res.data.artifactSize).toBe(4321);
    expect(res.data.rawUrl).toBe(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw`
    );
    expect(res.response.headers.get('cache-control')).toBe('no-store');
  });

  it('member can read', async () => {
    const member = await ctx.createUser(`member-logget-${Date.now()}@project${ctx.projectId}.e2e.test`);
    await prisma.projectMember.create({
      data: { projectId: ctx.projectId, userId: member.id, role: 'member' },
    });
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`,
      { headers: { 'x-test-user-id': member.id } }
    );
    expect(res.status).toBe(200);
  });

  it('non-member is rejected', async () => {
    const outsider = await ctx.createUser(`outsider-logget-${Date.now()}@e2e.local`);
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`,
      { headers: { 'x-test-user-id': outsider.id } }
    );
    expect([403, 404]).toContain(res.status);
  });

  it('rawUrl is null when captureStatus is UNAVAILABLE', async () => {
    await prisma.jobLog.update({
      where: { jobId },
      data: {
        captureStatus: 'UNAVAILABLE',
        preview: 'Logs unavailable — capture failed.',
        artifactKey: null,
        artifactSize: null,
      },
    });
    const res = await ctx.api.get<{ captureStatus: string; rawUrl: string | null }>(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`
    );
    expect(res.status).toBe(200);
    expect(res.data.captureStatus).toBe('UNAVAILABLE');
    expect(res.data.rawUrl).toBeNull();
  });

  it('nativeRawUrl is populated when rawArtifactKey exists', async () => {
    await prisma.jobLog.update({
      where: { jobId },
      data: {
        rawArtifactKey: `logs/${ctx.projectId}/${ticketId}/${jobId}-raw.jsonl.gz`,
        rawArtifactSize: 9876,
      },
    });
    const res = await ctx.api.get<{
      captureStatus: string;
      nativeRawUrl: string | null;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`);
    expect(res.status).toBe(200);
    expect(res.data.nativeRawUrl).toBe(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs/raw?type=native`
    );
  });

  it('nativeRawUrl is null when rawArtifactKey is absent', async () => {
    const res = await ctx.api.get<{
      captureStatus: string;
      nativeRawUrl: string | null;
    }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`);
    expect(res.status).toBe(200);
    expect(res.data.nativeRawUrl).toBeNull();
  });

  it('returns 404 when no log row exists', async () => {
    await prisma.jobLog.delete({ where: { jobId } });
    const res = await ctx.api.get(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/${jobId}/logs`
    );
    expect(res.status).toBe(404);
  });
});
