/**
 * Integration Tests: Retro-Spec Job API
 *
 * Tests for retro-spec job creation, filtering, and status transitions.
 * Covers RETRO_SPEC-specific validation, concurrent job prevention,
 * and behavior differences from ONBOARD jobs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Retro-Spec Job API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    const prisma = getPrismaClient();

    // Clean up any existing setup jobs
    await prisma.projectSetupJob.deleteMany({
      where: { projectId: ctx.projectId },
    });

    // Set project as configured (required for RETRO_SPEC) and reset hasSpecs
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: new Date(), hasSpecs: false },
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

  describe('POST /api/projects/:projectId/setup/jobs (RETRO_SPEC)', () => {
    it('should create retro-spec job with depth and return 201', async () => {
      const response = await ctx.api.post<{
        id: number;
        projectId: number;
        agent: string;
        command: string;
        status: string;
        depth: string;
        createdAt: string;
      }>(`/api/projects/${ctx.projectId}/setup/jobs`, {
        agent: 'CLAUDE',
        command: 'RETRO_SPEC',
        depth: 'STANDARD',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.projectId).toBe(ctx.projectId);
      expect(response.data.command).toBe('RETRO_SPEC');
      expect(response.data.depth).toBe('STANDARD');
      expect(response.data.status).toBe('PENDING');
    });

    it('should reject RETRO_SPEC without depth with 400', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE', command: 'RETRO_SPEC' }
      );

      expect(response.status).toBe(400);
    });

    it('should reject RETRO_SPEC when project not configured (configSyncedAt null) with 409', async () => {
      const prisma = getPrismaClient();
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: null },
      });

      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE', command: 'RETRO_SPEC', depth: 'STANDARD' }
      );

      expect(response.status).toBe(409);
      expect(response.data).toHaveProperty('code', 'NOT_CONFIGURED');
    });

    it('should reject concurrent RETRO_SPEC job with 409', async () => {
      // Create first retro-spec job
      await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, {
        agent: 'CLAUDE',
        command: 'RETRO_SPEC',
        depth: 'STANDARD',
      });

      // Attempt second retro-spec job
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE', command: 'RETRO_SPEC', depth: 'QUICK' }
      );

      expect(response.status).toBe(409);
      expect(response.data).toHaveProperty('code', 'JOB_ACTIVE');
    });

    it('should reject invalid docUrl with 400', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE', command: 'RETRO_SPEC', depth: 'STANDARD', docUrl: 'not-a-url' }
      );

      expect(response.status).toBe(400);
    });

    it('should accept RETRO_SPEC with docUrl and context', async () => {
      const response = await ctx.api.post<{
        id: number;
        command: string;
        depth: string;
        docUrl: string;
      }>(`/api/projects/${ctx.projectId}/setup/jobs`, {
        agent: 'CLAUDE',
        command: 'RETRO_SPEC',
        depth: 'COMPREHENSIVE',
        docUrl: 'https://docs.example.com/api',
        context: 'This project uses a custom auth system',
      });

      expect(response.status).toBe(201);
      expect(response.data.command).toBe('RETRO_SPEC');
      expect(response.data.depth).toBe('COMPREHENSIVE');
      expect(response.data.docUrl).toBe('https://docs.example.com/api');
    });

    it('should allow RETRO_SPEC and ONBOARD to coexist independently', async () => {
      // RETRO_SPEC job should be creatable even if project is configured
      const retroResponse = await ctx.api.post<{ id: number; command: string }>(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE', command: 'RETRO_SPEC', depth: 'STANDARD' }
      );
      expect(retroResponse.status).toBe(201);
      expect(retroResponse.data.command).toBe('RETRO_SPEC');

      // ONBOARD job should be rejected because configSyncedAt is set (ALREADY_CONFIGURED)
      const onboardResponse = await ctx.api.post(
        `/api/projects/${ctx.projectId}/setup/jobs`,
        { agent: 'CLAUDE' }
      );
      expect(onboardResponse.status).toBe(409);
      expect(onboardResponse.data).toHaveProperty('code', 'ALREADY_CONFIGURED');
    });
  });

  describe('GET /api/projects/:projectId/setup/jobs (command filter)', () => {
    it('should return retro-spec job when filtering by command=RETRO_SPEC', async () => {
      // Create a retro-spec job
      await ctx.api.post(`/api/projects/${ctx.projectId}/setup/jobs`, {
        agent: 'CLAUDE',
        command: 'RETRO_SPEC',
        depth: 'STANDARD',
      });

      const response = await ctx.api.get<{
        job: { id: number; command: string; depth: string } | null;
        configSyncedAt: string | null;
      }>(`/api/projects/${ctx.projectId}/setup/jobs?command=RETRO_SPEC`);

      expect(response.status).toBe(200);
      expect(response.data.job).not.toBeNull();
      expect(response.data.job?.command).toBe('RETRO_SPEC');
      expect(response.data.job?.depth).toBe('STANDARD');
    });

    it('should return null when no retro-spec job exists', async () => {
      const response = await ctx.api.get<{
        job: null;
        configSyncedAt: string | null;
      }>(`/api/projects/${ctx.projectId}/setup/jobs?command=RETRO_SPEC`);

      expect(response.status).toBe(200);
      expect(response.data.job).toBeNull();
    });
  });

  describe('PATCH status → hasSpecs side effect', () => {
    // These tests create jobs directly in DB via raw SQL to avoid:
    // 1. The workflow dispatch that fails in test env (POST returns 500)
    // 2. The SetupJobDepth enum type drift between Prisma schema and actual DB
    const workflowHeaders = {
      includeTestUserHeader: false as const,
      enableTestAuthOverride: false as const,
      headers: {
        Authorization: `Bearer ${process.env.WORKFLOW_API_TOKEN || 'test-workflow-token'}`,
      },
    };

    async function createRetroSpecJobInDb(projectId: number): Promise<number> {
      const prisma = getPrismaClient();
      const result = await prisma.$queryRaw<{ id: number }[]>`
        INSERT INTO "ProjectSetupJob" ("projectId", "agent", "command", "status", "depth", "createdAt", "updatedAt")
        VALUES (${projectId}, 'CLAUDE', 'RETRO_SPEC', 'PENDING', 'QUICK', NOW(), NOW())
        RETURNING id
      `;
      return result[0].id;
    }

    it('should set project.hasSpecs to true when RETRO_SPEC job completes', async () => {
      const prisma = getPrismaClient();

      // Verify hasSpecs starts as false
      const projectBefore = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { hasSpecs: true },
      });
      expect(projectBefore?.hasSpecs).toBe(false);

      // Create RETRO_SPEC job directly in DB
      const jobId = await createRetroSpecJobInDb(ctx.projectId);

      // Transition PENDING → RUNNING
      const runResponse = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        workflowHeaders
      );
      expect(runResponse.status).toBe(200);

      // Transition RUNNING → COMPLETED
      const completeResponse = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'COMPLETED' },
        workflowHeaders
      );
      expect(completeResponse.status).toBe(200);

      // Verify hasSpecs is now true
      const projectAfter = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { hasSpecs: true },
      });
      expect(projectAfter?.hasSpecs).toBe(true);
    });

    it('should NOT set project.hasSpecs when RETRO_SPEC job fails', async () => {
      const prisma = getPrismaClient();

      // Create RETRO_SPEC job directly in DB
      const jobId = await createRetroSpecJobInDb(ctx.projectId);

      // PENDING → RUNNING → FAILED
      const runResponse = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'RUNNING' },
        workflowHeaders
      );
      expect(runResponse.status).toBe(200);

      const failResponse = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/setup/jobs/${jobId}/status`,
        { status: 'FAILED', errorMessage: 'Workflow crashed' },
        workflowHeaders
      );
      expect(failResponse.status).toBe(200);

      // hasSpecs should still be false
      const project = await prisma.project.findUnique({
        where: { id: ctx.projectId },
        select: { hasSpecs: true },
      });
      expect(project?.hasSpecs).toBe(false);
    });
  });
});
