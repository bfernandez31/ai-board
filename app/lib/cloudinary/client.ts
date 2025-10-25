import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary client configuration
 *
 * Environment variables required:
 * - CLOUDINARY_CLOUD_NAME: Your Cloudinary cloud name
 * - CLOUDINARY_API_KEY: Your Cloudinary API key
 * - CLOUDINARY_API_SECRET: Your Cloudinary API secret
 */

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true, // Use HTTPS for all URLs
});

/**
 * Upload image to Cloudinary
 *
 * @param buffer - Image file buffer
 * @param options - Upload options
 * @returns Cloudinary upload result with URL
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    filename: string;
    resourceType?: 'image' | 'raw' | 'video' | 'auto';
  }
): Promise<{
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.filename,
        resource_type: options.resourceType || 'image',
        overwrite: false, // Don't overwrite existing files
        unique_filename: true, // Auto-generate unique filename if conflict
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }

        if (!result) {
          reject(new Error('Cloudinary upload failed: No result returned'));
          return;
        }

        resolve({
          url: result.secure_url, // HTTPS URL
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    // Write buffer to upload stream
    uploadStream.end(buffer);
  });
}

/**
 * Delete image from Cloudinary
 *
 * @param publicId - Cloudinary public ID
 * @returns Deletion result
 */
export async function deleteImageFromCloudinary(
  publicId: string
): Promise<{ result: string }> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete image from Cloudinary: ${errorMessage}`);
  }
}

/**
 * Delete all images in a Cloudinary folder recursively
 *
 * @param folderPrefix - Folder prefix to delete (e.g., 'ai-board/tickets')
 * @returns Deletion result
 */
export async function deleteCloudinaryFolder(
  folderPrefix: string
): Promise<{ deleted: number; errors: string[] }> {
  try {
    const errors: string[] = [];
    let deleted = 0;

    // Step 1: Delete all resources (images) in the folder and subfolders
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folderPrefix,
        max_results: 500, // Cloudinary API limit
        next_cursor: nextCursor,
      });

      // Delete each resource
      for (const resource of result.resources || []) {
        try {
          await cloudinary.uploader.destroy(resource.public_id);
          deleted++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to delete ${resource.public_id}: ${errorMessage}`);
        }
      }

      // Check if there are more results
      hasMore = !!result.next_cursor;
      nextCursor = result.next_cursor;
    }

    // Step 2: Delete all subfolders recursively
    try {
      const subfolders = await cloudinary.api.sub_folders(folderPrefix);

      for (const subfolder of subfolders.folders || []) {
        const subfolderPath = `${folderPrefix}/${subfolder.name}`;
        try {
          await cloudinary.api.delete_folder(subfolderPath);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to delete subfolder ${subfolderPath}: ${errorMessage}`);
        }
      }
    } catch (error) {
      // Ignore if no subfolders exist
    }

    // Step 3: Delete the root folder itself
    try {
      await cloudinary.api.delete_folder(folderPrefix);
    } catch (error) {
      // Ignore folder deletion errors (folder might not be empty or might not exist)
    }

    return { deleted, errors };
  } catch (error) {
    console.error('[Cloudinary Debug] Error details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    throw new Error(`Failed to delete Cloudinary folder: ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`);
  }
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export { cloudinary };
