import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

// The integration test server starts with WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only
// (see scripts/run-integration-tests.sh line 47), so we must use this exact token.
const WORKFLOW_TOKEN = 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Project Setup API', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Clean up any setup jobs and reset configSyncedAt for this project
    await prisma.projectSetupJob.deleteMany({ where: { projectId: ctx.projectId } });
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { configSyncedAt: null },
    });

    // Ensure test user has a credential for ANTHROPIC
    const testUserId = (await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { userId: true },
    }))!.userId;

    await prisma.userCredential.upsert({
      where: { userId_provider: { userId: testUserId, provider: 'ANTHROPIC' } },
      update: {},
      create: {
        userId: testUserId,
        provider: 'ANTHROPIC',
        credentialType: 'API_KEY',
        label: 'Test Key',
        encryptedValue: 'encrypted-test-value',
        iv: 'dGVzdC1pdi12YWx1ZQ==',
        authTag: 'dGVzdC1hdXRoLXRhZw==',
        preview: 'sk-t',
        readinessStatus: 'READY',
      },
    });
  });

  describe('GET /api/projects/[projectId]/setup', () => {
    it('returns NEEDS_SETUP for a new project with no setup jobs', async () => {
      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        setupState: 'NEEDS_SETUP',
        latestJob: null,
        configSyncedAt: null,
      });
    });

    it('returns IN_PROGRESS when a job is PENDING', async () => {
      await prisma.projectSetupJob.create({
        data: { projectId: ctx.projectId, agent: 'CLAUDE', status: 'PENDING' },
      });

      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        setupState: 'IN_PROGRESS',
      });
      expect((response.data as { latestJob: { status: string } }).latestJob.status).toBe('PENDING');
    });

    it('returns IN_PROGRESS when a job is RUNNING', async () => {
      await prisma.projectSetupJob.create({
        data: { projectId: ctx.projectId, agent: 'CLAUDE', status: 'RUNNING' },
      });

      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        setupState: 'IN_PROGRESS',
      });
    });

    it('returns CONFIGURED when configSyncedAt is set', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: new Date() },
      });

      const response = await ctx.api.get(`/api/projects/${ctx.projectId}/setup`);
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        setupState: 'CONFIGURED',
      });
    });
  });

  describe('POST /api/projects/[projectId]/setup', () => {
    it('creates a setup job and returns 201', async () => {
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CLAUDE',
      });
      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        status: 'PENDING',
        agent: 'CLAUDE',
      });
      expect((response.data as { jobId: number }).jobId).toBeDefined();
    });

    it('rejects with 409 when already configured', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { configSyncedAt: new Date() },
      });

      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CLAUDE',
      });
      expect(response.status).toBe(409);
      expect(response.data).toMatchObject({
        code: 'ALREADY_CONFIGURED',
      });
    });

    it('rejects with 409 when a job is already in progress', async () => {
      await prisma.projectSetupJob.create({
        data: { projectId: ctx.projectId, agent: 'CLAUDE', status: 'RUNNING' },
      });

      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CLAUDE',
      });
      expect(response.status).toBe(409);
      expect(response.data).toMatchObject({
        code: 'JOB_IN_PROGRESS',
      });
    });
  });

  describe('PATCH /api/projects/[projectId]/setup/status', () => {
    let setupJobId: number;
    let workflowApi: APIClient;

    beforeEach(async () => {
      workflowApi = createWorkflowClient();
      const job = await prisma.projectSetupJob.create({
        data: { projectId: ctx.projectId, agent: 'CLAUDE', status: 'PENDING' },
      });
      setupJobId = job.id;
    });

    it('updates status from PENDING to RUNNING', async () => {
      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/status`,
        { jobId: setupJobId, status: 'RUNNING' }
      );

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: setupJobId,
        status: 'RUNNING',
        configSynced: false,
      });
    });

    it('updates status to COMPLETED and triggers config sync', async () => {
      // First transition to RUNNING
      await prisma.projectSetupJob.update({
        where: { id: setupJobId },
        data: { status: 'RUNNING' },
      });

      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/status`,
        { jobId: setupJobId, status: 'COMPLETED', artifactSummary: [] }
      );

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: setupJobId,
        status: 'COMPLETED',
      });
      expect((response.data as { completedAt: string }).completedAt).not.toBeNull();
    });

    it('persists logs on FAILED status', async () => {
      await prisma.projectSetupJob.update({
        where: { id: setupJobId },
        data: { status: 'RUNNING' },
      });

      const errorLogs = 'Error: Config file not found in repository';
      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/status`,
        { jobId: setupJobId, status: 'FAILED', logs: errorLogs }
      );

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: setupJobId,
        status: 'FAILED',
      });

      // Verify logs persisted
      const job = await prisma.projectSetupJob.findUnique({ where: { id: setupJobId } });
      expect(job?.logs).toBe(errorLogs);
    });

    it('rejects unauthorized callback with 401', async () => {
      const invalidClient = createAPIClient({
        defaultHeaders: { 'Authorization': 'Bearer invalid-token' },
      });

      const response = await invalidClient.patch(
        `/api/projects/${ctx.projectId}/setup/status`,
        { jobId: setupJobId, status: 'RUNNING' }
      );

      expect(response.status).toBe(401);
    });

    it('rejects invalid status transition with 400', async () => {
      // PENDING → COMPLETED is invalid (must go through RUNNING)
      const response = await workflowApi.patch(
        `/api/projects/${ctx.projectId}/setup/status`,
        { jobId: setupJobId, status: 'COMPLETED' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('POST after previous job FAILED', () => {
    it('allows dispatch after a failed job', async () => {
      // Create and fail a job
      await prisma.projectSetupJob.create({
        data: {
          projectId: ctx.projectId,
          agent: 'CLAUDE',
          status: 'FAILED',
          logs: 'Previous failure',
          completedAt: new Date(),
        },
      });

      // Should be able to dispatch again
      const response = await ctx.api.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CLAUDE',
      });
      expect(response.status).toBe(201);
    });
  });

  describe('Auth edge cases', () => {
    it('POST rejects non-owner with 403', async () => {
      // Create a member user who is not the owner
      const memberEmail = `member-setup@project${ctx.projectId}.e2e.test`;
      const member = await prisma.user.upsert({
        where: { email: memberEmail },
        update: {},
        create: {
          id: `member-setup-${ctx.projectId}`,
          email: memberEmail,
          name: 'Setup Member',
          updatedAt: new Date(),
        },
      });

      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: ctx.projectId, userId: member.id } },
        update: {},
        create: { projectId: ctx.projectId, userId: member.id, role: 'member' },
      });

      const memberClient = createAPIClient({ testUserId: member.id });
      const response = await memberClient.post(`/api/projects/${ctx.projectId}/setup`, {
        agent: 'CLAUDE',
      });

      expect(response.status).toBe(403);
    });

    it('PATCH rejects unauthorized callback with 401', async () => {
      const job = await prisma.projectSetupJob.create({
        data: { projectId: ctx.projectId, agent: 'CLAUDE', status: 'PENDING' },
      });

      // No auth header at all
      const noAuthClient = createAPIClient({
        includeTestUserHeader: false,
        enableTestAuthOverride: false,
      });
      const response = await noAuthClient.patch(
        `/api/projects/${ctx.projectId}/setup/status`,
        { jobId: job.id, status: 'RUNNING' }
      );

      expect(response.status).toBe(401);
    });

    it('GET returns 403 for non-member', async () => {
      // Create a user who exists but is NOT a member of this project
      const strangerEmail = `stranger-setup@project${ctx.projectId}.e2e.test`;
      const stranger = await prisma.user.upsert({
        where: { email: strangerEmail },
        update: {},
        create: {
          id: `stranger-setup-${ctx.projectId}`,
          email: strangerEmail,
          name: 'Stranger',
          updatedAt: new Date(),
        },
      });

      const strangerClient = createAPIClient({ testUserId: stranger.id });
      const response = await strangerClient.get(`/api/projects/${ctx.projectId}/setup`);

      expect(response.status).toBe(403);
    });
  });
});
