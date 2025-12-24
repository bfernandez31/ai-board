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
 */
const PROJECT_MAPPING: readonly [1, 2, 4, 5, 6, 7] = [1, 2, 4, 5, 6, 7];

/**
 * Get project ID for a worker index
 */
export function getProjectId(workerId: number): number {
  if (workerId >= PROJECT_MAPPING.length) {
    throw new Error(
      `Worker ${workerId} exceeds configured projects. ` +
        `Max workers: ${PROJECT_MAPPING.length}. ` +
        `Configure more projects to support more workers.`
    );
  }
  return PROJECT_MAPPING[workerId]!;
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

  // Load environment variables
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

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
