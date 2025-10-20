# Quickstart: Image Attachments for Tickets

**Feature**: Image Attachments for Tickets
**Branch**: `038-image-support-spec`
**Prerequisites**: Node.js 22.20.0 LTS, PostgreSQL 14+, GitHub account with API access

## Developer Setup

### 1. Install New Dependencies

```bash
npm install formidable file-type
npm install --save-dev @types/formidable
```

**Dependencies Added**:
- `formidable` - Multipart form data parsing for file uploads
- `file-type` - Magic byte file signature detection for validation
- `@types/formidable` - TypeScript type definitions

### 2. Run Database Migration

```bash
# Generate migration file
npx prisma migrate dev --name add_ticket_attachments

# Apply migration (automatically runs during dev command)
# Adds Ticket.attachments JSON field with default []
```

**Verify Migration**:
```bash
# Open Prisma Studio
npx prisma studio

# Check Ticket table has new 'attachments' column
```

### 3. Update Environment Variables

No new environment variables required. Existing `GITHUB_TOKEN` is reused for image commits.

**Verify**:
```bash
# Check .env.local file
cat .env.local | grep GITHUB_TOKEN

# If missing, create GitHub Personal Access Token
# Scopes: repo (full control of private repositories)
# Add to .env.local:
GITHUB_TOKEN=ghp_your_token_here
```

### 4. Test Database Schema

```bash
# Run TypeScript type check
npx tsc --noEmit

# Verify Prisma client has updated types
# Should show Ticket.attachments as Json? type
```

## Implementation Checklist

### Phase 1: Database & Validation (Foundation)

- [ ] **Prisma Schema**: Add `attachments Json? @default("[]")` to Ticket model
- [ ] **Migration**: Run `prisma migrate dev` and verify in Prisma Studio
- [ ] **TypeScript Types**: Create `TicketAttachment` interface in `lib/types/ticket.ts`
- [ ] **Zod Schemas**: Create validation schemas in `lib/schemas/ticket.ts`
  - `TicketAttachmentSchema` (single attachment)
  - `TicketAttachmentsArraySchema` (array with max 5 items)
- [ ] **Unit Tests**: Write tests for Zod schemas (`tests/unit/ticket-attachment-schema.test.ts`)

### Phase 2: Image Validation Utilities

- [ ] **Validation Module**: Create `lib/validations/image.ts`
  - `validateImageFile(file: File): Promise<ValidationResult>`
  - MIME type check (image/*)
  - Magic byte signature verification (file-type library)
  - Size validation (≤10MB)
  - Format allowlist (JPEG, PNG, GIF, WebP, SVG)
- [ ] **Unit Tests**: Write tests for image validation (`tests/unit/image-validation.test.ts`)
  - Valid images pass
  - Oversized files rejected
  - Invalid MIME types rejected
  - Mismatched file signatures rejected

### Phase 3: GitHub Operations

- [ ] **GitHub Module**: Create `lib/github/operations.ts`
  - `commitImageToRepo(image: Buffer, path: string): Promise<string>`
  - `moveImagesToFeatureBranch(ticketId: number, branch: string): Promise<void>`
  - `deleteTicketAssets(ticketId: number): Promise<void>`
- [ ] **Integration Tests**: Test GitHub API operations (`tests/integration/github-operations.test.ts`)
  - Mock GitHub API responses
  - Test commit success and failure scenarios
  - Test rate limit handling

### Phase 4: Markdown Parser

- [ ] **Parser Module**: Create `lib/parsers/markdown.ts`
  - `extractImageUrls(markdown: string): Array<{alt: string, url: string}>`
  - Regex: `/!\[([^\]]*)\]\(([^)]+)\)/g`
  - URL validation (absolute HTTPS only)
- [ ] **Unit Tests**: Write tests for markdown parsing (`tests/unit/markdown-parser.test.ts`)
  - Extract single image URL
  - Extract multiple image URLs
  - Ignore non-image markdown
  - Validate URL format

### Phase 5: Backend API - Ticket Creation

- [ ] **API Route**: Modify `app/api/projects/[projectId]/tickets/route.ts`
  - Parse multipart/form-data with formidable
  - Validate uploaded images
  - Extract markdown image URLs from description
  - Commit images to GitHub (`ticket-assets/[id]/`)
  - Create ticket with attachments JSON
  - Handle errors with rollback
- [ ] **API Tests**: Extend `tests/api/tickets.spec.ts`
  - Test ticket creation with uploaded images
  - Test ticket creation with markdown URLs
  - Test validation errors (size, count, format)
  - Test GitHub commit failure handling
  - Test database rollback on failure

### Phase 6: Backend API - Image Upload (Optional)

- [ ] **API Route**: Create `app/api/uploads/image/route.ts`
  - Parse single image file
  - Validate image
  - Commit to temporary GitHub location
  - Return GitHub path
- [ ] **API Tests**: Create `tests/api/image-upload.spec.ts`
  - Test successful upload
  - Test validation errors
  - Test GitHub commit failures

### Phase 7: Frontend - Image Upload Component

- [ ] **Component**: Create `components/ui/image-upload.tsx`
  - Drag-and-drop zone (HTML5 DnD API)
  - File picker button (shadcn/ui Button + hidden input)
  - Clipboard paste handler (Clipboard API)
  - Image preview grid with thumbnails
  - Remove button for each image
  - File count and size display
  - Error messages for validation failures
- [ ] **Styling**: Use shadcn/ui primitives (Card, Button, Badge)
- [ ] **E2E Tests**: Create `tests/e2e/image-upload-component.spec.ts`
  - Test drag-and-drop flow
  - Test file picker flow
  - Test clipboard paste flow
  - Test remove image flow
  - Test validation error display

### Phase 8: Frontend - New Ticket Modal Integration

- [ ] **Modal**: Modify `components/board/new-ticket-modal.tsx`
  - Import and render ImageUpload component
  - Add attachments state management
  - Handle form submission with multipart/form-data
  - Display upload progress
  - Handle API errors
- [ ] **E2E Tests**: Extend `tests/e2e/ticket-creation.spec.ts`
  - Test creating ticket with images
  - Test creating ticket with markdown URLs
  - Test creating ticket with both
  - Test maximum 5 images enforcement
  - Test file size validation

### Phase 9: GitHub Workflow Updates

- [ ] **Workflow**: Modify `.github/workflows/speckit.yml`
  - Add step: Download external image URLs to `ticket-assets/[id]/`
  - Add input parameter: `attachments` (JSON string)
  - Add input parameter: `has_images` (boolean flag)
  - Modify specify step: Pass `imageContext` parameter to Claude
  - Add step: Move images from main to feature branch after branch creation
  - Add step: Delete `ticket-assets/[id]/` from main branch
- [ ] **Testing**: Manual workflow testing
  - Create test ticket with images
  - Trigger specify transition
  - Verify images available to Claude
  - Verify images moved to feature branch
  - Verify main branch cleanup

### Phase 10: Claude Command Integration

- [ ] **Command**: Modify `.claude/commands/specify.md`
  - Accept `imageContext` parameter (array of image paths)
  - Document image paths in generated spec.md
  - Reference images in specification content
- [ ] **Testing**: Manual testing
  - Create ticket with UI mockup image
  - Run /speckit.specify
  - Verify spec.md references the image
  - Verify visual context improves specification quality

## Testing Strategy

### Test Execution Order

1. **Unit Tests** (fastest, run frequently):
   ```bash
   npm run test:unit
   ```
   - Zod schema validation
   - Image validation functions
   - Markdown parser
   - Utility functions

2. **Integration Tests** (moderate speed, run before push):
   ```bash
   npm run test:integration
   ```
   - GitHub API operations (mocked)
   - Database operations
   - API route handlers

3. **E2E Tests** (slowest, run before PR):
   ```bash
   npx playwright test
   ```
   - Full user flows
   - Browser interactions
   - Real file uploads
   - GitHub workflow integration

### Test Data

**Sample Images** (`tests/fixtures/images/`):
- `valid-image.png` (500KB, valid PNG)
- `large-image.png` (11MB, exceeds limit)
- `invalid-signature.txt` (text file renamed to .png)
- `valid-jpeg.jpg` (1MB, valid JPEG)
- `corrupted.gif` (corrupted GIF file)

**Sample Markdown**:
```markdown
# Test Ticket

![Figma mockup](https://figma.com/file/abc123/design.png)

Some description text.

![Screenshot](https://example.com/screenshot.jpg)
```

## Common Development Tasks

### Run Local Development Server

```bash
npm run dev

# Open http://localhost:3000/projects/3/board
# Test ticket creation with image uploads
```

### Check TypeScript Compilation

```bash
npx tsc --noEmit

# Should show no errors after implementation
```

### Run Database Migrations

```bash
# Create new migration
npx prisma migrate dev --name description_here

# Reset database (careful!)
npx prisma migrate reset

# View database
npx prisma studio
```

### Test GitHub API Operations

```bash
# Verify GitHub token works
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Test rate limit
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

## Troubleshooting

### Issue: Prisma migration fails

**Symptom**: `Error: Migration failed to apply`

**Solution**:
```bash
# Check database connection
npx prisma db pull

# If migration is partially applied, resolve manually
npx prisma migrate resolve --applied [migration-name]

# Or rollback and retry
npx prisma migrate resolve --rolled-back [migration-name]
npx prisma migrate dev
```

### Issue: Image upload fails with GitHub error

**Symptom**: `GITHUB_COMMIT_FAILED` error in API response

**Solution**:
1. Check GitHub token has `repo` scope
2. Verify token is not expired
3. Check GitHub API rate limit: `https://api.github.com/rate_limit`
4. Test token manually with curl
5. Check repository permissions (write access required)

### Issue: File signature validation fails

**Symptom**: `INVALID_FILE_SIGNATURE` error for valid images

**Solution**:
1. Verify `file-type` library is installed: `npm list file-type`
2. Check image file is not corrupted (open in image viewer)
3. Test magic bytes manually: `hexdump -C image.png | head`
4. Verify MIME type matches file extension
5. Check for BOM (Byte Order Mark) in file header

### Issue: E2E tests fail on clipboard paste

**Symptom**: Playwright test fails during clipboard paste simulation

**Solution**:
1. Ensure browser context has clipboard permissions
2. Use `page.evaluate()` to programmatically copy image to clipboard
3. Verify paste event listener is attached before triggering
4. Check browser DevTools console for JavaScript errors

### Issue: Images not moved to feature branch during workflow

**Symptom**: Workflow completes but images remain in `ticket-assets/`

**Solution**:
1. Check GitHub Actions logs for step failure
2. Verify branch name is correctly extracted
3. Check git permissions (workflow has write access)
4. Manually verify: `git ls-tree -r [branch] specs/[branch]/assets/`
5. Test workflow locally with `act` tool

## Next Steps

After completing the implementation checklist:

1. **Run Full Test Suite**:
   ```bash
   npm run test:unit
   npm run test:integration
   npx playwright test
   ```

2. **Manual Testing**:
   - Create ticket with images via UI
   - Verify images stored in GitHub
   - Transition to SPECIFY
   - Verify images passed to Claude
   - Verify images moved to feature branch

3. **Code Review**:
   - Check TypeScript strict mode compliance
   - Verify shadcn/ui component usage
   - Validate error handling
   - Review security considerations

4. **Generate Tasks**:
   ```bash
   /speckit.tasks
   ```
   Generates dependency-ordered implementation tasks.

5. **Implementation**:
   ```bash
   /speckit.implement
   ```
   Executes tasks from tasks.md.
