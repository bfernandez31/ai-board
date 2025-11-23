import { test, expect } from '../../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient } from '../../helpers/db-cleanup';
import { setupTestData, createTestTicket } from '../../helpers/db-setup';

/**
 * E2E Test: CleanupInProgressBanner Component
 * Feature: 090-1492-clean-workflow
 *
 * Tests that the cleanup in progress banner displays correctly when
 * a cleanup workflow is active for the project.
 */

test.describe('CleanupInProgressBanner', () => {
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
   * Helper: Create a cleanup ticket using worker-isolated project
   * Uses createTestTicket which auto-generates unique ticketNumber via PostgreSQL sequence
   */
  async function createCleanupTicket(projectId: number) {
    const ticket = await createTestTicket(projectId, {
      title: '[e2e] Clean 2025-01-01',
      description: '[e2e] Cleanup ticket',
      stage: 'BUILD',
    });

    // Update workflowType to CLEAN (createTestTicket doesn't support this field)
    return prisma.ticket.update({
      where: { id: ticket.id },
      data: { workflowType: 'CLEAN' },
    });
  }

  /**
   * Test: Banner displays when cleanup is in progress
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: User views the board page
   * Then: Banner with cleanup message is visible
   */
  test('should display banner when cleanup job is RUNNING', async ({ page, projectId }) => {
    // Arrange
    await setupTestData(projectId);

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

    // Act - Navigate to board page
    await page.goto(`/projects/${projectId}/board`);

    // Assert - Banner should be visible
    const banner = page.locator('[role="alert"]').filter({ hasText: /cleanup in progress/i });
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Assert - Banner contains expected text
    await expect(banner).toContainText('Stage transitions are temporarily disabled');
    await expect(banner).toContainText('descriptions');
    await expect(banner).toContainText('documents');
  });

  /**
   * Test: Banner displays when cleanup is PENDING
   * Given: Project has activeCleanupJobId with PENDING job
   * When: User views the board page
   * Then: Banner with cleanup message is visible
   */
  test('should display banner when cleanup job is PENDING', async ({ page, projectId }) => {
    // Arrange
    await setupTestData(projectId);

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

    // Act - Navigate to board page
    await page.goto(`/projects/${projectId}/board`);

    // Assert - Banner should be visible
    const banner = page.locator('[role="alert"]').filter({ hasText: /cleanup in progress/i });
    await expect(banner).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test: Banner not displayed when no cleanup is active
   * Given: Project has no activeCleanupJobId
   * When: User views the board page
   * Then: No cleanup banner is visible
   */
  test('should not display banner when no cleanup is active', async ({ page, projectId }) => {
    // Arrange
    await setupTestData(projectId);

    // Ensure no activeCleanupJobId
    await prisma.project.update({
      where: { id: projectId },
      data: { activeCleanupJobId: null },
    });

    // Act - Navigate to board page
    await page.goto(`/projects/${projectId}/board`);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Assert - No cleanup banner should be visible
    const banner = page.locator('[role="alert"]').filter({ hasText: /cleanup in progress/i });
    await expect(banner).not.toBeVisible();
  });

  /**
   * Test: Banner disappears when cleanup completes
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: Cleanup job status changes to COMPLETED
   * Then: Banner should disappear (due to polling)
   */
  test('should hide banner when cleanup job completes', async ({ page, projectId }) => {
    // Arrange
    await setupTestData(projectId);

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

    // Act - Navigate to board page
    await page.goto(`/projects/${projectId}/board`);

    // Assert - Banner should be visible initially
    const banner = page.locator('[role="alert"]').filter({ hasText: /cleanup in progress/i });
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Act - Complete the cleanup job
    await prisma.job.update({
      where: { id: cleanupJob.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Assert - Banner should disappear after polling (2s interval + buffer)
    await expect(banner).not.toBeVisible({ timeout: 10000 });
  });

  /**
   * Test: Banner indicates what operations are allowed
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: User views the board page
   * Then: Banner explains what operations are still allowed
   */
  test('should explain allowed operations during cleanup', async ({ page, projectId }) => {
    // Arrange
    await setupTestData(projectId);

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

    // Act - Navigate to board page
    await page.goto(`/projects/${projectId}/board`);

    // Assert - Banner should contain info about allowed operations
    const banner = page.locator('[role="alert"]').filter({ hasText: /cleanup in progress/i });
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Check for mentions of allowed operations
    await expect(banner).toContainText(/ticket descriptions|descriptions/i);
    await expect(banner).toContainText(/documents/i);
    await expect(banner).toContainText(/preview deployments|previews/i);
    await expect(banner).toContainText(/unlock when cleanup completes|automatically/i);
  });

  /**
   * AIB-72: Test visual lock overlay on drag during cleanup
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: User drags a ticket from INBOX
   * Then: Columns show "Cleanup in progress" visual lock overlay
   */
  test('should show visual lock overlay when dragging during cleanup', async ({ page, projectId }) => {
    // Arrange
    await setupTestData(projectId);

    // Create an INBOX ticket to drag
    const inboxTicket = await createTestTicket(projectId, {
      title: '[e2e] Test drag during cleanup',
      description: '[e2e] Ticket to test visual lock',
      stage: 'INBOX',
    });

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

    // Act - Navigate to board page
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('domcontentloaded');

    // Start dragging the ticket (but don't release)
    const ticketCard = page.locator(`[data-ticket-id="${inboxTicket.id}"]`);
    const ticketBox = await ticketCard.boundingBox();

    if (ticketBox) {
      // Start drag - mouse down and move slightly to trigger drag
      await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
      await page.mouse.down();
      // Move slightly to trigger drag
      await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 15, ticketBox.y + ticketBox.height / 2, { steps: 3 });

      // Assert - Visual lock overlay should appear with cleanup message
      // Multiple columns show the overlay, so use .first() to check one is visible
      const lockOverlay = page.locator('text="Cleanup in progress"').first();
      await expect(lockOverlay).toBeVisible({ timeout: 5000 });

      // Release mouse
      await page.mouse.up();
    }
  });

  /**
   * AIB-72: Test that drop zones are disabled during cleanup
   * Given: Project has activeCleanupJobId with RUNNING job
   * When: User views board during drag
   * Then: Drop zone columns should have disabled visual style (opacity-50)
   */
  test('should disable drop zones during cleanup drag', async ({ page, projectId }) => {
    // Arrange
    await setupTestData(projectId);

    // Create an INBOX ticket to drag
    const inboxTicket = await createTestTicket(projectId, {
      title: '[e2e] Test drop zone disable',
      description: '[e2e] Ticket to test drop zone visual',
      stage: 'INBOX',
    });

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

    // Act - Navigate to board page
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('domcontentloaded');

    // Start dragging the ticket
    const ticketCard = page.locator(`[data-ticket-id="${inboxTicket.id}"]`);
    const ticketBox = await ticketCard.boundingBox();

    if (ticketBox) {
      // Start drag
      await page.mouse.move(ticketBox.x + ticketBox.width / 2, ticketBox.y + ticketBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(ticketBox.x + ticketBox.width / 2 + 15, ticketBox.y + ticketBox.height / 2, { steps: 3 });

      // Assert - SPECIFY column should have the cursor-not-allowed class during drag
      const specifyColumn = page.locator('[data-stage="SPECIFY"]');
      await expect(specifyColumn).toHaveClass(/cursor-not-allowed/);

      // Release mouse
      await page.mouse.up();
    }
  });
});
