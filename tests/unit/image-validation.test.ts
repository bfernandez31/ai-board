/**
 * Unit tests for image validation module
 */

import { describe, it, expect } from 'vitest';
import { validateImageFile, isAllowedMimeType } from '../../app/lib/validations/image';
import { MAX_IMAGE_SIZE_BYTES } from '../../app/lib/schemas/ticket';

describe('validateImageFile', () => {
  // Helper to create a simple PNG buffer with valid magic bytes
  const createPngBuffer = (sizeBytes: number): Buffer => {
    const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const buffer = Buffer.alloc(sizeBytes);
    pngMagicBytes.copy(buffer, 0);
    return buffer;
  };

  // Helper to create a simple JPEG buffer with valid magic bytes
  const createJpegBuffer = (sizeBytes: number): Buffer => {
    const jpegMagicBytes = Buffer.from([0xff, 0xd8, 0xff]);
    const buffer = Buffer.alloc(sizeBytes);
    jpegMagicBytes.copy(buffer, 0);
    return buffer;
  };

  // Helper to create an SVG buffer
  const createSvgBuffer = (): Buffer => {
    return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  };

  it('should accept valid PNG image', async () => {
    const buffer = createPngBuffer(5000); // 5KB
    const result = await validateImageFile(buffer, 'image/png', 5000);

    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.error).toBeUndefined();
  });

  it('should accept valid JPEG image', async () => {
    const buffer = createJpegBuffer(5000); // 5KB
    const result = await validateImageFile(buffer, 'image/jpeg', 5000);

    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.error).toBeUndefined();
  });

  it('should accept valid SVG image', async () => {
    const buffer = createSvgBuffer();
    const result = await validateImageFile(buffer, 'image/svg+xml', buffer.length);

    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.error).toBeUndefined();
  });

  it('should accept SVG starting with XML declaration', async () => {
    const buffer = Buffer.from('<?xml version="1.0"?><svg></svg>');
    const result = await validateImageFile(buffer, 'image/svg+xml', buffer.length);

    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/svg+xml');
  });

  it('should reject file larger than 10MB', async () => {
    const buffer = createPngBuffer(1000);
    const largeSize = MAX_IMAGE_SIZE_BYTES + 1;
    const result = await validateImageFile(buffer, 'image/png', largeSize);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
    expect(result.error).toContain('10MB');
  });

  it('should reject empty file', async () => {
    const buffer = Buffer.alloc(0);
    const result = await validateImageFile(buffer, 'image/png', 0);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('File is empty');
  });

  it('should reject disallowed MIME type', async () => {
    const buffer = createPngBuffer(1000);
    const result = await validateImageFile(buffer, 'application/pdf', 1000);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid MIME type');
    expect(result.error).toContain('application/pdf');
  });

  it('should reject file with mismatched signature (PNG declared as JPEG)', async () => {
    const buffer = createPngBuffer(1000); // PNG magic bytes
    const result = await validateImageFile(buffer, 'image/jpeg', 1000); // Declared as JPEG

    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature mismatch');
    expect(result.error).toContain('image/png'); // Detected as PNG
  });

  it('should reject file with mismatched signature (JPEG declared as PNG)', async () => {
    const buffer = createJpegBuffer(1000); // JPEG magic bytes
    const result = await validateImageFile(buffer, 'image/png', 1000); // Declared as PNG

    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature mismatch');
    expect(result.error).toContain('image/jpeg'); // Detected as JPEG
  });

  it('should reject text file disguised as image', async () => {
    const buffer = Buffer.from('This is a text file, not an image');
    const result = await validateImageFile(buffer, 'image/png', buffer.length);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unable to determine file type');
  });

  it('should reject corrupted image file', async () => {
    // Create buffer with random data (no valid magic bytes)
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    const result = await validateImageFile(buffer, 'image/png', buffer.length);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unable to determine file type');
  });

  it('should reject SVG that does not start with <svg or <?xml', async () => {
    const buffer = Buffer.from('<!DOCTYPE html><html></html>');
    const result = await validateImageFile(buffer, 'image/svg+xml', buffer.length);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not appear to be a valid SVG');
  });

  it('should handle validation errors gracefully', async () => {
    // Create an invalid buffer that might cause file-type to throw
    const buffer = Buffer.alloc(1);
    const result = await validateImageFile(buffer, 'image/png', 1);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should accept maximum allowed file size', async () => {
    const buffer = createPngBuffer(1000);
    const result = await validateImageFile(buffer, 'image/png', MAX_IMAGE_SIZE_BYTES);

    expect(result.valid).toBe(true);
  });

  it('should reject file size by exactly 1 byte over limit', async () => {
    const buffer = createPngBuffer(1000);
    const result = await validateImageFile(buffer, 'image/png', MAX_IMAGE_SIZE_BYTES + 1);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });
});

describe('isAllowedMimeType', () => {
  it('should return true for allowed MIME types', () => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    allowedTypes.forEach((type) => {
      expect(isAllowedMimeType(type)).toBe(true);
    });
  });

  it('should return false for disallowed MIME types', () => {
    const disallowedTypes = [
      'application/pdf',
      'text/plain',
      'video/mp4',
      'audio/mp3',
      'image/bmp', // Valid image but not in allowlist
      'image/tiff', // Valid image but not in allowlist
    ];

    disallowedTypes.forEach((type) => {
      expect(isAllowedMimeType(type)).toBe(false);
    });
  });

  it('should be case-sensitive', () => {
    expect(isAllowedMimeType('image/PNG')).toBe(false);
    expect(isAllowedMimeType('IMAGE/png')).toBe(false);
  });

  it('should not accept partial matches', () => {
    expect(isAllowedMimeType('image/')).toBe(false);
    expect(isAllowedMimeType('png')).toBe(false);
  });
});
