/**
 * Zod validation schemas for ticket-related data
 */

import { z } from 'zod';

/**
 * Ticket key validation schema
 * Format: {PROJECT_KEY}-{TICKET_NUMBER} (e.g., "ABC-123" or "MOBILE-5")
 * - Project key: 3-6 uppercase alphanumeric characters
 * - Ticket number: positive integer
 */
export const ticketKeySchema = z
  .string()
  .regex(
    /^[A-Z0-9]{3,6}-\d+$/,
    'Ticket key must be in format KEY-NUM (e.g., ABC-123 or MOBILE-5)'
  );

/**
 * Ticket number validation schema
 * Positive integer representing sequential number within project
 */
export const ticketNumberSchema = z.number().positive('Ticket number must be positive');

/**
 * Allowed image MIME types
 */
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

/**
 * Maximum file size for uploaded images (10MB in bytes)
 */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Maximum number of attachments per ticket
 */
export const MAX_ATTACHMENTS_PER_TICKET = 5;

/**
 * Zod schema for a single ticket attachment
 */
export const TicketAttachmentSchema = z.object({
  type: z.enum(['uploaded', 'external'], {
    message: 'Attachment type must be "uploaded" or "external"',
  }),
  url: z
    .string()
    .url({ message: 'URL must be a valid URL' })
    .max(500, { message: 'URL must be less than 500 characters' }),
  filename: z
    .string()
    .min(1, { message: 'Filename cannot be empty' })
    .max(200, { message: 'Filename must be less than 200 characters' })
    .refine(
      (filename) => !filename.includes('/') && !filename.includes('\\'),
      { message: 'Filename cannot contain path separators' }
    ),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES, {
    message: 'Invalid image MIME type',
  }),
  sizeBytes: z
    .number()
    .int({ message: 'File size must be an integer' })
    .min(0, { message: 'File size cannot be negative' })
    .max(MAX_IMAGE_SIZE_BYTES, { message: `File size cannot exceed ${MAX_IMAGE_SIZE_BYTES} bytes (10MB)` }),
  uploadedAt: z
    .string()
    .datetime({ message: 'uploadedAt must be a valid ISO 8601 datetime string' }),
});

/**
 * Zod schema for an array of ticket attachments
 */
export const TicketAttachmentsArraySchema = z
  .array(TicketAttachmentSchema)
  .max(MAX_ATTACHMENTS_PER_TICKET, {
    message: `Maximum ${MAX_ATTACHMENTS_PER_TICKET} images per ticket`
  });

/**
 * TypeScript type inferred from TicketAttachmentSchema
 */
export type TicketAttachment = z.infer<typeof TicketAttachmentSchema>;
