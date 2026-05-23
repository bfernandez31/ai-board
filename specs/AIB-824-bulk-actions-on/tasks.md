# Tasks: Bulk actions on INBOX tickets

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-824-bulk-actions-on/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/bulk-ticket-actions-api.md`

**Tests**: Test tasks are included by default (constitution). Existing suites are extended first; new test files are used only where no current file cleanly covers the domain.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Every task includes exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared validation and route scaffolding all bulk actions depend on.

- [ ] T001 Extend `lib/validations/ticket.ts` with shared Zod schemas and inferred types for bulk ticket ID payloads, bulk agent updates, bulk model updates, blocking error details, and bulk merge drafts.
- [ ] T002 [P] Extend `lib/db/tickets.ts` with shared bulk ticket lookup result types, INBOX eligibility validation helpers, and attachment dedupe utilities reused by all bulk actions.
- [ ] T003 [P] Create `app/api/projects/[projectId]/tickets/bulk/delete/route.ts`, `app/api/projects/[projectId]/tickets/bulk/agent/route.ts`, `app/api/projects/[projectId]/tickets/bulk/model-config/route.ts`, and `app/api/projects/[projectId]/tickets/bulk/merge/route.ts` with common auth/error scaffolding wired to the shared validation layer.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared board-level state and reusable UI surface that every bulk workflow needs.

**⚠️ CRITICAL**: No user story work should start until these tasks are complete.

- [ ] T004 Extend `components/board/board.tsx` with shared bulk-selection state, visible INBOX order derivation, and clear-selection helpers that can be reused by every bulk action flow.
- [ ] T005 [P] Extend `components/board/board-grid.tsx` and `components/board/stage-column.tsx` to thread INBOX-only selection props without changing non-INBOX column behavior.
- [ ] T006 [P] Create `components/board/bulk-action-bar.tsx` as the floating board-level action surface with selection count, cancel affordance, and disabled action slots for later stories.

**Checkpoint**: Shared selection state and bulk-action surface exist; user story work can now proceed.

---

## Phase 3: User Story 1 - Select multiple INBOX tickets for one review pass (Priority: P1) 🎯 MVP

**Goal**: Let owners and members build, inspect, and clear an INBOX-only multi-selection without opening tickets unintentionally.

**Independent Test**: From the board, a user can select INBOX tickets with checkbox, Shift+select a range, Cmd/Ctrl+toggle individual tickets, and clear everything with Escape or Cancel without modifying ticket data.

### Tests for User Story 1

**NOTE**: Write these tests first and confirm they fail before implementing.

- [ ] T007 [P] [US1] Create `tests/unit/components/board/bulk-selection.test.tsx` to cover checkbox entry into selection mode, persistent INBOX checkboxes, Shift range selection, Cmd/Ctrl toggling, and Escape clear because no existing board unit file covers bulk selection behavior.
- [ ] T008 [P] [US1] Extend `tests/unit/components/ticket-detail-modal.test.tsx` with assertions that selection gestures on the board do not open the ticket modal or clobber modal-local state.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Extend `components/board/ticket-card.tsx` with hover-visible selection checkbox, selected-card styling, and modifier-key selection handling that suppresses modal open.
- [ ] T010 [US1] Extend `components/board/board.tsx` with anchor/range-selection logic, keyboard clearing, and INBOX identity-based selection updates when board ordering changes.
- [ ] T011 [US1] Extend `components/board/bulk-action-bar.tsx`, `components/board/board-grid.tsx`, and `components/board/stage-column.tsx` to show selection mode for INBOX only and clear selection through the floating Cancel action.

**Checkpoint**: User Story 1 is independently functional when users can reliably select and clear INBOX batches without opening tickets accidentally.

---

## Phase 4: User Story 2 - Apply non-merge bulk updates to selected INBOX tickets (Priority: P2)

**Goal**: Allow owners and members to bulk delete INBOX tickets or bulk change agent/model settings with atomic all-or-nothing results.

**Independent Test**: After selecting INBOX tickets, the user can open the floating action bar, confirm delete or agent/model updates, and see either the full requested change applied or a blocking error with no partial updates.

### Tests for User Story 2

**NOTE**: Write these tests first and confirm they fail before implementing.

- [ ] T012 [P] [US2] Extend `tests/integration/tickets/crud.test.ts` with contract, auth, and blocking cases for `POST /api/projects/[projectId]/tickets/bulk/delete` and `PATCH /api/projects/[projectId]/tickets/bulk/agent`.
- [ ] T013 [P] [US2] Extend `tests/integration/tickets/model-override.test.ts` with contract, auth, and blocking cases for `PATCH /api/projects/[projectId]/tickets/bulk/model-config`.
- [ ] T014 [P] [US2] Create `tests/unit/components/board/bulk-action-bar.test.tsx` to cover selection-count display, enabled/disabled action states, destructive confirmation entry, and dialog launch behavior because no existing board unit file covers the floating bulk action surface.

### Implementation for User Story 2

- [ ] T015 [P] [US2] Implement `POST /api/projects/[projectId]/tickets/bulk/delete/route.ts` and `PATCH /api/projects/[projectId]/tickets/bulk/agent/route.ts` using the shared auth/validation helpers plus delete guardrails from `lib/tickets/deletion.ts`.
- [ ] T016 [P] [US2] Implement `PATCH /api/projects/[projectId]/tickets/bulk/model-config/route.ts` and the corresponding multi-ticket update helpers in `lib/db/tickets.ts`.
- [ ] T017 [P] [US2] Create `components/board/bulk-change-agent-dialog.tsx` and `components/board/bulk-change-model-dialog.tsx` by reusing validation and selection patterns from `components/tickets/agent-edit-dialog.tsx` and `components/tickets/model-override-dialog.tsx`.
- [ ] T018 [US2] Create `lib/hooks/mutations/useBulkDeleteTickets.ts`, `lib/hooks/mutations/useBulkUpdateTicketAgent.ts`, and `lib/hooks/mutations/useBulkUpdateTicketModelConfig.ts` with optimistic rollback against `app/lib/hooks/queries/useTickets.ts`.
- [ ] T019 [US2] Extend `components/board/board.tsx`, `components/board/board-modals.tsx`, and `components/board/bulk-action-bar.tsx` to wire delete, change-agent, and change-model actions, clear selection on success, and surface structured blocking errors.

**Checkpoint**: User Story 2 is independently functional when non-merge bulk actions complete atomically and refresh the board without a manual reload.

---

## Phase 5: User Story 3 - Merge duplicate or related INBOX tickets into one survivor (Priority: P3)

**Goal**: Let owners and members merge multiple INBOX tickets into the oldest surviving ticket with editable combined content and preserved attachments.

**Independent Test**: With at least two INBOX tickets selected, the user can open Merge, review the base/sources, edit title and description, hit validation limits in the preview, and finish with one surviving INBOX ticket plus no partial source deletion.

### Tests for User Story 3

**NOTE**: Write these tests first and confirm they fail before implementing.

- [ ] T020 [P] [US3] Extend `tests/integration/tickets/constraints.test.ts` with atomic merge eligibility, stale `expectedBaseTicketId`, non-INBOX blocking, and attachment-preservation cases for `POST /api/projects/[projectId]/tickets/bulk/merge`.
- [ ] T021 [P] [US3] Create `tests/unit/components/board/bulk-merge-dialog.test.tsx` to cover merge preview ordering, base-ticket identification, live remaining-character feedback, and over-limit submission blocking because no existing component test covers merge preview behavior.

### Implementation for User Story 3

- [ ] T022 [P] [US3] Extend `lib/validations/ticket.ts` and `lib/db/tickets.ts` with merge-specific validation, prefilled description assembly, survivor/source transaction helpers, and attachment dedupe by stable reference.
- [ ] T023 [P] [US3] Implement `POST /api/projects/[projectId]/tickets/bulk/merge/route.ts` with atomic survivor update, source-ticket deletion, and `expectedBaseTicketId` conflict handling.
- [ ] T024 [P] [US3] Create `components/board/bulk-merge-dialog.tsx` with editable merge preview, source provenance sections, disabled submit for invalid state, and live character-count messaging.
- [ ] T025 [US3] Create `lib/hooks/mutations/useBulkMergeTickets.ts` and extend `components/board/board.tsx`, `components/board/board-modals.tsx`, and `components/board/ticket-detail-modal.tsx` to launch merge, reconcile the survivor in cache, preserve retryable selection on failure, and clear stale modal state on success.

**Checkpoint**: User Story 3 is independently functional when merge leaves exactly one surviving INBOX ticket with combined content and fully atomic cleanup.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish cross-story validation, accessibility, and end-to-end coverage.

- [ ] T026 [P] Create `tests/e2e/board/bulk-actions.spec.ts` for desktop/mobile multi-select, bulk delete, bulk agent/model update, merge happy path, and blocked retry flows because `tests/e2e/board/drag-drop.spec.ts` covers unrelated board interactions.
- [ ] T027 [P] Extend `components/board/bulk-action-bar.tsx`, `components/board/bulk-change-agent-dialog.tsx`, `components/board/bulk-change-model-dialog.tsx`, and `components/board/bulk-merge-dialog.tsx` with final accessibility labels, loading/disabled states, and focus-return behavior after cancel or submit.
- [ ] T028 Extend `components/board/board.tsx`, `lib/hooks/mutations/useBulkDeleteTickets.ts`, `lib/hooks/mutations/useBulkUpdateTicketAgent.ts`, `lib/hooks/mutations/useBulkUpdateTicketModelConfig.ts`, and `lib/hooks/mutations/useBulkMergeTickets.ts` to normalize success/error toasts, post-settle invalidation, and selection reset rules across all bulk actions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and User Story 1 because bulk updates require the selection UX to exist first.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and User Story 1 because merge builds on the same selection UX; it does not need User Story 2 to be complete.
- **Polish (Phase 6)**: Depends on the user stories you intend to ship.

### User Story Dependencies

- **US1**: First shippable MVP after Setup and Foundational are complete.
- **US2**: Builds on US1 selection state and the shared bulk-action surface.
- **US3**: Builds on US1 selection state and shared validation/transaction helpers; can proceed in parallel with US2 after US1 is stable.

### Within Each User Story

- Tests must be written and fail before implementation.
- Shared schema/helper work comes before route or UI wiring.
- Client mutation hooks come before board integration.
- Board integration completes only after the relevant endpoints and dialogs are ready.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T005` and `T006` can run in parallel after `T004`.
- In US1, `T007`, `T008`, and `T009` can run in parallel before `T010`.
- In US2, `T012`, `T013`, `T014`, `T015`, `T016`, and `T017` can run in parallel once Phase 3 is stable; `T018` depends on the route contracts; `T019` depends on `T017` and `T018`.
- In US3, `T020`, `T021`, `T022`, `T023`, and `T024` can run in parallel after US1; `T025` depends on `T023` and `T024`.
- `T026` and `T027` can run in parallel once the target stories are implemented.

---

## Parallel Example: User Story 1

```bash
# Launch selection tests together:
Task: "T007 [US1] Create tests/unit/components/board/bulk-selection.test.tsx"
Task: "T008 [US1] Extend tests/unit/components/ticket-detail-modal.test.tsx"

# Launch UI pieces together:
Task: "T009 [US1] Extend components/board/ticket-card.tsx"
Task: "T011 [US1] Extend components/board/bulk-action-bar.tsx, components/board/board-grid.tsx, and components/board/stage-column.tsx"
```

## Parallel Example: User Story 2

```bash
# Launch endpoint contract coverage together:
Task: "T012 [US2] Extend tests/integration/tickets/crud.test.ts"
Task: "T013 [US2] Extend tests/integration/tickets/model-override.test.ts"

# Launch backend and dialog work together:
Task: "T015 [US2] Implement bulk delete and bulk agent routes"
Task: "T016 [US2] Implement bulk model-config route and DB helpers"
Task: "T017 [US2] Create bulk-change-agent-dialog.tsx and bulk-change-model-dialog.tsx"
```

## Parallel Example: User Story 3

```bash
# Launch merge verification together:
Task: "T020 [US3] Extend tests/integration/tickets/constraints.test.ts"
Task: "T021 [US3] Create tests/unit/components/board/bulk-merge-dialog.test.tsx"

# Launch merge backend and dialog work together:
Task: "T022 [US3] Extend lib/validations/ticket.ts and lib/db/tickets.ts"
Task: "T023 [US3] Implement app/api/projects/[projectId]/tickets/bulk/merge/route.ts"
Task: "T024 [US3] Create components/board/bulk-merge-dialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the selection-only workflow independently before enabling destructive bulk actions.

### Incremental Delivery

1. Ship US1 for safe multi-selection and review-pass ergonomics.
2. Add US2 for operational cleanup wins through atomic delete/agent/model changes.
3. Add US3 for higher-risk merge behavior after the shared bulk infrastructure is proven.
4. Finish with Phase 6 end-to-end and accessibility polish.

### Parallel Execution Strategy

1. Complete Setup and Foundational sequentially.
2. Complete US1 and stabilize the selection UX.
3. Run US2 and US3 in parallel once US1 is passing.
4. Run Polish once the chosen release scope is implemented.

---

## Notes

- All tasks use real existing repository paths or justified new files in directories that already own the relevant responsibility.
- Existing tests are extended where the repository already covers the same domain; new test files are only introduced for board bulk-selection, bulk-action-surface, bulk-merge-preview, and end-to-end bulk-flow coverage.
- `US1` is the recommended MVP scope because it delivers the selection foundation that every later bulk action depends on.
