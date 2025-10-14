import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env file for test environment
dotenv.config({ path: path.resolve(__dirname, '.env') });

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
  testDir: './tests',
  fullyParallel: false, // Disabled to prevent race conditions with database
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for faster feedback during auth setup
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
    // Global auth header for all tests (bypasses NextAuth)
    extraHTTPHeaders: {
      'x-test-user-id': testUserId, // Set by global-setup.ts
    },
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
    env: {
      NODE_ENV: 'test',
    },
  },
});

export default config;
