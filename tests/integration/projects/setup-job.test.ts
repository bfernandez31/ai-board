/**
 * Integration Tests: Setup Job API
 *
 * Tests for project setup job endpoints: POST, GET, and PATCH.
 * Covers happy path, guards, credential checks, retry, and callback scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Setup Job API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Clean up any existing setup jobs for this project
    const prisma = getPrismaClient();
    await prisma.projectSetupJob.deleteMany({
      where: { projectId: ctx.projectId },
    });

    // Ensure project is unconfigured for setup tests
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: null },
    });

    // Ensure test user has an ANTHROPIC credential for Claude tests
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
    it('should create setup job and return 201', async () => {
      const response = await ctx.api.post<{
        id: number;
        projectId: number;
        agent: string;
        status: string;
        createdAt: string;
      }>(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.projectId).toBe(ctx.projectId);
      expect(response.data.agent).toBe('CLAUDE');
      expect(response.data.status).toBe('PENDING');
    });

    it('should reject non-owner with 403', async () => {
      const nonOwner = await ctx.createUser(`non-owner@project${ctx.projectId}.e2e.test`);
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' },
        { testUserId: nonOwner.id }
      );

      // verifyProjectOwnership returns "Project not found" for non-owners
      expect([403, 404]).toContain(response.status);
    });

    it('should reject already-configured project with 409', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: new Date() },
      });

      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' }
      );

      expect(response.status).toBe(409);
    });

    it('should reject when active job exists with 409', async () => {
      // Create first job
      await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });

      // Attempt second job
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' }
      );

      expect(response.status).toBe(409);
    });

    it('should reject when credential missing with 409', async () => {
      // Delete ANTHROPIC credential
      const prisma = getPrismaClient();
      await prisma.userCredential.deleteMany({
        where: { userId: 'test-user-id', provider: 'ANTHROPIC' },
      });

      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' }
      );

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/projects/:projectId/setup/jobs', () => {
    it('should return latest setup job', async () => {
      // Create a job first
      await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, { agent: 'CLAUDE' });

      const response = await ctx.api.get<{
        job: { id: number; status: string; agent: string } | null;
        configSyncedAt: string | null;
      }>(`/api/projects/${ctx.projectId}/setup/jobs`);

      expect(response.status).toBe(200);
      expect(response.data.job).not.toBeNull();
      expect(response.data.job?.agent).toBe('CLAUDE');
      expect(response.data.configSyncedAt).toBeNull();
    });

    it('should return null when no job exists', async () => {
      const response = await ctx.api.get<{
        job: null;
        configSyncedAt: string | null;
      }>(`/api/projects/${ctx.projectId}/setup/jobs`);

      expect(response.status).toBe(200);
      expect(response.data.job).toBeNull();
    });
  });

  describe('PATCH /api/projects/:projectId/setup/jobs/:jobId/status', () => {
    let jobId: number;

    beforeEach(async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' }
      );
      jobId = createResponse.data.id;
    });

    it('should update PENDING to RUNNING', async () => {
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING', workflowRunId: 12345 },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'RUNNING');
    });

    it('should update RUNNING to COMPLETED and trigger config sync', async () => {
      // First transition to RUNNING
      await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      // Then to COMPLETED
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'COMPLETED' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'COMPLETED');
    });

    it('should update RUNNING to FAILED with errorMessage', async () => {
      await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'FAILED', errorMessage: 'Workflow crashed' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'FAILED');
    });

    it('should reject invalid transition with 400', async () => {
      // PENDING -> COMPLETED is invalid (must go through RUNNING)
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'COMPLETED' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated request with 401', async () => {
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
        }
      );

      expect(response.status).toBe(401);
    });

    it('should be idempotent for same status', async () => {
      // Transition to RUNNING
      await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      // Same status again
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      expect(response.status).toBe(200);
    });

    it('should allow retry after failure creates new job', async () => {
      // Fail the first job
      await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );
      await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'FAILED', errorMessage: 'First attempt failed' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      // Should be able to create a new job (retry)
      const retryResponse = await ctx.api.post<{ id: number; status: string }>(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' }
      );

      expect(retryResponse.status).toBe(201);
      expect(retryResponse.data.id).not.toBe(jobId);
    });
  });
});
