import { test, expect } from '../helpers/worker-isolation';

test.describe('Foundation Validation', () => {
  test('no console errors on homepage', async ({ page , projectId }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    expect(consoleErrors).toHaveLength(0);
  });
});
