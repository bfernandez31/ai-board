import { cleanupDatabase } from './helpers/db-cleanup';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup() {
  console.log('\n🧹 Running global test setup...');

  // Load environment variables from .env file
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

  // Clean database and get test user ID
  const testUserId = await cleanupDatabase();

  // Store test user ID in environment for Playwright to use
  process.env.TEST_USER_ID = testUserId.toString();

  console.log(`✅ Global setup complete (test user ID: ${testUserId})\n`);
}

export default globalSetup;
