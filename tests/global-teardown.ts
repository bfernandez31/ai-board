import { disconnectPrisma, cleanupCloudinaryImages } from './helpers/db-cleanup';

/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */
async function globalTeardown() {
  console.log('\n🧹 Running global test teardown...');

  // Clean up Cloudinary test images
  await cleanupCloudinaryImages();

  // Disconnect Prisma client
  await disconnectPrisma();

  console.log('✅ Global teardown complete\n');
}

export default globalTeardown;
