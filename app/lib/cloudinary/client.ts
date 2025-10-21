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
