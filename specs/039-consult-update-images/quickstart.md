# Quickstart Guide: Image Management in Ticket Details

**Feature**: Image Management in Ticket Details
**Branch**: `039-consult-update-images`
**Date**: 2025-01-21

## Overview

This guide provides a quick reference for implementing and using the image management feature. For detailed planning, see [plan.md](./plan.md).

## Feature Summary

**User Goal**: View, add, remove, and replace images in ticket details through a lazy-loaded gallery interface.

**Key Benefits**:
- 60% bandwidth reduction via lazy loading (images load only when requested)
- Consistent permission model with spec document editing
- Optimistic UI updates for instant feedback
- Full CRUD support for image management

## Implementation Checklist

### Phase 1: Backend API (4 endpoints)

- [ ] **GET /api/projects/:projectId/tickets/:id/images**
  - Returns image metadata from `Ticket.attachments`
  - No file downloads (lazy loading optimization)
  - See: `contracts/get-images.yaml`

- [ ] **POST /api/projects/:projectId/tickets/:id/images**
  - Upload image to GitHub `ticket-assets/{ticketId}/`
  - Append metadata to attachments array
  - Permission check: `canEdit(stage, 'images')`
  - See: `contracts/upload-image.yaml`

- [ ] **DELETE /api/projects/:projectId/tickets/:id/images/:index**
  - Remove attachment at index from array
  - Permission check: `canEdit(stage, 'images')`
  - Version validation for concurrency control
  - See: `contracts/delete-image.yaml`

- [ ] **PUT /api/projects/:projectId/tickets/:id/images/:index**
  - Replace image file and metadata at index
  - Permission check: `canEdit(stage, 'images')`
  - See: `contracts/replace-image.yaml`

### Phase 2: Frontend Components (3 new components)

- [ ] **ImageGallery** (`components/ticket/image-gallery.tsx`)
  - Props: `ticketId`, `projectId`, `ticketStage`, `attachments`
  - Collapsible section (collapsed by default)
  - Lazy loads images when expanded
  - Grid layout with thumbnails
  - Permission-based add/remove/replace buttons

- [ ] **ImageLightbox** (`components/ticket/image-lightbox.tsx`)
  - Props: `open`, `onOpenChange`, `images`, `initialIndex`
  - Full-size image viewer using shadcn/ui Dialog
  - Previous/Next navigation
  - Zoom controls (Fit, 100%, 200%)
  - Keyboard shortcuts (arrows, ESC)

- [ ] **ImageUploadButton** (`components/ticket/image-upload-button.tsx`)
  - Props: `ticketId`, `projectId`, `onUploadSuccess`
  - File picker (accept: .jpg,.png,.gif,.webp)
  - Upload mutation with TanStack Query
  - Loading state and error handling

### Phase 3: State Management (2 hooks)

- [ ] **useTicketImages** (`lib/hooks/use-ticket-images.ts`)
  - TanStack Query hook for fetching image metadata
  - Query key: `['ticket', projectId, ticketId, 'images']`
  - Enabled only when gallery expanded (lazy loading)
  - 5-minute stale time, 30-minute cache time

- [ ] **useImageMutations** (`lib/hooks/use-image-mutations.ts`)
  - Upload mutation (POST /images)
  - Delete mutation (DELETE /images/:index)
  - Replace mutation (PUT /images/:index)
  - Optimistic updates with rollback on error
  - Refetch ticket on success

### Phase 4: Validation & Permissions

- [ ] **Zod Schemas** (`lib/schemas/ticket-image.ts`)
  - `imageFileSchema` - File type, size validation
  - `attachmentIndexSchema` - Index bounds checking
  - `imageOperationSchema` - Version validation

- [ ] **Permission Guard** (extend `components/ticket/edit-permission-guard.tsx`)
  - Add 'images' document type to permission matrix
  - Images editable in SPECIFY and PLAN stages only
  - Use existing `canEdit(ticketStage, 'images')` function

### Phase 5: Integration

- [ ] **Update TicketDetailModal** (`components/board/ticket-detail-modal.tsx`)
  - Add "Images" section after description
  - Show image count badge when attachments exist
  - Integrate ImageGallery component
  - Permission-based visibility for add button

### Phase 6: Testing

- [ ] **Search for existing tests**
  - `npx grep -r "attachments\|images" tests/` (find relevant test files)
  - Extend `tests/api/projects-tickets-image-uploads.spec.ts` if exists

- [ ] **API Contract Tests**
  - GET /images returns correct metadata
  - POST /images uploads and updates attachments
  - DELETE /images removes correct item
  - PUT /images replaces at correct index
  - Permission checks enforce stage restrictions
  - Version conflicts return 409

- [ ] **E2E Workflow Tests** (`tests/e2e/ticket-image-management.spec.ts`)
  - User views images in ticket details
  - User uploads new image (SPECIFY stage)
  - User deletes image (PLAN stage)
  - User cannot upload in BUILD stage
  - Lightbox navigation works correctly
  - Concurrent edit conflict handling

- [ ] **Unit Tests** (`tests/unit/image-permission-guard.test.ts`)
  - canEdit('SPECIFY', 'images') returns true
  - canEdit('BUILD', 'images') returns false
  - Permission matrix completeness

## Quick Reference

### File Locations

**Backend**:
```
app/api/projects/[projectId]/tickets/[id]/
├── images/
│   ├── route.ts                    # GET, POST endpoints
│   └── [attachmentIndex]/
│       └── route.ts                # DELETE, PUT endpoints
```

**Frontend**:
```
components/
├── board/ticket-detail-modal.tsx   # Integrate gallery
└── ticket/
    ├── image-gallery.tsx           # Gallery component
    ├── image-lightbox.tsx          # Viewer component
    └── image-upload-button.tsx     # Upload UI

lib/
├── hooks/
│   ├── use-ticket-images.ts        # Fetch hook
│   └── use-image-mutations.ts      # Mutation hooks
└── schemas/
    └── ticket-image.ts             # Validation schemas
```

**Tests**:
```
tests/
├── api/projects-tickets-image-uploads.spec.ts  # Extend existing
├── e2e/ticket-image-management.spec.ts         # New E2E tests
└── unit/image-permission-guard.test.ts         # New unit tests
```

### Data Flow

```
User Action → Component → Hook → API → Database → GitHub
                    ↓                        ↓        ↓
              Optimistic UI              Update    Upload
                    ↓                   attachments  file
              Success/Error ← ← ← ← ← ←  ← ← ← ← ← ←
```

### Permission Matrix

| Stage   | View | Add | Remove | Replace |
|---------|------|-----|--------|---------|
| INBOX   | ✅   | ❌  | ❌     | ❌      |
| SPECIFY | ✅   | ✅  | ✅     | ✅      |
| PLAN    | ✅   | ✅  | ✅     | ✅      |
| BUILD   | ✅   | ❌  | ❌     | ❌      |
| VERIFY  | ✅   | ❌  | ❌     | ❌      |
| SHIP    | ✅   | ❌  | ❌     | ❌      |

### Key Constants

```typescript
// File size limit
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// GitHub storage path
const IMAGE_STORAGE_PATH = `images/${ticketId}/`;

// TanStack Query cache config
const QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000,   // 5 minutes
  cacheTime: 30 * 60 * 1000,  // 30 minutes
};
```

## Performance Targets

- ✅ Modal load: <2s even with 10+ images (metadata only)
- ✅ Lazy load: <3s to display images after click
- ✅ Upload: <5s for 5MB files on broadband
- ✅ Bandwidth: 60% reduction vs. auto-loading

## Common Pitfalls

1. **Don't load images on modal open** - Use lazy loading (load when gallery expanded)
2. **Don't skip permission checks** - Always validate `canEdit(stage, 'images')` in API
3. **Don't forget version field** - Include `version` in all mutation requests
4. **Don't create duplicate tests** - Search for existing tests first (`npx grep -r "images" tests/`)
5. **Don't use external image libraries** - Build custom lightbox with shadcn/ui Dialog

## Testing Commands

```bash
# Search for existing tests
npx grep -r "attachments\|images" tests/

# Run E2E tests
npx playwright test tests/e2e/ticket-image-management.spec.ts

# Run API tests
npx playwright test tests/api/projects-tickets-image-uploads.spec.ts

# Run unit tests
npm test -- tests/unit/image-permission-guard.test.ts

# Run all tests
npx playwright test
```

## Next Steps

1. Generate detailed task breakdown: `/speckit.tasks`
2. Review tasks with stakeholders
3. Begin TDD workflow (tests first)
4. Implement backend API endpoints
5. Build frontend components
6. Integrate into TicketDetailModal
7. Verify performance targets
8. Deploy and monitor

## Resources

- **Spec**: [spec.md](./spec.md) - Feature requirements
- **Plan**: [plan.md](./plan.md) - Implementation strategy
- **Research**: [research.md](./research.md) - Technical decisions
- **Data Model**: [data-model.md](./data-model.md) - Schema and interfaces
- **Contracts**: [contracts/](./contracts/) - OpenAPI specs

## Questions?

If unclear requirements found during implementation:
1. Check [research.md](./research.md) for technical decisions
2. Review [data-model.md](./data-model.md) for schema details
3. Consult [contracts/](./contracts/) for API specifications
4. Refer back to [spec.md](./spec.md) for user requirements
