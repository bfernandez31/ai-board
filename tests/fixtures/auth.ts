import { test as base, Page, APIRequestContext } from '@playwright/test';
import { getTestSessionCookie, getTestUserId } from '../helpers/auth';

/**
 * Extended Playwright test with authenticated context
 * Automatically sets up auth session for all tests
 */

type AuthFixtures = {
  authenticatedPage: Page;
  request: APIRequestContext;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Set up authentication cookie before each test
    const sessionCookie = await getTestSessionCookie();
    await page.context().addCookies([sessionCookie]);

    // Add test user header for API requests made through page.request
    await page.setExtraHTTPHeaders({
      'x-test-user-id': (await getTestUserId()).toString(),
    });

    // Use the authenticated page
    await use(page);
  },

  // Override request fixture to include test user header
  request: async ({ playwright }, use) => {
    const testUserId = await getTestUserId();

    // Create request context with test user header
    const context = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: {
        'x-test-user-id': testUserId.toString(),
      },
    });

    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
