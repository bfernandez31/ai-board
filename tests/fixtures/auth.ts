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

  // Override request fixture to include auth cookie via storageState
  request: async ({ playwright }, use) => {
    const sessionCookie = await getTestSessionCookie();

    // Create browser context first to get cookies in proper format
    const browser = await playwright.chromium.launch();
    const browserContext = await browser.newContext();
    await browserContext.addCookies([sessionCookie]);

    // Get storage state with cookies
    const storageState = await browserContext.storageState();
    await browserContext.close();
    await browser.close();

    // Create request context with storage state
    const context = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      storageState,
    });

    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
