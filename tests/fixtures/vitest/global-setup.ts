/**
 * Global Setup for Vitest Integration Tests
 *
 * This file runs once before all tests in a worker.
 * Sets up worker isolation by mapping workerId to projectId.
 *
 * Implementation of: specs/AIB-116-restructure-test-suite/contracts/test-context.ts
 */

import { ensureTestFixtures, cleanupDatabase } from '../../helpers/db-cleanup';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
 * Global setup function for Vitest
 * Called once before all tests in a worker
 */
export default async function globalSetup(): Promise<void> {
  console.error('\n🧹 Running Vitest integration test setup...');

  // Load environment variables
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

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
