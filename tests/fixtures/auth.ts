import { test as base, Page } from '@playwright/test';
import { getTestSessionCookie } from '../helpers/auth';

/**
 * Extended Playwright test with authenticated context
 * Automatically sets up auth session for all tests
 */

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Set up authentication cookie before each test
    const sessionCookie = await getTestSessionCookie();
    await page.context().addCookies([sessionCookie]);

    // Use the authenticated page
    await use(page);
  },
});

export { expect } from '@playwright/test';
