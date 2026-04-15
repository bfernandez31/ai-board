import { test, expect } from '../helpers/worker-isolation';
import { getPrismaClient, cleanupDatabase, ensureProjectExists, getProjectKey } from '../helpers/db-cleanup';

const prisma = getPrismaClient();

async function seedProjectsHeatmap(projectId: number): Promise<void> {
  await ensureProjectExists(projectId);
  await prisma.user.update({
    where: { id: 'test-user-id' },
    data: {
      createdAt: new Date('2024-01-15T00:00:00.000Z'),
      updatedAt: new Date(),
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: {
      defaultAgent: 'CLAUDE',
      updatedAt: new Date(),
    },
  });

  const projectKey = getProjectKey(projectId);

  const shippedTicket = await prisma.ticket.create({
    data: {
      ticketNumber: 1,
      ticketKey: `${projectKey}-1`,
      title: '[e2e] Projects heatmap shipped ticket',
      description: 'Seeded ticket for projects heatmap',
      stage: 'SHIP',
      workflowType: 'FULL',
      projectId,
      updatedAt: new Date(),
    },
  });

  const inheritedTicket = await prisma.ticket.create({
    data: {
      ticketNumber: 2,
      ticketKey: `${projectKey}-2`,
      title: '[e2e] Projects heatmap inherited agent ticket',
      description: 'Seeded inherited-agent ticket',
      stage: 'BUILD',
      workflowType: 'FULL',
      projectId,
      updatedAt: new Date(),
    },
  });

  const codexTicket = await prisma.ticket.create({
    data: {
      ticketNumber: 3,
      ticketKey: `${projectKey}-3`,
      title: '[e2e] Projects heatmap explicit agent ticket',
      description: 'Seeded explicit-agent ticket',
      stage: 'BUILD',
      workflowType: 'FULL',
      projectId,
      agent: 'CODEX',
      updatedAt: new Date(),
    },
  });

  await prisma.job.createMany({
    data: [
      {
        ticketId: shippedTicket.id,
        projectId,
        command: 'ship',
        status: 'COMPLETED',
        startedAt: new Date('2026-04-14T10:00:00.000Z'),
        completedAt: new Date('2026-04-14T10:15:00.000Z'),
        costUsd: 1.25,
        updatedAt: new Date('2026-04-14T10:15:00.000Z'),
      },
      {
        ticketId: inheritedTicket.id,
        projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2026-04-10T09:00:00.000Z'),
        completedAt: new Date('2026-04-10T09:10:00.000Z'),
        costUsd: 0.8,
        updatedAt: new Date('2026-04-10T09:10:00.000Z'),
      },
      {
        ticketId: codexTicket.id,
        projectId,
        command: 'implement',
        status: 'COMPLETED',
        startedAt: new Date('2026-04-08T09:00:00.000Z'),
        completedAt: new Date('2026-04-08T09:10:00.000Z'),
        costUsd: 0.65,
        updatedAt: new Date('2026-04-08T09:10:00.000Z'),
      },
    ],
  });
}

test.describe('Projects Activity Heatmap', () => {
  test.beforeEach(async ({ projectId }) => {
    await cleanupDatabase(projectId);
    await seedProjectsHeatmap(projectId);
  });

  test('restores the selected period and agent from the URL', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const periodFilter = page.getByTestId('projects-activity-period-filter');
    await expect(periodFilter).toBeVisible();
    await periodFilter.click();
    await page.getByRole('option', { name: '2026' }).click();

    const agentFilter = page.getByTestId('projects-activity-agent-filter');
    await expect(agentFilter).toBeVisible();
    await agentFilter.click();
    await page.getByRole('option', { name: 'Claude' }).click();

    await expect(page).toHaveURL(/period=year/);
    await expect(page).toHaveURL(/year=2026/);
    await expect(page).toHaveURL(/agent=CLAUDE/);

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/period=year/);
    await expect(page).toHaveURL(/year=2026/);
    await expect(page).toHaveURL(/agent=CLAUDE/);
    await expect(page.getByText(/jobs .* tickets shipped in 2026/i)).toBeVisible();
  });

  test.use({ viewport: { width: 375, height: 812 } });

  test('supports horizontal scrolling with pinned labels and tap-open day details on mobile', async ({
    page,
  }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const scrollRegion = page.getByTestId('projects-activity-scroll');
    await expect(scrollRegion).toBeVisible();
    await expect(page.getByText('Mon', { exact: true })).toBeVisible();

    const metricsBefore = await scrollRegion.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollLeft: element.scrollLeft,
    }));

    expect(metricsBefore.scrollWidth).toBeGreaterThan(metricsBefore.clientWidth);

    await scrollRegion.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });

    const metricsAfter = await scrollRegion.evaluate((element) => ({
      scrollLeft: element.scrollLeft,
    }));

    expect(metricsAfter.scrollLeft).toBeGreaterThan(metricsBefore.scrollLeft);

    await page.getByTestId('projects-activity-cell-2026-04-14').click();

    await expect(page.getByText('April 14, 2026')).toBeVisible();
    await expect(page.getByText(/\d+ jobs?/).last()).toBeVisible();
    await expect(page.getByText(/\d+ tickets? shipped/).last()).toBeVisible();
  });
});
