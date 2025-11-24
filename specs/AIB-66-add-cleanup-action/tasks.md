# Tasks: Add Cleanup Action in Burger Menu

**Input**: Design documents from `/specs/AIB-66-add-cleanup-action/`
**Prerequisites**: spec.md (required)

**Tests**: Tests are NOT included - not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single Next.js app**: `components/`, `app/` at repository root
- Components organized by domain: `components/layout/`, `components/cleanup/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and interface preparation

- [x] T001 Add projectId prop to MobileMenuProps interface in components/layout/mobile-menu.tsx ✅ DONE
- [x] T002 Pass projectId from Header to MobileMenu in components/layout/header.tsx ✅ DONE

**Checkpoint**: MobileMenu now receives projectId prop needed for cleanup functionality

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core state management that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add showCleanupDialog state to MobileMenu component in components/layout/mobile-menu.tsx ✅ DONE
- [x] T004 Import CleanupConfirmDialog and Sparkles icon in components/layout/mobile-menu.tsx ✅ DONE

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Trigger Cleanup from Mobile Burger Menu (Priority: P1) 🎯 MVP

**Goal**: Enable project owners/members on mobile to trigger the cleanup workflow from the burger menu without switching to desktop

**Independent Test**: Navigate to a project board on mobile, open the burger menu, verify "Clean Project" action appears with Sparkles icon, tap it, confirm dialog opens, confirm triggers cleanup workflow successfully

### Implementation for User Story 1

- [x] T005 [US1] Add "Clean Project" menu item with Sparkles icon in project section after specs link in components/layout/mobile-menu.tsx ✅ DONE
- [x] T006 [US1] Add onClick handler to "Clean Project" that opens CleanupConfirmDialog in components/layout/mobile-menu.tsx ✅ DONE
- [x] T007 [US1] Render CleanupConfirmDialog conditionally when showCleanupDialog is true in components/layout/mobile-menu.tsx ✅ DONE
- [x] T008 [US1] Implement handleCleanupClose callback to close dialog and sheet in components/layout/mobile-menu.tsx ✅ DONE
- [x] T009 [US1] Implement handleCleanupSuccess callback to close dialog and sheet on success in components/layout/mobile-menu.tsx ✅ DONE

**Checkpoint**: At this point, User Story 1 should be fully functional - authenticated users on project pages can trigger cleanup from mobile menu

---

## Phase 4: User Story 2 - Menu Hides Cleanup When Not in Project (Priority: P2)

**Goal**: Ensure the cleanup option only appears when user is within a project context for clean UX

**Independent Test**: Navigate to non-project pages (home, projects list), open burger menu, verify "Clean Project" option is absent

### Implementation for User Story 2

- [x] T010 [US2] Wrap "Clean Project" menu item in conditional that checks projectId exists in components/layout/mobile-menu.tsx ✅ DONE

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - cleanup only shows in project context

---

## Phase 5: User Story 3 - Unauthenticated User Cannot See Cleanup (Priority: P3)

**Goal**: Ensure unauthenticated users cannot see cleanup options for security

**Independent Test**: View a project page without authentication, open burger menu, verify no "Clean Project" option appears

### Implementation for User Story 3

- [x] T011 [US3] Add authentication check to "Clean Project" visibility condition using session from useSession in components/layout/mobile-menu.tsx ✅ DONE

**Checkpoint**: All user stories should now be independently functional - cleanup only visible to authenticated users in project context

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and validation

- [x] T012 [P] Verify visual consistency: Sparkles icon matches desktop ProjectMenu in components/layout/mobile-menu.tsx ✅ DONE
- [x] T013 Run type-check to ensure no TypeScript errors ✅ DONE
- [x] T014 Manual validation: Test all acceptance scenarios from spec.md ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Builds on US1/US2 but independently testable

### Within Each User Story

- Import statements before component logic
- State management before render logic
- Core implementation before validation
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks can run sequentially (same file dependencies)
- All Foundational tasks can run sequentially (same file)
- Once Foundational phase completes, user stories should be done sequentially (all in same file)
- Polish tasks marked [P] can run in parallel

---

## Parallel Example: Setup Phase

```bash
# These tasks modify the same file, so run sequentially:
Task T001: "Add projectId prop to MobileMenuProps interface"
Task T002: "Pass projectId from Header to MobileMenu" (depends on T001)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Single File Strategy

This feature is primarily implemented in a single file (`mobile-menu.tsx`) with a minor prop addition to `header.tsx`. The sequential approach is recommended:

1. Complete all phases in order
2. Each task builds on the previous
3. Single commit after each logical phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All US tasks are in the same file, so parallelization is limited
- Verify visual consistency with desktop ProjectMenu (same icon, same dialog)
- Reuse existing CleanupConfirmDialog without modification (as per checklist)
- Test on mobile viewport (below md breakpoint) for accurate testing
