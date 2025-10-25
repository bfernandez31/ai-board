import { deleteCloudinaryFolder, isCloudinaryConfigured } from '@/app/lib/cloudinary/client';
import { prisma } from '@/app/lib/db/client';

/**
 * Clean up Cloudinary images uploaded during tests
 *
 * This helper deletes images ONLY from test ticket folders ([e2e] prefix)
 * to prevent accumulation of test artifacts while preserving production/dev images.
 *
 * Strategy:
 * 1. Query database for all [e2e] test tickets
 * 2. Delete Cloudinary folders for those specific ticket IDs only
 * 3. Preserve all other images (production, development, manual uploads)
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
    // Find all test tickets (those with [e2e] prefix)
    const testTickets = await prisma.ticket.findMany({
      where: {
        title: {
          startsWith: '[e2e]',
        },
      },
      select: {
        id: true,
      },
    });

    if (testTickets.length === 0) {
      console.log('[Cloudinary Cleanup] No test tickets found');
      return;
    }

    let totalDeleted = 0;
    const allErrors: string[] = [];

    // Delete Cloudinary folders for each test ticket
    for (const ticket of testTickets) {
      const folderPath = `ai-board/tickets/${ticket.id}`;

      try {
        const result = await deleteCloudinaryFolder(folderPath);
        totalDeleted += result.deleted;

        if (result.errors.length > 0) {
          allErrors.push(...result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        allErrors.push(`Failed to cleanup ticket ${ticket.id}: ${errorMessage}`);
      }
    }

    if (totalDeleted > 0) {
      console.log(`[Cloudinary Cleanup] Deleted ${totalDeleted} test images from ${testTickets.length} tickets`);
    }

    if (allErrors.length > 0) {
      console.warn('[Cloudinary Cleanup] Errors:', allErrors);
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
