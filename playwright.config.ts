import { defineConfig, devices } from '@playwright/test';

const config = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Disabled to prevent race conditions with database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Allow 1 retry in dev for flaky SSE tests
  workers: 1, // Single worker to ensure database consistency
  reporter: 'html',
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  timeout: 30000, // 30 seconds per test
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10000, // 10 seconds for actions
    navigationTimeout: 30000, // 30 seconds for navigation
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'NODE_ENV=test npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI, // Reuse in dev (UI mode), restart in CI
    timeout: 120000, // 2 minutes for server startup
    stdout: 'pipe', // Show server output
    stderr: 'pipe',
  },
});

export default config;
