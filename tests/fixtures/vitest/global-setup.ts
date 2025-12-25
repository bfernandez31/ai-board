/**
 * Global Setup for Vitest Integration Tests
 *
 * This file runs once before all tests in a worker.
 * Sets up worker isolation by mapping workerId to projectId.
 *
 * IMPORTANT: Integration tests require the dev server to be running.
 * Run `bun run dev` in another terminal before running integration tests.
 */

import { ensureTestFixtures, cleanupDatabase } from '../../helpers/db-cleanup';
import * as dotenv from 'dotenv';
import * as path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * Worker to project mapping
 * Skip project 3 (reserved for development)
 * Projects 8-10 added to support up to 9 parallel test files
 */
const PROJECT_MAPPING: readonly number[] = [1, 2, 4, 5, 6, 7, 8, 9, 10];

/**
 * Get project ID for a worker index
 * Uses modulo to recycle projects when workers exceed available projects
 */
export function getProjectId(workerId: number): number {
  // Use modulo to recycle projects - workers share projects if there are more workers than projects
  const index = workerId % PROJECT_MAPPING.length;
  return PROJECT_MAPPING[index]!;
}

/**
 * Check if the dev server is running
 */
async function checkServerRunning(): Promise<boolean> {
  try {
    // Try to fetch the root page - any 2xx or 3xx response means server is running
    const response = await fetch(BASE_URL, {
      signal: AbortSignal.timeout(5000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Global setup function for Vitest
 * Called once before all tests in a worker
 */
export default async function globalSetup(): Promise<void> {
  console.error('\n🧪 Running Vitest integration test setup...');

  // Load environment variables (.env.test.local takes precedence for test tokens)
  const envPath = path.resolve(process.cwd(), '.env');
  const envTestLocalPath = path.resolve(process.cwd(), '.env.test.local');
  dotenv.config({ path: envPath });
  dotenv.config({ path: envTestLocalPath, override: true });

  // Check if dev server is running
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    console.error(`
╔════════════════════════════════════════════════════════════════════╗
║  ❌ DEV SERVER NOT RUNNING                                         ║
║                                                                    ║
║  Integration tests require the dev server to be running.          ║
║  Please run in another terminal:                                  ║
║                                                                    ║
║    TEST_MODE=true bun run dev                                     ║
║                                                                    ║
║  Then re-run the integration tests.                               ║
╚════════════════════════════════════════════════════════════════════╝
`);
    throw new Error('Dev server not running. Run `TEST_MODE=true bun run dev` first.');
  }

  try {
    // Clean any leftover test data
    await cleanupDatabase();

    // Ensure test fixtures exist (user + worker projects)
    const testUserId = await ensureTestFixtures();

    // Store test user ID in environment
    process.env.TEST_USER_ID = testUserId;

    console.error(`✅ Vitest global setup complete (test user ID: ${testUserId})\n`);
  } catch (error) {
    // Log but don't fail - tests may need to run without database
    console.error('⚠️ Vitest global setup warning:', error);
  }
}

// Export for use in setup.ts
export { PROJECT_MAPPING };
