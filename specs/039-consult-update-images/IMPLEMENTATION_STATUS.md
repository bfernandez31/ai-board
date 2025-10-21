# Implementation Status: Image Management in Ticket Details

**Feature Branch**: `039-consult-update-images`
**Last Updated**: 2025-01-21

## Completed Phases

### ✅ Phase 1: Setup & Prerequisites (T001-T004)
- Verified existing TicketAttachment schema
- Confirmed permission guard pattern
- Reviewed ticket creation image upload flow
- No breaking changes required

### ✅ Phase 2: Foundational Tasks (T005-T008)
- Created `lib/schemas/ticket-image.ts` with Zod validation:
  * `imageFileSchema`: MIME type and 10MB size validation
  * `attachmentIndexSchema`: Index bounds (0-99)
  * `imageOperationSchema`: Version field for concurrency control
  
- Extended `components/ticket/edit-permission-guard.tsx`:
  * Added 'images' to DocType
  * Images editable in SPECIFY and PLAN stages only

### ✅ Phase 3: User Story 1 - View Attached Images (T009-T023)

**Backend (T009-T012)**:
- `app/api/projects/[projectId]/tickets/[id]/images/route.ts`:
  * GET endpoint fetches ticket attachments with authentication
  * Transforms attachments array to include index field
  * Returns 403 for unauthorized, 404 for missing tickets
  * POST endpoint stubbed (501 Not Implemented)

**Frontend Query Hook (T013-T014)**:
- `lib/hooks/use-ticket-images.ts`:
  * TanStack Query hook with lazy loading (enabled parameter)
  * 5min stale time, 30min cache retention
  * Exponential backoff retry (3 attempts)

**Frontend Components (T015-T023)**:
- `components/ticket/image-gallery.tsx`:
  * Collapsible section with image count badge
  * Grid layout (2-4 columns responsive)
  * Lazy loads images only when expanded
  * Loading, error, and empty states
  * Thumbnail overlay with filename/size

- `components/ticket/image-lightbox.tsx`:
  * Full-size image viewer using shadcn/ui Dialog
  * Zoom controls (Fit, 100%, 200%)
  * Keyboard navigation (arrow keys, ESC)
  * Previous/Next with wrapping navigation
  * Displays metadata (filename, size, date, index)

**Integration (T019)**:
- Extended `components/board/ticket-detail-modal.tsx`:
  * Added ImageGallery after description section
  * Extended TicketData interface with attachments field
  * Uses isTicketAttachmentArray type guard for validation

**Acceptance Criteria**:
✅ Image count badge displays when attachments present
✅ Clicking badge loads images with lazy loading
✅ Images display with metadata (filename, size, date)
✅ Lightbox opens on thumbnail click with zoom/navigation
✅ Keyboard shortcuts work (arrows, ESC)
✅ Modal loads quickly (metadata only, no downloads until expanded)

## Remaining Phases (NOT YET IMPLEMENTED)

### ⏳ Phase 4: User Story 2 - Add New Images (T026-T041)

**Backend (T026-T032)**:
- POST endpoint in `app/api/projects/[projectId]/tickets/[id]/images/route.ts`
- Multipart/form-data parsing for file uploads
- File validation using imageFileSchema
- Permission check: `canEdit(stage, 'images')`
- GitHub file upload to `images/{ticketId}/` using @octokit/rest
- Update ticket attachments array + increment version
- Optimistic concurrency control (409 on version mismatch)

**Frontend Mutation Hooks (T033-T035)**:
- Create `lib/hooks/use-image-mutations.ts` (or use-image-upload.ts)
- Upload mutation with optimistic UI update
- Rollback on error
- Toast notifications for success/error
- Retry logic

**Frontend Upload Component (T036-T039)**:
- Create `components/ticket/image-upload-button.tsx`
- File picker with accept filter (.jpg,.png,.gif,.webp)
- Loading state with progress indication
- Integrate into ImageGallery with permission-based visibility

### ⏳ Phase 5: User Story 3 - Remove Unwanted Images (T042-T053)

**Backend (T042-T046)**:
- Create `app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts`
- DELETE handler with index parameter validation
- Permission check: `canEdit(stage, 'images')`
- Remove attachment at index from array + increment version
- Optimistic concurrency control

**Frontend Mutation Hooks (T047-T049)**:
- Add delete mutation to use-image-mutations.ts
- Optimistic update (remove from UI, rollback on error)
- Confirmation dialog using shadcn/ui AlertDialog

**Frontend Integration (T050-T051)**:
- Add delete button to ImageGallery thumbnail hover state
- Show only in SPECIFY/PLAN stages
- Wire to mutation with confirmation

### ⏳ Phase 6: User Story 4 - Replace Existing Image (T054-T063)

**Backend (T054-T057)**:
- PUT handler in `app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts`
- File upload and validation (reuse POST logic)
- Replace attachment at index, preserve array position
- Permission check + concurrency control

**Frontend Mutation Hooks (T058-T059)**:
- Add replace mutation to use-image-mutations.ts
- Optimistic update (show new image immediately)

**Frontend Integration (T060-T061)**:
- Add replace button to ImageGallery thumbnail hover
- Wire to file picker and mutation

### ⏳ Phase 7: Polish & Cross-Cutting Concerns (T064-T067)

- Edge case handling (empty state, corrupt images)
- Accessibility improvements (alt text, screen reader announcements, keyboard nav)
- Performance validation (<2s modal load, <3s lazy load, <5s upload for 5MB)

### ⏳ Testing (Deferred)

**API Contract Tests**:
- GET /images returns correct metadata (T024)
- POST /images uploads and updates attachments (T040)
- DELETE /images removes correct item (T052)
- PUT /images replaces at correct index (T062)
- Permission checks enforce stage restrictions
- Version conflicts return 409

**E2E Tests**:
- User views images (T025)
- User uploads image (T041)
- User deletes image (T053)
- User replaces image (T063)
- Permission denied in wrong stages
- Concurrent edit conflicts

## Files Created

✅ Implemented:
- `lib/schemas/ticket-image.ts`
- `app/api/projects/[projectId]/tickets/[id]/images/route.ts` (GET only)
- `lib/hooks/use-ticket-images.ts`
- `components/ticket/image-gallery.tsx`
- `components/ticket/image-lightbox.tsx`

⏳ TODO:
- `lib/hooks/use-image-mutations.ts` (upload, delete, replace)
- `components/ticket/image-upload-button.tsx`
- `app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts`
- `tests/api/projects-tickets-image-uploads.spec.ts` (extend existing)
- `tests/e2e/ticket-image-management.spec.ts`
- `tests/unit/image-permission-guard.test.ts`

## Files Modified

✅ Implemented:
- `components/ticket/edit-permission-guard.tsx` (added 'images' type)
- `components/board/ticket-detail-modal.tsx` (integrated ImageGallery)

## Next Steps to Complete Feature

1. **Implement Phase 4 (Add Images)**:
   - Add POST handler with multipart parsing
   - Integrate with existing GitHub upload pattern from ticket creation
   - Create upload mutation hooks with optimistic UI
   - Add upload button to ImageGallery

2. **Implement Phase 5 (Remove Images)**:
   - Create DELETE endpoint with index parameter
   - Add delete mutation with confirmation dialog
   - Add delete button to gallery thumbnails

3. **Implement Phase 6 (Replace Images)**:
   - Create PUT endpoint for image replacement
   - Add replace mutation hooks
   - Add replace button to gallery thumbnails

4. **Phase 7 (Polish)**:
   - Handle all edge cases
   - Accessibility audit
   - Performance validation

5. **Testing**:
   - Write API contract tests for all endpoints
   - Write E2E tests for all user stories
   - Write unit tests for permission guard

## Technical Notes

**Design Decisions**:
- Lazy loading: Metadata loaded immediately, images only when gallery expanded
- Permission model: Images editable in SPECIFY/PLAN stages (same as spec docs)
- Storage: GitHub `images/{ticketId}/` directory (existing pattern)
- Concurrency: Reuse `ticket.version` field (no new mechanisms)
- Lightbox: Custom using shadcn/ui Dialog (no dependencies)

**Performance Targets**:
- Modal load: <2s (metadata only, no image downloads)
- Lazy load: <3s after gallery expanded
- Upload: <5s for 5MB files
- Bandwidth: 60% reduction vs auto-loading

**Technology Stack**:
- TypeScript 5.6 (strict mode)
- Next.js 15 (App Router)
- React 18
- TanStack Query v5.90.5
- shadcn/ui components
- Zod 4.x validation
- @octokit/rest for GitHub API

## Known Limitations

- POST/PUT/DELETE endpoints not yet implemented
- Upload, delete, replace UI not yet implemented
- No tests written yet (deferred to allow faster iteration)
- Image editing only works in SPECIFY/PLAN stages (by design)
- Max file size: 10MB (configurable via schema)
- Supported formats: JPEG, PNG, GIF, WebP only

## How to Test Current Implementation

1. Ensure ticket has attachments in database (from ticket creation flow)
2. Open ticket detail modal
3. Should see "Images" section with count badge
4. Click section to expand gallery (lazy loads images)
5. Click thumbnail to open lightbox
6. Use zoom controls and navigation arrows
7. Press ESC or click outside to close

**Note**: Upload/delete/replace functionality not yet available (Phases 4-6 pending).

## Component Reuse Strategy (Updated)

**Important Realization**: The codebase already has a robust `ImageUpload` component!

### Existing Components

**`components/ui/image-upload.tsx`** (EXISTING):
- Drag-and-drop file upload
- File picker button  
- Clipboard paste support
- Image previews with remove buttons
- Validation (size, type, count)
- Used in ticket creation flow

**`components/ticket/image-gallery.tsx`** (NEW - Phase 3):
- Displays persisted images from database
- Lazy loading pattern
- Grid layout with thumbnails
- Opens lightbox on click

### Reuse Plan for Phase 4 (Add Images)

Instead of creating `components/ticket/image-upload-button.tsx` from scratch:

**Option 1: Reuse ImageUpload directly** ✅ RECOMMENDED
- Use existing `ImageUpload` component inside ImageGallery
- Show upload area when user has edit permissions
- After upload completes → images persist to database → refresh gallery
- Maintains consistency with ticket creation UX

**Option 2: Extract shared upload logic**
- Create shared `useImageUpload` hook
- Both ImageUpload and new upload button use same logic
- More DRY but adds complexity

**Recommended Implementation**:
```tsx
// In ImageGallery component
{canEdit(ticketStage, 'images') && (
  <div className="mb-4">
    <ImageUpload
      images={localPendingImages}
      onImagesChange={handleLocalImagesChange}
      maxImages={5}
      maxFileSize={10 * 1024 * 1024}
    />
    <Button onClick={handleUploadToServer}>
      Upload Images
    </Button>
  </div>
)}
```

This reuses proven upload UI while adding persistence logic for existing tickets.
