import { deleteCloudinaryFolder, isCloudinaryConfigured } from '@/app/lib/cloudinary/client';

/**
 * Clean up Cloudinary images for a specific ticket
 *
 * This helper deletes images from a specific ticket's Cloudinary folder.
 * Use this immediately after each test that uploads images for efficient cleanup.
 *
 * Strategy:
 * - Delete only the folder for the specified ticket ID
 * - Preserves all other images (production, development, other tests)
 * - More efficient than scanning all tickets
 *
 * Usage: Call in test.afterEach() with the ticket ID created in the test
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
