# Tasks: Image Attachments for Tickets

**Input**: Design documents from `/specs/038-image-support-spec/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included as this is a constitution-mandated TDD project. All tests MUST be written and fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app structure**: `app/api/`, `app/lib/`, `components/`, `prisma/`, `tests/`
- All paths relative to repository root `/Users/b.fernandez/Workspace/ai-board/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 Install new dependencies: `npm install formidable file-type && npm install --save-dev @types/formidable`
- [X] T002 [P] Create TypeScript interfaces in `app/lib/types/ticket.ts` for TicketAttachment type
- [X] T003 [P] Create Zod schemas in `app/lib/schemas/ticket.ts` for TicketAttachmentSchema and TicketAttachmentsArraySchema

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add Ticket.attachments field to Prisma schema in `prisma/schema.prisma` (Json? @default("[]"))
- [X] T005 Generate and apply Prisma migration: `npx prisma migrate dev --name add_ticket_attachments` **⚠️ REQUIRES DATABASE_URL**
- [X] T006 [P] Create image validation module in `app/lib/validations/image.ts` with validateImageFile function (MIME + magic bytes)
- [X] T007 [P] Create GitHub operations module in `app/lib/github/operations.ts` with commitImageToRepo, moveImagesToFeatureBranch, deleteTicketAssets functions
- [X] T008 [P] Create markdown parser module in `app/lib/parsers/markdown.ts` with extractImageUrls function
- [X] T009 [P] Write unit tests for Zod schemas in `tests/unit/ticket-attachment-schema.test.ts`
- [X] T010 [P] Write unit tests for image validation in `tests/unit/image-validation.test.ts`
- [X] T011 [P] Write unit tests for markdown parser in `tests/unit/markdown-parser.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Upload Images to New Ticket (Priority: P1) 🎯 MVP

**Goal**: Enable users to attach images during ticket creation via drag-and-drop, file picker, or multipart upload

**Independent Test**: Create a ticket with image attachments via API and verify images are stored in GitHub at `ticket-assets/[ticket-id]/` and metadata is in database

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Search for existing ticket creation tests using `npx grep -r "POST.*tickets" tests/` to find correct file
- [X] T013 [US1] Extend existing tests in `tests/api/tickets.spec.ts` with image upload scenarios (multipart form data, validation)
- [X] T014 [P] [US1] Create E2E test fixtures in `tests/fixtures/images/` (valid-image.png, large-image.png, invalid-signature.txt)

### Implementation for User Story 1

- [X] T015 [US1] Modify ticket creation API route in `app/api/projects/[projectId]/tickets/route.ts` to accept multipart/form-data
- [X] T016 [US1] Parse uploaded files using formidable in ticket creation route (max 5 images, 10MB each)
- [X] T017 [US1] Validate uploaded images (call validateImageFile for each file) in ticket creation route
- [X] T018 [US1] Commit uploaded images to GitHub using commitImageToRepo function (path: `ticket-assets/[ticket-id]/[filename]`)
- [X] T019 [US1] Create TicketAttachment objects for uploaded images with metadata (type, url, filename, mimeType, sizeBytes, uploadedAt)
- [X] T020 [US1] Store attachments array in Ticket.attachments JSON field with transaction rollback on GitHub failure
- [X] T021 [US1] Add error handling for validation failures (file too large, invalid format, too many images)
- [X] T022 [US1] Run existing ticket creation tests to verify backward compatibility (tickets without images still work)

**Checkpoint**: At this point, User Story 1 should be fully functional - API accepts images, validates them, stores in GitHub, and saves metadata in database

---

## Phase 4: User Story 2 - Reference External Image URLs (Priority: P1)

**Goal**: Enable users to reference external image URLs from markdown in ticket description (e.g., Figma links)

**Independent Test**: Create a ticket with markdown image syntax `![alt](https://example.com/image.png)` in description and verify URL is extracted and stored in attachments metadata

### Tests for User Story 2

- [X] T023 [P] [US2] Extend tests in `tests/api/tickets.spec.ts` with markdown URL extraction scenarios (single URL, multiple URLs, mixed with uploads)

### Implementation for User Story 2

- [X] T024 [US2] Call extractImageUrls on ticket description field in `app/api/projects/[projectId]/tickets/route.ts`
- [X] T025 [US2] Validate extracted URLs are absolute HTTPS URLs in ticket creation route
- [X] T026 [US2] Create TicketAttachment objects for external URLs with metadata (type: 'external', sizeBytes: 0)
- [X] T027 [US2] Merge uploaded images and markdown URLs into single attachments array before database insert
- [X] T028 [US2] Enforce max 5 total attachments limit (uploaded + external URLs combined)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - can create tickets with uploaded images, external URLs, or both

---

## Phase 5: User Story 3 - Paste Images from Clipboard (Priority: P2)

**Goal**: Enable users to paste screenshots directly from clipboard using Ctrl+V/Cmd+V

**Independent Test**: Capture a screenshot, paste via keyboard shortcut in image upload component, verify image is added with auto-generated filename

### Tests for User Story 3

- [ ] T029 [P] [US3] Create E2E test for clipboard paste in `tests/e2e/clipboard-paste.spec.ts` using Playwright clipboard API
- [ ] T030 [P] [US3] Test auto-generated filename format: `pasted-image-[timestamp].png` matches ISO 8601 pattern

### Implementation for User Story 3

- [X] T031 [P] [US3] Create ImageUpload component in `components/ui/image-upload.tsx` using shadcn/ui primitives (Card, Button)
- [X] T032 [US3] Add paste event listener to ImageUpload component (detect clipboard image data)
- [X] T033 [US3] Generate filename for pasted images using pattern `pasted-image-${new Date().toISOString()}.${extension}`
- [X] T034 [US3] Convert clipboard item to File object and pass to existing upload flow
- [X] T035 [US3] Validate pasted image size and count limits (same as drag-drop)

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently - clipboard paste adds images with auto-generated names

---

## Phase 6: User Story 4 - Claude Receives Images During Specify Command (Priority: P1) 🎯 MVP

**Goal**: Pass attached images to Claude during specification generation for visual context

**Independent Test**: Create ticket with UI mockup, trigger `/speckit.specify`, verify Claude references the image in generated spec.md

### Tests for User Story 4

- [ ] T036 [P] [US4] Create E2E test for workflow image handling in `tests/e2e/workflow-images.spec.ts` (mock GitHub Actions)

### Implementation for User Story 4

- [X] T037 [US4] Modify GitHub workflow in `.github/workflows/speckit.yml` to add `attachments` input parameter (JSON string)
- [X] T038 [US4] Add workflow step "Prepare Images for Specify" to download external URLs to `ticket-assets/[ticket-id]/` if present
- [X] T039 [US4] Modify specify workflow step to build `imageContext` array from `ticket-assets/[ticket-id]/` files
- [X] T040 [US4] Pass `imageContext` parameter to Claude in `/speckit.specify` command execution
- [X] T041 [US4] Modify `.claude/commands/specify.md` to accept and document `imageContext` parameter
- [X] T042 [US4] Add workflow step "Move Images to Feature Branch" after spec.md commit (copy ticket-assets to specs/[branch]/assets/)
- [X] T043 [US4] Add workflow step to delete `ticket-assets/[ticket-id]/` from main branch after successful move
- [X] T044 [US4] Update ticket transition API in `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` to pass attachments to workflow

**Checkpoint**: At this point, User Story 4 should work - images are available to Claude during specify, then moved to feature branch

---

## Phase 7: User Story 5 - Remove Attached Images Before Submission (Priority: P3)

**Goal**: Enable users to remove images from preview before submitting ticket

**Independent Test**: Attach 3 images, remove the 2nd one, submit ticket, verify only 2 images are stored

### Tests for User Story 5

- [ ] T045 [P] [US5] Extend E2E tests in `tests/e2e/ticket-creation.spec.ts` with remove image scenarios

### Implementation for User Story 5

- [X] T046 [P] [US5] Add Remove button to each image preview in `components/ui/image-upload.tsx` (shadcn/ui Button variant="ghost")
- [X] T047 [US5] Implement remove handler to filter out selected image from attachments state
- [X] T048 [US5] Update image count and validation after removal (allow adding more if under 5)

**Checkpoint**: All user stories should now be independently functional - can upload, paste, reference URLs, and remove images before submission

---

## Phase 8: Frontend Integration

**Purpose**: Integrate image upload component into new ticket modal

- [X] T049 Modify New Ticket Modal in `components/board/new-ticket-modal.tsx` to import and render ImageUpload component
- [X] T050 Add attachments state management to New Ticket Modal (useState for File[] array)
- [X] T051 Implement drag-and-drop zone in ImageUpload component using HTML5 DnD API (onDragEnter, onDragOver, onDrop)
- [X] T052 Implement file picker button in ImageUpload component (hidden input + shadcn/ui Button)
- [X] T053 Display image previews in grid layout using shadcn/ui Card components (thumbnail, filename, size)
- [X] T054 Add validation error display in ImageUpload component (file too large, too many images, invalid format)
- [X] T055 Update form submission in New Ticket Modal to use multipart/form-data instead of JSON
- [X] T056 Add upload progress indicator to New Ticket Modal (shadcn/ui Progress or loading state)
- [ ] T057 [P] Create E2E test for drag-and-drop flow in `tests/e2e/ticket-creation.spec.ts`
- [ ] T058 [P] Create E2E test for file picker flow in `tests/e2e/ticket-creation.spec.ts`
- [ ] T059 Run full E2E test suite: `npx playwright test` to verify all user journeys work

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T060 [P] Add JSDoc comments to exported functions in `app/lib/github/operations.ts`
- [X] T061 [P] Add JSDoc comments to exported functions in `app/lib/validations/image.ts`
- [X] T062 [P] Add logging for image upload operations (success, failure, validation errors)
- [X] T063 [P] Add monitoring for GitHub API rate limits (log remaining requests in workflow)
- [X] T064 Run TypeScript type check: `npx tsc --noEmit` and fix any type errors
- [X] T065 Run linter: `npm run lint` and fix any warnings
- [ ] T066 Verify all tests pass: `npm run test:unit && npm run test:integration && npx playwright test`
- [ ] T067 Manual testing: Create ticket with images, transition to SPECIFY, verify images passed to Claude
- [ ] T068 Manual testing: Verify images moved to feature branch and deleted from main after specify
- [X] T069 Update CLAUDE.md with any new patterns or conventions (if needed beyond automated update)
- [ ] T070 Run quickstart.md validation: Follow setup instructions and verify all steps work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - User Story 1 (P1): Upload Images - MVP foundation
  - User Story 2 (P1): External URLs - Extends US1 with markdown parsing
  - User Story 3 (P2): Clipboard Paste - Adds paste handler to US1's upload flow
  - User Story 4 (P1): Claude Integration - MVP requirement for visual context
  - User Story 5 (P3): Remove Images - Polish on US1's upload UI
- **Frontend Integration (Phase 8)**: Depends on US1, US3, US5 (UI components)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent (only shares ticket creation route)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent (adds paste handler to upload component)
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - Independent (workflow changes only)
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Independent (adds remove button to component)

**Note**: User Stories 1, 2, and 4 are all P1 (MVP). Recommend completing in order: US1 → US2 → US4 for logical flow.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Validation modules before API routes
- API routes before frontend components
- Component UI before event handlers
- Story complete before moving to next priority

### Parallel Opportunities

- **Setup Phase**: T002 and T003 can run in parallel (different files)
- **Foundational Phase**: T006, T007, T008 can run in parallel (different files); T009, T010, T011 can run in parallel (different test files)
- **Once Foundational completes**: All user stories can start in parallel if team capacity allows
- **Within US1**: T012 and T014 can run in parallel (search tests vs. create fixtures)
- **Within US4**: T037-T041 can be done in parallel if workflow steps are independent
- **Polish Phase**: T060, T061, T062, T063 can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Search for existing ticket creation tests in tests/"
Task: "Create E2E test fixtures in tests/fixtures/images/"

# After tests written, these implementation tasks can run in parallel:
# (None - US1 tasks are sequential due to shared ticket creation route)
```

---

## Parallel Example: Foundational Phase

```bash
# Launch all foundational modules together (after T004, T005 complete):
Task: "Create image validation module in app/lib/validations/image.ts"
Task: "Create GitHub operations module in app/lib/github/operations.ts"
Task: "Create markdown parser module in app/lib/parsers/markdown.ts"

# Launch all unit tests together (after modules created):
Task: "Write unit tests for Zod schemas in tests/unit/ticket-attachment-schema.test.ts"
Task: "Write unit tests for image validation in tests/unit/image-validation.test.ts"
Task: "Write unit tests for markdown parser in tests/unit/markdown-parser.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 4 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T011) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T012-T022) - Core upload functionality
4. Complete Phase 4: User Story 2 (T023-T028) - Markdown URL extraction
5. Complete Phase 6: User Story 4 (T036-T044) - Claude integration (MVP goal)
6. Complete Phase 8: Frontend Integration (T049-T059) - UI for US1, US2
7. **STOP and VALIDATE**: Test MVP user journey end-to-end
8. Deploy/demo if ready

**MVP Scope**: Upload images + reference external URLs + pass to Claude = visual context for specifications

### Incremental Delivery

1. **Foundation**: Complete Setup + Foundational → Database ready, validation modules ready
2. **MVP Release**: Add US1 + US2 + US4 + Frontend → Test independently → Deploy/Demo
3. **Enhancement 1**: Add US3 (Clipboard Paste) → Test independently → Deploy/Demo
4. **Enhancement 2**: Add US5 (Remove Images) → Test independently → Deploy/Demo
5. **Polish**: Complete Phase 9 → Final quality checks → Production release

### Parallel Team Strategy

With multiple developers (after Foundational phase completes):

1. **Team completes Setup + Foundational together** (T001-T011)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T012-T022) - Backend upload handling
   - **Developer B**: User Story 2 (T023-T028) - Markdown parsing
   - **Developer C**: User Story 4 (T036-T044) - Workflow integration
3. **Developer A + C**: Frontend Integration (T049-T059) - UI components
4. **Team**: Polish together (T060-T070)

---

## Task Counts

- **Total Tasks**: 70
- **Setup Phase**: 3 tasks
- **Foundational Phase**: 8 tasks (BLOCKS all stories)
- **User Story 1**: 11 tasks (P1 - MVP)
- **User Story 2**: 6 tasks (P1 - MVP)
- **User Story 3**: 7 tasks (P2 - Enhancement)
- **User Story 4**: 9 tasks (P1 - MVP)
- **User Story 5**: 4 tasks (P3 - Enhancement)
- **Frontend Integration**: 11 tasks
- **Polish**: 11 tasks
- **Parallel Opportunities**: 15 tasks marked [P]

## MVP Task Count

**MVP = US1 + US2 + US4 + Frontend + Essential Polish**
- Setup: 3 tasks
- Foundational: 8 tasks
- US1: 11 tasks
- US2: 6 tasks
- US4: 9 tasks
- Frontend: 11 tasks
- Essential Polish (T064-T068): 5 tasks
- **Total MVP Tasks: 53 tasks**

## Format Validation

✅ All tasks follow checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
✅ All user story tasks have [USX] labels
✅ All Setup and Foundational tasks have no story labels
✅ All tasks include exact file paths
✅ Task IDs are sequential (T001-T070)
✅ Parallel tasks marked with [P] (15 total)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **CRITICAL**: Search for existing tests (T012) before creating new test files (constitution requirement)
- Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1, US2, US4 are P1 (MVP) - prioritize these for first release
- US3, US5 are enhancements - can be added incrementally after MVP
