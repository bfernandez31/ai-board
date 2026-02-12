import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

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
        overwrite: false,
        unique_filename: true,
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
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

export async function deleteImageFromCloudinary(
  publicId: string
): Promise<{ result: string }> {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete image from Cloudinary: ${errorMessage}`);
  }
}

export async function deleteCloudinaryFolder(
  folderPrefix: string
): Promise<{ deleted: number; errors: string[] }> {
  try {
    const errors: string[] = [];
    let deleted = 0;

    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folderPrefix,
        max_results: 500,
        next_cursor: nextCursor,
      });

      for (const resource of result.resources || []) {
        try {
          await cloudinary.uploader.destroy(resource.public_id);
          deleted++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to delete ${resource.public_id}: ${errorMessage}`);
        }
      }

      hasMore = !!result.next_cursor;
      nextCursor = result.next_cursor;
    }

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
    } catch {
      // Ignore if no subfolders exist
    }

    try {
      await cloudinary.api.delete_folder(folderPrefix);
    } catch {
      // Ignore folder deletion errors
    }

    return { deleted, errors };
  } catch (error) {
    console.error('[Cloudinary Debug] Error details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    throw new Error(`Failed to delete Cloudinary folder: ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`);
  }
}

export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export { cloudinary };
