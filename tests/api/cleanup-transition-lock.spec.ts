import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient, getProjectKey } from '../helpers/db-cleanup';
import { setupTestData } from '../helpers/db-setup';

/**
 * Contract Test: Cleanup Transition Lock (HTTP 423 Locked)
 * Feature: 090-1492-clean-workflow
 *
 * Tests that stage transitions are blocked when a cleanup workflow is in progress.
 * The system returns HTTP 423 Locked with CLEANUP_IN_PROGRESS error code.
 */

test.describe('POST /api/projects/[projectId]/tickets/[id]/transition - Cleanup Lock', () => {
  const prisma = getPrismaClient();

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    // Clear any existing cleanup lock
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: null },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create a cleanup ticket with unique ticket number
   * Uses timestamp + random suffix to avoid conflicts in parallel tests
   */
  async function createCleanupTicket(projectId: number, stage: 'BUILD' | 'VERIFY' = 'BUILD') {
    const uniqueSuffix = Date.now() % 100000 + Math.floor(Math.random() * 1000);
    const projectKey = getProjectKey(projectId);

    return prisma.ticket.create({
      data: {
        title: '[e2e] Clean 2025-01-01',
        description: '[e2e] Cleanup ticket',
        stage,
        workflowType: 'CLEAN',
        projectId,
        ticketNumber: uniqueSuffix,
        ticketKey: `${projectKey}-${uniqueSuffix}`,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Test: Block transition when cleanup job is PENDING
   * Given: Project has activeCleanupJobId with PENDING job
   * When: Attempt to transition any ticket
   * Then: 423 Locked with CLEANUP_IN_PROGRESS code
   */
  test('should return 423 when cleanup job is PENDING', async ({ request, projectId }) => {
    // Arrange
    const { ticket } = await setupTestData(projectId);

    // Create a cleanup ticket and job
    const cleanupTicket = await createCleanupTicket(projectId);

    const cleanupJob = await prisma.job.create({
      data: {
        ticketId: cleanupTicket.id,
        projectId,
        command: 'clean',
        status: 'PENDING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Set activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: cleanupJob.id },
    });

    // Act - Attempt transition
    const response = await request.post(
      `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert
    expect(response.status()).toBe(423);
    const body = await response.json();
    expect(body.code).toBe('CLEANUP_IN_PROGRESS');
    expect(body.error).toContain('cleanup is in progress');
    expect(body.details.activeCleanupJobId).toBe(cleanupJob.id);
    expect(body.details.jobStatus).toBe('PENDING');
    expect(body.details.ticketKey).toBe(cleanupTicket.ticketKey);
  });

  /**
   * Test: Block transition when cleanup job is RUNNING
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: Attempt to transition any ticket
   * Then: 423 Locked with CLEANUP_IN_PROGRESS code
   */
  test('should return 423 when cleanup job is RUNNING', async ({ request, projectId }) => {
    // Arrange
    const { ticket } = await setupTestData(projectId);

    // Create a cleanup ticket and job
    const cleanupTicket = await createCleanupTicket(projectId);

    const cleanupJob = await prisma.job.create({
      data: {
        ticketId: cleanupTicket.id,
        projectId,
        command: 'clean',
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Set activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: cleanupJob.id },
    });

    // Act - Attempt transition
    const response = await request.post(
      `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert
    expect(response.status()).toBe(423);
    const body = await response.json();
    expect(body.code).toBe('CLEANUP_IN_PROGRESS');
    expect(body.error).toContain('cleanup is in progress');
    expect(body.details.jobStatus).toBe('RUNNING');
  });

  /**
   * Test: Allow transition when cleanup job is COMPLETED (self-healing)
   * Given: Project has activeCleanupJobId with COMPLETED job (stale lock)
   * When: Attempt to transition any ticket
   * Then: 200 success, lock is cleared
   */
  test('should allow transition and clear lock when cleanup job is COMPLETED', async ({ request, projectId }) => {
    // Arrange
    const { ticket } = await setupTestData(projectId);

    // Create a cleanup ticket and completed job
    const cleanupTicket = await createCleanupTicket(projectId, 'VERIFY');

    const cleanupJob = await prisma.job.create({
      data: {
        ticketId: cleanupTicket.id,
        projectId,
        command: 'clean',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Set stale activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: cleanupJob.id },
    });

    // Act - Attempt transition
    const response = await request.post(
      `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert - Transition succeeds
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('SPECIFY');

    // Assert - Lock was cleared (self-healing)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeCleanupJobId: true },
    });
    expect(project?.activeCleanupJobId).toBeNull();
  });

  /**
   * Test: Allow transition when cleanup job is FAILED (self-healing)
   * Given: Project has activeCleanupJobId with FAILED job (stale lock)
   * When: Attempt to transition any ticket
   * Then: 200 success, lock is cleared
   */
  test('should allow transition and clear lock when cleanup job is FAILED', async ({ request, projectId }) => {
    // Arrange
    const { ticket } = await setupTestData(projectId);

    // Create a cleanup ticket and failed job
    const cleanupTicket = await createCleanupTicket(projectId);

    const cleanupJob = await prisma.job.create({
      data: {
        ticketId: cleanupTicket.id,
        projectId,
        command: 'clean',
        status: 'FAILED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Set stale activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: cleanupJob.id },
    });

    // Act - Attempt transition
    const response = await request.post(
      `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert - Transition succeeds
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('SPECIFY');

    // Assert - Lock was cleared (self-healing)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeCleanupJobId: true },
    });
    expect(project?.activeCleanupJobId).toBeNull();
  });

  /**
   * Test: Allow transition when no cleanup job is active
   * Given: Project has no activeCleanupJobId
   * When: Attempt to transition any ticket
   * Then: 200 success
   */
  test('should allow transition when no cleanup is active', async ({ request, projectId }) => {
    // Arrange
    const { ticket } = await setupTestData(projectId);

    // Ensure no activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: null },
    });

    // Act - Attempt transition
    const response = await request.post(
      `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert - Transition succeeds
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.stage).toBe('SPECIFY');
  });

  /**
   * Test: Block quick-impl transition during cleanup
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: Attempt quick-impl transition (INBOX → BUILD)
   * Then: 423 Locked with CLEANUP_IN_PROGRESS code
   */
  test('should block quick-impl transition during cleanup', async ({ request, projectId }) => {
    // Arrange
    const { ticket } = await setupTestData(projectId);

    // Create a cleanup ticket and job
    const cleanupTicket = await createCleanupTicket(projectId);

    const cleanupJob = await prisma.job.create({
      data: {
        ticketId: cleanupTicket.id,
        projectId,
        command: 'clean',
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Set activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: cleanupJob.id },
    });

    // Act - Attempt quick-impl transition
    const response = await request.post(
      `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'BUILD' },
      }
    );

    // Assert
    expect(response.status()).toBe(423);
    const body = await response.json();
    expect(body.code).toBe('CLEANUP_IN_PROGRESS');
  });

  /**
   * Test: Error response includes helpful details
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: Attempt to transition any ticket
   * Then: Response includes message about what operations are still allowed
   */
  test('should include helpful message in 423 response', async ({ request, projectId }) => {
    // Arrange
    const { ticket } = await setupTestData(projectId);

    // Create a cleanup ticket and job
    const cleanupTicket = await createCleanupTicket(projectId);

    const cleanupJob = await prisma.job.create({
      data: {
        ticketId: cleanupTicket.id,
        projectId,
        command: 'clean',
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Set activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: cleanupJob.id },
    });

    // Act - Attempt transition
    const response = await request.post(
      `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
      {
        data: { targetStage: 'SPECIFY' },
      }
    );

    // Assert
    expect(response.status()).toBe(423);
    const body = await response.json();
    expect(body.details.message).toContain('descriptions');
    expect(body.details.message).toContain('documents');
    expect(body.details.message).toContain('preview deployments');
  });
});
