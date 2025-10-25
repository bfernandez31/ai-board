/**
 * Manual Cloudinary Cleanup Script
 *
 * Removes test images from Cloudinary CDN for [e2e] tickets ONLY.
 * Preserves production and development images.
 *
 * Strategy:
 * 1. Query database for all [e2e] test tickets
 * 2. Delete Cloudinary folders for those specific ticket IDs only
 * 3. Preserve all other images (production, development, manual uploads)
 *
 * Usage: npx tsx scripts/cleanup-cloudinary.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';

// Load environment variables from .env.local FIRST
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Then configure Cloudinary with loaded env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cloudinary Cleanup Script (Test Images Only)\n');

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary is not configured');
    console.error('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    process.exit(1);
  }

  console.log(`📂 Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`📂 Finding [e2e] test tickets...\n`);

  try {
    // Find all test tickets
    const testTickets = await prisma.ticket.findMany({
      where: {
        title: {
          startsWith: '[e2e]',
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (testTickets.length === 0) {
      console.log('✅ No test tickets found - nothing to clean up');
      await prisma.$disconnect();
      return;
    }

    console.log(`📋 Found ${testTickets.length} test tickets\n`);

    const errors: string[] = [];
    let totalDeleted = 0;

    // Delete Cloudinary folders for each test ticket
    for (const ticket of testTickets) {
      const folderPath = `ai-board/tickets/${ticket.id}`;

      console.log(`🗑️  Processing ticket ${ticket.id}: ${ticket.title}`);

      // Delete all images in this ticket's folder
      let deleted = 0;
      let hasMore = true;
      let nextCursor: string | undefined;

      while (hasMore) {
        const result = await cloudinary.api.resources({
          type: 'upload',
          prefix: folderPath,
          max_results: 500,
          next_cursor: nextCursor,
        });

        for (const resource of result.resources || []) {
          try {
            await cloudinary.uploader.destroy(resource.public_id);
            deleted++;
            console.log(`   ✓ Deleted: ${resource.public_id}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to delete ${resource.public_id}: ${errorMessage}`);
          }
        }

        hasMore = !!result.next_cursor;
        nextCursor = result.next_cursor;
      }

      // Delete the folder itself
      if (deleted > 0) {
        try {
          await cloudinary.api.delete_folder(folderPath);
          console.log(`   ✓ Deleted folder: ${folderPath}`);
        } catch (error) {
          // Ignore folder deletion errors
        }
      }

      totalDeleted += deleted;
      console.log(`   📊 Deleted ${deleted} images for ticket ${ticket.id}\n`);
    }

    const result = { deleted: totalDeleted, errors };

    console.log(`✅ Cleanup completed successfully!`);
    console.log(`   • Total images deleted: ${result.deleted}`);
    console.log(`   • Tickets processed: ${testTickets.length}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Cleanup failed:');
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    } else {
      console.error('   Error:', error);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
