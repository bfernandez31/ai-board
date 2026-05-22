# Tasks: Bulk Actions on INBOX Tickets

**Input**: Design documents from `specs/AIB-822-bulk-actions-on/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/bulk-api.md

**Tests**: Included by default (constitution). Tests are written first and must fail before implementation.

**Organization**: Tasks are grouped by user story. US1 (Select+Delete) and US4 (Range/Multi-Select Interactions) are combined into a single P1 phase since US4's acceptance criteria are fulfilled by the same selection infrastructure and hook that US1 requires.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create validation schemas and API route skeleton shared by all bulk actions

- [x] T001 Create Zod discriminated union schemas for all bulk action payloads in `lib/validations/bulk-actions.ts`
- [x] T002 Create bulk operations API route skeleton with auth, validation, and action routing in `app/api/projects/[projectId]/tickets/bulk/route.ts`

---

## Phase 2: Foundational (Selection Infrastructure)

**Purpose**: Core multi-select UI infrastructure that ALL bulk actions depend on — checkboxes, selection state, floating action bar, keyboard shortcuts

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create selection state management hook (`useTicketSelection`) with toggle, range-select, clear, and auto-cleanup in `components/board/hooks/use-ticket-selection.ts`
- [x] T004 [P] Create floating action bar component with selected count, action buttons (Delete, Merge disabled <2, Change Agent, Change Model, Cancel), and aurora glass styling in `components/board/floating-action-bar.tsx`
- [x] T005 Modify `components/board/ticket-card.tsx` — Add `isSelectMode`, `isSelected`, `onSelectToggle`, `onRangeSelect` props; render checkbox (lucide Square/CheckSquare) on hover or always in select-mode; handle Cmd/Ctrl+click to toggle selection; handle Shift+click on checkbox for range-select; stop propagation on checkbox click
- [x] T006 Modify `components/board/stage-column.tsx` — Accept selection props from parent and pass selection state and callbacks to each TicketCard for INBOX column only
- [x] T007 Modify `components/board/board-grid.tsx` — Pass selection props through to INBOX StageColumn
- [x] T008 Modify `components/board/board.tsx` — Initialize `useTicketSelection(ticketsByStage[Stage.INBOX])`, pass selection state to BoardGrid and BoardModals
- [x] T009 Modify `components/board/hooks/use-board-keyboard-shortcuts.ts` — Add Escape handler that clears selection when `isSelectMode` is active (takes priority over other Escape behaviors)

**Checkpoint**: Selection infrastructure ready — checkboxes appear on INBOX cards, floating action bar shows on selection, Escape clears. User story implementation can now begin.

---

## Phase 3: User Story 1 + User Story 4 — Select and Delete + Range/Multi-Select (Priority: P1) MVP

**Goal**: Users can multi-select INBOX tickets via checkboxes, Shift+click range select, and Cmd/Ctrl+click toggle, then bulk delete selected tickets with a confirmation modal that handles partial failures (active jobs skipped).

**Independent Test**: Select 3+ INBOX tickets, click Delete, confirm in modal, verify all eligible tickets removed. Select range with Shift+click. Deselect with Escape.

### Tests for US1+US4
**Write these tests FIRST — they must FAIL before implementation**

- [x] T010 [P] [US1] Create integration tests for bulk delete API (auth, validation, partial success with active jobs, cascade delete, concurrent modification handling) in `tests/integration/tickets/bulk-operations.test.ts`
- [x] T011 [P] [US1] Create unit tests for `useTicketSelection` hook (toggle, range select with Shift, auto-cleanup on ticket removal, clear on Escape) in `tests/unit/hooks/use-ticket-selection.test.ts`
- [x] T012 [P] [US1] Create unit tests for floating action bar (render with count, Merge disabled when <2 selected, button callbacks, Cancel clears selection) in `tests/unit/components/board/floating-action-bar.test.tsx`
- [x] T013 [P] [US1] Create unit tests for bulk delete confirmation modal (ticket list display, warning text, confirm/cancel callbacks) in `tests/unit/components/board/bulk-delete-confirmation-modal.test.tsx`

### Implementation for US1+US4

- [x] T014 [US1] Add `bulkDeleteInboxTickets(projectId, ticketIds)` function in `lib/tickets/deletion.ts` — fetch tickets by ID+project+INBOX, batch-check active jobs, partition into deletable/skipped, deleteMany with cascade, return discriminated result with per-ticket reporting
- [x] T015 [US1] Implement delete action handler in `app/api/projects/[projectId]/tickets/bulk/route.ts` — route "delete" action to `bulkDeleteInboxTickets`, return results per contract
- [x] T016 [P] [US1] Create bulk delete confirmation modal (AlertDialog listing selected tickets by ticketKey+title, irreversibility warning, confirm triggers mutation) in `components/board/bulk-delete-confirmation-modal.tsx`
- [x] T017 [US1] Create `useBulkDeleteTickets(projectId)` mutation hook with optimistic removal of selected tickets from cache, rollback on error, toast with success/skip summary, clear selection on success in `lib/hooks/mutations/useBulkTicketActions.ts`
- [x] T018 [US1] Modify `components/board/board-modals.tsx` — Add BulkDeleteConfirmationModal with selection state and delete mutation wiring

**Checkpoint**: Users can select INBOX tickets (checkbox, Shift+range, Cmd/Ctrl+toggle), see floating action bar, bulk delete with confirmation, and clear selection with Escape/Cancel. Partial failures reported via toast.

---

## Phase 4: User Story 2 — Merge Duplicate INBOX Tickets (Priority: P2)

**Goal**: Users can merge 2+ selected INBOX tickets into the base ticket (lowest ID), with an editable preview modal for title, description, and attachment management. Source tickets are hard-deleted.

**Independent Test**: Select 3 INBOX tickets, click Merge, review preview modal with combined title/description, edit if needed, confirm. Verify base ticket updated, source tickets deleted.

### Tests for US2
**Write these tests FIRST — they must FAIL before implementation**

- [x] T019 [P] [US2] Extend `tests/integration/tickets/bulk-operations.test.ts` with merge scenarios — min 2 tickets validation, active job blocking, description limit, attachment limit, transaction atomicity, concurrent modification
- [x] T020 [P] [US2] Create unit tests for merge preview modal (title/description pre-fill, character counter at 10,000 limit, attachment limit warning, submit disabled states, base ticket badge) in `tests/unit/components/board/merge-preview-modal.test.tsx`

### Implementation for US2

- [x] T021 [US2] Create `mergeInboxTickets(projectId, ticketIds, mergedTitle, mergedDescription, selectedAttachments)` in `lib/tickets/merge.ts` — fetch+validate tickets, verify no active jobs, sort by ID for base, Prisma interactive transaction (update base + deleteMany sources), return updated base + deleted list
- [x] T022 [US2] Implement merge action handler in `app/api/projects/[projectId]/tickets/bulk/route.ts` — route "merge" action to `mergeInboxTickets`, return response per contract
- [x] T023 [US2] Create merge preview modal in `components/board/merge-preview-modal.tsx` — ordered ticket list with base badge, editable title (max 100), editable description (pre-filled with concatenated format per FR-012, max 10,000 with live counter), attachment manager (checkboxes if combined >5), warnings about data loss, submit button "Merge N tickets"
- [x] T024 [US2] Add `useMergeTickets(projectId)` mutation in `lib/hooks/mutations/useBulkTicketActions.ts` — optimistic update of base ticket in cache + remove source tickets, toast on success, clear selection
- [x] T025 [US2] Modify `components/board/board-modals.tsx` — Add MergePreviewModal with selection state and merge mutation wiring

**Checkpoint**: Users can merge 2+ INBOX tickets via preview modal. Base ticket updated, sources deleted. Attachment and description limits enforced. All US1+US4 functionality still works.

---

## Phase 5: User Story 3 — Bulk Change Agent or Model (Priority: P3)

**Goal**: Users can change the AI agent or model for all selected INBOX tickets at once via dropdowns on the floating action bar.

**Independent Test**: Select 4 INBOX tickets, click "Change agent", select Gemini from dropdown, verify all 4 tickets updated. Repeat for "Change model".

### Tests for US3
**Write these tests FIRST — they must FAIL before implementation**

- [ ] T026 [P] [US3] Extend `tests/integration/tickets/bulk-operations.test.ts` with update-agent and update-model scenarios — valid agent enum, valid model ID, version-based concurrency skip, all 5 STAGE_MODEL_KEYS set on model change

### Implementation for US3

- [ ] T027 [US3] Implement update-agent and update-model action handlers in `app/api/projects/[projectId]/tickets/bulk/route.ts` — fetch tickets, verify INBOX, loop with version-checked updates per ticket, collect success/skipped, return results per contract
- [ ] T028 [US3] Modify `components/board/floating-action-bar.tsx` — Add "Change agent" dropdown (agents from `app/lib/utils/agent-icons.ts`) and "Change model" dropdown (models from `lib/models/claude-models.ts`); on selection trigger bulk mutation immediately
- [ ] T029 [US3] Add `useBulkUpdateAgent(projectId)` and `useBulkUpdateModel(projectId)` mutations in `lib/hooks/mutations/useBulkTicketActions.ts` — optimistic cache update of all selected tickets with new agent/model values, rollback on error, toast with success/skip summary

**Checkpoint**: All four bulk actions fully operational. Selection, delete, merge, agent change, and model change all work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify cross-story interactions and ensure quality

- [ ] T030 [P] Extend `tests/unit/components/ticket-card-deploy.test.tsx` with checkbox rendering tests — verify checkbox appears on hover outside select-mode, always visible in select-mode, Cmd/Ctrl+click toggles selection
- [ ] T031 Verify floating action bar updates correctly after each bulk operation (count decrements, bar hides when selection empty, Merge re-enables/disables based on remaining count)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 schemas used by T002 route) — BLOCKS all user stories
- **US1+US4 (Phase 3)**: Depends on Phase 2 completion — MVP delivery target
- **US2 (Phase 4)**: Depends on Phase 2 completion; can run in parallel with Phase 3 but recommended after (shares bulk API route file)
- **US3 (Phase 5)**: Depends on Phase 2 completion; can run in parallel with Phase 3/4 but recommended after (shares bulk API route file and mutation hook file)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1+US4 (P1)**: Requires Foundational phase only — no dependency on other stories
- **US2 (P2)**: Requires Foundational phase only — independent of US1 (shares route file but different action handler)
- **US3 (P3)**: Requires Foundational phase only — independent of US1/US2 (shares route file but different action handler)

### Within Each User Story

1. Tests MUST be written first and FAIL before implementation
2. Server-side logic (lib/) before API route handlers
3. API route handlers before client-side mutations
4. Client-side mutations before modal/UI components
5. Modal/UI components before board-modals.tsx wiring

### Shared File Coordination

These files are modified across multiple phases — sequential execution recommended:
- `app/api/projects/[projectId]/tickets/bulk/route.ts` — Phase 1 skeleton → Phase 3 delete → Phase 4 merge → Phase 5 agent/model
- `lib/hooks/mutations/useBulkTicketActions.ts` — Phase 3 create with delete → Phase 4 add merge → Phase 5 add agent/model
- `components/board/board-modals.tsx` — Phase 3 add delete modal → Phase 4 add merge modal
- `components/board/floating-action-bar.tsx` — Phase 2 create → Phase 5 add agent/model dropdowns
- `tests/integration/tickets/bulk-operations.test.ts` — Phase 3 create with delete → Phase 4 extend merge → Phase 5 extend agent/model

### Parallel Opportunities

Within each phase, tasks marked [P] can run in parallel:

**Phase 2**: T003 (selection hook) and T004 (floating action bar) in parallel — different new files
**Phase 3 Tests**: T010, T011, T012, T013 — all different test files, can run simultaneously
**Phase 3 Impl**: T014 (deletion.ts) and T016 (delete modal) in parallel — different files
**Phase 4 Tests**: T019 and T020 in parallel — different test files
**Phase 5**: T026 (tests) runs first, then T027+T028+T029 sequentially (shared files)

---

## Parallel Example: Phase 3 (US1+US4)

```
# Launch all test files in parallel:
Task T010: "Integration tests for bulk delete API in tests/integration/tickets/bulk-operations.test.ts"
Task T011: "Unit tests for useTicketSelection hook in tests/unit/hooks/use-ticket-selection.test.ts"
Task T012: "Unit tests for floating action bar in tests/unit/components/board/floating-action-bar.test.tsx"
Task T013: "Unit tests for bulk delete modal in tests/unit/components/board/bulk-delete-confirmation-modal.test.tsx"

# Then launch independent implementation tasks:
Task T014: "bulkDeleteInboxTickets in lib/tickets/deletion.ts"
Task T016: "Bulk delete confirmation modal in components/board/bulk-delete-confirmation-modal.tsx"
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3 = US1+US4)

1. Complete Phase 1: Setup (validation schemas + route skeleton)
2. Complete Phase 2: Foundational (selection hook, FAB, board wiring, keyboard shortcuts)
3. Complete Phase 3: US1+US4 (bulk delete + range/multi-select)
4. **STOP and VALIDATE**: Test multi-select and bulk delete independently
5. Deploy/demo if ready — core value delivered

### Incremental Delivery

1. Phase 1+2 → Selection infrastructure ready (checkboxes, FAB visible)
2. Add Phase 3 (US1+US4) → Bulk delete works → **MVP!**
3. Add Phase 4 (US2) → Merge works → Deploy
4. Add Phase 5 (US3) → Agent/model change works → Deploy
5. Phase 6 → Polish and verify cross-cutting concerns

### Key Implementation Notes

- **No database migration** — all operations use existing Ticket, Job, Comment, Notification models
- **Single API endpoint** — `POST /api/projects/[projectId]/tickets/bulk` with discriminated union
- **Selection is client-only** — `Set<number>` in React state, not persisted
- **Optimistic UI pattern** — follow existing `useDeleteTicket` pattern: cancel queries → snapshot → optimistic update → rollback on error
- **Partial success** — delete/agent/model operations skip individual failures; merge is all-or-nothing
- **Authorization** — single `verifyProjectAccess(projectId)` call per request, then validate each ticket belongs to project + INBOX stage

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 31 |
| **Phase 1 (Setup)** | 2 tasks |
| **Phase 2 (Foundational)** | 7 tasks |
| **Phase 3 (US1+US4 — P1)** | 9 tasks (4 test + 5 impl) |
| **Phase 4 (US2 — P2)** | 7 tasks (2 test + 5 impl) |
| **Phase 5 (US3 — P3)** | 4 tasks (1 test + 3 impl) |
| **Phase 6 (Polish)** | 2 tasks |
| **Parallel opportunities** | 12 tasks marked [P] |
| **New files** | 9 source + 5 test = 14 |
| **Modified files** | 7 source + 1 test = 8 |
| **MVP scope** | Phases 1-3 (18 tasks) |
