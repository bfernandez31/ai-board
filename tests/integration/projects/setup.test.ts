import { beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '@prisma/client';
import { encryptCredential } from '@/lib/ai-credentials/crypto';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { addProjectMember, createTestMemberUser } from '@/tests/helpers/db-setup';
import type {
  ProjectSetupResponse,
  SetupStartResponse,
} from '@/lib/project-setup/types';

const prisma = getPrismaClient();
const WORKFLOW_TOKEN = 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient() {
  return createAPIClient({
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

async function createReadyCredential(
  provider: 'ANTHROPIC' | 'OPENAI',
  value: string
) {
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
      preview: value.slice(-4),
      readinessStatus: 'READY',
    },
  });
}

describe('Project setup flow', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        config: null,
        configSyncedAt: null,
      },
    });

    await prisma.projectSetupAttempt.deleteMany({
      where: { projectId: ctx.projectId },
    });

    await prisma.userCredential.deleteMany({
      where: { userId: 'test-user-id' },
    });
  });

  it('returns owner-visible setup state and member read-only state', async () => {
    const ownerResponse = await ctx.api.get<ProjectSetupResponse>(
      `/api/projects/${ctx.projectId}/setup`
    );

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.data.setupRequired).toBe(true);
    expect(ownerResponse.data.viewerCanManage).toBe(true);
    expect(ownerResponse.data.latestAttempt).toBeNull();
    expect(ownerResponse.data.credentialReadiness.CLAUDE.ready).toBe(false);
    expect(ownerResponse.data.credentialReadiness.CODEX.ready).toBe(false);

    const member = await createTestMemberUser();
    await addProjectMember(ctx.projectId, member.id);

    const memberClient = createAPIClient({
      testUserId: member.id,
      includeTestUserHeader: true,
      enableTestAuthOverride: true,
    });

    const memberResponse = await memberClient.get<ProjectSetupResponse>(
      `/api/projects/${ctx.projectId}/setup`
    );

    expect(memberResponse.status).toBe(200);
    expect(memberResponse.data.viewerCanManage).toBe(false);
    expect(memberResponse.data.setupRequired).toBe(true);
  });

  it('blocks member starts and rejects missing credentials', async () => {
    const member = await createTestMemberUser();
    await addProjectMember(ctx.projectId, member.id);

    const memberClient = createAPIClient({
      testUserId: member.id,
      includeTestUserHeader: true,
      enableTestAuthOverride: true,
    });

    const forbiddenResponse = await memberClient.post(
      `/api/projects/${ctx.projectId}/setup/attempts`,
      { selectedAgent: Agent.CLAUDE }
    );

    expect(forbiddenResponse.status).toBe(403);

    const missingCredentialResponse = await ctx.api.post(
      `/api/projects/${ctx.projectId}/setup/attempts`,
      { selectedAgent: Agent.CODEX }
    );

    expect(missingCredentialResponse.status).toBe(422);
    expect(missingCredentialResponse.data).toHaveProperty(
      'code',
      'CREDENTIAL_NOT_READY'
    );
  });

  it('starts setup, rejects duplicates, persists failures, and allows retry', async () => {
    await createReadyCredential('ANTHROPIC', 'sk-ant-api03-' + 'a'.repeat(80));

    const firstStart = await ctx.api.post<SetupStartResponse>(
      `/api/projects/${ctx.projectId}/setup/attempts`,
      { selectedAgent: Agent.CLAUDE }
    );

    expect(firstStart.status).toBe(201);
    expect(firstStart.data.attempt.status).toBe('PENDING');

    const duplicateStart = await ctx.api.post(
      `/api/projects/${ctx.projectId}/setup/attempts`,
      { selectedAgent: Agent.CLAUDE }
    );

    expect(duplicateStart.status).toBe(409);
    expect(duplicateStart.data).toHaveProperty(
      'code',
      'ACTIVE_ATTEMPT_EXISTS'
    );

    const workflowApi = createWorkflowClient();

    const runningResponse = await workflowApi.patch(
      `/api/projects/${ctx.projectId}/setup/attempts/${firstStart.data.attempt.id}/status`,
      {
        status: 'RUNNING',
        message: 'Creating onboarding files',
        workflowRunId: 1234,
      }
    );

    expect(runningResponse.status).toBe(200);
    expect(runningResponse.data).toHaveProperty('status', 'RUNNING');

    const failedResponse = await workflowApi.patch(
      `/api/projects/${ctx.projectId}/setup/attempts/${firstStart.data.attempt.id}/status`,
      {
        status: 'FAILED',
        message: 'Workflow failed',
        failureCode: 'WORKFLOW_FAILED',
        failureMessage: 'Workflow failed before completion.',
      }
    );

    expect(failedResponse.status).toBe(200);
    expect(failedResponse.data).toHaveProperty('status', 'FAILED');

    const setupAfterFailure = await ctx.api.get<ProjectSetupResponse>(
      `/api/projects/${ctx.projectId}/setup`
    );

    expect(setupAfterFailure.data.latestAttempt?.status).toBe('FAILED');
    expect(setupAfterFailure.data.latestAttempt?.failureCode).toBe(
      'WORKFLOW_FAILED'
    );

    const retryStart = await ctx.api.post<SetupStartResponse>(
      `/api/projects/${ctx.projectId}/setup/attempts`,
      { selectedAgent: Agent.CLAUDE }
    );

    expect(retryStart.status).toBe(201);
    expect(retryStart.data.attempt.id).not.toBe(firstStart.data.attempt.id);

    const attempts = await prisma.projectSetupAttempt.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { attemptNumber: 'asc' },
      select: { attemptNumber: true, status: true },
    });

    expect(attempts).toEqual([
      { attemptNumber: 1, status: 'FAILED' },
      { attemptNumber: 2, status: 'PENDING' },
    ]);

    const staleCallback = await workflowApi.patch(
      `/api/projects/${ctx.projectId}/setup/attempts/${firstStart.data.attempt.id}/status`,
      { status: 'RUNNING' }
    );

    expect(staleCallback.status).toBe(409);
    expect(staleCallback.data).toHaveProperty('code', 'STALE_ATTEMPT');
  });

  it('completes setup, syncs config, and redirects project entry to the board', async () => {
    await createReadyCredential('OPENAI', 'sk-proj-' + 'b'.repeat(40));

    const startResponse = await ctx.api.post<SetupStartResponse>(
      `/api/projects/${ctx.projectId}/setup/attempts`,
      { selectedAgent: Agent.CODEX }
    );

    expect(startResponse.status).toBe(201);

    const workflowApi = createWorkflowClient();
    await workflowApi.patch(
      `/api/projects/${ctx.projectId}/setup/attempts/${startResponse.data.attempt.id}/status`,
      {
        status: 'RUNNING',
        message: 'Preparing setup files',
        workflowRunId: 9876,
      }
    );

    const completedResponse = await workflowApi.patch(
      `/api/projects/${ctx.projectId}/setup/attempts/${startResponse.data.attempt.id}/status`,
      {
        status: 'COMPLETED',
        message: 'Created AI Board setup files',
        workflowRunId: 9876,
        artifactSummary: {
          created: ['.ai-board/config.yml'],
          notes: ['Generated initial setup assets'],
        },
      }
    );

    expect(completedResponse.status).toBe(200);
    expect(completedResponse.data).toHaveProperty('status', 'COMPLETED');
    expect(completedResponse.data).toHaveProperty('setupRequired', false);

    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { configSyncedAt: true, config: true },
    });

    expect(project?.configSyncedAt).not.toBeNull();
    expect(project?.config).not.toBeNull();

    const setupResponse = await ctx.api.get<ProjectSetupResponse>(
      `/api/projects/${ctx.projectId}/setup`
    );

    expect(setupResponse.data.setupRequired).toBe(false);
    expect(setupResponse.data.latestAttempt?.status).toBe('COMPLETED');
    expect(setupResponse.data.latestAttempt?.artifactSummary).toEqual({
      created: ['.ai-board/config.yml'],
      notes: ['Generated initial setup assets'],
    });

    const projectEntryResponse = await ctx.api.fetch(`/projects/${ctx.projectId}`, {
      redirect: 'manual',
    });

    expect(projectEntryResponse.status).toBeGreaterThanOrEqual(300);
    expect(projectEntryResponse.headers.get('location')).toContain(
      `/projects/${ctx.projectId}/board`
    );
  });
});
