import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Optimized Playwright configuration for CI/CD environments
 *
 * Key optimizations:
 * - Parallel test execution (4 workers)
 * - Shorter timeouts (10s per test)
 * - No traces/videos (performance)
 * - Minimal reporter (JSON only)
 * - Sharded execution support
 */

// Get the base webServer config (handling array case)
const baseWebServer = Array.isArray(baseConfig.webServer)
  ? baseConfig.webServer[0]
  : baseConfig.webServer;

export default defineConfig({
  ...baseConfig,

  // Performance optimizations for CI
  workers: process.env.CI ? 4 : 1, // Parallel execution in CI
  fullyParallel: true, // Enable parallel execution

  // Reduced timeouts for faster feedback
  timeout: 10000, // 10 seconds per test (was 30s)

  use: {
    ...baseConfig.use,
    // Disable traces and videos in CI for performance
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',

    // Shorter action timeouts
    actionTimeout: 5000, // 5 seconds (was 10s)
    navigationTimeout: 10000, // 10 seconds (was 30s)
  },

  // Minimal reporter for CI
  reporter: process.env.CI ? [['json', { outputFile: 'test-results.json' }]] : 'html',

  // Support for sharded execution
  ...(process.env.SHARD ? {
    shard: {
      current: parseInt(process.env.SHARD_CURRENT || '1'),
      total: parseInt(process.env.SHARD_TOTAL || '1'),
    },
  } : {}),

  // Faster web server configuration
  ...(baseWebServer ? {
    webServer: {
      ...baseWebServer,
      command: process.env.CI
        ? 'TEST_MODE=true WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only npm run build && npm run start'
        : baseWebServer.command,
      timeout: 180000, // 3 minutes for build + start
      reuseExistingServer: false, // Always fresh in CI
    }
  } : {}),
});