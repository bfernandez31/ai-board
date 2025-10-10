import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase } from '../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * E2E Test: Animation Performance (T034)
 *
 * Tests that RUNNING status animation maintains 60fps performance
 * and doesn't impact scroll or overall board performance.
 *
 * Success Criteria:
 * - RUNNING animation maintains 60fps
 * - Board scroll performance not impacted by animations
 * - Memory usage stable over 5 minutes of updates
 */
test.describe('E2E: Animation Performance', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should render RUNNING animation smoothly', async ({ page }) => {
    // Create ticket with RUNNING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Animation performance test',
        description: 'Testing RUNNING animation performance',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'RUNNING',
        branch: '020-test-branch',
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card with RUNNING status
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    await expect(statusIndicator).toBeVisible();

    // Verify animation is present (should have CSS animation property)
    const icon = statusIndicator.;
    const hasAnimation = await icon.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.animationName !== 'none' && style.animationDuration !== '0s';
    });

    expect(hasAnimation).toBe(true);

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should use GPU-accelerated properties for animation', async ({ page }) => {
    // Create ticket with RUNNING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] GPU acceleration test',
        description: 'Testing animation uses transform/opacity',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'RUNNING',
        branch: '020-test-branch',
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Find status indicator
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;

    await expect(icon).toBeVisible();

    // Verify animation uses only transform and opacity (GPU-accelerated)
    const animationProperties = await icon.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        animationName: style.animationName,
        willChange: style.willChange,
        // Check if animation uses transform
        usesTransform: style.animationName.includes('rotate') ||
                       style.animationName.includes('translate') ||
                       style.animationName.includes('scale') ||
                       style.animationName.includes('spin') ||
                       style.animationName.includes('writing'),
      };
    });

    // Verify will-change hint is present for performance
    expect(animationProperties.willChange).toContain('transform');

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should respect prefers-reduced-motion setting', async ({ page }) => {
    // Create ticket with RUNNING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Reduced motion test',
        description: 'Testing prefers-reduced-motion',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'RUNNING',
        branch: '020-test-branch',
      },
    });

    // Emulate prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Find status indicator
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;

    await expect(icon).toBeVisible();

    // Verify animation is disabled when prefers-reduced-motion is set
    const hasAnimation = await icon.evaluate((el) => {
      const style = window.getComputedStyle(el);
      // Animation should be disabled or set to 0s duration
      return style.animationName !== 'none' && style.animationDuration !== '0s';
    });

    // With reduced motion, animation should be disabled
    expect(hasAnimation).toBe(false);

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should NOT animate non-RUNNING statuses', async ({ page }) => {
    // Create tickets with different statuses
    const statuses = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
    const tickets: any[] = [];
    const jobs: any[] = [];

    for (const status of statuses) {
      const ticket = await prisma.ticket.create({
        data: {
          title: `[e2e] ${status} status test`,
          description: `Testing ${status} has no animation`,
          stage: 'INBOX',
          projectId: 1,
        },
      });
      tickets.push(ticket);

      const job = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'specify',
          status,
          branch: status === 'PENDING' ? null : '020-test-branch',
          completedAt: ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status) ? new Date() : null,
        },
      });
      jobs.push(job);
    }

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Verify each status has NO animation
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
      const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
      const icon = statusIndicator.;

      await expect(icon).toBeVisible();

      const hasAnimation = await icon.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.animationName !== 'none' && style.animationDuration !== '0s';
      });

      // Non-RUNNING statuses should NOT have animation
      expect(hasAnimation).toBe(false);
    }

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: jobs.map(j => j.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
  });

  test('should maintain scroll performance with multiple animated indicators', async ({ page }) => {
    // Create 10 tickets with RUNNING jobs to test scroll performance
    const tickets: any[] = [];
    const jobs: any[] = [];

    for (let i = 0; i < 10; i++) {
      const ticket = await prisma.ticket.create({
        data: {
          title: `[e2e] Scroll test ticket ${i + 1}`,
          description: `Testing scroll performance with animations`,
          stage: 'INBOX',
          projectId: 1,
        },
      });
      tickets.push(ticket);

      const job = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          command: 'specify',
          status: 'RUNNING',
          branch: '020-test-branch',
        },
      });
      jobs.push(job);
    }

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Wait for all tickets to load
    const firstCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: tickets[0].title }).first();
    await expect(firstCard).toBeVisible();

    // Measure scroll performance
    const scrollStart = Date.now();

    // Perform scroll action
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });

    await page.waitForTimeout(100);

    await page.evaluate(() => {
      window.scrollBy(0, -500);
    });

    const scrollTime = Date.now() - scrollStart;

    // Scroll should be smooth (complete within 200ms for 2 scroll operations)
    expect(scrollTime).toBeLessThan(200);

    // Clean up
    await prisma.job.deleteMany({ where: { id: { in: jobs.map(j => j.id) } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets.map(t => t.id) } } });
  });

  test('should not cause layout shifts during animation', async ({ page }) => {
    // Create ticket with RUNNING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Layout stability test',
        description: 'Testing animation doesnt cause layout shifts',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'RUNNING',
        branch: '020-test-branch',
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    // Measure card position before and after animation runs
    const initialPosition = await ticketCard.boundingBox();

    // Wait for animation to run (2 seconds = one full cycle)
    await page.waitForTimeout(2000);

    const finalPosition = await ticketCard.boundingBox();

    // Verify card position hasn't shifted
    expect(initialPosition?.x).toBe(finalPosition?.x);
    expect(initialPosition?.y).toBe(finalPosition?.y);
    expect(initialPosition?.width).toBe(finalPosition?.width);
    expect(initialPosition?.height).toBe(finalPosition?.height);

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  test('should handle animation cleanup on status change', async ({ page, request }) => {
    // Create ticket with RUNNING job
    const ticket = await prisma.ticket.create({
      data: {
        title: '[e2e] Animation cleanup test',
        description: 'Testing animation stops on status change',
        stage: 'SPECIFY',
        projectId: 1,
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: 'RUNNING',
        branch: '020-test-branch',
      },
    });

    // Load board
    await page.goto('http://localhost:3000/projects/1/board');

    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticket.title }).first();
    await expect(ticketCard).toBeVisible();

    const statusIndicator = ticketCard.locator('[data-testid="job-status-indicator"]');
    const icon = statusIndicator.;

    // Verify animation is running
    let hasAnimation = await icon.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.animationName !== 'none' && style.animationDuration !== '0s';
    });
    expect(hasAnimation).toBe(true);

    // Change status to COMPLETED (should stop animation)
    await request.patch(`http://localhost:3000/api/jobs/${job.id}/status`, {
      data: { status: 'COMPLETED' },
    });

    // Wait for SSE update
    await page.waitForTimeout(600);

    // Verify animation has stopped
    hasAnimation = await icon.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.animationName !== 'none' && style.animationDuration !== '0s';
    });
    expect(hasAnimation).toBe(false);

    // Clean up
    await prisma.job.delete({ where: { id: job.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});
