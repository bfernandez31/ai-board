import { defineConfig } from 'vitest/config';
import path from 'path';

const isIntegration = !!process.env.VITEST_INTEGRATION;

export default defineConfig({
  test: {
    globals: true,
    // Use happy-dom for unit tests (faster than jsdom), node for integration tests
    environment: isIntegration ? 'node' : 'happy-dom',
    // Include appropriate test files based on mode
    include: isIntegration
      ? ['tests/integration/**/*.test.ts']
      : ['tests/unit/**/*.test.ts'],
    // Exclude Playwright tests and cross-mode tests
    exclude: ['tests/e2e/**', 'tests/**/*.spec.ts'],
    // Setup files for integration tests (worker isolation, database)
    setupFiles: isIntegration ? ['./tests/fixtures/vitest/setup.ts'] : [],
    // Global setup for integration tests (one-time database prep)
    globalSetup: isIntegration ? './tests/fixtures/vitest/global-setup.ts' : undefined,
    // Pool configuration for worker isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit to 6 workers to match project mapping [1, 2, 4, 5, 6, 7]
        maxForks: isIntegration ? 6 : undefined,
        minForks: isIntegration ? 1 : undefined,
      },
    },
    // Timeout configuration
    testTimeout: isIntegration ? 30000 : 5000,
    hookTimeout: isIntegration ? 30000 : 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
