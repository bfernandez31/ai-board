import { ensureTestFixtures, cleanupDatabase } from './helpers/db-cleanup';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup() {
  console.log('\n🧹 Running global test setup...');

  // Load environment variables from .env file
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

  // Set TEST_MODE to enable mock GitHub responses
  process.env.TEST_MODE = 'true';

  // Clean any leftover test data
  await cleanupDatabase();

  // Create test fixtures (user + projects 1 and 2)
  const testUserId = await ensureTestFixtures();

  // Store test user ID in environment and file for Playwright to use
  process.env.TEST_USER_ID = testUserId;
  const testUserIdPath = path.resolve(process.cwd(), '.test-user-id');
  fs.writeFileSync(testUserIdPath, testUserId, 'utf-8');

  console.log(`✅ Global setup complete (test user ID: ${testUserId})\n`);
}

export default globalSetup;
