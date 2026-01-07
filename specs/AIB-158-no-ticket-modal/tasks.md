# Tasks: Fix Ticket Modal Display from URL Navigation

**Input**: Design documents from `/specs/AIB-158-no-ticket-modal/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Tests**: Integration test included per plan.md Test Strategy section.

**Organization**: This is a minimal bug fix. User Story 2 (Direct URL) is the only story requiring implementation - the bug is in the `/ticket/[key]` redirect. User Stories 1 and 3 already work correctly.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup required - this is a bug fix in an existing codebase

*N/A - All infrastructure exists*

---

## Phase 2: Foundational

**Purpose**: No foundational work required - single file bug fix

*N/A - No blocking prerequisites needed*

---

## Phase 3: User Story 2 - Open Ticket Modal via Direct URL (Priority: P1) 🎯 MVP

**Goal**: Fix the `/ticket/[key]` redirect to include `modal=open` parameter so the modal opens automatically

**Independent Test**: Navigate directly to `/ticket/ABC-123` and verify the redirect lands on the board with URL `?ticket=ABC-123&modal=open` and the modal opens

### Implementation for User Story 2

- [x] T001 [US2] Add `&modal=open` to redirect URL in app/ticket/[key]/page.tsx (line 71)

### Test for User Story 2

- [x] T002 [US2] Create unit test verifying redirect includes modal=open in tests/unit/tickets/ticket-page-redirect.test.ts

**Checkpoint**: After T001 and T002, the bug is fixed and verified

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: N/A for this minimal fix

*No additional polish needed - single line fix with test coverage*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A
- **Foundational (Phase 2)**: N/A
- **User Story 2 (Phase 3)**: Can start immediately - the only required work
- **Polish (Phase 4)**: N/A

### Task Dependencies

- **T001**: No dependencies - standalone fix
- **T002**: No dependencies on T001 (test file is separate)

### Parallel Opportunities

- T001 and T002 can run in parallel (different files, no dependencies)

---

## Parallel Example

```bash
# Both tasks can run simultaneously:
Task: "Add &modal=open to redirect URL in app/ticket/[key]/page.tsx"
Task: "Create integration test in tests/integration/tickets/ticket-page-redirect.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 2 Only)

1. ~~Complete Phase 1: Setup~~ (N/A)
2. ~~Complete Phase 2: Foundational~~ (N/A)
3. Complete Phase 3: User Story 2 (T001 + T002)
4. **DONE**: Run test to verify fix works

### Why Only User Story 2?

Per research.md:
- **US1 (Header Search)**: Already works - `ticket-search.tsx` includes `params.set('modal', 'open')`
- **US2 (Direct URL)**: **BUG HERE** - `/ticket/[key]/page.tsx` redirect missing `&modal=open`
- **US3 (Notifications)**: Already works - `notification-dropdown.tsx` includes `&modal=open&tab=comments`

The fix is isolated to US2. No changes needed for US1 or US3.

---

## Notes

- This is a one-line bug fix plus one integration test
- Total estimated tasks: 2
- No models, services, or API changes required
- Fix location: `app/ticket/[key]/page.tsx:71`
- Test type: Vitest integration test (per Testing Trophy - NOT E2E)
