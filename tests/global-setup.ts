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

  // Clean database before test run
  await cleanupDatabase();

  console.log('✅ Global setup complete\n');
}

export default globalSetup;
