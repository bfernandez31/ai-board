import { test, expect } from '../helpers/worker-isolation';
import { Agent, PrismaClient, Stage, WorkflowType } from '@prisma/client';
import { cleanupDatabase, getPrismaClient, getProjectKey } from '../helpers/db-cleanup';

test.describe('Projects activity heatmap', () => {
  let prisma: PrismaClient;

  test.beforeAll(() => {
    prisma = getPrismaClient();
  });

  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    await prisma.project.update({
      where: { id: projectId },
      data: { defaultAgent: Agent.CLAUDE },
    });
  });

  test('supports mobile scrolling and day inspection on /projects', async ({ page, projectId }) => {
    const now = new Date();
    const activityDate = new Date(now);
    activityDate.setUTCDate(activityDate.getUTCDate() - 2);

    const ticketNumber = 1;
    const projectKey = getProjectKey(projectId);

    const ticket = await prisma.ticket.create({
      data: {
        projectId,
        title: '[e2e] Activity heatmap mobile test',
        description: 'mobile heatmap inspection coverage',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber,
        ticketKey: `${projectKey}-${ticketNumber}`,
        updatedAt: activityDate,
      },
    });

    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: activityDate,
        completedAt: activityDate,
        updatedAt: activityDate,
        costUsd: 4.25,
      },
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    });

    await expect(page.locator('[data-testid="projects-activity-grid"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const cellDate = activityDate.toISOString().slice(0, 10);
    const activityCell = page.locator(`[data-testid="projects-activity-cell"][data-date="${cellDate}"]`);

    await activityCell.focus();
    await expect(activityCell).toHaveAttribute(
      'aria-label',
      /1 jobs, 1 tickets shipped, \$4\.25 cost/
    );
  });
});
