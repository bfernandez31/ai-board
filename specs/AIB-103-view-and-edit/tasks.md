# Tasks: View and Edit the Constitution

**Input**: Design documents from `/specs/AIB-103-view-and-edit/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.yaml

**Tests**: Not explicitly requested in feature specification - test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create TypeScript interfaces and shared utilities that all user stories depend on

- [X] T001 [P] Create constitution TypeScript interfaces in lib/types/constitution.ts ✅ DONE
- [X] T002 [P] Create constitution fetcher utility in lib/github/constitution-fetcher.ts ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API routes and query hooks that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete

- [X] T003 Create GET endpoint for constitution content in app/api/projects/[projectId]/constitution/route.ts ✅ DONE
- [X] T004 Add PUT endpoint for constitution update in app/api/projects/[projectId]/constitution/route.ts ✅ DONE
- [X] T005 [P] Create history endpoint in app/api/projects/[projectId]/constitution/history/route.ts ✅ DONE
- [X] T006 [P] Create diff endpoint in app/api/projects/[projectId]/constitution/diff/route.ts ✅ DONE
- [X] T007 Create useConstitution query hook in lib/hooks/use-constitution.ts ✅ DONE
- [X] T008 [P] Create useConstitutionHistory query hook in lib/hooks/use-constitution-history.ts ✅ DONE
- [X] T009 [P] Create useConstitutionDiff query hook in lib/hooks/use-constitution-history.ts ✅ DONE

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Constitution (Priority: P1) 🎯 MVP

**Goal**: Users can view the constitution content from project settings with proper markdown rendering

**Independent Test**: Navigate to project settings, click Constitution button, verify markdown content renders correctly with syntax highlighting for code blocks

### Implementation for User Story 1

- [X] T010 [US1] Create ConstitutionCard component in components/settings/constitution-card.tsx ✅ DONE
- [X] T011 [US1] Create ConstitutionViewer modal with View tab in components/settings/constitution-viewer.tsx ✅ DONE
- [X] T012 [US1] Integrate markdown rendering using react-markdown in ConstitutionViewer ✅ DONE
- [X] T013 [US1] Add empty state handling for missing constitution file in ConstitutionViewer ✅ DONE
- [X] T014 [US1] Add ConstitutionCard to project settings page in app/projects/[projectId]/settings/page.tsx ✅ DONE

**Checkpoint**: At this point, User Story 1 should be fully functional - users can view constitution content

---

## Phase 4: User Story 2 - Edit Constitution (Priority: P2)

**Goal**: Users can edit the constitution content, save changes with validation, and get unsaved changes warnings

**Independent Test**: Open constitution viewer, switch to edit mode, modify content, save, verify changes persist in repository

### Implementation for User Story 2

- [X] T015 [US2] Add Edit tab to ConstitutionViewer with textarea in components/settings/constitution-viewer.tsx ✅ DONE
- [X] T016 [US2] Implement useConstitutionMutation for save operation in lib/hooks/use-constitution.ts ✅ DONE
- [X] T017 [US2] Add markdown validation before save using existing validateMarkdown utility ✅ DONE
- [X] T018 [US2] Add unsaved changes confirmation dialog to ConstitutionViewer ✅ DONE
- [X] T019 [US2] Add loading and error states for save operation in Edit tab ✅ DONE

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can view and edit constitution

---

## Phase 5: User Story 3 - View Constitution History (Priority: P3)

**Goal**: Users can view commit history and diff for constitution changes

**Independent Test**: View constitution, click history tab, select a commit, verify diff display shows additions/deletions correctly

### Implementation for User Story 3

- [X] T020 [US3] Add History tab to ConstitutionViewer in components/settings/constitution-viewer.tsx ✅ DONE
- [X] T021 [US3] Integrate CommitHistoryViewer component for commit list display ✅ DONE
- [X] T022 [US3] Integrate DiffViewer component for selected commit diff display ✅ DONE
- [X] T023 [US3] Add empty history state handling for new files with no commits ✅ DONE

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and edge case handling

- [X] T024 [P] Add error toast notifications for GitHub API failures ✅ DONE
- [X] T025 [P] Add loading skeletons for constitution content fetch ✅ DONE
- [X] T026 Verify keyboard accessibility for all constitution viewer interactions ✅ DONE
- [X] T027 Run quickstart.md validation to verify feature works end-to-end ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Builds on US1's ConstitutionViewer - Adds Edit tab
- **User Story 3 (P3)**: Builds on US1's ConstitutionViewer - Adds History tab

### Within Each Phase

- Types/interfaces before implementations (T001-T002)
- API routes before hooks (T003-T006 before T007-T009)
- Hooks before components (T007-T009 before T010+)
- Component structure before integration (T010-T013 before T014)

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel - different files
- T005 and T006 (history/diff endpoints) can run in parallel - different route files
- T008 and T009 (history hooks) can run in parallel - same file but independent functions
- T024 and T025 (Polish) can run in parallel - different concerns

---

## Parallel Example: Foundational Phase

```bash
# After T003-T004 complete (constitution route), launch in parallel:
Task: "Create history endpoint in app/api/projects/[projectId]/constitution/history/route.ts"
Task: "Create diff endpoint in app/api/projects/[projectId]/constitution/diff/route.ts"

# After API routes complete, launch hooks in parallel:
Task: "Create useConstitution query hook in lib/hooks/use-constitution.ts"
Task: "Create useConstitutionHistory query hook in lib/hooks/use-constitution-history.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T009)
3. Complete Phase 3: User Story 1 (T010-T014)
4. **STOP and VALIDATE**: Navigate to settings, click Constitution button, verify markdown renders
5. Deploy/demo if ready - users can now view constitution

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP: View Constitution)
3. Add User Story 2 → Test independently → Deploy (Edit capability)
4. Add User Story 3 → Test independently → Deploy (History capability)
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Reuse existing patterns: doc-fetcher.ts, documentation-viewer.tsx, commit-history-viewer.tsx, diff-viewer.tsx

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 27 |
| **Setup Tasks** | 2 |
| **Foundational Tasks** | 7 |
| **User Story 1 Tasks** | 5 |
| **User Story 2 Tasks** | 5 |
| **User Story 3 Tasks** | 4 |
| **Polish Tasks** | 4 |
| **Parallel Opportunities** | 8 tasks marked [P] |
| **MVP Scope** | T001-T014 (Setup + Foundation + US1 = 14 tasks) |
