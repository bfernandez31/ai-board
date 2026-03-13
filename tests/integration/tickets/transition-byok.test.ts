import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, JobStatus } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { getWorkflowHeaders } from '@/tests/helpers/workflow-auth';

describe('Ticket transitions with BYOK gating', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    process.env.PROJECT_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.GITHUB_OWNER = 'test';
    process.env.GITHUB_REPO = 'ai-board';
  });

  it('blocks a transition when the required provider credential is missing', async () => {
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] BYOK missing credential',
        description: 'Credential gating test',
      }
    );

    const response = await ctx.api.post<{ code: string; details: { providerFailures: Array<{ provider: string; reason: string }> } }>(
      `/api/projects/${ctx.projectId}/tickets/${createResponse.data.id}/transition`,
      { targetStage: 'SPECIFY' }
    );

    expect(response.status).toBe(400);
    expect(response.data.code).toBe('BYOK_REQUIRED');
    expect(response.data.details.providerFailures).toEqual([
      expect.objectContaining({ provider: 'ANTHROPIC', reason: 'MISSING' }),
    ]);
    expect(JSON.stringify(response.data)).not.toContain('valid');
  });

  it('creates job-scoped snapshots and serves them to workflow-authenticated requests', async () => {
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.CODEX },
    });

    await ctx.api.fetch(`/api/projects/${ctx.projectId}/ai-credentials/OPENAI`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey: 'openai-valid-2222' }),
    });

    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] BYOK happy path',
        description: 'Credential snapshot test',
      }
    );

    const transitionResponse = await ctx.api.post<{ jobId: number; stage: string }>(
      `/api/projects/${ctx.projectId}/tickets/${createResponse.data.id}/transition`,
      { targetStage: 'SPECIFY' }
    );

    expect(transitionResponse.status).toBe(200);
    expect(transitionResponse.data.stage).toBe('SPECIFY');
    expect(JSON.stringify(transitionResponse.data)).not.toContain('openai-valid-2222');

    const job = await prisma.job.findUnique({
      where: { id: transitionResponse.data.jobId },
      include: { providerCredentialSnapshots: true },
    });

    expect(job?.status).toBe(JobStatus.PENDING);
    expect(job?.providerCredentialSnapshots).toHaveLength(1);
    expect(job?.providerCredentialSnapshots[0]?.provider).toBe('OPENAI');

    const workflowApi = createAPIClient({
      testUserId: '',
      defaultHeaders: getWorkflowHeaders(),
    });

    const credentialResponse = await workflowApi.get<{ credentials: Array<{ provider: string; apiKey: string; lastFour: string }> }>(
      `/api/projects/${ctx.projectId}/jobs/${transitionResponse.data.jobId}/provider-credentials`
    );

    expect(credentialResponse.status).toBe(200);
    expect(credentialResponse.data.credentials).toEqual([
      expect.objectContaining({
        provider: 'OPENAI',
        apiKey: 'openai-valid-2222',
        lastFour: '2222',
      }),
    ]);
  });
});
