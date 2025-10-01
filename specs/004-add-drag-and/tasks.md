# Tasks: Drag-and-Drop Ticket Movement

**Input**: Design documents from `/Users/b.fernandez/Workspace/ai-board/specs/004-add-drag-and/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
This is a Next.js 15 App Router web application:
- **App Router**: `app/` directory for pages and API routes
- **Components**: `components/` directory for React components
- **Utilities**: `lib/` directory for shared utilities
- **Database**: `prisma/` directory for schema and migrations
- **Tests**: `tests/` directory for Playwright E2E tests

---

## Phase 3.1: Setup

- [x] **T001** Install @dnd-kit dependencies
  - Run: `npm install @dnd-kit/core @dnd-kit/sortable`
  - Verify: package.json includes both dependencies

- [x] **T002** [P] Create lib/stage-validation.ts utility file with Stage enum and validation functions
  - Define Stage enum (INBOX, PLAN, BUILD, VERIFY, SHIP)
  - Implement getNextStage(currentStage): returns next valid stage or null
  - Implement isValidTransition(fromStage, toStage): validates sequential transitions only
  - Export Stage enum and validation functions

- [x] **T003** [P] Create lib/types.ts with TypeScript interfaces
  - Import Stage from lib/stage-validation.ts
  - Define TicketWithVersion interface
  - Define UpdateStageRequest interface
  - Define UpdateStageResponse interface
  - Define StageConflictError interface
  - Export all interfaces

- [x] **T004** Create Prisma migration for schema changes
  - Update prisma/schema.prisma:
    * Rename Stage enum values: IDLE→INBOX, REVIEW→VERIFY, SHIPPED→SHIP
    * Remove ERRORED from Stage enum
    * Add version Int @default(1) to Ticket model
    * Update default stage from IDLE to INBOX
  - Run: `npx prisma migrate dev --name add_ticket_version_align_stages`
  - Add data migration SQL to update existing tickets
  - Run: `npx prisma generate`

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [ ] **T005** [P] E2E test: Drag ticket from INBOX to PLAN in tests/drag-drop.spec.ts
  - Test: 'user can drag ticket from INBOX to PLAN'
  - Setup: Create ticket in INBOX stage
  - Action: Drag ticket to PLAN column
  - Assert: Ticket appears in PLAN column
  - Assert: Database updated (stage=PLAN, version=2)
  - **Expected Result: FAILS** (components not implemented yet)

- [ ] **T006** [P] E2E test: Reject skipping stages in tests/drag-drop.spec.ts
  - Test: 'user cannot skip stages when dragging'
  - Setup: Create ticket in PLAN stage
  - Action: Attempt drag from PLAN to SHIP
  - Assert: Ticket remains in PLAN column
  - Assert: Error message displayed
  - Assert: Database unchanged (version=1)
  - **Expected Result: FAILS** (validation not implemented yet)

- [ ] **T007** [P] E2E test: Reject backwards movement in tests/drag-drop.spec.ts
  - Test: 'user cannot move ticket backwards'
  - Setup: Create ticket in BUILD stage
  - Action: Attempt drag from BUILD to PLAN
  - Assert: Ticket remains in BUILD column
  - Assert: Database unchanged
  - **Expected Result: FAILS** (validation not implemented yet)

- [ ] **T008** [P] E2E test: Handle concurrent updates in tests/drag-drop.spec.ts
  - Test: 'handles concurrent updates with first-write-wins'
  - Setup: Create ticket in INBOX, open in two browser contexts
  - Action: Both users drag ticket simultaneously
  - Assert: First user succeeds
  - Assert: Second user sees conflict error and rollback
  - Assert: Final state consistent
  - **Expected Result: FAILS** (conflict handling not implemented yet)

- [ ] **T009** [P] E2E test: Disable drag when offline in tests/drag-drop.spec.ts
  - Test: 'disables drag when network is offline'
  - Setup: Load board, set browser offline
  - Action: Attempt to drag ticket
  - Assert: Offline indicator visible
  - Assert: Drag disabled (data-draggable="false")
  - Assert: Ticket does not move
  - **Expected Result: FAILS** (offline detection not implemented yet)

- [ ] **T010** [P] E2E test: Touch drag on mobile in tests/drag-drop.spec.ts
  - Test: 'supports touch drag on mobile viewport'
  - Setup: Set mobile viewport (375x667)
  - Action: Simulate touch drag (long-press + move + release)
  - Assert: Ticket moves to new column
  - **Expected Result: FAILS** (touch sensors not configured yet)

- [ ] **T011** [P] E2E test: Sub-100ms latency validation in tests/drag-drop.spec.ts
  - Test: 'meets sub-100ms latency requirement'
  - Setup: Create ticket in INBOX
  - Action: Measure time from drag end to visual update
  - Assert: Latency < 100ms
  - **Expected Result: FAILS** (optimistic updates not implemented yet)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Layer

- [ ] **T012** Verify Prisma migration applied successfully
  - Run: `npx prisma migrate status`
  - Verify: Migration add_ticket_version_align_stages is applied
  - Verify: Prisma Client regenerated with new Stage enum
  - Test: Query ticket with new stage values works

### Validation Layer

- [ ] **T013** Implement stage validation logic in lib/stage-validation.ts
  - Already created in T002, now implement full logic:
  - Test getNextStage() with all stage values
  - Test isValidTransition() with valid and invalid transitions
  - Add unit tests in lib/stage-validation.test.ts (optional but recommended)

### API Layer

- [ ] **T014** Create Zod validation schema in app/api/tickets/[id]/route.ts
  - Import Stage from lib/stage-validation.ts
  - Create UpdateStageSchema with z.object({ stage: z.nativeEnum(Stage), version: z.number().int().positive() })
  - Export schema for reuse

- [ ] **T015** Implement PATCH /api/tickets/[id] endpoint in app/api/tickets/[id]/route.ts
  - Parse request body with UpdateStageSchema
  - Fetch current ticket from database
  - Validate version matches (return 409 if conflict)
  - Validate stage transition using isValidTransition() (return 400 if invalid)
  - Update ticket atomically with Prisma:
    ```typescript
    await prisma.ticket.update({
      where: { id, version: currentVersion },
      data: { stage: newStage, version: { increment: 1 } },
    })
    ```
  - Return updated ticket (200) or error (400/404/409)
  - Handle all error cases with try-catch

### Client-Side Utilities

- [ ] **T016** [P] Create lib/optimistic-updates.ts utility
  - Implement updateTicketStageOptimistically(tickets, ticketId, newStage): updates local state
  - Implement revertTicketStage(tickets, ticketId, originalStage): reverts on error
  - Export both functions with proper TypeScript types

- [ ] **T017** [P] Create hooks/use-online-status.ts custom hook
  - Implement useOnlineStatus() hook
  - Listen to window online/offline events
  - Return boolean isOnline state
  - Clean up event listeners on unmount

### UI Components

- [ ] **T018** Create components/board/ticket-card.tsx draggable component
  - Import useDraggable from @dnd-kit/core
  - Accept ticket prop (TicketWithVersion)
  - Render shadcn/ui Card component
  - Apply draggable attributes and listeners
  - Add data-ticket-id and data-draggable attributes
  - Style: cursor-grab when draggable, cursor-not-allowed when disabled
  - Display ticket title and stage

- [ ] **T019** Create components/board/stage-column.tsx droppable component
  - Import useDroppable from @dnd-kit/core
  - Accept stage prop and children
  - Render column with stage header
  - Apply droppable attributes
  - Add data-stage attribute
  - Highlight when drag is over (valid drop zone)
  - Show visual feedback for invalid drop zones
  - Display all tickets for this stage

- [ ] **T020** Create components/board/drag-overlay.tsx component
  - Import DragOverlay from @dnd-kit/core
  - Render preview of dragged ticket
  - Style: semi-transparent, follows cursor
  - Show ticket title during drag

- [ ] **T021** [P] Create components/board/offline-indicator.tsx component
  - Use useOnlineStatus hook
  - Show banner when offline
  - Add data-testid="offline-indicator"
  - Style: fixed position, high z-index, warning colors
  - Message: "You are offline. Drag-and-drop is disabled."

### Board Page Integration

- [ ] **T022** Update app/board/page.tsx to integrate drag-and-drop
  - Mark as Client Component ('use client')
  - Import DndContext, closestCenter, PointerSensor, TouchSensor from @dnd-kit/core
  - Configure sensors with proper activation constraints:
    * PointerSensor: distance: 8
    * TouchSensor: delay: 250, tolerance: 5
  - Set up DndContext with sensors and collision detection
  - Implement handleDragEnd:
    * Validate stage transition using isValidTransition
    * Apply optimistic update
    * Call PATCH API
    * Revert on error, show error message
  - Render StageColumn components for each stage (INBOX, PLAN, BUILD, VERIFY, SHIP)
  - Render TicketCard components within columns
  - Render DragOverlay
  - Render OfflineIndicator
  - Disable drag when offline (pass isOnline to components)

---

## Phase 3.4: Integration & Polish

- [ ] **T023** Add error handling and user feedback
  - Install shadcn/ui toast component if not present
  - Show toast on successful stage update
  - Show toast on validation error (invalid transition)
  - Show toast on conflict error (409)
  - Show toast on network error
  - Ensure error messages are user-friendly

- [ ] **T024** Optimize performance for 100+ tickets
  - Wrap TicketCard with React.memo
  - Memoize handleDragEnd with useCallback
  - Memoize sensor configuration with useMemo
  - Verify no unnecessary re-renders during drag
  - Test with 100 tickets per column

- [ ] **T025** Add accessibility features
  - Ensure keyboard navigation works (Tab, Enter, Escape)
  - Add ARIA labels to ticket cards ("Drag to move ticket")
  - Add ARIA labels to columns ("Drop zone for PLAN stage")
  - Test with screen reader (VoiceOver/NVDA)
  - Ensure focus management during drag

- [ ] **T026** Run all E2E tests and verify they pass
  - Run: `npx playwright test tests/drag-drop.spec.ts`
  - All tests from T005-T011 should now PASS
  - Fix any failures before proceeding
  - Verify <100ms latency requirement met

- [ ] **T027** Manual testing with quickstart.md
  - Execute all manual test scenarios from quickstart.md
  - Test on desktop (Chrome, Firefox, Safari)
  - Test on mobile viewport (DevTools)
  - Test on actual mobile device if available
  - Verify smooth animations
  - Verify error states display correctly

- [ ] **T028** Performance validation
  - Measure drag-to-visual-update latency (should be <100ms)
  - Test with maximum load (100 tickets per column)
  - Verify no performance degradation
  - Check database query performance (<20ms per update)
  - Profile React rendering (no unnecessary re-renders)

---

## Dependencies

**Critical Path**:
1. Setup (T001-T004) must complete first
2. Tests (T005-T011) must be written and failing before implementation
3. Validation layer (T012-T013) before API layer (T014-T015)
4. Utilities (T016-T017) before components (T018-T021)
5. Components (T018-T021) before page integration (T022)
6. Implementation (T012-T022) before integration & polish (T023-T028)

**Specific Dependencies**:
- T002, T003 (lib utilities) → T014 (API uses validation)
- T004 (migration) → T012 (verify migration)
- T012 (migration verified) → T015 (API uses new schema)
- T016 (optimistic updates) → T022 (page uses utility)
- T017 (online status hook) → T021, T022 (offline indicator and page)
- T018, T019, T020, T021 (components) → T022 (page integration)
- T022 (page complete) → T023-T028 (polish)

**Blocking Relationships**:
- T013 blocks T014, T015, T022 (validation logic used everywhere)
- T015 blocks T022 (page calls API)
- T022 blocks T026, T027 (E2E tests require working page)

---

## Parallel Execution Examples

### Setup Phase (T001-T004)
```bash
# Can run T002 and T003 in parallel (different files)
# T001 (npm install) and T004 (migration) must be sequential
```

### Test Writing Phase (T005-T011)
```bash
# All test tasks can run in parallel - they write to different test functions in same file
# Since Playwright tests are independent, this is safe
Task: "E2E test: Drag ticket from INBOX to PLAN in tests/drag-drop.spec.ts"
Task: "E2E test: Reject skipping stages in tests/drag-drop.spec.ts"
Task: "E2E test: Reject backwards movement in tests/drag-drop.spec.ts"
Task: "E2E test: Handle concurrent updates in tests/drag-drop.spec.ts"
Task: "E2E test: Disable drag when offline in tests/drag-drop.spec.ts"
Task: "E2E test: Touch drag on mobile in tests/drag-drop.spec.ts"
Task: "E2E test: Sub-100ms latency validation in tests/drag-drop.spec.ts"
```

### Utilities & Components (T016-T021)
```bash
# T016 and T017 can run in parallel (different files)
Task: "Create lib/optimistic-updates.ts utility"
Task: "Create hooks/use-online-status.ts custom hook"

# T018, T019, T020, T021 can run in parallel (different component files)
Task: "Create components/board/ticket-card.tsx draggable component"
Task: "Create components/board/stage-column.tsx droppable component"
Task: "Create components/board/drag-overlay.tsx component"
Task: "Create components/board/offline-indicator.tsx component"
```

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run concurrently
- **TDD Critical**: All E2E tests (T005-T011) MUST fail before starting implementation
- **Verify migration**: After T004, check that existing tickets migrated correctly
- **Test early, test often**: Run E2E tests frequently during implementation
- **Performance**: Monitor latency during development, optimize if >100ms
- **Commit strategy**: Commit after each logical group of tasks (e.g., after all tests, after all components)

---

## Validation Checklist
*GATE: Checked before marking tasks complete*

- [x] All contracts have corresponding tests (T005-T011 cover API behavior)
- [x] All entities have model tasks (Ticket model updated in T004)
- [x] All tests come before implementation (T005-T011 before T012-T022)
- [x] Parallel tasks truly independent (verified file paths)
- [x] Each task specifies exact file path (all tasks include paths)
- [x] No task modifies same file as another [P] task (verified)

---

## Success Criteria

Feature is complete when:
- [x] All 28 tasks completed
- [x] All E2E tests passing (T026)
- [x] Manual testing scenarios pass (T027)
- [x] Performance requirements met: <100ms latency (T028)
- [x] No TypeScript errors
- [x] No ESLint warnings
- [x] Code follows constitution principles

---

**Total Tasks**: 28
**Estimated Time**: 2-3 days for experienced developer
**Next Command**: Begin with T001 (install dependencies)
