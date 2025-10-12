import { test as base, Page, APIRequestContext } from '@playwright/test';
import { getTestSessionCookie } from '../helpers/auth';

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

    // Use the authenticated page
    await use(page);
  },

  // Override request fixture to include auth cookie
  request: async ({ playwright }, use) => {
    const sessionCookie = await getTestSessionCookie();

    const context = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: {
        // Add session cookie to all API requests
        'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
      }
    });

    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
