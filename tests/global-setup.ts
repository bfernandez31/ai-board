import { cleanupDatabase } from './helpers/db-cleanup';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup() {
  console.log('\n🧹 Running global test setup...');

  // Clean database before test run
  await cleanupDatabase();

  console.log('✅ Global setup complete\n');
}

export default globalSetup;
