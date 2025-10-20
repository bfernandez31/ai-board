/**
 * Image validation module
 *
 * Provides multi-layer validation for uploaded images:
 * 1. MIME type check (Content-Type header)
 * 2. Magic byte signature verification (file-type library)
 * 3. File size validation
 */

import { fileTypeFromBuffer } from 'file-type';
import { MAX_IMAGE_SIZE_BYTES } from '../schemas/ticket';

/**
 * Allowed image MIME types
 */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/**
 * Result of image validation
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

/**
 * Validate an uploaded image file
 *
 * Performs multi-layer validation:
 * - MIME type validation against allowlist
 * - Magic byte signature verification to prevent spoofing
 * - File size validation (max 10MB)
 *
 * @param buffer - Image file content as Buffer
 * @param declaredMimeType - MIME type from Content-Type header
 * @param fileSize - File size in bytes
 * @returns Validation result with error message if invalid
 */
export async function validateImageFile(
  buffer: Buffer,
  declaredMimeType: string,
  fileSize: number
): Promise<ImageValidationResult> {
  // Validate file size
  if (fileSize > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${fileSize} bytes) exceeds maximum allowed size (${MAX_IMAGE_SIZE_BYTES} bytes / 10MB)`,
    };
  }

  if (fileSize === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  // Validate declared MIME type
  if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
    return {
      valid: false,
      error: `Invalid MIME type: ${declaredMimeType}. Allowed types: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
    };
  }

  // Verify file signature (magic bytes) matches declared MIME type
  try {
    const fileTypeResult = await fileTypeFromBuffer(buffer);

    // Handle SVG separately (file-type doesn't detect SVG from magic bytes)
    if (declaredMimeType === 'image/svg+xml') {
      // Simple SVG validation: check if content starts with '<svg' or '<?xml'
      const bufferStart = buffer.toString('utf8', 0, Math.min(100, buffer.length)).trim();
      if (bufferStart.startsWith('<svg') || bufferStart.startsWith('<?xml')) {
        return {
          valid: true,
          mimeType: 'image/svg+xml',
        };
      }

      return {
        valid: false,
        error: 'File does not appear to be a valid SVG image',
      };
    }

    // For other image types, verify magic bytes match
    if (!fileTypeResult) {
      return {
        valid: false,
        error: 'Unable to determine file type from content. File may be corrupted or not a valid image.',
      };
    }

    if (fileTypeResult.mime !== declaredMimeType) {
      return {
        valid: false,
        error: `File signature mismatch: declared as ${declaredMimeType} but content indicates ${fileTypeResult.mime}`,
      };
    }

    return {
      valid: true,
      mimeType: fileTypeResult.mime,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Error validating file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if a MIME type is allowed for image uploads
 *
 * @param mimeType - MIME type to check
 * @returns true if MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}
