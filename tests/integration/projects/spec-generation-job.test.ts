/**
 * Integration Tests: Spec Generation Job API
 *
 * Tests for spec generation job endpoints: POST, GET, and PATCH.
 * Covers happy path, guards, credential checks, and state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Spec Generation Job API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    const prisma = getPrismaClient();

    // Clean up any existing spec gen jobs
    await prisma.specGenerationJob.deleteMany({
      where: { projectId: ctx.projectId },
    });

    // Ensure project is configured (configSyncedAt set) for spec gen tests
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: new Date(), specsGeneratedAt: null },
    });

    // Ensure test user has an ANTHROPIC credential
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

  describe('POST /api/projects/:projectId/spec-generation/jobs', () => {
    it('should create spec gen job and return 201', async () => {
      const response = await ctx.api.post<{
        id: number;
        projectId: number;
        agent: string;
        depth: string;
        status: string;
        createdAt: string;
      }>(`/api/projects/${ctx.projectId}/spec-generation/jobs`, {
        agent: 'CLAUDE',
        depth: 'STANDARD',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.projectId).toBe(ctx.projectId);
      expect(response.data.agent).toBe('CLAUDE');
      expect(response.data.depth).toBe('STANDARD');
      expect(response.data.status).toBe('PENDING');
    });

    it('should reject invalid body with 400', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/spec-generation/jobs`,
        { agent: 'INVALID' }
      );

      expect(response.status).toBe(400);
    });

    it('should reject non-owner with 403', async () => {
      const nonOwner = await ctx.createUser(`non-owner-spec@project${ctx.projectId}.e2e.test`);
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/spec-generation/jobs`,
        { agent: 'CLAUDE', depth: 'STANDARD' },
        { testUserId: nonOwner.id }
      );

      expect([403, 404]).toContain(response.status);
    });

    it('should reject not-configured project with 409', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: null },
      });

      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/spec-generation/jobs`,
        { agent: 'CLAUDE', depth: 'STANDARD' }
      );

      expect(response.status).toBe(409);
      expect(response.data).toHaveProperty('code', 'NOT_CONFIGURED');
    });

    it('should reject when active job exists with 409', async () => {
      // Create first job
      await ctx.api.post(`/api/projects/${ctx.projectId}/spec-generation/jobs`, {
        agent: 'CLAUDE',
        depth: 'STANDARD',
      });

      // Attempt second job
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/spec-generation/jobs`,
        { agent: 'CLAUDE', depth: 'QUICK' }
      );

      expect(response.status).toBe(409);
      expect(response.data).toHaveProperty('code', 'JOB_ACTIVE');
    });

    it('should reject when credential missing with 422', async () => {
      const prisma = getPrismaClient();
      await prisma.userCredential.deleteMany({
        where: { userId: 'test-user-id', provider: 'ANTHROPIC' },
      });

      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/spec-generation/jobs`,
        { agent: 'CLAUDE', depth: 'STANDARD' }
      );

      expect(response.status).toBe(422);
      expect(response.data).toHaveProperty('code', 'CREDENTIAL_MISSING');
    });
  });

  describe('GET /api/projects/:projectId/spec-generation/jobs', () => {
    it('should return latest job', async () => {
      // Create a job first
      await ctx.api.post(`/api/projects/${ctx.projectId}/spec-generation/jobs`, {
        agent: 'CLAUDE',
        depth: 'COMPREHENSIVE',
      });

      const response = await ctx.api.get<{
        job: { id: number; status: string; depth: string } | null;
        specsGeneratedAt: string | null;
      }>(`/api/projects/${ctx.projectId}/spec-generation/jobs`);

      expect(response.status).toBe(200);
      expect(response.data.job).not.toBeNull();
      expect(response.data.job?.depth).toBe('COMPREHENSIVE');
      expect(response.data.specsGeneratedAt).toBeNull();
    });

    it('should return null when no jobs exist', async () => {
      const response = await ctx.api.get<{
        job: null;
        specsGeneratedAt: string | null;
      }>(`/api/projects/${ctx.projectId}/spec-generation/jobs`);

      expect(response.status).toBe(200);
      expect(response.data.job).toBeNull();
    });

    it('should return specsGeneratedAt when set', async () => {
      const prisma = getPrismaClient();
      const now = new Date();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { specsGeneratedAt: now },
      });

      const response = await ctx.api.get<{
        job: null;
        specsGeneratedAt: string | null;
      }>(`/api/projects/${ctx.projectId}/spec-generation/jobs`);

      expect(response.status).toBe(200);
      expect(response.data.specsGeneratedAt).not.toBeNull();
    });
  });

  describe('PATCH /api/projects/:projectId/spec-generation/jobs/:jobId/status', () => {
    let jobId: number;

    beforeEach(async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/spec-generation/jobs`,
        { agent: 'CLAUDE', depth: 'STANDARD' }
      );
      jobId = createResponse.data.id;
    });

    it('should update PENDING to RUNNING', async () => {
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/spec-generation/jobs/${jobId}/status`,
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

    it('should update RUNNING to COMPLETED and set specsGeneratedAt', async () => {
      // First transition to RUNNING
      await ctx.api.patch(
        `/api/projects/${ctx.projectId}/spec-generation/jobs/${jobId}/status`,
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
        `/api/projects/${ctx.projectId}/spec-generation/jobs/${jobId}/status`,
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

      // Verify specsGeneratedAt was set on project
      const prisma = getPrismaClient();
      const project = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { specsGeneratedAt: true },
      });
      expect(project?.specsGeneratedAt).not.toBeNull();
    });

    it('should update RUNNING to FAILED with errorMessage', async () => {
      await ctx.api.patch(
        `/api/projects/${ctx.projectId}/spec-generation/jobs/${jobId}/status`,
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
        `/api/projects/${ctx.projectId}/spec-generation/jobs/${jobId}/status`,
        { status: 'FAILED', errorMessage: 'Generation crashed' },
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

    it('should reject invalid transition with 409', async () => {
      // PENDING -> COMPLETED is invalid
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/spec-generation/jobs/${jobId}/status`,
        { status: 'COMPLETED' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
          headers: {
            Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
          },
        }
      );

      expect(response.status).toBe(409);
    });

    it('should reject unauthenticated request with 401', async () => {
      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/spec-generation/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        {
          includeTestUserHeader: false,
          enableTestAuthOverride: false,
        }
      );

      expect(response.status).toBe(401);
    });
  });
});
