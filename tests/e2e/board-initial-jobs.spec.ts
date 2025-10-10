import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase } from '../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * E2E Test: Board Initial Job Status Load (T031)
 *
 * Tests that board correctly fetches and displays initial job status
 * for all tickets on page load.
 *
 * Success Criteria:
 * - Board fetches initial jobs for all tickets on load
 * - Tickets display correct initial job status
 * - Tickets without jobs show clean card (no indicator)
 */
test.describe('E2E: Board Initial Job Status Load', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should load and display initial job status for all tickets', async ({ page }) => {
    // Create multiple tickets with different job statuses
    const tickets = await Promise.all([
      prisma.ticket.create({
        data: {
          title: '[e2e] Ticket with PENDING job',
          description: 'Should show PENDING indicator',
          stage: 'INBOX',
          projectId: 1,
        },
      }),
      prisma.ticket.create({
        data: {
          title: '[e2e] Ticket with RUNNING job',
          description: 'Should show RUNNING indicator with animation',
          stage: 'SPECIFY',
          projectId: 1,
        },
      }),
      prisma.ticket.create({
        data: {
          title: '[e2e] Ticket with COMPLETED job',
          description: 'Should show COMPLETED indicator',
          stage: 'PLAN',
          projectId: 1,
        },
      }),
    ]);

    // Create jobs for tickets
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
          status: 'RUNNING',
          branch: '020-test-branch',
        },
      }),
      prisma.job.create({
        data: {
          ticketId: tickets[2].id,
          command: 'build',
          status: 'COMPLETED',
          branch: '020-test-branch',
          completedAt: new Date(),
        },
      }),
    ]);

    // Load board page
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify all ticket cards are visible
    for (const ticket of tickets) {
      const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
      await expect(ticketCard).toBeVisible();

      // Verify job status indicator is present
      const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
      await expect(statusIndicator).toBeVisible();
    }

    // Verify specific status for each ticket
    const pendingCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: tickets[0].title }).first();
    const pendingIcon = pendingCard.locator('[data-testid="job-status-indicator"] [role="img"]');
    const pendingLabel = await pendingIcon.getAttribute('aria-label');
    expect(pendingLabel?.toLowerCase()).toContain('pending');

    const runningCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: tickets[1].title }).first();
    const runningIcon = runningCard.locator('[data-testid="job-status-indicator"] [role="img"]');
    const runningLabel = await runningIcon.getAttribute('aria-label');
    expect(runningLabel?.toLowerCase()).toContain('running');

    const completedCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: tickets[2].title }).first();
    const completedIcon = completedCard.locator('[data-testid="job-status-indicator"] [role="img"]');
    const completedLabel = await completedIcon.getAttribute('aria-label');
    expect(completedLabel?.toLowerCase()).toContain('completed');

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: jobs.map(j => j.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
  });

  test('should show clean card for tickets without jobs', async ({ page }) => {
    // Create tickets - some with jobs, some without
    const tickets = await Promise.all([
      prisma.ticket.create({
        data: {
          title: '[e2e] Ticket with job',
          description: 'Should show indicator',
          stage: 'INBOX',
          projectId: 1,
        },
      }),
      prisma.ticket.create({
        data: {
          title: '[e2e] Ticket without job',
          description: 'Should show clean card',
          stage: 'INBOX',
          projectId: 1,
        },
      }),
    ]);

    // Create job only for first ticket
    const job = await prisma.job.create({
      data: {
        ticketId: tickets[0].id,
        command: 'specify',
        status: 'PENDING',
        branch: null,
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify first ticket has job indicator
    const cardWithJob = page.locator('[data-testid="ticket-card"]').filter({ hasText: tickets[0].title }).first();
    await expect(cardWithJob).toBeVisible();
    const indicatorPresent = cardWithJob.locator('[data-testid="job-status-indicator"]');
    await expect(indicatorPresent).toBeVisible();

    // Verify second ticket does NOT have job indicator
    const cardWithoutJob = page.locator('[data-testid="ticket-card"]').filter({ hasText: tickets[1].title }).first();
    await expect(cardWithoutJob).toBeVisible();
    const indicatorAbsent = cardWithoutJob.locator('[data-testid="job-status-indicator"]');
    await expect(indicatorAbsent).not.toBeVisible();

    // Verify card without job still shows title
    const title = cardWithoutJob.locator('h3').filter({ hasText: '[e2e] Ticket without job' });
    await expect(title).toBeVisible();

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
  });

  test('should prioritize active jobs over terminal jobs for display', async ({ page }) => {
    // Create ticket with multiple jobs (older COMPLETED, newer RUNNING)
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket with multiple jobs',
        description: 'Should show most recent active job',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });

    // Create older COMPLETED job
    const completedJob = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'COMPLETED',
        branch: '020-test-branch',
        startedAt: new Date(Date.now() - 60000), // 1 minute ago
        completedAt: new Date(Date.now() - 30000), // 30 seconds ago
      },
    });

    // Create newer RUNNING job
    const runningJob = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'plan',
        status: 'RUNNING',
        branch: '020-test-branch',
        startedAt: new Date(), // Just now
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify ticket shows RUNNING status (most recent active job)
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;
    const ariaLabel = await icon.getAttribute('aria-label');

    expect(ariaLabel?.toLowerCase()).toContain('running');
    expect(ariaLabel).toContain('plan'); // Should show 'plan' command, not 'specify'

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: [completedJob.id, runningJob.id] } } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should display most recent terminal job if no active jobs', async ({ page }) => {
    // Create ticket with only COMPLETED jobs
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket with terminal jobs only',
        description: 'Should show most recent terminal job',
        stage: 'PLAN',
        projectId: 1,
      },
    });

    // Create older COMPLETED job
    const olderJob = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'COMPLETED',
        branch: '020-test-branch',
        startedAt: new Date(Date.now() - 120000), // 2 minutes ago
        completedAt: new Date(Date.now() - 90000), // 1.5 minutes ago
      },
    });

    // Create newer COMPLETED job
    const newerJob = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'plan',
        status: 'COMPLETED',
        branch: '020-test-branch',
        startedAt: new Date(Date.now() - 60000), // 1 minute ago
        completedAt: new Date(Date.now() - 30000), // 30 seconds ago
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify ticket shows most recent COMPLETED job (plan)
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;
    const ariaLabel = await icon.getAttribute('aria-label');

    expect(ariaLabel?.toLowerCase()).toContain('completed');
    expect(ariaLabel).toContain('plan'); // Should show newer 'plan' job, not older 'specify'

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: [olderJob.id, newerJob.id] } } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should handle FAILED jobs correctly', async ({ page }) => {
    // Create ticket with FAILED job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Ticket with failed job',
        description: 'Should show FAILED indicator',
        stage: 'BUILD',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'build',
        status: 'FAILED',
        branch: '020-test-branch',
        completedAt: new Date(),
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify ticket shows FAILED status
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;
    const ariaLabel = await icon.getAttribute('aria-label');

    expect(ariaLabel?.toLowerCase()).toContain('failed');
    expect(ariaLabel).toContain('build');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should load jobs for tickets across all stage columns', async ({ page }) => {
    // Create tickets in different stages with jobs
    const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD'] as const;
    const tickets: any[] = [];
    const jobs: any[] = [];

    for (const stage of stages) {
      const ticket = await prisma.ticket.create({
        data: {
          title: `[e2e] Ticket in ${stage}`,
          description: `Testing job load in ${stage} column`,
          stage,
          projectId: 1,
        },
      });
      tickets.push(ticket);

      const job = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: stage.toLowerCase(),
          status: 'RUNNING',
          branch: '020-test-branch',
        },
      });
      jobs.push(job);
    }

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify all tickets across all columns have job indicators
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
      await expect(ticketCard).toBeVisible();

      const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
      await expect(statusIndicator).toBeVisible();

      const icon = statusIndicator.;
      const ariaLabel = await icon.getAttribute('aria-label');
      expect(ariaLabel?.toLowerCase()).toContain('running');
    }

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: jobs.map(j => j.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
  });

  test('should load initial jobs within acceptable time', async ({ page }) => {
    // Create 10 tickets with jobs to test query performance
    const tickets: any[] = [];
    const jobs: any[] = [];

    for (let i = 0; i < 10; i++) {
      const ticket = await prisma.ticket.create({
        data: {
          title: `[e2e] Performance test ticket ${i + 1}`,
          description: `Testing batch job query performance`,
          stage: 'INBOX',
          projectId: 1,
        },
      });
      tickets.push(ticket);

      const job = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'specify',
          status: i % 2 === 0 ? 'RUNNING' : 'COMPLETED',
          branch: '020-test-branch',
          completedAt: i % 2 === 1 ? new Date() : null,
        },
      });
      jobs.push(job);
    }

    // Measure page load time
    const startTime = Date.now();
    await page.goto('http://localhost:3000/projects/1/board');

    // Wait for first ticket to be visible
    const firstCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: tickets[0].title }).first();
    await expect(firstCard).toBeVisible();

    const loadTime = Date.now() - startTime;

    // Page should load within 3 seconds (generous for E2E test)
    expect(loadTime).toBeLessThan(3000);

    // Verify all job indicators are present
    for (const ticket of tickets) {
      const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
      const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
      await expect(statusIndicator).toBeVisible();
    }

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: jobs.map(j => j.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
  });
});
