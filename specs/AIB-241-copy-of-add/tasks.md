# Tasks: Global TooltipProvider Refactoring

**Input**: Design documents from `/specs/AIB-241-copy-of-add/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Not requested in the feature specification. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the global TooltipProvider to the root layout before removing local instances

- [x] T001 [US1] Add `TooltipProvider` import and wrapper inside `SessionProvider` in `app/layout.tsx`

**Checkpoint**: Global TooltipProvider is now available to all descendant components

---

## Phase 2: User Story 1 - Tooltips Continue to Appear on Hover (Priority: P1)

**Goal**: Remove all local TooltipProvider wrappers from 8 components while preserving identical tooltip behavior

**Independent Test**: Hover over each tooltip-enabled element (job status, deploy/preview icons, close/trash zones, mentions, autocomplete) and verify tooltips appear with correct content and timing

### Implementation for User Story 1

- [x] T002 [P] [US1] Remove `TooltipProvider` import and wrapper from `components/board/job-status-indicator.tsx`
- [x] T003 [P] [US1] Remove `TooltipProvider` import and wrapper from `components/board/ticket-card.tsx`
- [x] T004 [P] [US1] Remove `TooltipProvider` import and wrapper from `components/board/ticket-card-preview-icon.tsx`
- [x] T005 [P] [US1] Remove `TooltipProvider` import and wrapper from `components/board/ticket-card-deploy-icon.tsx`
- [x] T006 [P] [US1] Remove `TooltipProvider` import and wrapper from `components/board/close-zone.tsx`
- [x] T007 [P] [US1] Remove `TooltipProvider` import and wrapper from `components/board/trash-zone.tsx`
- [x] T008 [P] [US1] Remove `TooltipProvider` import and wrapper from `components/comments/user-autocomplete.tsx`
- [x] T009 [US1] Remove `TooltipProvider` import and wrapper from `components/comments/mention-display.tsx`, move `delayDuration={300}` to `<Tooltip delayDuration={300}>`

**Checkpoint**: All 8 components no longer use local TooltipProvider; all tooltips still function via the global provider

---

## Phase 3: User Story 2 - Cleaner Component Code (Priority: P2)

**Goal**: Verify the codebase is clean - no stale TooltipProvider imports remain outside of `components/ui/tooltip.tsx` and `app/layout.tsx`

**Independent Test**: Search all component files for `TooltipProvider` and confirm it only appears in the UI primitive definition and root layout

### Implementation for User Story 2

- [x] T010 [US2] Verify no remaining `TooltipProvider` imports exist in component files (only in `components/ui/tooltip.tsx` and `app/layout.tsx`)

**Checkpoint**: Codebase is clean with a single global TooltipProvider pattern

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that refactoring introduces no regressions

- [x] T011 Run `bun run type-check` to verify no TypeScript errors
- [x] T012 Run `bun run lint` to verify no lint errors
- [x] T013 Run `bun run test:unit` to verify existing tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - must complete first to ensure global provider exists before removing local ones
- **User Story 1 (Phase 2)**: Depends on Phase 1 (global provider must exist before removing local providers)
- **User Story 2 (Phase 3)**: Depends on Phase 2 (verification after all removals)
- **Polish (Phase 4)**: Depends on Phase 3 (final validation)

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Setup (Phase 1) - core functional refactoring
- **User Story 2 (P2)**: Depends on User Story 1 (Phase 2) - verification of cleanliness

### Within User Story 1

- T001 must complete before T002-T009 (global provider must exist first)
- T002-T008 can all run in parallel (different files, no dependencies)
- T009 can run in parallel with T002-T008 but requires careful handling of `delayDuration`

### Parallel Opportunities

- T002-T008 can all execute in parallel (7 independent file modifications)
- T009 can execute in parallel with T002-T008
- T011-T013 can execute in parallel (independent validation commands)

---

## Parallel Example: User Story 1

```bash
# After T001 completes, launch all component modifications together:
Task: "Remove TooltipProvider from components/board/job-status-indicator.tsx"
Task: "Remove TooltipProvider from components/board/ticket-card.tsx"
Task: "Remove TooltipProvider from components/board/ticket-card-preview-icon.tsx"
Task: "Remove TooltipProvider from components/board/ticket-card-deploy-icon.tsx"
Task: "Remove TooltipProvider from components/board/close-zone.tsx"
Task: "Remove TooltipProvider from components/board/trash-zone.tsx"
Task: "Remove TooltipProvider from components/comments/user-autocomplete.tsx"
Task: "Remove TooltipProvider from components/comments/mention-display.tsx (with delay migration)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Add global TooltipProvider to layout
2. Complete Phase 2: Remove all 8 local TooltipProvider wrappers
3. **STOP and VALIDATE**: All tooltips still work identically
4. Proceed to verification and polish

### Incremental Delivery

1. Add global provider (T001) -> Foundation ready
2. Remove local providers (T002-T009) -> All tooltips use global provider (MVP!)
3. Verify cleanliness (T010) -> Code quality confirmed
4. Run validation suite (T011-T013) -> No regressions confirmed

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- T009 (mention-display.tsx) is the only component requiring special handling due to custom `delayDuration={300}`
- No new files are created; this is purely modifying existing files
- Net change is approximately -21 lines across 9 files
- Commit after each task or logical group
