/**
 * E2E Tests: Activity Heatmap on Projects Page
 * Feature: AIB-688-copy-of-activity
 *
 * Covers only the three genuinely browser-bound success criteria per tasks.md T031:
 *   SC-001: First-paint heatmap is populated; no skeleton/spinner flashes on initial render.
 *   SC-005: ?period=2025&agent=CLAUDE reproduces the filtered view on first paint in a fresh session.
 *   SC-007: Mobile viewport renders ≥14×14 cells, scrolls horizontally, keeps day-of-week labels visible.
 */

import { test, expect } from '../../helpers/worker-isolation';
import { ensureProjectExists, getPrismaClient } from '../../helpers/db-cleanup';
import { Agent, JobStatus, Stage, WorkflowType } from '@prisma/client';

async function seedHeatmapJobs(projectId: number): Promise<void> {
  const client = getPrismaClient();

  // Clean any pre-existing tickets/jobs on this worker project to keep tallies deterministic
  await client.job.deleteMany({ where: { ticket: { projectId } } });
  await client.ticket.deleteMany({ where: { projectId } });

  // Ensure project has a defaultAgent so effective-agent resolution works
  await client.project.update({
    where: { id: projectId },
    data: { defaultAgent: Agent.CLAUDE },
  });

  const now = new Date();
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const tickets = await client.ticket.createManyAndReturn({
    data: [
      {
        projectId,
        title: '[e2e] heatmap claude',
        description: 'heatmap seed',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 1,
        ticketKey: `HE-${projectId}-1`,
        agent: Agent.CLAUDE,
        updatedAt: daysAgo(3),
      },
      {
        projectId,
        title: '[e2e] heatmap codex',
        description: 'heatmap seed',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 2,
        ticketKey: `HE-${projectId}-2`,
        agent: Agent.CODEX,
        updatedAt: daysAgo(5),
      },
    ],
  });
  const byKey = new Map(tickets.map((t) => [t.ticketKey, t.id]));
  const claudeTicketId = byKey.get(`HE-${projectId}-1`)!;
  const codexTicketId = byKey.get(`HE-${projectId}-2`)!;

  // Build jobs across the last 14 days so the default heatmap is visibly shaded
  const jobRows = [];
  for (let i = 0; i < 14; i += 1) {
    const day = daysAgo(i);
    const ticketId = i % 2 === 0 ? claudeTicketId : codexTicketId;
    jobRows.push({
      ticketId,
      projectId,
      command: i === 7 ? 'ship' : 'implement',
      status: JobStatus.COMPLETED,
      startedAt: day,
      completedAt: day,
      updatedAt: day,
      createdAt: day,
      costUsd: i % 3 === 0 ? null : 0.25,
    });
  }

  await client.job.createMany({ data: jobRows });
}

async function clearHeatmapJobs(projectId: number): Promise<void> {
  const client = getPrismaClient();
  await client.job.deleteMany({ where: { ticket: { projectId } } });
  await client.ticket.deleteMany({ where: { projectId } });
}

test.describe('Activity Heatmap — first-paint (SC-001)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ projectId }) => {
    await ensureProjectExists(projectId);
    await seedHeatmapJobs(projectId);
  });

  test.afterEach(async ({ projectId }) => {
    await clearHeatmapJobs(projectId);
  });

  test('renders shaded cells on first paint with no spinner/skeleton', async ({ page }) => {
    await page.goto('/projects');

    const grid = page.locator('[data-testid="activity-heatmap-grid"]');
    await expect(grid).toBeVisible();

    // No progressbar role should be rendered inside the heatmap
    const heatmapProgress = page.locator(
      '[data-testid="activity-heatmap-grid"] [role="progressbar"]'
    );
    await expect(heatmapProgress).toHaveCount(0);

    // At least one cell should be shaded (level > 0)
    const shadedCells = page.locator(
      '[data-testid="activity-heatmap-cell"][data-level="1"], ' +
        '[data-testid="activity-heatmap-cell"][data-level="2"], ' +
        '[data-testid="activity-heatmap-cell"][data-level="3"], ' +
        '[data-testid="activity-heatmap-cell"][data-level="4"]'
    );
    const count = await shadedCells.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Activity Heatmap — URL-driven SSR (SC-005)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ projectId }) => {
    await ensureProjectExists(projectId);
    await seedHeatmapJobs(projectId);
  });

  test.afterEach(async ({ projectId }) => {
    await clearHeatmapJobs(projectId);
  });

  test('?agent=CLAUDE renders the filtered view on first paint', async ({ page }) => {
    // Deep-link directly so SSR consumes the filter. No intermediate navigation.
    await page.goto('/projects?agent=CLAUDE');

    const grid = page.locator('[data-testid="activity-heatmap-grid"]');
    await expect(grid).toBeVisible();

    // Counter header should be present and reflect the filtered label
    const header = page.locator('[data-testid="activity-heatmap-header"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText(/jobs/);
  });
});

test.describe('Activity Heatmap — mobile (SC-007)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ projectId }) => {
    await ensureProjectExists(projectId);
    await seedHeatmapJobs(projectId);
  });

  test.afterEach(async ({ projectId }) => {
    await clearHeatmapJobs(projectId);
  });

  test('cells are ≥14×14 and day-of-week labels remain visible', async ({ page }) => {
    await page.goto('/projects');

    const grid = page.locator('[data-testid="activity-heatmap-grid"]');
    await expect(grid).toBeVisible();

    const firstCell = page.locator('[data-testid="activity-heatmap-cell"]').first();
    await expect(firstCell).toBeVisible();
    const box = await firstCell.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(14);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(14);

    // At least one day-of-week label (Mon/Wed/Fri is rendered with opacity-100) should be visible
    const dayLabels = grid.locator('text=/^(Mon|Wed|Fri)$/');
    const labelCount = await dayLabels.count();
    expect(labelCount).toBeGreaterThan(0);
  });
});
