/**
 * Manual Cloudinary Cleanup Script
 *
 * Removes all test images from Cloudinary CDN.
 * Use this to clean up leftover test data.
 *
 * Usage: npx tsx scripts/cleanup-cloudinary.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables from .env.local FIRST
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Then configure Cloudinary with loaded env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

async function main() {
  console.log('🧹 Cloudinary Cleanup Script\n');

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary is not configured');
    console.error('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    process.exit(1);
  }

  console.log(`📂 Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`📂 Deleting all images from ai-board folder...\n`);

  try {
    // Delete all resources recursively
    const errors: string[] = [];
    let deleted = 0;
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'ai-board',
        max_results: 500,
        next_cursor: nextCursor,
      });

      // Delete each resource
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

    // Delete all subfolders
    try {
      const subfolders = await cloudinary.api.sub_folders('ai-board/tickets');

      for (const subfolder of subfolders.folders || []) {
        const subfolderPath = `ai-board/tickets/${subfolder.name}`;
        try {
          await cloudinary.api.delete_folder(subfolderPath);
          console.log(`   ✓ Deleted folder: ${subfolderPath}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to delete subfolder ${subfolderPath}: ${errorMessage}`);
        }
      }
    } catch (error) {
      // Ignore if no subfolders
    }

    // Delete root folders
    try {
      await cloudinary.api.delete_folder('ai-board/tickets');
      console.log(`   ✓ Deleted folder: ai-board/tickets`);
    } catch (error) {
      // Ignore
    }

    try {
      await cloudinary.api.delete_folder('ai-board');
      console.log(`   ✓ Deleted folder: ai-board`);
    } catch (error) {
      // Ignore
    }

    const result = { deleted, errors };

    console.log(`✅ Cleanup completed successfully!`);
    console.log(`   • Images deleted: ${result.deleted}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
  } catch (error) {
    console.error('❌ Cleanup failed:');
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    } else {
      console.error('   Error:', error);
    }
    process.exit(1);
  }
}

main();
