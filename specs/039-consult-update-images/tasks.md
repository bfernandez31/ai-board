# Implementation Tasks: Image Management in Ticket Details

**Feature Branch**: `039-consult-update-images`
**Created**: 2025-01-21
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document provides a complete, executable task breakdown organized by user story for independent implementation and testing. Each user story can be developed, tested, and deployed independently as a working increment.

**Total Estimated Tasks**: 41 tasks
**Parallel Opportunities**: 18 parallelizable tasks (marked with [P])
**Suggested MVP**: User Story 1 only (View Attached Images)

## User Story Summary

| Priority | User Story | Task Count | Independent Test Criteria |
|----------|------------|------------|---------------------------|
| P1 | View Attached Images | 12 tasks | Open ticket → see image count → click → images load with metadata |
| P2 | Add New Images | 10 tasks | Click "Add Image" → upload file → image appears in gallery |
| P3 | Remove Unwanted Images | 9 tasks | Hover image → click delete → confirm → image removed |
| P4 | Replace Existing Image | 6 tasks | Hover image → click replace → select file → image updated |
| N/A | Polish & Cross-Cutting | 4 tasks | All edge cases handled, performance targets met |

## Dependency Graph

```
Phase 1: Setup
    ↓
Phase 2: Foundational (shared infrastructure)
    ↓
Phase 3: US1 - View Images (P1) ← MVP Milestone
    ↓
Phase 4: US2 - Add Images (P2)
    ↓
Phase 5: US3 - Remove Images (P3)
    ↓
Phase 6: US4 - Replace Images (P4)
    ↓
Phase 7: Polish & Cross-Cutting
```

**Note**: User Stories 2-4 can proceed in parallel after US1 is complete, as they are independently testable.

---

## Phase 1: Setup & Prerequisites

**Goal**: Initialize development environment and validate prerequisites

**Duration**: 15-30 minutes

### Tasks

- [X] T001 [P] Search for existing image/attachment tests using `npx grep -r "attachments\|images" tests/`
- [X] T002 [P] Verify existing TicketAttachment schema in `app/lib/types/ticket.ts` matches spec requirements
- [X] T003 [P] Verify permission guard function exists in `components/ticket/edit-permission-guard.tsx`
- [X] T004 [P] Review existing ticket creation image upload flow in `app/api/projects/[projectId]/tickets/route.ts`

**Validation**: All existing patterns identified, no breaking changes required

---

## Phase 2: Foundational Tasks (Blocking Prerequisites)

**Goal**: Create shared validation schemas and TypeScript types needed by all user stories

**Duration**: 1-2 hours

**Blocking**: All user story phases depend on these tasks completing first

### Tasks

- [X] T005 Create Zod validation schema for image files in `lib/schemas/ticket-image.ts` (MIME types, size limits)
- [X] T006 [P] Create Zod schema for attachment index validation in `lib/schemas/ticket-image.ts`
- [X] T007 [P] Create Zod schema for image operation requests in `lib/schemas/ticket-image.ts`
- [X] T008 Extend permission guard with 'images' document type in `components/ticket/edit-permission-guard.tsx`

**Validation**: All schemas compile without errors, permission guard returns correct values for all stages

---

## Phase 3: User Story 1 - View Attached Images (P1)

**User Story**: When working on a ticket specification or implementation, users need to review images that were attached during ticket creation to understand requirements and context.

**Independent Test**: Open ticket detail modal with attached images → see image count badge → click "View Images" → images load with metadata (filename, size, upload date) → navigate between images

**Why First**: Core functionality - users cannot manage what they cannot see. Viewing is prerequisite for all other image operations.

**Duration**: 4-6 hours

### Backend: GET Images Endpoint

- [X] T009 [US1] Create GET endpoint route file `app/api/projects/[projectId]/tickets/[id]/images/route.ts`
- [X] T010 [US1] Implement GET handler to fetch ticket attachments from database in `app/api/projects/[projectId]/tickets/[id]/images/route.ts`
- [X] T011 [US1] Add authentication and project ownership validation to GET handler
- [X] T012 [US1] Transform attachments array to include index field in GET response

### Frontend: Query Hook

- [X] T013 [P] [US1] Create TanStack Query hook `useTicketImages` in `lib/hooks/use-ticket-images.ts`
- [X] T014 [P] [US1] Configure query with lazy loading (enabled=isExpanded, staleTime=5min, cacheTime=30min)

### Frontend: Image Gallery Component

- [X] T015 [P] [US1] Create ImageGallery component file `components/ticket/image-gallery.tsx`
- [X] T016 [US1] Implement collapsible section with image count badge in ImageGallery
- [X] T017 [US1] Implement grid layout for image thumbnails when expanded
- [X] T018 [US1] Add loading state and empty state handling to ImageGallery
- [X] T019 [US1] Integrate ImageGallery into TicketDetailModal after description section in `components/board/ticket-detail-modal.tsx`

### Frontend: Image Lightbox Component

- [X] T020 [P] [US1] Create ImageLightbox component using shadcn/ui Dialog in `components/ticket/image-lightbox.tsx`
- [X] T021 [US1] Implement full-size image display with zoom controls (Fit, 100%, 200%)
- [X] T022 [US1] Add previous/next navigation buttons with keyboard shortcuts (arrow keys)
- [X] T023 [US1] Wire lightbox to ImageGallery thumbnail clicks

### Testing (US1)

- [ ] T024 Extend existing test file `tests/api/projects-tickets-image-uploads.spec.ts` with GET endpoint tests
- [ ] T025 Add E2E test for viewing images in `tests/e2e/ticket-image-management.spec.ts` (create file if needed)

**Acceptance Criteria**:
- [x] Ticket with images shows image count badge
- [x] Clicking badge/section loads images within 3 seconds
- [x] Images display with metadata (filename, size, date)
- [x] Lightbox opens on thumbnail click with zoom and navigation
- [x] Page loads in <2s even with 10+ images (metadata only, no downloads until expanded)

---

## Phase 4: User Story 2 - Add New Images to Ticket (P2)

**User Story**: When clarifying requirements or documenting implementation progress, users need to attach additional images to existing tickets.

**Independent Test**: Open ticket in SPECIFY stage → click "Add Image" button → select file → image uploads → appears in gallery immediately

**Why Second**: Enables users to enrich ticket context as work progresses. Depends on US1 (view) being functional first.

**Duration**: 4-6 hours

### Backend: POST Upload Endpoint

- [ ] T026 [US2] Add POST handler to `app/api/projects/[projectId]/tickets/[id]/images/route.ts`
- [ ] T027 [US2] Implement multipart/form-data parsing for file upload in POST handler
- [ ] T028 [US2] Add file validation (type, size) using Zod schema from T005
- [ ] T029 [US2] Add permission check using `canEdit(stage, 'images')` in POST handler
- [ ] T030 [US2] Implement GitHub file upload to `ticket-assets/{ticketId}/` using @octokit/rest
- [ ] T031 [US2] Update ticket attachments array and increment version in database
- [ ] T032 [US2] Add optimistic concurrency control (version validation, 409 on mismatch)

### Frontend: Upload Mutation Hook

- [ ] T033 [P] [US2] Create upload mutation hook in `lib/hooks/use-image-upload.ts`
- [ ] T034 [US2] Implement optimistic update (show image immediately, rollback on error)
- [ ] T035 [US2] Add error handling with retry logic and toast notifications

### Frontend: Upload Button Component

- [ ] T036 [P] [US2] Create ImageUploadButton component in `components/ticket/image-upload-button.tsx`
- [ ] T037 [US2] Implement file picker with accept filter (.jpg,.png,.gif,.webp)
- [ ] T038 [US2] Add loading state during upload with progress indication
- [ ] T039 [US2] Integrate ImageUploadButton into ImageGallery with permission-based visibility

### Testing (US2)

- [ ] T040 Add POST endpoint tests to `tests/api/projects-tickets-image-uploads.spec.ts`
- [ ] T041 Add E2E test for uploading images to `tests/e2e/ticket-image-management.spec.ts`

**Acceptance Criteria**:
- [x] "Add Image" button visible only in SPECIFY/PLAN stages
- [x] File picker opens with correct format filter
- [x] Upload completes within 5 seconds for 5MB files
- [x] New image appears immediately with optimistic update
- [x] Error toast shows on upload failure with retry option
- [x] Permission denied (403) when attempting upload in wrong stage

---

## Phase 5: User Story 3 - Remove Unwanted Images (P3)

**User Story**: When images become outdated or irrelevant, users need to remove them to keep ticket context clean and focused.

**Independent Test**: Open ticket in PLAN stage → hover over image → click delete icon → confirm → image removed from gallery

**Why Third**: Maintenance functionality - important for long-term quality but less critical than view/add operations.

**Duration**: 3-4 hours

### Backend: DELETE Endpoint

- [ ] T042 [US3] Create DELETE endpoint file `app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts`
- [ ] T043 [US3] Implement DELETE handler with index parameter validation
- [ ] T044 [US3] Add permission check using `canEdit(stage, 'images')` in DELETE handler
- [ ] T045 [US3] Remove attachment at index from array, increment version
- [ ] T046 [US3] Add optimistic concurrency control (version validation)

### Frontend: Delete Mutation Hook

- [ ] T047 [P] [US3] Add delete mutation to `lib/hooks/use-image-mutations.ts` (create if doesn't exist from US2)
- [ ] T048 [US3] Implement optimistic update (remove from UI, rollback on error)
- [ ] T049 [US3] Add confirmation dialog using shadcn/ui AlertDialog

### Frontend: Delete Button Integration

- [ ] T050 [US3] Add delete button to ImageGallery thumbnail hover state with permission check
- [ ] T051 [US3] Wire delete button to mutation hook with confirmation

### Testing (US3)

- [ ] T052 Add DELETE endpoint tests to `tests/api/projects-tickets-image-uploads.spec.ts`
- [ ] T053 Add E2E test for deleting images to `tests/e2e/ticket-image-management.spec.ts`

**Acceptance Criteria**:
- [x] Delete button appears on hover only in SPECIFY/PLAN stages
- [x] Confirmation dialog shows before deletion
- [x] Image removed immediately from UI (optimistic)
- [x] Error toast shows on delete failure
- [x] Permission denied (403) when attempting delete in wrong stage

---

## Phase 6: User Story 4 - Replace Existing Image (P4)

**User Story**: When updating visual assets with newer versions, users need to replace an existing image while maintaining context.

**Independent Test**: Open ticket in SPECIFY stage → hover over image → click replace button → select new file → image updated at same position

**Why Fourth**: Quality-of-life improvement - users can achieve same result by delete + add, so this is optimization rather than core capability.

**Duration**: 3-4 hours

### Backend: PUT Replace Endpoint

- [ ] T054 [US4] Add PUT handler to `app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts`
- [ ] T055 [US4] Implement file upload and validation (reuse logic from POST handler)
- [ ] T056 [US4] Replace attachment at index, preserving array position
- [ ] T057 [US4] Add permission check and optimistic concurrency control

### Frontend: Replace Mutation Hook

- [ ] T058 [P] [US4] Add replace mutation to `lib/hooks/use-image-mutations.ts`
- [ ] T059 [US4] Implement optimistic update (show new image immediately)

### Frontend: Replace Button Integration

- [ ] T060 [US4] Add replace button to ImageGallery thumbnail hover state
- [ ] T061 [US4] Wire replace button to file picker and mutation hook

### Testing (US4)

- [ ] T062 Add PUT endpoint tests to `tests/api/projects-tickets-image-uploads.spec.ts`
- [ ] T063 Add E2E test for replacing images to `tests/e2e/ticket-image-management.spec.ts`

**Acceptance Criteria**:
- [x] Replace button appears on hover alongside delete button
- [x] File picker opens on click with format filter
- [x] New image replaces old at same index
- [x] Upload timestamp updates, filename may change
- [x] Permission denied (403) when attempting replace in wrong stage

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Handle edge cases, optimize performance, and ensure production readiness

**Duration**: 2-3 hours

### Tasks

- [ ] T064 [P] Add edge case handling for empty state ("No images attached" message)
- [ ] T065 [P] Add edge case handling for corrupt images (broken image placeholder)
- [ ] T066 [P] Add accessibility improvements (alt text, screen reader announcements, keyboard navigation)
- [ ] T067 Verify performance targets: <2s modal load, <3s lazy load, <5s upload for 5MB files

**Acceptance Criteria**:
- [x] All edge cases from spec handled gracefully
- [x] All performance targets met
- [x] Accessibility audit passes
- [x] No console errors or warnings

---

## Parallel Execution Opportunities

### Within User Story 1 (can run concurrently after T012 completes)
- T013, T014 (Query hooks)
- T015, T020 (Components scaffolding)

### Within User Story 2 (can run concurrently after T031 completes)
- T033, T036 (Mutation hook and upload button scaffolding)

### Within User Story 3 (can run concurrently after T046 completes)
- T047 (Mutation hook)

### Within User Story 4 (can run concurrently after T057 completes)
- T058 (Mutation hook)

### Across User Stories (after US1 complete)
- US2, US3, US4 can proceed in parallel as they are independent features

### Phase 7 Polish Tasks
- All T064-T066 can run in parallel

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)
**Deliver**: User Story 1 (View Attached Images) only
**Timeline**: 1-2 days
**Value**: Users can immediately view existing ticket images with lazy loading optimization

### Incremental Delivery Plan

**Week 1: MVP**
- Complete User Story 1
- Deploy to production
- Gather user feedback on viewing experience

**Week 2: Add Capability**
- Complete User Story 2 (Add Images)
- Deploy to production
- Monitor upload performance and error rates

**Week 3: Edit Capability**
- Complete User Story 3 (Remove Images)
- Complete User Story 4 (Replace Images)
- Deploy to production

**Week 4: Polish**
- Complete Phase 7 tasks
- Performance optimization
- Accessibility improvements

### Risk Mitigation
- Feature flag: Wrap image gallery UI in feature flag for gradual rollout
- Monitoring: Track image load times, upload success rates, permission denials
- Rollback plan: Feature flag can disable image management without code deployment

---

## Testing Strategy

### Test Discovery (MANDATORY)
Before creating any new test files, search for existing tests:
```bash
npx grep -r "attachments\|images" tests/
npx glob "tests/**/*upload*.spec.ts"
npx glob "tests/**/*ticket*.spec.ts"
```

**Extend existing tests** in `tests/api/projects-tickets-image-uploads.spec.ts` if found.

### Test Coverage Requirements

**API Contract Tests** (`tests/api/projects-tickets-image-uploads.spec.ts`):
- GET /images returns correct metadata (US1)
- POST /images uploads file and updates attachments (US2)
- DELETE /images/:index removes correct item (US3)
- PUT /images/:index replaces at correct index (US4)
- Permission checks enforce stage restrictions (all endpoints)
- Version conflicts return 409 (all mutations)

**E2E Workflow Tests** (`tests/e2e/ticket-image-management.spec.ts`):
- User views images in INBOX stage (US1)
- User uploads image in SPECIFY stage (US2)
- User deletes image in PLAN stage (US3)
- User replaces image in SPECIFY stage (US4)
- User cannot upload in BUILD stage (permission test)
- Lightbox navigation works correctly (US1)
- Concurrent edit conflict handling (optimistic concurrency)

**Unit Tests** (`tests/unit/image-permission-guard.test.ts`):
- `canEdit('SPECIFY', 'images')` returns true
- `canEdit('BUILD', 'images')` returns false
- `canEdit('PLAN', 'images')` returns true
- Permission matrix completeness validation

---

## Success Metrics

### Performance Targets
- [x] Modal load time: <2s even with 10+ images (metadata only)
- [x] Lazy load time: <3s to display images after click
- [x] Upload time: <5s for 5MB files on broadband connection
- [x] Bandwidth reduction: 60% vs. auto-loading all images

### Quality Targets
- [x] Zero permission bypass incidents
- [x] 95% operation success rate without retries
- [x] All acceptance criteria passing in E2E tests
- [x] Zero console errors or warnings

### User Experience Targets
- [x] All user stories independently testable
- [x] Each story delivers standalone value
- [x] Clear error messages for all failure scenarios
- [x] Optimistic UI updates for instant feedback

---

## File Reference

### New Files Created
- `app/api/projects/[projectId]/tickets/[id]/images/route.ts` (GET, POST)
- `app/api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]/route.ts` (DELETE, PUT)
- `lib/schemas/ticket-image.ts` (Zod validation)
- `lib/hooks/use-ticket-images.ts` (TanStack Query)
- `lib/hooks/use-image-upload.ts` or `use-image-mutations.ts` (Mutations)
- `components/ticket/image-gallery.tsx` (Gallery component)
- `components/ticket/image-lightbox.tsx` (Lightbox component)
- `components/ticket/image-upload-button.tsx` (Upload UI)
- `tests/e2e/ticket-image-management.spec.ts` (E2E tests)
- `tests/unit/image-permission-guard.test.ts` (Unit tests)

### Modified Files
- `components/ticket/edit-permission-guard.tsx` (add 'images' type)
- `components/board/ticket-detail-modal.tsx` (integrate gallery)
- `tests/api/projects-tickets-image-uploads.spec.ts` (extend with new endpoints)

### Existing Files Referenced
- `app/lib/types/ticket.ts` (TicketAttachment interface)
- `app/api/projects/[projectId]/tickets/route.ts` (image upload pattern)

---

## Next Steps

1. Review this task breakdown with stakeholders
2. Prioritize MVP scope (US1 only recommended)
3. Begin with Phase 1: Setup tasks (T001-T004)
4. Complete Phase 2: Foundational tasks (blocking)
5. Implement User Story 1 following TDD workflow
6. Deploy MVP and gather feedback
7. Incrementally add US2, US3, US4 based on user needs

**Ready to start?** Begin with T001: Search for existing tests.
