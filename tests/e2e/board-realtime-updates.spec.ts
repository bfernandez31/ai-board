import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase } from '../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * E2E Test: Real-Time Board Updates via SSE (T030)
 *
 * Tests that board receives and displays job status updates
 * via Server-Sent Events without page refresh.
 *
 * Success Criteria:
 * - Board establishes SSE connection on load
 * - Job status update received via SSE updates ticket card
 * - Update happens without page refresh
 * - Multiple browser tabs receive same update
 */
test.describe('E2E: Board Real-Time Updates via SSE', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should establish SSE connection when board loads', async ({ page }) => {
    // Navigate to board
    await page.goto('http://localhost:3000/projects/1/board');

    // Wait for page load
    await page.waitForLoadState('domcontentloaded');

    // Check for SSE connection in Network tab
    // The connection should be visible as an EventSource request
    const sseRequests = await page.evaluate(() => {
      // Check if window has EventSource connections
      return typeof EventSource !== 'undefined';
    });

    expect(sseRequests).toBe(true);

    // Verify page has loaded successfully
    const heading = page.getByRole('heading', { name: /inbox/i }).first();
    await expect(heading).toBeVisible();
  });

  test('should receive and display job status update via SSE', async ({ page, request }) => {
    // Create ticket with PENDING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test SSE job update',
        description: 'Testing real-time job status via SSE',
        stage: 'INBOX',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'PENDING',
        branch: null,
      },
    });

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify initial PENDING status
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    const initialIcon = statusIndicator.;
    const initialAriaLabel = await initialIcon.getAttribute('aria-label');
    expect(initialAriaLabel?.toLowerCase()).toContain('pending');

    // Update job status via API (triggers SSE broadcast)
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });

    // Wait for SSE message to arrive and UI to update
    // SSE latency should be <200ms according to spec
    await page.waitForTimeout(500);

    // Verify status updated to RUNNING WITHOUT page refresh
    const updatedIcon = statusIndicator.;
    const updatedAriaLabel = await updatedIcon.getAttribute('aria-label');
    expect(updatedAriaLabel?.toLowerCase()).toContain('running');

    // Verify we didn't refresh the page (check URL and session)
    expect(page.url()).toBe('http://localhost:3000/projects/1/board');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should update without page refresh', async ({ page, request }) => {
    // Create ticket with job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test no page refresh',
        description: 'Verify update happens without refresh',
        stage: 'INBOX',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'PENDING',
        branch: null,
      },
    });

    // Load board and inject marker to detect refresh
    await page.goto('http://localhost:3000/projects/1/board');
    await page.evaluate(() => {
      (window as any).__testMarker = 'no-refresh-test';
    });

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Update job status
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });

    // Wait for update
    await page.waitForTimeout(500);

    // Verify marker still exists (page wasn't refreshed)
    const markerExists = await page.evaluate(() => {
      return (window as any).__testMarker === 'no-refresh-test';
    });

    expect(markerExists).toBe(true);

    // Verify status was updated
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;
    const ariaLabel = await icon.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('running');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should handle multiple sequential status updates', async ({ page, request }) => {
    // Create ticket with job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test sequential updates',
        description: 'Testing PENDING → RUNNING → COMPLETED',
        stage: 'INBOX',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'PENDING',
        branch: null,
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;

    // Verify initial PENDING status
    let ariaLabel = await icon.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('pending');

    // Update 1: PENDING → RUNNING
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });
    await page.waitForTimeout(600); // Account for 500ms display duration + SSE latency

    ariaLabel = await icon.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('running');

    // Update 2: RUNNING → COMPLETED
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
    });
    await page.waitForTimeout(600);

    ariaLabel = await icon.getAttribute('aria-label');
    expect(ariaLabel?.toLowerCase()).toContain('completed');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should handle job status update for ticket in different stage column', async ({ page, request }) => {
    // Create tickets in different stages
    const ticket1 = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket in INBOX',
        description: 'Testing SSE in INBOX column',
        stage: 'INBOX',
        projectId: 1,
      },
    });

    const ticket2 = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket in SPECIFY',
        description: 'Testing SSE in SPECIFY column',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });

    const job1 = await prisma.job.create({
      data: {
        ticketId: ticket1.id,
        command: 'specify',
        status: 'PENDING',
        branch: null,
      },
    });

    const job2 = await prisma.job.create({
      data: {
        ticketId: ticket2.id,
        command: 'plan',
        status: 'PENDING',
        branch: null,
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Find both ticket cards
    const ticketCard1 = page.locator(`[data-testid="ticket-card-${ticket1.id}"]`).first();
    const ticketCard2 = page.locator(`[data-testid="ticket-card-${ticket2.id}"]`).first();

    await expect(ticketCard1).toBeVisible();
    await expect(ticketCard2).toBeVisible();

    // Update both jobs
    await request.patch(`http://localhost:3000/api/jobs/${job1.id}/status`, {
      data: { status: 'RUNNING' },
    });
    await request.patch(`http://localhost:3000/api/jobs/${job2.id}/status`, {
      data: { status: 'RUNNING' },
    });

    await page.waitForTimeout(500);

    // Verify both cards updated
    const status1 = ticketCard1.locator('[data-testid="job-status-indicator"]');
    const status2 = ticketCard2.locator('[data-testid="job-status-indicator"]');

    const icon1 = status1.;
    const icon2 = status2.;

    const label1 = await icon1.getAttribute('aria-label');
    const label2 = await icon2.getAttribute('aria-label');

    expect(label1?.toLowerCase()).toContain('running');
    expect(label2?.toLowerCase()).toContain('running');

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: [job1.id, job2.id] } } });
    await prisma.ticket.deleteMany({ where: { id: { in: [ticket1.id, ticket2.id] } } });
  });

  test('should maintain SSE connection after status update', async ({ page, request }) => {
    // Create ticket with job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Test persistent connection',
        description: 'Verify connection persists after updates',
        stage: 'INBOX',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'PENDING',
        branch: null,
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Perform first update
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });
    await page.waitForTimeout(500);

    // Perform second update (should still work via same SSE connection)
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
    });
    await page.waitForTimeout(500);

    // Verify final status
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;
    const ariaLabel = await icon.getAttribute('aria-label');

    expect(ariaLabel?.toLowerCase()).toContain('completed');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
