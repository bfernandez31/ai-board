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
      : ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    // Exclude Playwright tests and cross-mode tests
    exclude: ['tests/e2e/**', 'tests/**/*.spec.ts'],
    // Setup files for tests
    setupFiles: isIntegration
      ? ['./tests/fixtures/vitest/setup.ts']
      : ['./tests/fixtures/vitest/unit-setup.ts'],
    // Global setup for integration tests (one-time database prep)
    globalSetup: isIntegration ? './tests/fixtures/vitest/global-setup.ts' : undefined,
    // For integration tests: disable file parallelism to avoid database race conditions
    // This ensures test files run sequentially, sharing the same database state
    fileParallelism: isIntegration ? false : true,
    // Pool configuration
    pool: 'forks',
    // Single fork for integration tests (sequential execution)
    maxForks: isIntegration ? 1 : undefined,
    minForks: isIntegration ? 1 : undefined,
    // Timeout configuration
    testTimeout: isIntegration ? 30000 : 5000,
    hookTimeout: isIntegration ? 30000 : 10000,
    // Inline next-auth so Vite's resolver (and our `next/server` alias) applies
    // when its lib/env.js does `from "next/server"` without the .js suffix.
    // Without this, externalized next-auth hits Node's strict ESM resolver
    // which can't find the extensionless bare specifier in next v16.
    server: {
      deps: {
        inline: ['next-auth', '@auth/core'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // next-auth v5-beta.29 imports `from "next/server"` as ESM, but
      // next v16 has no `exports` map, so Node's strict ESM resolver
      // refuses to fall back on `server.js`. Force the .js suffix.
      'next/server': path.resolve(__dirname, 'node_modules/next/server.js'),
    },
  },
});
