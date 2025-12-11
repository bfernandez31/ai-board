# Tasks: Add Button to Consult Summary

**Input**: Design documents from `/specs/AIB-102-add-button-to/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No test tasks included (not explicitly requested in feature specification).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend core type definitions that all subsequent changes depend on

- [ ] T001 [P] Add 'summary' to DocumentTypeSchema enum in lib/validations/documentation.ts
- [ ] T002 [P] Add 'summary' to DocumentTypeLabels mapping in components/board/documentation-viewer.tsx

**Checkpoint**: Type definitions ready - API and UI implementation can proceed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create API endpoint that the UI depends on

**⚠️ CRITICAL**: UI cannot function until API endpoint is available

- [ ] T003 Create GET endpoint for summary content in app/api/projects/[projectId]/tickets/[id]/summary/route.ts following spec/route.ts pattern with 'implement' job check

**Checkpoint**: API ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Implementation Summary (Priority: P1) 🎯 MVP

**Goal**: Allow users to view the summary.md file from tickets that have completed the implement step

**Independent Test**: Complete an implement job on a FULL workflow ticket, verify Summary button appears and opens summary content in modal

### Implementation for User Story 1

- [ ] T004 [US1] Add hasCompletedImplementJob state calculation in components/board/ticket-detail-modal.tsx (similar to hasCompletedPlanJob pattern, checking for job.command='implement' with status='COMPLETED')
- [ ] T005 [US1] Add Summary button with FileOutput icon and visibility logic (workflowType === 'FULL' && hasCompletedImplementJob) in components/board/ticket-detail-modal.tsx
- [ ] T006 [US1] Update docViewerType state to include 'summary' option in components/board/ticket-detail-modal.tsx

**Checkpoint**: User Story 1 complete - users can view summary for BUILD/VERIFY stage tickets

---

## Phase 4: User Story 2 - View Summary After Shipping (Priority: P2)

**Goal**: Allow users to view implementation summary from main branch for shipped tickets

**Independent Test**: Ship a FULL workflow ticket, verify Summary button fetches content from main branch

### Implementation for User Story 2

- [ ] T007 [US2] Verify API endpoint branch resolution logic (SHIP → main branch, else → feature branch) in app/api/projects/[projectId]/tickets/[id]/summary/route.ts
- [ ] T008 [US2] Verify Summary button remains visible for SHIP stage tickets in components/board/ticket-detail-modal.tsx

**Checkpoint**: User Story 2 complete - shipped tickets show summary from main branch

---

## Phase 5: User Story 3 - Summary Not Available Yet (Priority: P3)

**Goal**: Ensure Summary button is correctly hidden when summary doesn't exist

**Independent Test**: View tickets at SPECIFY, PLAN stages and QUICK workflow tickets - verify no Summary button appears

### Implementation for User Story 3

- [ ] T009 [US3] Verify Summary button is hidden for SPECIFY and PLAN stage tickets (no implement job yet) in components/board/ticket-detail-modal.tsx
- [ ] T010 [US3] Verify Summary button is hidden for QUICK workflow tickets (workflowType !== 'FULL' check) in components/board/ticket-detail-modal.tsx
- [ ] T011 [US3] Verify Summary button is hidden for BUILD stage tickets without completed implement job in components/board/ticket-detail-modal.tsx

**Checkpoint**: User Story 3 complete - button visibility matches implement job availability

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify read-only enforcement and error handling

- [ ] T012 Verify no Edit button appears for summary content (read-only enforcement via EDIT_PERMISSIONS exclusion) in components/ticket/edit-permission-guard.tsx
- [ ] T013 Verify error handling for missing summary file (FILE_NOT_FOUND response) in app/api/projects/[projectId]/tickets/[id]/summary/route.ts
- [ ] T014 Run type-check to ensure all TypeScript types are correct

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Can start after T001 (needs DocumentType extended)
- **User Stories (Phase 3+)**: All depend on T003 (API endpoint) completion
- **Polish (Phase 6)**: Can run after User Story 1 is complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after API endpoint (T003) - Core functionality
- **User Story 2 (P2)**: Mostly verification tasks - Can run after US1
- **User Story 3 (P3)**: Mostly verification tasks - Can run after US1

### Within Each User Story

- T004 → T005 → T006 (sequential - state before button before viewer)
- T007 → T008 (API before UI verification)
- T009, T010, T011 can run in parallel (different scenarios)

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T009, T010, T011 can run in parallel (independent verification scenarios)
- T012, T013, T014 can run in parallel (independent verification tasks)

---

## Parallel Example: Phase 1

```bash
# Launch both setup tasks together:
Task: "Add 'summary' to DocumentTypeSchema enum in lib/validations/documentation.ts"
Task: "Add 'summary' to DocumentTypeLabels mapping in components/board/documentation-viewer.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 (T004, T005, T006)
4. **STOP and VALIDATE**: Test Summary button on FULL workflow ticket with completed implement job
5. Deploy if ready

### Incremental Delivery

1. Complete Setup + Foundational → Infrastructure ready
2. Add User Story 1 → Test independently → Deploy (MVP!)
3. Add User Story 2 → Verify shipped ticket behavior → Deploy
4. Add User Story 3 → Verify edge cases → Deploy
5. Add Polish → Final validation → Complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Read-only enforcement happens automatically (summary not in EDIT_PERMISSIONS)
- API endpoint follows exact same pattern as spec/route.ts
- FileOutput icon from lucide-react differentiates from Spec's FileText icon
- No database changes required - this feature extends existing patterns only

---

## Key Files Reference

| Task | Primary File |
|------|--------------|
| T001 | lib/validations/documentation.ts |
| T002 | components/board/documentation-viewer.tsx |
| T003 | app/api/projects/[projectId]/tickets/[id]/summary/route.ts (NEW) |
| T004-T006 | components/board/ticket-detail-modal.tsx |
| T007 | app/api/projects/[projectId]/tickets/[id]/summary/route.ts |
| T008-T011 | components/board/ticket-detail-modal.tsx |
| T012 | components/ticket/edit-permission-guard.tsx |
| T013 | app/api/projects/[projectId]/tickets/[id]/summary/route.ts |
