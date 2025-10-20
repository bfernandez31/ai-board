# Implementation Guide: Image Attachments API

**Status**: Foundation Complete | Ready for API Implementation
**Next Task**: Modify ticket creation API to accept multipart/form-data

## Current Progress Summary

### ✅ Completed (Phase 1-2)
- Dependencies installed
- TypeScript interfaces & Zod schemas created
- Image validation module (MIME + magic bytes)
- GitHub operations module (commit, move, delete)
- Markdown parser module
- Unit tests (62+ test cases)
- Database migration applied
- Test fixtures created

### 🔄 In Progress (Phase 3 - User Story 1)
- Modifying ticket creation API for image uploads

## API Implementation Steps

### Step 1: Modify POST /api/projects/[projectId]/tickets/route.ts

**Current Implementation**: JSON only (`application/json`)
**Target**: Support both JSON and multipart/form-data

**Key Changes**:

```typescript
// Add imports at top
import formidable from 'formidable';
import { validateImageFile } from '@/lib/validations/image';
import { commitImageToRepo } from '@/lib/github/operations';
import { createGitHubClient } from '@/lib/github/client';
import { extractImageUrls } from '@/lib/parsers/markdown';
import { TicketAttachmentsArraySchema } from '@/app/lib/schemas/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';

// In POST handler, before existing JSON parsing:
const contentType = request.headers.get('content-type') || '';

if (contentType.includes('multipart/form-data')) {
  // Handle multipart upload (T015-T021)
  return await handleMultipartUpload(request, projectId);
} else {
  // Existing JSON logic remains unchanged
  // ... (current code continues)
}
```

### Step 2: Implement handleMultipartUpload Helper

```typescript
async function handleMultipartUpload(
  request: NextRequest,
  projectId: number
): Promise<NextResponse> {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    // Get uploaded files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image_') && value instanceof File) {
        files.push(value);
      }
    }

    // Validate file count (max 5)
    if (files.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 images per ticket', code: 'TOO_MANY_IMAGES' },
        { status: 400 }
      );
    }

    // Validate ticket data
    const result = CreateTicketSchema.safeParse({ title, description });
    if (!result.success) {
      // ... (same error handling as JSON)
    }

    // Create ticket first to get ticket ID
    const ticket = await createTicket(projectId, result.data);

    // Process uploaded images
    const attachments: TicketAttachment[] = [];
    const octokit = createGitHubClient();

    for (const file of files) {
      // Validate image
      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = await validateImageFile(
        buffer,
        file.type,
        file.size
      );

      if (!validation.valid) {
        // Rollback: delete ticket
        await prisma.ticket.delete({ where: { id: ticket.id } });
        return NextResponse.json(
          { error: validation.error, code: 'INVALID_IMAGE' },
          { status: 400 }
        );
      }

      // Commit image to GitHub
      try {
        const result = await commitImageToRepo(octokit, {
          owner: process.env.GITHUB_OWNER!,
          repo: process.env.GITHUB_REPO!,
          path: `ticket-assets/${ticket.id}/${file.name}`,
          content: buffer,
          message: `feat(ticket-${ticket.id}): add image ${file.name}`,
          authorName: 'AI Board',
          authorEmail: 'noreply@aiboard.dev',
        });

        // Create attachment metadata
        attachments.push({
          type: 'uploaded',
          url: `ticket-assets/${ticket.id}/${file.name}`,
          filename: file.name,
          mimeType: validation.mimeType!,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        });
      } catch (error) {
        // Rollback: delete ticket and any committed images
        await prisma.ticket.delete({ where: { id: ticket.id } });
        // TODO: Clean up committed images
        return NextResponse.json(
          { error: 'Failed to upload images to GitHub', code: 'GITHUB_ERROR' },
          { status: 500 }
        );
      }
    }

    // Extract markdown image URLs (User Story 2)
    const markdownImages = extractImageUrls(description);
    for (const { alt, url } of markdownImages) {
      attachments.push({
        type: 'external',
        url,
        filename: alt,
        mimeType: 'image/png', // Placeholder (we don't know actual type)
        sizeBytes: 0,
        uploadedAt: new Date().toISOString(),
      });
    }

    // Validate total attachment count
    if (attachments.length > 5) {
      await prisma.ticket.delete({ where: { id: ticket.id } });
      return NextResponse.json(
        { error: 'Maximum 5 total attachments (uploaded + external URLs)', code: 'TOO_MANY_ATTACHMENTS' },
        { status: 400 }
      );
    }

    // Update ticket with attachments
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { attachments },
    });

    // Return response with attachments
    return NextResponse.json(
      {
        ...ticketResponse,
        attachments: updatedTicket.attachments,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error handling multipart upload:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
```

### Step 3: Add Tests (T013)

**File**: `tests/api/projects-tickets-post.spec.ts`

```typescript
test('should create ticket with single uploaded image', async ({ request }) => {
  const formData = new FormData();
  formData.append('title', '[e2e] Test with image');
  formData.append('description', 'Testing image upload');

  const imageBuffer = fs.readFileSync('tests/fixtures/images/valid-image.png');
  const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
  formData.append('image_0', imageBlob, 'test-image.png');

  const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
    multipart: formData,
  });

  expect(response.status()).toBe(201);
  const body = await response.json();

  expect(body.attachments).toBeDefined();
  expect(body.attachments).toHaveLength(1);
  expect(body.attachments[0].type).toBe('uploaded');
  expect(body.attachments[0].filename).toBe('test-image.png');
});

test('should reject file larger than 10MB', async ({ request }) => {
  const formData = new FormData();
  formData.append('title', '[e2e] Test large image');
  formData.append('description', 'Should fail');

  const imageBuffer = fs.readFileSync('tests/fixtures/images/large-image.png');
  const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
  formData.append('image_0', imageBlob, 'large.png');

  const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
    multipart: formData,
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toContain('exceeds maximum');
});

test('should extract markdown image URLs', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/api/projects/1/tickets`, {
    data: {
      title: '[e2e] Test markdown images',
      description: 'Check this mockup: ![Figma](https://example.com/mockup.png)',
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();

  expect(body.attachments).toHaveLength(1);
  expect(body.attachments[0].type).toBe('external');
  expect(body.attachments[0].url).toBe('https://example.com/mockup.png');
});
```

## Environment Variables Required

Make sure these are set in `.env.local`:

```bash
DATABASE_URL="postgresql://..."
GITHUB_TOKEN="ghp_..."
GITHUB_OWNER="your-github-username"
GITHUB_REPO="ai-board"
```

## Testing Checklist

- [ ] Run unit tests: `npm run test:unit` (should all pass)
- [ ] Run API tests: `npx playwright test tests/api/`
- [ ] Test ticket creation WITHOUT images (backward compatibility)
- [ ] Test ticket creation WITH single image
- [ ] Test ticket creation WITH multiple images (2-5)
- [ ] Test rejection of files >10MB
- [ ] Test rejection of non-image files
- [ ] Test rejection of >5 images
- [ ] Test GitHub commit failure handling
- [ ] Test markdown URL extraction
- [ ] Test mixed uploads + markdown URLs
- [ ] Test total attachment limit (uploaded + external)

## Next Phases

After User Story 1 is complete and tested:

1. **User Story 4**: Modify GitHub workflows to pass images to Claude
2. **Frontend**: Build image upload UI component
3. **Polish**: Final testing, documentation, type checking

## Common Issues & Solutions

### Issue: Formidable not parsing files correctly
**Solution**: Ensure `Content-Type: multipart/form-data` header is set

### Issue: GitHub API rate limit
**Solution**: Check remaining requests: `curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit`

### Issue: File validation failing for valid images
**Solution**: Check magic bytes match MIME type - use `hexdump -C image.png | head` to inspect

### Issue: Transaction rollback not cleaning up images
**Solution**: Implement compensating transaction to delete committed images on failure

## Code Quality Checks

Before marking User Story 1 complete:

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Unit tests
npm run test:unit

# API tests
npx playwright test tests/api/projects-tickets-post.spec.ts

# Full E2E tests
npx playwright test
```

All checks must pass before proceeding to User Story 2.
