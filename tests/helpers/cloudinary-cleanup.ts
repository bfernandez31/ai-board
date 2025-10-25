import { deleteCloudinaryFolder, isCloudinaryConfigured } from '@/app/lib/cloudinary/client';

/**
 * Clean up Cloudinary images uploaded during tests
 *
 * This helper deletes all images from test-specific folders to prevent
 * accumulation of test artifacts in the Cloudinary CDN.
 *
 * Usage: Call in test.afterEach() for tests that upload images
 */
export async function cleanupCloudinaryTestImages(): Promise<void> {
  // Skip cleanup if Cloudinary is not configured (e.g., CI without credentials)
  if (!isCloudinaryConfigured()) {
    console.log('[Cloudinary Cleanup] Skipped - Cloudinary not configured');
    return;
  }

  try {
    // Delete all images from the test folder
    // Cloudinary stores images in: ai-board/tickets/{ticketId}/
    // We clean up the entire ai-board folder for test isolation
    const result = await deleteCloudinaryFolder('ai-board');

    if (result.deleted > 0) {
      console.log(`[Cloudinary Cleanup] Deleted ${result.deleted} test images`);
    }

    if (result.errors.length > 0) {
      console.warn('[Cloudinary Cleanup] Errors:', result.errors);
    }
  } catch (error) {
    // Log error but don't fail the test
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cloudinary Cleanup] Failed:', errorMessage);
  }
}

/**
 * Clean up specific ticket images from Cloudinary
 *
 * @param ticketId - The ticket ID whose images should be deleted
 */
export async function cleanupCloudinaryTicketImages(ticketId: number): Promise<void> {
  if (!isCloudinaryConfigured()) {
    return;
  }

  try {
    const folderPath = `ai-board/tickets/${ticketId}`;
    const result = await deleteCloudinaryFolder(folderPath);

    if (result.deleted > 0) {
      console.log(`[Cloudinary Cleanup] Deleted ${result.deleted} images for ticket ${ticketId}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Cloudinary Cleanup] Failed for ticket ${ticketId}:`, errorMessage);
  }
}
