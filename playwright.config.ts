import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {
  TEST_AUTH_OVERRIDE_HEADER,
  TEST_USER_HEADER,
} from './lib/auth/test-user-override';

// Load .env.test.local for test environment (contains test tokens)
// This ensures tests use the same tokens as the test server
// Use override: true to ensure test tokens take precedence over shell env
dotenv.config({ path: path.resolve(__dirname, '.env.test.local'), override: true });

// Read test user ID from file (set by global-setup.ts)
const testUserIdPath = path.resolve(__dirname, '.test-user-id');
let testUserId = 'test-user-id'; // Default fallback
try {
  if (fs.existsSync(testUserIdPath)) {
    testUserId = fs.readFileSync(testUserIdPath, 'utf-8').trim();
  }
} catch (error) {
  console.warn('Could not read test user ID file, using default');
}

const config = defineConfig({
  testDir: './tests/e2e', // Only browser-required tests (Testing Trophy: E2E for critical paths only)
  testMatch: '**/*.spec.ts',
  fullyParallel: true, // ✅ Enabled: All tests now use worker-isolation helper
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for faster feedback during auth setup
  workers: 4, // ✅ Parallel execution: Tests use getWorkerProjectId() for isolation (projects 1,2,4,5,6,7)
  reporter: 'html',
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  timeout: 30000, // 30 seconds per test
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10000, // 10 seconds for actions
    navigationTimeout: 30000, // 30 seconds for navigation
    // Global auth header for all tests (bypasses NextAuth)
    extraHTTPHeaders: {
      [TEST_USER_HEADER]: testUserId, // Set by global-setup.ts
      [TEST_AUTH_OVERRIDE_HEADER]: 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'TEST_MODE=true WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI, // Reuse in dev (UI mode), restart in CI
    timeout: 120000, // 2 minutes for server startup
    stdout: 'pipe', // Show server output
    stderr: 'pipe',
    env: {
      TEST_MODE: 'true', // Custom env var for test mode (NODE_ENV is always 'development' with npm run dev)
      WORKFLOW_API_TOKEN: 'test-workflow-token-for-e2e-tests-only', // Required for workflow endpoints
    },
  },
});

export default config;
