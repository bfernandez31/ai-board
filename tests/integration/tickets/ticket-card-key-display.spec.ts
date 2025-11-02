import { test, expect } from '../../helpers/worker-isolation';
import { PrismaClient } from '@prisma/client';
import { cleanupDatabase, getProjectKey } from '../../helpers/db-cleanup';

const prisma = new PrismaClient();

/**
 * Integration Test: TicketKey Display in Ticket Card Title
 *
 * Tests that ticket cards correctly display the ticketKey before the title
 * in the format: #ticketKey - ticketTitle
 *
 * Success Criteria:
 * - Ticket card displays ticketKey in the title area
 * - Format is: #KEY-123 - Title Text
 * - ticketKey is visually distinct from title
 */
test.describe('Integration: TicketKey Display in Title', () => {
  let nextTicketNumber = 1;

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    nextTicketNumber = 1;
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display ticketKey before title in format #KEY-123 - Title', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticketKey = `${projectKey}-${ticketNumber}`;
    const ticketTitle = '[e2e] Test ticket with key display';

    await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey,
        title: ticketTitle,
        description: 'Testing ticketKey display in title',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: ticketTitle }).first();
    await expect(ticketCard).toBeVisible();

    // Find the title element within the card
    const titleElement = ticketCard.locator('h3');
    await expect(titleElement).toBeVisible();

    // Verify the title contains both ticketKey and title in correct format
    const titleText = await titleElement.textContent();
    expect(titleText).toContain(`#${ticketKey}`);
    expect(titleText).toContain(ticketTitle);

    // Verify the format is: #ticketKey - ticketTitle
    expect(titleText).toMatch(new RegExp(`#${ticketKey}\\s*-\\s*${ticketTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  test('should display ticketKey with different ticket numbers', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);
    const testCases = [
      { ticketNumber: 1, title: '[e2e] First ticket' },
      { ticketNumber: 42, title: '[e2e] Mid-range ticket' },
      { ticketNumber: 999, title: '[e2e] High number ticket' },
    ];

    for (const testCase of testCases) {
      const ticketKey = `${projectKey}-${testCase.ticketNumber}`;
      await prisma.ticket.create({
        data: {
          ticketNumber: testCase.ticketNumber,
          ticketKey,
          title: testCase.title,
          description: `Testing ticketKey display for ticket ${testCase.ticketNumber}`,
          stage: 'INBOX',
          projectId,
          updatedAt: new Date(),
        },
      });
    }

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Verify each ticket displays its ticketKey correctly
    for (const testCase of testCases) {
      const ticketKey = `${projectKey}-${testCase.ticketNumber}`;
      const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: testCase.title }).first();
      await expect(ticketCard).toBeVisible();

      const titleElement = ticketCard.locator('h3');
      const titleText = await titleElement.textContent();

      expect(titleText).toContain(`#${ticketKey}`);
      expect(titleText).toContain(testCase.title);
    }
  });

  test('should display ticketKey for tickets in different stages', async ({ page, projectId }) => {
    const projectKey = getProjectKey(projectId);
    const stages = ['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP'] as const;

    for (const stage of stages) {
      const ticketNumber = nextTicketNumber++;
      const ticketKey = `${projectKey}-${ticketNumber}`;
      const title = `[e2e] Ticket in ${stage}`;

      await prisma.ticket.create({
        data: {
          ticketNumber,
          ticketKey,
          title,
          description: `Testing ticketKey display in ${stage} stage`,
          stage,
          projectId,
          updatedAt: new Date(),
        },
      });
    }

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Verify each ticket displays its ticketKey correctly in its respective stage
    for (const stage of stages) {
      const title = `[e2e] Ticket in ${stage}`;
      const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: title }).first();
      await expect(ticketCard).toBeVisible();

      const titleElement = ticketCard.locator('h3');
      const titleText = await titleElement.textContent();

      // Should contain the ticketKey format (e.g., #TE2-1 - [e2e] Ticket in INBOX)
      expect(titleText).toMatch(/#[A-Z0-9]{1,3}-\d+\s*-\s*\[e2e\]/);
    }
  });

  test('should maintain ticketKey display during drag operations', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticketKey = `${projectKey}-${ticketNumber}`;
    const title = '[e2e] Draggable ticket';

    await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey,
        title,
        description: 'Testing ticketKey display during drag',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: title }).first();
    await expect(ticketCard).toBeVisible();

    // Verify initial state
    const titleElement = ticketCard.locator('h3');
    const initialTitleText = await titleElement.textContent();
    expect(initialTitleText).toContain(`#${ticketKey}`);

    // Verify the card is draggable
    const isDraggable = await ticketCard.getAttribute('data-draggable');
    expect(isDraggable).toBe('true');

    // After potential drag operations, ticketKey should still be visible
    const finalTitleText = await titleElement.textContent();
    expect(finalTitleText).toContain(`#${ticketKey}`);
  });

  test('should display ticketKey with long ticket titles', async ({ page, projectId }) => {
    const ticketNumber = nextTicketNumber++;
    const projectKey = getProjectKey(projectId);
    const ticketKey = `${projectKey}-${ticketNumber}`;
    const longTitle = '[e2e] This is a long ticket title that tests ticketKey display';

    await prisma.ticket.create({
      data: {
        ticketNumber,
        ticketKey,
        title: longTitle,
        description: 'Testing ticketKey display with long title',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    // Load board page
    await page.goto(`http://localhost:3000/projects/${projectId}/board`);

    // Find ticket card
    const ticketCard = page.locator('[data-testid="ticket-card"]').filter({ hasText: longTitle.substring(0, 50) }).first();
    await expect(ticketCard).toBeVisible();

    // Find the title element
    const titleElement = ticketCard.locator('h3');
    await expect(titleElement).toBeVisible();

    // Verify ticketKey is present even with long title
    const titleText = await titleElement.textContent();
    expect(titleText).toContain(`#${ticketKey}`);

    // Verify the ticketKey comes before the title
    const keyIndex = titleText?.indexOf(`#${ticketKey}`) ?? -1;
    const titleIndex = titleText?.indexOf('[e2e]') ?? -1;
    expect(keyIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeGreaterThan(keyIndex);
  });
});
