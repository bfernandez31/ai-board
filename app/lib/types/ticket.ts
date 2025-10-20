/**
 * Ticket-related TypeScript interfaces
 */

/**
 * Represents metadata for a single image attachment
 * Stored in Ticket.attachments JSON field
 */
export interface TicketAttachment {
  /** Attachment source type */
  type: 'uploaded' | 'external';

  /** GitHub path (for uploaded) or external URL (for external) */
  url: string;

  /** Original filename or alt text from markdown */
  filename: string;

  /** MIME type of the image (e.g., "image/png") */
  mimeType: string;

  /** File size in bytes (0 for external URLs) */
  sizeBytes: number;

  /** ISO 8601 timestamp when attachment was created */
  uploadedAt: string;
}

/**
 * Type guard to check if a value is a valid TicketAttachment
 */
export function isTicketAttachment(value: unknown): value is TicketAttachment {
  if (typeof value !== 'object' || value === null) return false;

  const attachment = value as Record<string, unknown>;

  return (
    (attachment.type === 'uploaded' || attachment.type === 'external') &&
    typeof attachment.url === 'string' &&
    typeof attachment.filename === 'string' &&
    typeof attachment.mimeType === 'string' &&
    typeof attachment.sizeBytes === 'number' &&
    typeof attachment.uploadedAt === 'string'
  );
}

/**
 * Type guard to check if a value is an array of TicketAttachments
 */
export function isTicketAttachmentArray(value: unknown): value is TicketAttachment[] {
  return Array.isArray(value) && value.every(isTicketAttachment);
}
