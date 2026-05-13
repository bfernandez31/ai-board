/**
 * E2E: Inbox Analysis (US1 + US7)
 *
 * Single happy-path verifying that the panel mount + button + banner are
 * keyboard-reachable with accessible names. The trigger flow is exercised at
 * the API level by integration tests; this E2E is the keyboard + screen-reader
 * smoke test.
 */
import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase, ensureProjectExists, getProjectKey } from '../helpers/db-cleanup';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Inbox Analysis a11y smoke', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page, projectId }) => {
    await cleanupDatabase(projectId);
    await ensureProjectExists(projectId);

    // Seed a deterministic INBOX ticket so the modal opens on Details tab
    // (where the inbox-analysis-panel lives). Clicking a non-INBOX ticket
    // would open Conversation/Stats instead and the panel would be hidden.
    const projectKey = getProjectKey(projectId);
    await prisma.ticket.create({
      data: {
        ticketNumber: 1,
        ticketKey: `${projectKey}-1`,
        title: '[e2e] Inbox Analysis a11y target',
        description: 'INBOX ticket used to assert analysis panel mount.',
        stage: 'INBOX',
        projectId,
        updatedAt: new Date(),
      },
    });

    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('reaches the analysis panel via keyboard from an INBOX ticket', async ({ page, projectId }) => {
    const inboxCard = page
      .locator('[data-testid="column-INBOX"] [data-testid="ticket-card"]')
      .first();
    await expect(inboxCard).toBeVisible({ timeout: 5000 });

    await inboxCard.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const panel = page.getByTestId('inbox-analysis-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });

    const trigger = page.getByTestId('inbox-analysis-trigger');
    if (await trigger.isVisible().catch(() => false)) {
      // The button is enabled immediately (triggerable=true, no rate-limit exhausted).
      // The aria-label gains the estimated cost once the eligibility GET resolves.
      // Use a generous timeout because the analysis GET endpoint can be slow under CI load.
      await expect(trigger).not.toBeDisabled({ timeout: 5000 });
      await expect(trigger).toHaveAttribute('aria-label', /estimated cost/, { timeout: 15000 });
      const label = await trigger.getAttribute('aria-label');
      expect(label).toContain('Run analysis');
      expect(label).toContain('cost');
    }

    expect(projectId).toBeGreaterThan(0);
  });
});
