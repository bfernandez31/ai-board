import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { POST } from '@/app/api/jobs/[id]/versions/route';

const { validateWorkflowAuth } = vi.hoisted(() => ({
  validateWorkflowAuth: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth,
}));

describe('POST /api/jobs/:id/versions', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });

    const ticket = await ctx.createTicket({ title: '[e2e] versions-post' });
    ticketId = ticket.id;
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'specify',
        status: 'PENDING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    jobId = job.id;
  });

  async function postVersions(targetJobId: number, body: unknown): Promise<Response> {
    return POST(
      new NextRequest(`http://localhost/api/jobs/${targetJobId}/versions`, {
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

  it('returns 401 when Authorization is missing or invalid', async () => {
    validateWorkflowAuth.mockReturnValue({ isValid: false });
    const res = await postVersions(jobId, { pluginVersion: '1.0.1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when pluginVersion is empty string', async () => {
    const res = await postVersions(jobId, { pluginVersion: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when agentCliVersion is longer than 100 characters', async () => {
    const res = await postVersions(jobId, { agentCliVersion: 'x'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when neither field is provided', async () => {
    const res = await postVersions(jobId, {});
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown job', async () => {
    const res = await postVersions(9999999, { pluginVersion: '1.0.1' });
    expect(res.status).toBe(404);
  });

  it('returns 200 and persists both versions on success', async () => {
    const res = await postVersions(jobId, {
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude-code 0.5.12',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: jobId,
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude-code 0.5.12',
    });

    const row = await prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      select: { pluginVersion: true, agentCliVersion: true },
    });
    expect(row.pluginVersion).toBe('1.0.1');
    expect(row.agentCliVersion).toBe('claude-code 0.5.12');
  });

  it('first-write-wins: a second POST with different values returns the originally stored values', async () => {
    const first = await postVersions(jobId, {
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude-code 0.5.12',
    });
    expect(first.status).toBe(200);

    const second = await postVersions(jobId, {
      pluginVersion: '2.0.0',
      agentCliVersion: 'claude-code 0.6.0',
    });
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body).toEqual({
      id: jobId,
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude-code 0.5.12',
    });

    const row = await prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      select: { pluginVersion: true, agentCliVersion: true },
    });
    expect(row.pluginVersion).toBe('1.0.1');
    expect(row.agentCliVersion).toBe('claude-code 0.5.12');
  });

  it('accepts the same payload shape across all four supported agents (CLAUDE/CODEX/MISTRAL/GEMINI)', async () => {
    const agents = [
      { command: 'specify', pluginVersion: 'sha:abc1234', agentCliVersion: 'claude-code 0.5.12' },
      { command: 'plan', pluginVersion: '1.0.1', agentCliVersion: 'codex 0.20.0' },
      { command: 'implement', pluginVersion: '1.0.1', agentCliVersion: 'vibe 0.4.0' },
      { command: 'verify', pluginVersion: '1.0.1', agentCliVersion: '@google/gemini-cli 0.3.1' },
    ];

    for (const { command, pluginVersion, agentCliVersion } of agents) {
      const otherJob = await prisma.job.create({
        data: {
          ticketId,
          projectId: ctx.projectId,
          command,
          status: 'PENDING',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const res = await postVersions(otherJob.id, { pluginVersion, agentCliVersion });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ id: otherJob.id, pluginVersion, agentCliVersion });
    }
  });

  it('exposes versions immediately while the job is still in a non-terminal state (RUNNING)', async () => {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'RUNNING' },
    });

    const res = await postVersions(jobId, {
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude-code 0.5.12',
    });
    expect(res.status).toBe(200);

    const row = await prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      select: { status: true, pluginVersion: true, agentCliVersion: true },
    });
    expect(row.status).toBe('RUNNING');
    expect(row.pluginVersion).toBe('1.0.1');
    expect(row.agentCliVersion).toBe('claude-code 0.5.12');
  });
});
