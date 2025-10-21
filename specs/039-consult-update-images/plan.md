# Implementation Plan: Image Management in Ticket Details

**Branch**: `039-consult-update-images` | **Date**: 2025-01-21 | **Spec**: [spec.md](./spec.md)

## Summary

Enable users to view, add, remove, and replace images in ticket details through a lazy-loaded gallery interface. Images are stored in GitHub repository and referenced via the existing `Ticket.attachments` JSON field. Edit permissions mirror the stage-based spec document editing model: images can only be modified when the ticket is in SPECIFY or PLAN stages.

**Key Technical Approach**:
- Lazy loading with click-to-view for performance optimization
- Reuse existing `TicketAttachment` schema and GitHub storage pattern
- Stage-based permission guard consistent with `canEdit()` function
- Optimistic UI updates with TanStack Query mutations
- shadcn/ui Dialog for image lightbox/viewer

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**:
- Frontend: Next.js 15 (App Router), React 18, shadcn/ui, TanStack Query v5.90.5
- Image handling: Browser native File API, GitHub API (@octokit/rest)
- Validation: Zod 4.x

**Storage**:
- Metadata: PostgreSQL 14+ (`Ticket.attachments` JSON field via Prisma 6.x)
- Files: GitHub repository (`ticket-assets/{ticketId}/` directory pattern)

**Testing**: Playwright E2E tests with existing test infrastructure

**Target Platform**: Web browsers (Chrome, Firefox, Safari, Edge - desktop and mobile)

**Project Type**: Web application (Next.js full-stack)

**Performance Goals**:
- Lazy loading: <3s to display images after click
- Modal load: <2s even with 10+ images (metadata only, no image downloads)
- Upload: <5s for 5MB files on broadband

**Constraints**:
- Bandwidth optimization: 60% reduction vs. auto-loading images
- Permission enforcement: Zero bypass incidents
- Optimistic UI: 95% operation success rate without retries
- Image formats: JPEG, PNG, GIF, WebP only
- File size: Reasonable limit (suggest 10MB max based on edge cases)

**Scale/Scope**:
- Single feature within existing ticket detail modal
- Extends existing `TicketDetailModal` component (`components/board/ticket-detail-modal.tsx`)
- Reuses existing attachment infrastructure from ticket creation flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ TypeScript-First Development
- All code will use TypeScript strict mode with explicit types
- Image gallery components will have defined prop interfaces
- API responses typed with Zod schemas
- **Status**: COMPLIANT

### ✅ Component-Driven Architecture
- Uses shadcn/ui Dialog, Button, ScrollArea for UI primitives
- New `ImageGallery` component follows existing patterns
- Extends `TicketDetailModal` with image section
- Server Components by default, Client Components for interactive gallery
- **Status**: COMPLIANT

### ✅ Test-Driven Development
- **MANDATORY**: Search for existing image/attachment tests before creating new files
- Extend existing tests in `tests/api/projects-tickets-image-uploads.spec.ts`
- Add E2E tests for gallery viewing/editing flows
- Reuse test patterns from `tests/api/projects-tickets-image-uploads.spec.ts`
- **Status**: COMPLIANT (test discovery required during implementation)

### ✅ Security-First Design
- Zod validation for file type, size, metadata
- Permission checks via `canEdit()` function from `components/ticket/edit-permission-guard.tsx`
- No sensitive GitHub tokens in client-side code
- Input sanitization for filenames and metadata
- **Status**: COMPLIANT

### ✅ Database Integrity
- No schema changes required (uses existing `Ticket.attachments` JSON field)
- Optimistic concurrency control via `ticket.version` field (existing pattern)
- Transactional updates when modifying attachments array
- **Status**: COMPLIANT

### ✅ Technology Standards
- Frontend: Next.js 15, React 18, TypeScript, TailwindCSS ✓
- UI Components: shadcn/ui exclusively ✓
- State Management: TanStack Query v5 for server state ✓
- Database: PostgreSQL via Prisma (no changes) ✓
- Testing: Playwright ✓
- **Status**: COMPLIANT

### ✅ State Management Standards
- TanStack Query for image fetching and mutations ✓
- Optimistic updates for add/remove/replace operations ✓
- Local state (useState) for gallery UI (selected image, lightbox open) ✓
- **Status**: COMPLIANT

### Post-Design Constitution Check
*To be completed after Phase 1 design artifacts are generated*

**Result**: No violations identified. Feature aligns with all constitution principles.

## Complexity Tracking

*No violations to justify - all constitution checks pass.*

## Project Structure

### Documentation (this feature)

```
specs/039-consult-update-images/
├── spec.md               # Feature specification (completed)
├── plan.md               # This file (Phase 0 output)
├── research.md           # Phase 0 research findings (to be generated)
├── data-model.md         # Phase 1 data model (to be generated)
├── contracts/            # Phase 1 API contracts (to be generated)
│   ├── get-images.yaml
│   ├── upload-image.yaml
│   ├── delete-image.yaml
│   └── replace-image.yaml
├── quickstart.md         # Phase 1 quickstart guide (to be generated)
└── tasks.md              # Phase 2 implementation tasks (NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router structure (existing)
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [id]/
│                   ├── route.ts                    # Existing ticket PATCH endpoint
│                   └── images/
│                       ├── route.ts                # NEW: GET all images, POST upload
│                       └── [attachmentIndex]/
│                           └── route.ts            # NEW: DELETE, PUT replace

components/
├── board/
│   └── ticket-detail-modal.tsx                     # MODIFY: Add image section
├── ticket/
│   ├── edit-permission-guard.tsx                   # REUSE: canEdit() for images
│   ├── image-gallery.tsx                           # NEW: Lazy-loaded gallery component
│   ├── image-lightbox.tsx                          # NEW: Full-size image viewer
│   └── image-upload-button.tsx                     # NEW: Upload UI component

lib/
├── hooks/
│   ├── use-ticket-images.ts                        # NEW: TanStack Query hooks
│   └── use-image-upload.ts                         # NEW: Upload mutation hook
├── schemas/
│   └── ticket-image.ts                             # NEW: Zod schemas for validation
└── types/
    └── ticket.ts                                   # EXISTING: TicketAttachment interface

tests/
├── api/
│   └── projects-tickets-image-uploads.spec.ts      # EXISTING: Extend with gallery tests
├── e2e/
│   └── ticket-image-management.spec.ts             # NEW: E2E gallery workflow tests
└── unit/
    └── image-permission-guard.test.ts              # NEW: Permission logic unit tests
```

**Structure Decision**: Web application structure (Option 2) selected. Feature integrates into existing Next.js App Router with `/app/api/` for backend and `/components/` for frontend. No new top-level directories needed - extends existing ticket management infrastructure.

## Phase 0: Research & Technical Decisions

### Research Tasks

1. **Image Lazy Loading Strategy**
   - **Question**: How to implement performant lazy loading without loading all images on modal open?
   - **Decision**: Two-phase loading - metadata loaded immediately from `Ticket.attachments`, images load only when user clicks "View Images" section
   - **Rationale**: Ticket attachments already in database response, no extra API call for metadata. Images fetched via separate API endpoint (`GET /api/projects/:projectId/tickets/:id/images`) only when needed
   - **Alternatives Considered**:
     - Browser native lazy loading (`loading="lazy"`) - rejected because images still download in DOM
     - Intersection Observer - rejected as too complex for click-based lazy loading

2. **Image Upload Flow**
   - **Question**: Should upload happen immediately or on ticket save?
   - **Decision**: Immediate upload with optimistic UI update
   - **Rationale**: Consistent with existing attachment upload during ticket creation, provides instant feedback
   - **Alternatives Considered**:
     - Batch upload on modal close - rejected due to poor UX (user doesn't know if upload succeeded)

3. **Permission Model Alignment**
   - **Question**: How do spec editing permissions map to image permissions?
   - **Decision**: Images editable in SPECIFY and PLAN stages only (same as spec/plan docs)
   - **Rationale**: Spec clarification from user request, matches `canEdit()` logic in `components/ticket/edit-permission-guard.tsx`
   - **Permission Matrix**:
     - INBOX: View only (if images added during creation)
     - SPECIFY: View + Add + Remove + Replace
     - PLAN: View + Add + Remove + Replace
     - BUILD/VERIFY/SHIP: View only
   - **Alternatives Considered**:
     - Allow editing in BUILD stage - rejected for consistency with spec editing model

4. **Image Storage Location**
   - **Question**: Where to store image files in GitHub repository?
   - **Decision**: `ticket-assets/{ticketId}/` directory pattern (existing pattern from ticket creation)
   - **Rationale**: Already implemented in ticket creation flow, consistent file organization
   - **Alternatives Considered**:
     - Flat `/images/` directory - rejected due to poor organization at scale
     - External storage (S3, Cloudinary) - rejected to avoid new dependencies

5. **Concurrent Edit Handling**
   - **Question**: How to prevent concurrent image modification conflicts?
   - **Decision**: Reuse existing `ticket.version` optimistic concurrency control
   - **Rationale**: Ticket attachments array is part of ticket record, version field already protects all ticket updates
   - **Alternatives Considered**:
     - Per-image locking - rejected as over-engineered for current scale

6. **Image Viewer/Lightbox Component**
   - **Question**: Build custom lightbox or use library?
   - **Decision**: Build simple lightbox using shadcn/ui Dialog component
   - **Rationale**: Avoids new dependencies, matches existing modal patterns, full control over UX
   - **Features**: Full-size view, zoom controls, previous/next navigation
   - **Alternatives Considered**:
     - react-image-lightbox - rejected to avoid dependencies
     - photoswipe - rejected due to complexity and bundle size

**Output**: research.md generated (see `specs/039-consult-update-images/research.md`)

## Phase 1: Design & Contracts

### Data Model

**Entities** (no new database tables - extends existing):

1. **Ticket.attachments** (existing JSON field)
   - Type: `TicketAttachment[]` from `app/lib/types/ticket.ts`
   - Schema: `{ type, url, filename, mimeType, sizeBytes, uploadedAt }`
   - Operations: Add, remove, replace items in array
   - Concurrency: Protected by `ticket.version` field

2. **ImageGalleryState** (React component state)
   - `selectedImage: number | null` - Index of image in lightbox
   - `isLightboxOpen: boolean` - Lightbox visibility
   - `isLoading: boolean` - Image fetch status

3. **ImageUploadOperation** (mutation state)
   - Input: `File` object + `projectId` + `ticketId`
   - Output: Updated `TicketAttachment[]`
   - Validation: File type, size, MIME type via Zod

**Relationships**:
- One Ticket → Many TicketAttachments (one-to-many in JSON array)
- No database schema changes required

### API Contracts

**Contract 1: Get Images Metadata**
```yaml
# GET /api/projects/:projectId/tickets/:id/images
# Returns image metadata without downloading files (lazy loading optimization)

Request:
  Method: GET
  Path: /api/projects/:projectId/tickets/:id/images
  Headers:
    - Cookie: session token (authenticated)

Response (200):
  Body:
    {
      "images": [
        {
          "index": 0,
          "type": "uploaded" | "external",
          "url": "string",          # GitHub URL or external link
          "filename": "string",
          "mimeType": "string",
          "sizeBytes": number,
          "uploadedAt": "ISO8601"
        }
      ]
    }

Response (404):
  Body: { "error": "Ticket not found" }

Response (403):
  Body: { "error": "Forbidden - project access denied" }
```

**Contract 2: Upload Image**
```yaml
# POST /api/projects/:projectId/tickets/:id/images
# Uploads new image file and updates ticket attachments

Request:
  Method: POST
  Path: /api/projects/:projectId/tickets/:id/images
  Headers:
    - Cookie: session token (authenticated)
    - Content-Type: multipart/form-data
  Body:
    - file: File (image file)
    - version: number (ticket version for concurrency control)

Response (200):
  Body:
    {
      "attachments": [...],      # Updated full array
      "version": number          # New ticket version
    }

Response (400):
  Body:
    {
      "error": "Validation failed",
      "issues": [
        { "field": "file", "message": "Invalid file type" }
      ]
    }

Response (403):
  Body: { "error": "Forbidden - cannot edit images in current stage" }

Response (409):
  Body: { "error": "Conflict - ticket was modified by another user" }
```

**Contract 3: Delete Image**
```yaml
# DELETE /api/projects/:projectId/tickets/:id/images/:attachmentIndex
# Removes image from attachments array and optionally deletes file

Request:
  Method: DELETE
  Path: /api/projects/:projectId/tickets/:id/images/:attachmentIndex
  Headers:
    - Cookie: session token (authenticated)
  Body:
    {
      "version": number         # Ticket version for concurrency control
    }

Response (200):
  Body:
    {
      "attachments": [...],     # Updated array without deleted image
      "version": number         # New ticket version
    }

Response (403):
  Body: { "error": "Forbidden - cannot edit images in current stage" }

Response (404):
  Body: { "error": "Image not found at index" }

Response (409):
  Body: { "error": "Conflict - ticket was modified by another user" }
```

**Contract 4: Replace Image**
```yaml
# PUT /api/projects/:projectId/tickets/:id/images/:attachmentIndex
# Replaces existing image with new file at same index

Request:
  Method: PUT
  Path: /api/projects/:projectId/tickets/:id/images/:attachmentIndex
  Headers:
    - Cookie: session token (authenticated)
    - Content-Type: multipart/form-data
  Body:
    - file: File (new image file)
    - version: number (ticket version for concurrency control)

Response (200):
  Body:
    {
      "attachments": [...],     # Updated array with replaced image
      "version": number         # New ticket version
    }

Response (400):
  Body: { "error": "Validation failed", "issues": [...] }

Response (403):
  Body: { "error": "Forbidden - cannot edit images in current stage" }

Response (404):
  Body: { "error": "Image not found at index" }

Response (409):
  Body: { "error": "Conflict - ticket was modified by another user" }
```

### Agent Context Update

No new technologies introduced. Feature uses existing stack:
- TypeScript, Next.js 15, React 18, shadcn/ui (existing)
- TanStack Query v5 (existing)
- Zod validation (existing)
- Prisma ORM (existing)
- GitHub API (@octokit/rest) (existing)

CLAUDE.md already documents all required technologies. No updates needed.

## Implementation Phases (High-Level)

**Phase 2: Task Breakdown** (generated by `/speckit.tasks` command)

Will be broken down into the following high-level work streams:

1. **Backend API Development**
   - Create image metadata endpoint (GET /images)
   - Implement upload endpoint (POST /images)
   - Implement delete endpoint (DELETE /images/:index)
   - Implement replace endpoint (PUT /images/:index)
   - Add permission guards (stage-based checks)
   - Add Zod validation schemas

2. **Frontend Component Development**
   - Create `ImageGallery` component (lazy-loaded grid/list)
   - Create `ImageLightbox` component (full-size viewer with zoom)
   - Create `ImageUploadButton` component (file picker + upload UI)
   - Extend `TicketDetailModal` with images section

3. **State Management**
   - Create TanStack Query hooks (useTicketImages, useImageUpload, etc.)
   - Implement optimistic updates for mutations
   - Add error handling and retry logic

4. **Testing**
   - Search and extend existing tests in `tests/api/projects-tickets-image-uploads.spec.ts`
   - Add E2E tests for gallery view/upload/delete/replace flows
   - Add unit tests for permission guard extensions
   - Test edge cases (large files, slow network, concurrent edits)

5. **Integration & Polish**
   - Wire up components in TicketDetailModal
   - Add loading states and error messages
   - Test on multiple browsers and devices
   - Verify performance targets (lazy loading, upload speed)

**Estimated Complexity**: Medium
- 4 new API endpoints (straightforward CRUD)
- 3 new React components (gallery, lightbox, upload button)
- Extends existing modal component
- Reuses existing permission model and concurrency control
- No database schema changes
- Well-defined success criteria and edge cases

## Next Steps

1. Run `/speckit.tasks` to generate detailed task breakdown in `tasks.md`
2. Review tasks with stakeholders
3. Begin implementation following TDD workflow (tests first)
