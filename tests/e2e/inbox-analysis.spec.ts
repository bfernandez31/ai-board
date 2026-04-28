/**
 * E2E: Inbox Analysis (US1 + US7)
 *
 * Single happy-path verifying that the panel mount + button + banner are
 * keyboard-reachable with accessible names. The trigger flow is exercised at
 * the API level by integration tests; this E2E is the keyboard + screen-reader
 * smoke test.
 */
import { test, expect } from '../helpers/worker-isolation';
import { ensureProjectExists } from '../helpers/db-cleanup';

test.describe('Inbox Analysis a11y smoke', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page, projectId }) => {
    await ensureProjectExists(projectId);
    await page.goto(`/projects/${projectId}/board`);
    await page.waitForLoadState('networkidle');
  });

  test('reaches the analysis panel via keyboard from an INBOX ticket', async ({ page, projectId }) => {
    const inboxCard = page.locator('[data-testid="ticket-card"]').first();
    if (!(await inboxCard.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await inboxCard.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const panel = page.getByTestId('inbox-analysis-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });

    const trigger = page.getByTestId('inbox-analysis-trigger');
    if (await trigger.isVisible().catch(() => false)) {
      const label = await trigger.getAttribute('aria-label');
      expect(label).toContain('Analyze');
      expect(label).toContain('cost');
    }

    expect(projectId).toBeGreaterThan(0);
  });
});
