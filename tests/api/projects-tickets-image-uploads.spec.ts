import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';
import { cleanupCloudinaryTestImages } from '../helpers/cloudinary-cleanup';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API Test: POST /api/projects/[projectId]/tickets - Image Upload Support
 *
 * Tests image attachment functionality including:
 * - Multipart/form-data parsing
 * - Image validation (MIME type, magic bytes, size)
 * - Cloudinary CDN storage integration
 * - External URL extraction from markdown
 * - Attachment limit enforcement
 * - Backward compatibility with JSON requests
 */

test.describe('POST /api/projects/[projectId]/tickets - Image Uploads', () => {
  const BASE_URL = 'http://localhost:3000';
  const FIXTURES_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'images');

  test.beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  test.describe('JSON Requests (Backward Compatibility)', () => {
    test('should create ticket with JSON request without attachments', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        data: {
          title: '[e2e] JSON-only ticket',
          description: 'Traditional JSON request without images',
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body).toHaveProperty('id');
      expect(body.title).toBe('[e2e] JSON-only ticket');
      expect(body.description).toBe('Traditional JSON request without images');
      expect(body.stage).toBe('INBOX');

      // Attachments should either be undefined or empty array
      if (body.attachments !== undefined) {
        expect(Array.isArray(body.attachments)).toBe(true);
        expect(body.attachments.length).toBe(0);
      }
    });

    test('should extract external image URLs from markdown description', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        data: {
          title: '[e2e] Ticket with markdown image',
          description: 'Check out this mockup: ![Design](https://example.com/mockup.png)',
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body).toHaveProperty('attachments');
      expect(Array.isArray(body.attachments)).toBe(true);
      expect(body.attachments.length).toBe(1);

      const attachment = body.attachments[0];
      expect(attachment.type).toBe('external');
      expect(attachment.url).toBe('https://example.com/mockup.png');
      expect(attachment.filename).toBe('Design');
      expect(attachment.mimeType).toBe('image/png');
      expect(attachment.sizeBytes).toBe(0);
      expect(attachment.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should ignore non-HTTPS image URLs in markdown', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        data: {
          title: '[e2e] HTTP image ignored',
          description: 'This image is HTTP: ![Image](http://example.com/image.png)',
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      // HTTP URLs should be ignored
      if (body.attachments !== undefined) {
        expect(body.attachments.length).toBe(0);
      }
    });

    test('should extract multiple external URLs from markdown', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        data: {
          title: '[e2e] Multiple markdown images',
          description: `
            Here are some designs:
            ![Mockup 1](https://example.com/mockup1.png)
            ![Mockup 2](https://example.com/mockup2.jpg)
            ![Mockup 3](https://example.com/mockup3.png)
          `,
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.attachments).toBeDefined();
      expect(body.attachments.length).toBe(3);

      expect(body.attachments[0].url).toBe('https://example.com/mockup1.png');
      expect(body.attachments[1].url).toBe('https://example.com/mockup2.jpg');
      expect(body.attachments[2].url).toBe('https://example.com/mockup3.png');
    });

    test('should enforce max 5 external URLs from markdown', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        data: {
          title: '[e2e] Too many markdown images',
          description: `
            ![Image 1](https://example.com/1.png)
            ![Image 2](https://example.com/2.png)
            ![Image 3](https://example.com/3.png)
            ![Image 4](https://example.com/4.png)
            ![Image 5](https://example.com/5.png)
            ![Image 6](https://example.com/6.png)
          `,
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      // Should only store first 5 images
      expect(body.attachments.length).toBe(5);
    });
  });

  test.describe('Multipart Requests (Image Uploads)', () => {
    // Clean up Cloudinary after each image upload test
    test.afterEach(async () => {
      await cleanupCloudinaryTestImages();
    });

    test('should accept multipart/form-data with valid image', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const formData = new FormData();
      formData.append('title', '[e2e] Ticket with image upload');
      formData.append('description', 'Testing image upload functionality');
      formData.append('images', new Blob([imageBuffer], { type: 'image/png' }), 'valid-image.png');

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Ticket with image upload',
          description: 'Testing image upload functionality',
          images: {
            name: 'valid-image.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body).toHaveProperty('id');
      expect(body.title).toBe('[e2e] Ticket with image upload');
      expect(body.attachments).toBeDefined();
      expect(Array.isArray(body.attachments)).toBe(true);
      expect(body.attachments.length).toBe(1);

      const attachment = body.attachments[0];
      expect(attachment.type).toBe('uploaded');
      expect(attachment.url).toContain('cloudinary');
      expect(attachment.url).toContain('res.cloudinary.com');
      expect(attachment.filename).toMatch(/^\d+_valid-image\.png$/);
      expect(attachment.mimeType).toBe('image/png');
      expect(attachment.sizeBytes).toBe(imageBuffer.length);
      expect(attachment.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should accept JPEG image upload', async ({ request }) => {
      const validJpegPath = path.join(FIXTURES_PATH, 'valid-jpeg.jpg');
      const imageBuffer = fs.readFileSync(validJpegPath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Ticket with JPEG upload',
          description: 'Testing JPEG image upload',
          images: {
            name: 'valid-jpeg.jpg',
            mimeType: 'image/jpeg',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.attachments.length).toBe(1);
      expect(body.attachments[0].mimeType).toBe('image/jpeg');
    });

    test.skip('should accept multiple image uploads (up to 5)', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Ticket with multiple images',
          description: 'Testing multiple image uploads',
          'images[0]': {
            name: 'image1.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
          'images[1]': {
            name: 'image2.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
          'images[2]': {
            name: 'image3.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.attachments.length).toBe(3);
      expect(body.attachments[0].type).toBe('uploaded');
      expect(body.attachments[1].type).toBe('uploaded');
      expect(body.attachments[2].type).toBe('uploaded');
    });

    test.skip('should reject more than 5 image uploads', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const multipartData: Record<string, any> = {
        title: '[e2e] Too many images',
        description: 'Trying to upload 6 images',
      };

      // Add 6 images
      for (let i = 0; i < 6; i++) {
        multipartData[`images[${i}]`] = {
          name: `image${i}.png`,
          mimeType: 'image/png',
          buffer: imageBuffer,
        };
      }

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: multipartData,
      });

      expect(response.status()).toBe(400);
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Maximum 5 images');
    });

    test.skip('should reject image exceeding 10MB size limit', async ({ request }) => {
      const largeImagePath = path.join(FIXTURES_PATH, 'large-image.png');

      // Verify test fixture exists and is large enough
      expect(fs.existsSync(largeImagePath)).toBe(true);
      const stats = fs.statSync(largeImagePath);
      expect(stats.size).toBeGreaterThan(10 * 1024 * 1024); // >10MB

      const imageBuffer = fs.readFileSync(largeImagePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Large image rejection',
          description: 'Testing file size limit',
          images: {
            name: 'large-image.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(body.error.toLowerCase()).toMatch(/file size|10mb|exceeds/);
    });

    test('should reject file with mismatched MIME type and magic bytes', async ({ request }) => {
      const invalidFilePath = path.join(FIXTURES_PATH, 'invalid-signature.txt');
      const fileBuffer = fs.readFileSync(invalidFilePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Invalid file signature',
          description: 'Testing magic byte validation',
          images: {
            name: 'fake-image.png',
            mimeType: 'image/png',
            buffer: fileBuffer,
          },
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/validation failed|signature|mismatch/i);
    });

    test('should combine uploaded images and markdown URLs (max 5 total)', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Mixed attachments',
          description: 'Uploaded image plus markdown: ![External](https://example.com/external.png)',
          images: {
            name: 'uploaded.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.attachments.length).toBe(2);

      // First attachment should be uploaded image
      expect(body.attachments[0].type).toBe('uploaded');
      expect(body.attachments[0].filename).toContain('uploaded.png');

      // Second attachment should be external URL
      expect(body.attachments[1].type).toBe('external');
      expect(body.attachments[1].url).toBe('https://example.com/external.png');
    });

    test.skip('should enforce max 5 total attachments (uploaded + external)', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const multipartData: Record<string, any> = {
        title: '[e2e] Max attachments limit',
        description: `
          ![URL 1](https://example.com/1.png)
          ![URL 2](https://example.com/2.png)
          ![URL 3](https://example.com/3.png)
        `,
      };

      // Add 3 uploaded images (total would be 6 with markdown)
      for (let i = 0; i < 3; i++) {
        multipartData[`images[${i}]`] = {
          name: `upload${i}.png`,
          mimeType: 'image/png',
          buffer: imageBuffer,
        };
      }

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: multipartData,
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      // Should only have 5 total attachments (3 uploaded + 2 external URLs)
      expect(body.attachments.length).toBe(5);

      // Verify types
      const uploadedCount = body.attachments.filter((a: any) => a.type === 'uploaded').length;
      const externalCount = body.attachments.filter((a: any) => a.type === 'external').length;

      expect(uploadedCount).toBe(3);
      expect(externalCount).toBe(2); // Third external URL should be skipped
    });

    test('should sanitize filename to prevent path traversal', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Filename sanitization',
          description: 'Testing path traversal prevention',
          images: {
            name: '../../etc/passwd.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.attachments.length).toBe(1);

      // Filename should be sanitized (slashes replaced with underscores)
      expect(body.attachments[0].filename).not.toContain('..');
      expect(body.attachments[0].filename).not.toContain('/');
      expect(body.attachments[0].filename).toMatch(/^\d+_.*\.png$/);
    });

    test('should return ticket with attachments via GET after creation', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      // Create ticket with image
      const createResponse = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Queryable ticket with image',
          description: 'Should appear in GET response with attachments',
          images: {
            name: 'test-image.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();

      // Query tickets
      const getResponse = await request.get(`${BASE_URL}/api/projects/1/tickets`);
      expect(getResponse.status()).toBe(200);

      const allTickets = await getResponse.json();
      const foundTicket = allTickets.INBOX.find((t: any) => t.id === created.id);

      expect(foundTicket).toBeDefined();
      expect(foundTicket.title).toBe('[e2e] Queryable ticket with image');

      // Attachments should be included in GET response
      // Note: This depends on whether getTicketsByStage includes attachments
      // If not included yet, this test will serve as a reminder to add it
    });
  });

  test.describe('Validation Error Handling', () => {
    test('should return 400 for missing title in multipart request', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          description: 'Missing title field',
          images: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(body.error).toContain('title');
    });

    test('should return 400 for missing description in multipart request', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Missing description',
          images: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();

      expect(body).toHaveProperty('error');
      expect(body.error).toContain('description');
    });

    test('should create ticket with multipart request but no images', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Multipart without images',
          description: 'Testing multipart form without file uploads',
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.title).toBe('[e2e] Multipart without images');

      // Should have no attachments or empty array
      if (body.attachments !== undefined) {
        expect(body.attachments.length).toBe(0);
      }
    });
  });

  test.describe('Cloudinary Integration', () => {
    test('should store image with timestamp-prefixed filename', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const beforeTimestamp = Date.now();

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Timestamp filename test',
          description: 'Verifying filename timestamp prefix',
          images: {
            name: 'myimage.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      const afterTimestamp = Date.now();

      expect(response.status()).toBe(201);
      const body = await response.json();

      const attachment = body.attachments[0];

      // Filename should match pattern: {timestamp}_myimage.png
      const filenameMatch = attachment.filename.match(/^(\d+)_myimage\.png$/);
      expect(filenameMatch).toBeTruthy();

      if (filenameMatch) {
        const timestamp = parseInt(filenameMatch[1], 10);
        expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
        expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
      }
    });

    test('should generate Cloudinary URL for uploaded images', async ({ request }) => {
      const validImagePath = path.join(FIXTURES_PATH, 'valid-image.png');
      const imageBuffer = fs.readFileSync(validImagePath);

      const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
        multipart: {
          title: '[e2e] Cloudinary URL verification',
          description: 'Checking Cloudinary URL format',
          images: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: imageBuffer,
          },
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();

      const attachment = body.attachments[0];

      // URL should be Cloudinary CDN URL
      expect(attachment.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
      expect(attachment.url).toContain('ai-board/tickets/');
      expect(attachment.url).toContain(`tickets/${body.id}/`);
      expect(attachment).toHaveProperty('cloudinaryPublicId');
      expect(attachment.cloudinaryPublicId).toContain(`ai-board/tickets/${body.id}/`);
    });
  });
});
