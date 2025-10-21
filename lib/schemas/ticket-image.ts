import { z } from 'zod';

/**
 * Allowed image MIME types for ticket attachments
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

/**
 * Maximum file size: 10MB
 * Based on edge case requirements from spec
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Schema for validating uploaded image files
 * Validates MIME type and size limits
 */
export const imageFileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, 'File cannot be empty')
    .refine(
      (file) => file.size <= MAX_FILE_SIZE_BYTES,
      `File size must be less than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
    )
    .refine(
      (file) => ALLOWED_MIME_TYPES.includes(file.type as any),
      `File type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`
    ),
  version: z.number().int().positive(),
});

/**
 * Schema for validating attachment index parameter
 * Used in DELETE and PUT operations
 */
export const attachmentIndexSchema = z
  .number()
  .int()
  .nonnegative()
  .refine((index) => index < 100, 'Attachment index out of range'); // Reasonable upper bound

/**
 * Schema for delete/replace request body
 * Ensures version field is present for optimistic concurrency control
 */
export const imageOperationSchema = z.object({
  version: z.number().int().positive(),
});

/**
 * Helper function to parse and validate attachment index from URL parameter
 */
export function parseAttachmentIndex(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error('Invalid attachment index: must be a number');
  }
  return attachmentIndexSchema.parse(parsed);
}
