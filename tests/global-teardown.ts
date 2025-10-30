import { disconnectPrisma } from './helpers/db-cleanup';

/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
async function globalTeardown() {
  console.error('\n🧹 Running global test teardown...');

  // Disconnect Prisma client
  await disconnectPrisma();

  console.error('✅ Global teardown complete\n');
}

export default globalTeardown;
