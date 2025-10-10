import { defineConfig, devices } from '@playwright/test';

const config = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Disabled to prevent race conditions with database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to ensure database consistency
  reporter: 'html',
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      E2E_TEST: 'true', // Disable GitHub API calls during E2E tests
    },
  },
});

export default config;
