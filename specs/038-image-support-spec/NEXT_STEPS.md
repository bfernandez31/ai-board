# Next Steps: Completing Image Attachment Implementation

**Current Status**: Foundation Complete (15.7% overall, 20.8% MVP)
**Migration**: ✅ Applied
**Next Phase**: User Story 1 - Upload Images to New Ticket

## Immediate Next Steps

### 1. Modify Ticket Creation API (T015-T021)

**File**: `app/api/projects/[projectId]/tickets/route.ts`

**Current**: Accepts JSON (`application/json`)
**Target**: Accept both JSON and multipart form data (`multipart/form-data`)

**Key Changes Needed**:
```typescript
// Add multipart parsing
import formidable from 'formidable';
import { validateImageFile } from '@/lib/validations/image';
import { commitImageToRepo } from '@/lib/github/operations';
import { Octokit } from '@octokit/rest';

// Detect content type
const contentType = request.headers.get('content-type');

if (contentType?.includes('multipart/form-data')) {
  // Parse multipart data with formidable
  // Validate images
  // Commit to GitHub
  // Create attachments array
} else {
  // Existing JSON parsing logic
}
```

**Implementation Steps**:
1. Add content-type detection
2. Implement formidable parsing for file uploads
3. Validate each uploaded image (max 5, 10MB each)
4. Commit images to GitHub (`ticket-assets/[id]/`)
5. Create TicketAttachment objects
6. Store attachments in Ticket.attachments field
7. Add transaction/rollback on GitHub failure
8. Return attachments in response

### 2. Add Image Upload Tests (T012-T014)

**File**: `tests/api/projects-tickets-post.spec.ts` (extend existing)

**New Test Cases**:
- Upload single image with ticket creation
- Upload multiple images (up to 5)
- Validate file size limit (reject >10MB)
- Validate file type (reject non-images)
- Validate max count (reject >5 images)
- Test GitHub commit failure handling
- Test database rollback on failure
- Backward compatibility (tickets without images)

**Test Fixtures Needed** (`tests/fixtures/images/`):
- `valid-image.png` (500KB, valid PNG)
- `large-image.png` (11MB, exceeds limit)
- `invalid-signature.txt` (text file renamed to .png)
- `valid-jpeg.jpg` (1MB, valid JPEG)

### 3. User Story 2 - Markdown URLs (T023-T028)

**Same API Route**: Extend ticket creation to extract markdown URLs

**Key Changes**:
```typescript
import { extractImageUrls } from '@/lib/parsers/markdown';

// After parsing uploaded images:
const markdownImages = extractImageUrls(description);

// Validate external URLs (HTTPS only)
// Create TicketAttachment objects (type: 'external')
// Merge with uploaded images
// Enforce total limit of 5 attachments
```

### 4. User Story 4 - Claude Integration (T036-T044)

**File**: `.github/workflows/speckit.yml`

**Modifications Needed**:
1. Add `attachments` input parameter (JSON string)
2. Add step to download external URLs to `ticket-assets/[id]/`
3. Pass `imageContext` to `/speckit.specify` command
4. Move images from main → feature branch after spec creation
5. Delete `ticket-assets/[id]/` from main

**File**: `.claude/commands/specify.md`
- Accept `imageContext` parameter
- Document image references in generated spec

### 5. Frontend Integration (T049-T059)

**Files to Create/Modify**:
- `components/ui/image-upload.tsx` - New component
- `components/board/new-ticket-modal.tsx` - Integrate upload component

**Features**:
- Drag-and-drop zone
- File picker button
- Clipboard paste (Ctrl+V / Cmd+V)
- Image previews with thumbnails
- Remove image button
- Validation error display
- Upload progress indicator

## Estimated Effort Remaining

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| User Story 1 | 11 | 4-6 hours |
| User Story 2 | 6 | 2-3 hours |
| User Story 4 | 9 | 3-4 hours |
| Frontend | 11 | 4-5 hours |
| Polish | 11 | 2-3 hours |
| **Total MVP** | 48 | **15-21 hours** |

## Code Structure Reference

### Files Created (Foundation)
```
app/lib/
├── types/ticket.ts              # TypeScript interfaces
├── schemas/ticket.ts            # Zod validation schemas
├── validations/image.ts         # Image validation (MIME + magic bytes)
├── parsers/markdown.ts          # Markdown image URL extraction
└── github/operations.ts         # GitHub API operations

prisma/
├── schema.prisma                # Added attachments field
└── migrations/
    └── 20251020214320_add_ticket_attachments/
        └── migration.sql        # ALTER TABLE Ticket ADD attachments

tests/unit/
├── ticket-attachment-schema.test.ts  # Zod schema tests
├── image-validation.test.ts          # Validation tests
└── markdown-parser.test.ts           # Parser tests
```

### Files to Modify (Implementation)
```
app/api/projects/[projectId]/tickets/
└── route.ts                     # Add multipart/form-data support

tests/api/
└── projects-tickets-post.spec.ts # Extend with image upload tests

.github/workflows/
└── speckit.yml                  # Add image handling steps

.claude/commands/
└── specify.md                   # Accept imageContext parameter

components/
├── ui/
│   └── image-upload.tsx        # NEW: Upload component
└── board/
    └── new-ticket-modal.tsx    # Integrate upload component
```

## Quick Command Reference

### Run Unit Tests
```bash
npm run test:unit
```

### Run API Tests
```bash
npx playwright test tests/api/
```

### Run E2E Tests
```bash
npx playwright test tests/e2e/
```

### Type Check
```bash
npx tsc --noEmit
```

### Lint
```bash
npm run lint
```

### Start Dev Server
```bash
npm run dev
```

## Implementation Strategy

### Option A: Complete MVP (Recommended)
1. Implement User Story 1 (Upload) - Core functionality
2. Implement User Story 2 (External URLs) - Extends US1
3. Implement User Story 4 (Claude) - MVP goal
4. Implement Frontend - UI for US1 & US2
5. Polish & Testing - Essential quality checks
6. **Result**: Functional MVP with visual context for specifications

### Option B: Incremental Delivery
1. Implement User Story 1 only → Test independently → Deploy
2. Implement User Story 2 → Test independently → Deploy
3. Implement User Story 4 → Test independently → Deploy
4. Add Frontend later → Full user experience
5. **Result**: Backend-first approach, test with API calls

### Option C: Frontend First
1. Implement Frontend components with mock data
2. Implement Backend API routes
3. Connect Frontend → Backend
4. Test end-to-end flows
5. **Result**: UI-first approach, visual progress

## Recommended: Option A (MVP First)

**Reasoning**:
- ✅ Delivers working end-to-end feature
- ✅ Validates all foundation work
- ✅ Achieves primary goal (images to Claude)
- ✅ Can demo to stakeholders
- ✅ Follows TDD principles (tests first)

## Questions to Answer Before Proceeding

1. **GitHub Token**: Is GITHUB_TOKEN configured in .env.local? (Required for image commits)
2. **Octokit Instance**: Is there an existing Octokit client we should reuse?
3. **Test Images**: Should we commit test fixtures to the repo?
4. **Error Handling**: Preferred error logging strategy? (console.error, monitoring service, etc.)
5. **Cleanup Strategy**: When should orphaned images be cleaned up? (Manual, cron job, workflow)

## Resources

- **Specification**: `specs/038-image-support-spec/spec.md`
- **Task Breakdown**: `specs/038-image-support-spec/tasks.md`
- **Implementation Status**: `specs/038-image-support-spec/IMPLEMENTATION_STATUS.md`
- **Migration Instructions**: `specs/038-image-support-spec/MIGRATION_INSTRUCTIONS.md`

---

**Ready to proceed? Choose your implementation strategy and let's continue!**
