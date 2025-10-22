import { disconnectPrisma } from './helpers/db-cleanup';

/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
async function globalTeardown() {
  console.log('\n🧹 Running global test teardown...');

  // Disconnect Prisma client
  await disconnectPrisma();

  console.log('✅ Global teardown complete\n');
}

export default globalTeardown;
