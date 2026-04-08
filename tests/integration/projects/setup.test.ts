import { beforeEach, describe, expect, it } from 'vitest';
import { encryptCredential } from '@/lib/ai-credentials/crypto';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Project setup API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.userCredential.deleteMany({
      where: {
        user: { email: 'test@e2e.local' },
      },
    });
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        config: null,
        configSyncedAt: null,
        defaultAgent: 'CLAUDE',
      },
    });
  });

  async function createReadyCredential(provider: 'ANTHROPIC' | 'OPENAI') {
    const value =
      provider === 'OPENAI'
        ? `sk-proj-${'a'.repeat(40)}`
        : `sk-ant-api03-${'a'.repeat(80)}`;
    const encrypted = encryptCredential(value);

    await prisma.userCredential.create({
      data: {
        userId: 'test-user-id',
        provider,
        credentialType: 'API_KEY',
        label: `[e2e] ${provider} setup credential`,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        preview: encrypted.preview,
        readinessStatus: 'READY',
      },
    });
  }

  function createWorkflowClient() {
    return createAPIClient({
      defaultHeaders: {
        Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only'}`,
      },
    });
  }

  it('returns setup state for imported projects without config', async () => {
    const response = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      projectId: ctx.projectId,
      requiresSetup: true,
      selectedAgentDefault: 'CLAUDE',
      redirectTo: null,
    });
    expect(response.data.eligibleAgents).toHaveLength(2);
  });

  it('blocks setup start when selected credential is not ready', async () => {
    const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      selectedAgent: 'CLAUDE',
    });

    expect(response.status).toBe(403);
    expect(response.data.error).toContain('not ready');
  });

  it('creates a new setup job and reuses it while active', async () => {
    await createReadyCredential('ANTHROPIC');

    const firstResponse = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      selectedAgent: 'CLAUDE',
    });

    expect(firstResponse.status).toBe(202);
    expect(firstResponse.data).toMatchObject({
      created: true,
      duplicate: false,
    });

    const secondResponse = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      selectedAgent: 'CLAUDE',
    });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.data).toMatchObject({
      created: false,
      duplicate: true,
    });
    expect(secondResponse.data.job.jobId).toBe(firstResponse.data.job.jobId);
  });

  it('accepts workflow callbacks and syncs config on completion', async () => {
    await createReadyCredential('ANTHROPIC');

    const startResponse = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
      selectedAgent: 'CLAUDE',
    });
    const jobId = startResponse.data.job.jobId as number;

    const workflowClient = createWorkflowClient();
    const runningResponse = await workflowClient.patch(
      `/api/projects/${ctx.projectId}/setup/status`,
      {
        jobId,
        status: 'RUNNING',
        workflowRunId: 12345,
      }
    );

    expect(runningResponse.status).toBe(200);
    expect(runningResponse.data.status).toBe('RUNNING');

    const completedResponse = await workflowClient.patch(
      `/api/projects/${ctx.projectId}/setup/status`,
      {
        jobId,
        status: 'COMPLETED',
        commitSha: 'abcdef1234567',
        artifactManifest: [
          {
            path: '.ai-board/config.yml',
            kind: 'config',
            status: 'generated',
            editable: true,
          },
        ],
      }
    );

    expect(completedResponse.status).toBe(200);
    expect(completedResponse.data.status).toBe('COMPLETED');
    expect(completedResponse.data.commitSha).toBe('abcdef1234567');

    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { config: true, configSyncedAt: true },
    });

    expect(project?.config).not.toBeNull();
    expect(project?.configSyncedAt).not.toBeNull();
  });
});
