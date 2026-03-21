import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup';
import { createStructuredComparisonFixture } from '../helpers/comparison-fixtures';
import { createTestTicket } from '../helpers/db-setup';

test.describe('Comparison dialog', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page, projectId }) => {
    await cleanupDatabase(projectId);
    const fixture = await createStructuredComparisonFixture(projectId);
    const prisma = getPrismaClient();

    for (const [offset, rank] of [4, 5, 6].entries()) {
      const ticketNumber = 105 + offset;
      const ticket = await createTestTicket(projectId, {
        title: `[e2e] Extra ticket ${rank}`,
        description: 'Adds width to the comparison dialog',
        ticketNumber,
        ticketKey: `TE2-${ticketNumber}`,
        stage: 'BUILD',
      });

      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId,
          command: 'implement',
          status: 'COMPLETED',
          model: `gpt-4.${rank}`,
          inputTokens: 120 + rank,
          outputTokens: 80 + rank,
          costUsd: 0.02 + rank / 1000,
          durationMs: 25000 + rank * 1000,
          startedAt: new Date(`2026-03-19T1${rank}:00:00.000Z`),
          completedAt: new Date(`2026-03-19T1${rank}:01:00.000Z`),
          updatedAt: new Date(`2026-03-19T1${rank}:01:00.000Z`),
        },
      });

      await prisma.comparisonParticipant.create({
        data: {
          comparisonRecordId: fixture.comparison.id,
          ticketId: ticket.id,
          rank,
          score: 60 - rank,
          workflowTypeAtComparison: 'FULL',
          agentAtComparison: rank % 2 === 0 ? 'CODEX' : 'CLAUDE',
          rankRationale: 'Additional candidate for responsive comparison coverage.',
          metricSnapshot: {
            create: {
              linesAdded: 20 + rank,
              linesRemoved: 5,
              linesChanged: 25 + rank,
              filesChanged: 3,
              testFilesChanged: 1,
              changedFiles: [`app/extra-${rank}.ts`],
              bestValueFlags: {},
            },
          },
          complianceAssessments: {
            create: [
              {
                principleKey: 'typescript-first-development',
                principleName: 'TypeScript-First Development',
                status: 'mixed',
                notes: 'Supplemental participant for responsive layout testing.',
                displayOrder: 0,
              },
            ],
          },
        },
      });
    }

    await page.route('**/api/sse**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      });
    });

    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');
  });

  test('supports horizontal scrolling and inline quality inspection', async ({ page }) => {
    const ticketCard = page
      .locator('[data-testid="ticket-card"]')
      .filter({ hasText: '[e2e] Winner ticket' })
      .first();

    await expect(ticketCard).toBeVisible();
    await ticketCard.click();

    const ticketDetailDialog = page.getByRole('dialog').first();
    await expect(ticketDetailDialog).toBeVisible();
    await ticketDetailDialog.getByRole('tab', { name: 'Details' }).click();

    const compareButton = page.getByTestId('compare-button');
    await expect(compareButton).toBeVisible({ timeout: 20000 });
    await compareButton.scrollIntoViewIfNeeded();
    await compareButton.click();

    await expect(page.getByRole('heading', { name: 'Ticket Comparison' })).toBeVisible();
    await expect(page.getByText('Operational Metrics')).toBeVisible();

    await expect(page.getByTestId('comparison-operational-scroll')).toBeVisible();
    await expect(
      page.getByTestId('comparison-operational-scroll').getByText('TE2-107')
    ).toBeVisible();

    await page.getByRole('button', { name: '91 (Excellent)' }).click();

    const qualityTray = page.getByTestId('comparison-quality-detail-tray');
    await expect(qualityTray).toBeVisible();
    await expect(page.getByText('TE2-102 quality details')).toBeVisible();
    await expect(qualityTray.getByText('Compliance')).toBeVisible();
    await expect(qualityTray.getByText('Bug Detection')).toBeVisible();
    await expect(page.getByText('75 (Good)')).toBeVisible();
  });
});
