import { defineConfig } from 'vitest/config';
import path from 'path';

const isIntegration = !!process.env.VITEST_INTEGRATION;

// Check if running component tests (need DOM environment)
const isComponentTest = process.env.VITEST_COMPONENT === 'true';

export default defineConfig({
  test: {
    globals: true,
    // Use happy-dom for unit tests and component tests, node for API integration tests
    environment: isIntegration && !isComponentTest ? 'node' : 'happy-dom',
    // Include appropriate test files based on mode
    include: isIntegration
      ? ['tests/integration/**/*.test.{ts,tsx}']
      : ['tests/unit/**/*.test.ts'],
    // Exclude Playwright tests and cross-mode tests
    exclude: ['tests/e2e/**', 'tests/**/*.spec.ts'],
    // Setup files for integration tests (worker isolation, database)
    setupFiles: isIntegration ? ['./tests/fixtures/vitest/setup.ts'] : [],
    // Global setup for integration tests (one-time database prep)
    globalSetup: isIntegration ? './tests/fixtures/vitest/global-setup.ts' : undefined,
    // For integration tests: disable file parallelism to avoid database race conditions
    // This ensures test files run sequentially, sharing the same database state
    fileParallelism: isIntegration ? false : true,
    // Pool configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        // Single fork for integration tests (sequential execution)
        maxForks: isIntegration ? 1 : undefined,
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
