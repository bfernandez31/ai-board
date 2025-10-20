/**
 * Unit tests for Ticket Attachment Zod schemas
 */

import { describe, it, expect } from 'vitest';
import {
  TicketAttachmentSchema,
  TicketAttachmentsArraySchema,
  MAX_IMAGE_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TICKET,
} from '../../app/lib/schemas/ticket';

describe('TicketAttachmentSchema', () => {
  it('should accept valid uploaded image attachment', () => {
    const validAttachment = {
      type: 'uploaded',
      url: 'ticket-assets/123/mockup.png',
      filename: 'mockup.png',
      mimeType: 'image/png',
      sizeBytes: 2457600, // ~2.4MB
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(validAttachment);
    expect(result.success).toBe(true);
  });

  it('should accept valid external URL attachment', () => {
    const validAttachment = {
      type: 'external',
      url: 'https://figma.com/file/abc123/design.png',
      filename: 'Figma design mockup',
      mimeType: 'image/png',
      sizeBytes: 0,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(validAttachment);
    expect(result.success).toBe(true);
  });

  it('should accept all allowed MIME types', () => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    allowedMimeTypes.forEach((mimeType) => {
      const attachment = {
        type: 'uploaded',
        url: `ticket-assets/123/image.${mimeType.split('/')[1]}`,
        filename: `image.${mimeType.split('/')[1]}`,
        mimeType,
        sizeBytes: 1000,
        uploadedAt: '2025-10-20T14:30:00.000Z',
      };

      const result = TicketAttachmentSchema.safeParse(attachment);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid attachment type', () => {
    const invalidAttachment = {
      type: 'unknown', // Invalid type
      url: 'ticket-assets/123/mockup.png',
      filename: 'mockup.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Attachment type must be');
    }
  });

  it('should reject invalid URL format', () => {
    const invalidAttachment = {
      type: 'uploaded',
      url: 'not-a-url', // Invalid URL
      filename: 'mockup.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
  });

  it('should reject URL longer than 500 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(500);
    const invalidAttachment = {
      type: 'external',
      url: longUrl,
      filename: 'image.png',
      mimeType: 'image/png',
      sizeBytes: 0,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('less than 500 characters');
    }
  });

  it('should reject empty filename', () => {
    const invalidAttachment = {
      type: 'uploaded',
      url: 'ticket-assets/123/image.png',
      filename: '', // Empty filename
      mimeType: 'image/png',
      sizeBytes: 1000,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('cannot be empty');
    }
  });

  it('should reject filename with path separators', () => {
    const invalidAttachments = [
      { filename: '../../../etc/passwd' },
      { filename: 'path\\to\\file.png' },
    ];

    invalidAttachments.forEach(({ filename }) => {
      const attachment = {
        type: 'uploaded',
        url: 'ticket-assets/123/file.png',
        filename,
        mimeType: 'image/png',
        sizeBytes: 1000,
        uploadedAt: '2025-10-20T14:30:00.000Z',
      };

      const result = TicketAttachmentSchema.safeParse(attachment);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('path separators');
      }
    });
  });

  it('should reject invalid MIME type', () => {
    const invalidAttachment = {
      type: 'uploaded',
      url: 'ticket-assets/123/document.pdf',
      filename: 'document.pdf',
      mimeType: 'application/pdf', // Not an allowed image MIME type
      sizeBytes: 1000,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid image MIME type');
    }
  });

  it('should reject file size larger than 10MB', () => {
    const invalidAttachment = {
      type: 'uploaded',
      url: 'ticket-assets/123/large.png',
      filename: 'large.png',
      mimeType: 'image/png',
      sizeBytes: MAX_IMAGE_SIZE_BYTES + 1, // 10MB + 1 byte
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('cannot exceed');
    }
  });

  it('should reject negative file size', () => {
    const invalidAttachment = {
      type: 'uploaded',
      url: 'ticket-assets/123/image.png',
      filename: 'image.png',
      mimeType: 'image/png',
      sizeBytes: -100, // Negative size
      uploadedAt: '2025-10-20T14:30:00.000Z',
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('cannot be negative');
    }
  });

  it('should reject invalid ISO 8601 datetime', () => {
    const invalidAttachment = {
      type: 'uploaded',
      url: 'ticket-assets/123/image.png',
      filename: 'image.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
      uploadedAt: '2025-10-20 14:30:00', // Missing 'T' separator
    };

    const result = TicketAttachmentSchema.safeParse(invalidAttachment);
    expect(result.success).toBe(false);
  });
});

describe('TicketAttachmentsArraySchema', () => {
  it('should accept empty array', () => {
    const result = TicketAttachmentsArraySchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('should accept array with 5 valid attachments', () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS_PER_TICKET }, (_, i) => ({
      type: 'uploaded' as const,
      url: `ticket-assets/123/image-${i}.png`,
      filename: `image-${i}.png`,
      mimeType: 'image/png',
      sizeBytes: 1000,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    }));

    const result = TicketAttachmentsArraySchema.safeParse(attachments);
    expect(result.success).toBe(true);
  });

  it('should reject array with more than 5 attachments', () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS_PER_TICKET + 1 }, (_, i) => ({
      type: 'uploaded' as const,
      url: `ticket-assets/123/image-${i}.png`,
      filename: `image-${i}.png`,
      mimeType: 'image/png',
      sizeBytes: 1000,
      uploadedAt: '2025-10-20T14:30:00.000Z',
    }));

    const result = TicketAttachmentsArraySchema.safeParse(attachments);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Maximum 5 images');
    }
  });

  it('should reject array with mix of valid and invalid attachments', () => {
    const attachments = [
      {
        type: 'uploaded' as const,
        url: 'ticket-assets/123/valid.png',
        filename: 'valid.png',
        mimeType: 'image/png',
        sizeBytes: 1000,
        uploadedAt: '2025-10-20T14:30:00.000Z',
      },
      {
        type: 'uploaded' as const,
        url: 'ticket-assets/123/invalid.png',
        filename: 'invalid.png',
        mimeType: 'application/pdf', // Invalid MIME type
        sizeBytes: 1000,
        uploadedAt: '2025-10-20T14:30:00.000Z',
      },
    ];

    const result = TicketAttachmentsArraySchema.safeParse(attachments);
    expect(result.success).toBe(false);
  });
});
