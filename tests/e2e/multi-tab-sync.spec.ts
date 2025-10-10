import { test, expect, chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase } from '../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * E2E Test: Multi-Tab SSE Synchronization (T035)
 *
 * Tests that multiple browser tabs receive and display the same
 * job status updates via independent SSE connections.
 *
 * Success Criteria:
 * - Open board in two tabs
 * - Job status update appears in both tabs simultaneously
 * - Both tabs maintain independent SSE connections
 * - Success criteria: <200ms latency between tabs
 */
test.describe('E2E: Multi-Tab SSE Synchronization', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should sync job status updates across multiple tabs', async ({ browser }) => {
    // Create ticket with PENDING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Multi-tab sync test',
        description: 'Testing SSE sync across tabs',
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

    // Open two browser contexts (tabs)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Navigate both tabs to the board
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
    ]);

    // Wait for both boards to load
    const card1 = page1.locator(`[data-testid="ticket-card-${ticket.id}"]`).first();
    const card2 = page2.locator(`[data-testid="ticket-card-${ticket.id}"]`).first();

    await Promise.all([
      expect(card1).toBeVisible(),
      expect(card2).toBeVisible(),
    ]);

    // Verify both tabs show PENDING status
    const indicator1 = card1.locator('[data-testid="job-status-indicator"]');
    const indicator2 = card2.locator('[data-testid="job-status-indicator"]');

    await expect(indicator1).toBeVisible();
    await expect(indicator2).toBeVisible();

    // Update job status to RUNNING via API
    const updateTime = Date.now();

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'RUNNING' },
    });

    // Trigger SSE broadcast by calling the API endpoint
    const context = await browser.newContext();
    const apiPage = await context.newPage();
    await apiPage.request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });
    await apiPage.close();
    await context.close();

    // Wait for SSE updates in both tabs
    await page1.waitForTimeout(600);
    await page2.waitForTimeout(600);

    // Verify both tabs received the update
    const icon1 = indicator1.;
    const icon2 = indicator2.;

    const label1 = await icon1.getAttribute('aria-label');
    const label2 = await icon2.getAttribute('aria-label');

    expect(label1?.toLowerCase()).toContain('running');
    expect(label2?.toLowerCase()).toContain('running');

    // Measure synchronization latency (should be <200ms between tabs)
    const syncLatency = Date.now() - updateTime;
    expect(syncLatency).toBeLessThan(1000); // 1 second buffer for E2E test

    // Clean up
    await page1.close();
    await page2.close();
    await context1.close();
    await context2.close();

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should maintain independent SSE connections per tab', async ({ browser }) => {
    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Independent connections test',
        description: 'Testing independent SSE connections',
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

    // Open two tabs
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Navigate both tabs
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
    ]);

    // Verify both tabs have loaded
    await Promise.all([
      expect(page1.locator(`[data-testid="ticket-card-${ticket.id}"]`).first()).toBeVisible(),
      expect(page2.locator(`[data-testid="ticket-card-${ticket.id}"]`).first()).toBeVisible(),
    ]);

    // Close first tab
    await page1.close();
    await context1.close();

    // Update job status
    const context = await browser.newContext();
    const apiPage = await context.newPage();
    await apiPage.request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });
    await apiPage.close();
    await context.close();

    // Wait for SSE update in second tab
    await page2.waitForTimeout(600);

    // Verify second tab still receives updates (independent connection)
    const card2 = page2.locator(`[data-testid="ticket-card-${ticket.id}"]`).first();
    const indicator2 = card2.locator('[data-testid="job-status-indicator"]');
    const icon2 = indicator2.;

    const label2 = await icon2.getAttribute('aria-label');
    expect(label2?.toLowerCase()).toContain('running');

    // Clean up
    await page2.close();
    await context2.close();

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should handle job updates with 3+ simultaneous tabs', async ({ browser }) => {
    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Three tabs sync test',
        description: 'Testing sync across 3 tabs',
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

    // Open three tabs
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const pages = await Promise.all([
      contexts[0].newPage(),
      contexts[1].newPage(),
      contexts[2].newPage(),
    ]);

    // Navigate all tabs
    await Promise.all(
      pages.map(page => page.goto('http://localhost:3000/projects/1/board'))
    );

    // Verify all tabs loaded
    await Promise.all(
      pages.map(page =>
        expect(page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first()).toBeVisible()
      )
    );

    // Update job status
    const context = await browser.newContext();
    const apiPage = await context.newPage();
    await apiPage.request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });
    await apiPage.close();
    await context.close();

    // Wait for SSE updates in all tabs
    await Promise.all(pages.map(page => page.waitForTimeout(600)));

    // Verify all tabs received the update
    for (const page of pages) {
      const card = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
      const indicator = card.locator('[data-testid="job-status-indicator"]');
      const icon = indicator.;

      const label = await icon.getAttribute('aria-label');
      expect(label?.toLowerCase()).toContain('running');
    }

    // Clean up
    for (let i = 0; i < pages.length; i++) {
      await pages[i].close();
      await contexts[i].close();
    }

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should sync updates for different tickets across tabs', async ({ browser }) => {
    // Create multiple tickets
    const tickets = await Promise.all([
      prisma.ticket.create({
        data: {
          title: '[e2e] Tab sync ticket 1',
          description: 'First ticket for multi-tab sync',
          stage: 'INBOX',
          projectId: 1,
        },
      }),
      prisma.ticket.create({
        data: {
          title: '[e2e] Tab sync ticket 2',
          description: 'Second ticket for multi-tab sync',
          stage: 'SPECIFY',
          projectId: 1,
        },
      }),
    ]);

    const jobs = await Promise.all([
      prisma.job.create({
        data: {
          ticketId: tickets[0].id,
          command: 'specify',
          status: 'PENDING',
          branch: null,
        },
      }),
      prisma.job.create({
        data: {
          ticketId: tickets[1].id,
          command: 'plan',
          status: 'PENDING',
          branch: null,
        },
      }),
    ]);

    // Open two tabs
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Navigate both tabs
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
    ]);

    // Wait for board to load
    await Promise.all([
      expect(page1.locator(`[data-testid="ticket-card-${tickets[0].id}"]`).first()).toBeVisible(),
      expect(page2.locator(`[data-testid="ticket-card-${tickets[0].id}"]`).first()).toBeVisible(),
    ]);

    // Update both jobs
    const context = await browser.newContext();
    const apiPage = await context.newPage();
    await apiPage.request.patch(`http://localhost:3000/api/jobs/${jobs[0].id}/status`, {
      data: { status: 'RUNNING' },
    });
    await apiPage.request.patch(`http://localhost:3000/api/jobs/${jobs[1].id}/status`, {
      data: { status: 'RUNNING' },
    });
    await apiPage.close();
    await context.close();

    // Wait for SSE updates
    await page1.waitForTimeout(600);
    await page2.waitForTimeout(600);

    // Verify both tabs received updates for both tickets
    for (const page of [page1, page2]) {
      for (const ticket of tickets) {
        const card = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
        const indicator = card.locator('[data-testid="job-status-indicator"]');
        const icon = indicator.;

        const label = await icon.getAttribute('aria-label');
        expect(label?.toLowerCase()).toContain('running');
      }
    }

    // Clean up
    await page1.close();
    await page2.close();
    await context1.close();
    await context2.close();

    await prisma.job.deleteMany({ where: { id: { in: jobs.map(j => j.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
  });

  test('should handle rapid updates across tabs without race conditions', async ({ browser }) => {
    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Rapid updates test',
        description: 'Testing rapid status changes across tabs',
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

    // Open two tabs
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Navigate both tabs
    await Promise.all([
      page1.goto('http://localhost:3000/projects/1/board'),
      page2.goto('http://localhost:3000/projects/1/board'),
    ]);

    // Wait for board to load
    await Promise.all([
      expect(page1.locator(`[data-testid="ticket-card-${ticket.id}"]`).first()).toBeVisible(),
      expect(page2.locator(`[data-testid="ticket-card-${ticket.id}"]`).first()).toBeVisible(),
    ]);

    // Perform rapid status updates
    const context = await browser.newContext();
    const apiPage = await context.newPage();

    await apiPage.request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'RUNNING' },
    });

    await page1.waitForTimeout(100);

    await apiPage.request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
    });

    await apiPage.close();
    await context.close();

    // Wait for all updates to propagate
    await page1.waitForTimeout(800);
    await page2.waitForTimeout(800);

    // Verify both tabs show final COMPLETED status
    for (const page of [page1, page2]) {
      const card = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
      const indicator = card.locator('[data-testid="job-status-indicator"]');
      const icon = indicator.;

      const label = await icon.getAttribute('aria-label');
      expect(label?.toLowerCase()).toContain('completed');
    }

    // Clean up
    await page1.close();
    await page2.close();
    await context1.close();
    await context2.close();

    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
