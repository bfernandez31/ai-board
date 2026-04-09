/**
 * Integration Tests: Setup Job API
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only'}`,
    },
  });
}

describe('Setup Job API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    const prisma = getPrismaClient();
    await prisma.projectSetupJob.deleteMany({
      where: { projectId: ctx.projectId },
    });
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: null },
    });
    await prisma.userCredential.upsert({
      where: { userId_provider: { userId: 'test-user-id', provider: 'ANTHROPIC' } },
      update: { readinessStatus: 'READY' },
      create: {
        userId: 'test-user-id',
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: 'Test Anthropic Key',
        encryptedValue: 'test-encrypted',
        iv: 'test-iv-value-12345678',
        authTag: 'test-auth-tag-1234567',
        preview: 'sk-t',
        readinessStatus: 'READY',
      },
    });
  });

  describe('POST /api/projects/:projectId/setup/jobs', () => {
    it('creates a pending setup job', async () => {
      const response = await ctx.api.post<{
        id: number;
        projectId: number;
        agent: string;
        status: string;
      }>(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });

      expect(response.status).toBe(201);
      expect(response.data.projectId).toBe(ctx.projectId);
      expect(response.data.agent).toBe('CLAUDE');
      expect(response.data.status).toBe('PENDING');
    });

    it('rejects non-owner access', async () => {
      const nonOwner = await ctx.createUser('non-owner@test.com');
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' },
        { testUserId: nonOwner.id },
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it('rejects already-configured projects', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: new Date() },
      });

      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });
      expect(response.status).toBe(409);
    });

    it('rejects when a setup job is already active', async () => {
      await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });

      expect(response.status).toBe(409);
    });

    it('rejects when the owner credential is missing', async () => {
      const prisma = getPrismaClient();
      await prisma.userCredential.deleteMany({
        where: { userId: 'test-user-id', provider: 'ANTHROPIC' },
      });

      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });
      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/projects/:projectId/setup/jobs', () => {
    it('returns null when no setup job exists', async () => {
      const response = await ctx.api.get<{ job: null; configSyncedAt: string | null }>(
        `/api/projects/${ctx.projectId}/setup/jobs`,
      );

      expect(response.status).toBe(200);
      expect(response.data.job).toBeNull();
    });

    it('returns the latest job including the richer terminal-state fields', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' },
      );

      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${createResponse.data.id}/status`,
        { status: 'RUNNING', workflowRunId: 12345 },
      );

      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${createResponse.data.id}/status`,
        {
          status: 'COMPLETED',
          commitSha: 'abc123def456abc123def456abc123def456abcd',
          artifactSummary: {
            created: [{ path: '.ai-board/config.yml', kind: 'config' }],
            preserved: [],
            missing: [],
          },
        },
      );

      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/setup/jobs`);
      expect(response.status).toBe(200);
      expect(response.data.job).toMatchObject({
        id: createResponse.data.id,
        status: 'COMPLETED',
        workflowRunId: 12345,
        partial: false,
        commitSha: 'abc123def456abc123def456abc123def456abcd',
        errorCode: null,
        logs: null,
      });
      expect(response.data.job.artifactSummary.created).toEqual([
        { path: '.ai-board/config.yml', kind: 'config' },
      ]);
    });
  });

  describe('PATCH /api/projects/:projectId/setup/jobs/:jobId/status', () => {
    let jobId: number;

    beforeEach(async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' },
      );
      jobId = createResponse.data.id;
    });

    it('updates PENDING to RUNNING', async () => {
      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING', workflowRunId: 12345 },
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('RUNNING');
    });

    it('updates RUNNING to COMPLETED with commit sha and artifacts', async () => {
      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
      );

      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        {
          status: 'COMPLETED',
          commitSha: 'abc123def456abc123def456abc123def456abcd',
          artifactSummary: {
            created: [{ path: '.ai-board/config.yml', kind: 'config' }],
            preserved: [{ path: 'CLAUDE.md', kind: 'guidance', reason: 'existing file preserved' }],
            missing: [],
          },
        },
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('COMPLETED');
    });

    it('records a partial completion when deterministic outputs succeeded', async () => {
      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
      );

      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        {
          status: 'COMPLETED',
          partial: true,
          commitSha: 'abc123def456abc123def456abc123def456abcd',
          errorCode: 'GUIDANCE_GENERATION_FAILED',
          logs: 'Guidance generation failed after deterministic outputs succeeded',
          artifactSummary: {
            created: [{ path: '.ai-board/config.yml', kind: 'config' }],
            preserved: [],
            missing: [{ path: 'CLAUDE.md', kind: 'guidance', reason: 'guidance generation failed' }],
            partialReason: 'Guidance generation failed after deterministic outputs succeeded',
          },
        },
      );

      expect(response.status).toBe(200);

      const getResponse = await ctx.api.get(`/api/projects/${ctx.projectId}/setup/jobs`);
      expect(getResponse.data.job).toMatchObject({
        status: 'COMPLETED',
        partial: true,
        errorCode: 'GUIDANCE_GENERATION_FAILED',
        commitSha: 'abc123def456abc123def456abc123def456abcd',
      });
      expect(getResponse.data.job.artifactSummary.missing).toEqual([
        { path: 'CLAUDE.md', kind: 'guidance', reason: 'guidance generation failed' },
      ]);
    });

    it('records a terminal failure with error code and logs', async () => {
      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
      );

      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        {
          status: 'FAILED',
          errorCode: 'CONFIGURATION_GENERATION_FAILED',
          errorMessage: 'Unable to infer a valid install command',
          logs: 'Stack detection did not identify a supported package manager',
          artifactSummary: {
            created: [],
            preserved: [],
            missing: [{ path: '.ai-board/config.yml', kind: 'config', reason: 'generation failed' }],
          },
        },
      );

      expect(response.status).toBe(200);

      const getResponse = await ctx.api.get(`/api/projects/${ctx.projectId}/setup/jobs`);
      expect(getResponse.data.job).toMatchObject({
        status: 'FAILED',
        partial: false,
        errorCode: 'CONFIGURATION_GENERATION_FAILED',
        logs: 'Stack detection did not identify a supported package manager',
      });
    });

    it('rejects invalid transitions', async () => {
      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'COMPLETED' },
      );

      expect(response.status).toBe(400);
    });

    it('rejects a FAILED callback without an error code', async () => {
      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
      );

      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'FAILED', errorMessage: 'Workflow crashed' },
      );

      expect(response.status).toBe(400);
    });

    it('rejects a RUNNING callback with terminal-only fields', async () => {
      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING', partial: true },
      );

      expect(response.status).toBe(400);
    });

    it('rejects unauthenticated callbacks', async () => {
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
        },
      );

      expect(response.status).toBe(401);
    });

    it('is idempotent for repeated same-status callbacks', async () => {
      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
      );

      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
      );

      expect(response.status).toBe(200);
    });

    it('allows retry by creating a new job after failure', async () => {
      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
      );
      await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        {
          status: 'FAILED',
          errorCode: 'COMMIT_FAILED',
          errorMessage: 'First attempt failed',
        },
      );

      const retryResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' },
      );

      expect(retryResponse.status).toBe(201);
      expect(retryResponse.data.id).not.toBe(jobId);
    });
  });
});
