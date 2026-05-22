# Tasks: Bulk Actions on INBOX Tickets (AIB-821)

**Input**: Design documents from `/specs/AIB-821-bulk-actions-on/`
**Prerequisites**: plan.md (required), spec.md, research.md, data-model.md, contracts/bulk-tickets-api.md

**Tests**: Test tasks are included by default (constitution §III). Tests precede implementation within each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are validated against the repo (existing files = Extend; new files = Create)

## Path Conventions

Single Next.js App Router project — paths from repo root: `prisma/`, `lib/`, `app/`, `components/board/`, `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema migration and Zod validation scaffolding required by every bulk endpoint.

- [X] T001 ✅ DONE Extend `Ticket` model in prisma/schema.prisma with `creatorId String? @db.VarChar(255)`, `creator User? @relation("TicketCreator", fields: [creatorId], references: [id], onDelete: SetNull)`, and `@@index([creatorId])` per data-model.md §1
- [X] T002 ✅ DONE Extend `Notification` model in prisma/schema.prisma: make `commentId` nullable, make `ticketId` nullable with `onDelete: SetNull`, add `type NotificationType @default(MENTION)`, add `mergedIntoTicketId Int?` with `onDelete: SetNull` relation, add `ticketKeySnapshot String? @db.VarChar(20)`, and add new enum `NotificationType { MENTION TICKET_DELETED TICKET_MERGED }` per data-model.md §2
- [X] T003 ✅ DONE Add reverse relations on `User` (`ticketsCreated Ticket[] @relation("TicketCreator")`) and on `Ticket` (`mergedIntoNotifications Notification[] @relation("NotificationMergedInto")`) in prisma/schema.prisma
- [X] T004 ✅ DONE Generate the Prisma migration with `bunx prisma migrate dev --name bulk_actions_inbox` and verify the generated SQL in `prisma/migrations/<ts>_bulk_actions_inbox/migration.sql` matches data-model.md §3 ordering (creator FK first, then enum, then Notification column adds, then NOT NULL drops, then ticketId FK recreate with SetNull, then mergedIntoTicketId FK)
- [X] T005 ✅ DONE Run `bunx prisma generate` to refresh the Prisma client types and confirm `bun run type-check` still passes against the updated schema
- [X] T006 ✅ DONE Populate `creatorId` in lib/db/tickets.ts `createTicket` (~line 475), `duplicateTicket` (~line 602), and any other ticket-creation helpers (e.g., `fullCloneTicket` ~line 662); thread `userId` from the API auth layer through callers in `app/api/projects/[projectId]/tickets/route.ts` and related routes
- [X] T007 ✅ DONE Populate `creatorId` on the MCP-server ticket-creation path and the inbox-analysis ticket spawner; verify both paths receive the actor's `userId` (search for `prisma.ticket.create` outside lib/db/tickets.ts)
- [X] T008 ✅ DONE Create lib/validations/bulk.ts exporting `bulkDeleteSchema`, `bulkMergeSchema`, `bulkAgentSchema`, `bulkModelSchema` per contracts/bulk-tickets-api.md §1–§4; reuse `titleSchema`, `descriptionSchema`, `versionSchema` from lib/validations/ticket.ts and `Agent` from `@prisma/client`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared service module, selection hook, and ticket-card / board affordances. Every user story depends on this phase.

**⚠️ CRITICAL**: No user-story-specific work can begin until this phase is complete.

- [X] T009 ✅ DONE Create lib/tickets/bulk-operations.ts with shared types: `BulkResult<T>` discriminated union (research.md P1), `BulkConflictError` class, and the precondition helper `assertInboxAndProject(tx, projectId, ticketIds)` returning either `{ ok: true; tickets: Ticket[] }` or `{ ok: false; status: 409; body: { code: 'BULK_CONFLICT_STAGE_DRIFT'; details: { conflictingIds: number[] } } }`
- [X] T010 ✅ DONE Add `createNotificationForTicketAction({ recipientId, actorId, ticketId, ticketKeySnapshot, type, mergedIntoTicketId? })` helper to app/lib/db/notifications.ts mirroring the existing `createNotificationForMention` shape (research.md P5) — used only OUTSIDE transactions; in-transaction code paths use `tx.notification.createMany` directly
- [X] T011 ✅ DONE [P] Create components/board/hooks/use-bulk-selection.ts exposing `{ selectedIds: Set<number>, anchorId: number | null, isSelectMode: boolean, toggle(id), rangeSelectTo(id, allInboxIdsSorted), clear(), cancel() }` per data-model.md §A and research.md D6/D7
- [X] T012 ✅ DONE [P] Create tests/unit/components/board/use-bulk-selection.test.ts covering toggle, range-select math (anchor→target both directions), clear, anchor tracking after deselect, automatic anchor reset on ticket removal
- [X] T013 ✅ DONE Modify components/board/ticket-card.tsx to accept new optional prop `selection?: { isSelected: boolean; onToggle: () => void; onRangeSelect: () => void; isSelectMode: boolean }`; render checkbox top-right (hover-revealed when not in select mode, always visible in select mode); intercept `event.shiftKey` → `onRangeSelect()` and `event.metaKey || event.ctrlKey` → `onToggle()` + `event.stopPropagation()` (FR-005, FR-006, FR-007)
- [X] T014 ✅ DONE [P] Create tests/unit/components/board/ticket-card-selection.test.tsx covering: checkbox hidden by default, visible on hover or in select mode, Cmd/Ctrl+click toggles without opening detail panel, Shift+click calls onRangeSelect, plain checkbox click toggles without opening detail
- [X] T015 ✅ DONE Modify components/board/stage-column.tsx to thread the `selection` prop down to each `<TicketCard>` only when `stage === 'INBOX'`; compute `allInboxIdsSorted` (ascending `ticketNumber` per research.md D7) once and pass to each card for shift+click math
- [X] T016 ✅ DONE Create components/board/bulk-action-bar.tsx skeleton per contracts/bulk-tickets-api.md "UI Contract: Floating Bulk Action Bar" — counter (`aria-live="polite"`), Cancel button, and disabled placeholder slots for Merge/Delete/agent/model (filled in by user-story phases); use only literal Tailwind class strings + `aurora-card` utility (CLAUDE.md)
- [X] T017 ✅ DONE [P] Create tests/unit/components/board/bulk-action-bar.test.tsx covering counter live updates, Cancel button clears, Merge disabled at <2 selected, all action buttons disabled when count > 50 with explanatory `title`/tooltip (FR-008, FR-011)
- [X] T018 ✅ DONE Modify components/board/board.tsx to mount `useBulkSelection`, pass selection context to the INBOX `<StageColumn>`, and render `<BulkActionBar>` (fixed bottom, z-50) when `selectedIds.size > 0`
- [X] T019 ✅ DONE Extend components/board/hooks/use-board-keyboard-shortcuts.ts to call `selection.clear()` when Escape is pressed and `selection.isSelectMode === true` (FR-003a, FR-032)

**Checkpoint**: Foundation ready — user stories can now proceed in priority order (or in parallel if multiple agents).

---

## Phase 3: User Story 1 — Bulk delete to clean up INBOX (Priority: P1) 🎯 MVP

**Goal**: User selects multiple INBOX tickets and deletes them in one atomic action via a floating action bar + confirmation modal.

**Independent Test**: Create 10 INBOX tickets, select 5 (one click + shift+click range), open Delete confirmation, confirm — verify those 5 are removed, the other 5 remain, the floating bar hides, and select mode exits.

### Tests for User Story 1

- [X] T020 ✅ DONE [P] [US1] Extend tests/integration/tickets/crud.test.ts with `describe('POST /api/projects/:projectId/tickets/bulk/delete')` covering: success on N≤50 INBOX tickets (atomic deletion + cascade of comments/jobs); 400 `BULK_LIMIT_EXCEEDED` at 51 ids; 400 `VALIDATION_ERROR` on missing expectedVersions key; 403 `FORBIDDEN_PROJECT` for non-member; 403 `FORBIDDEN_CROSS_PROJECT` when ids span projects; 409 `BULK_CONFLICT_STAGE_DRIFT` when a ticket is moved to SPECIFY mid-flight; 409 `BULK_CONFLICT_VERSION` when version map is stale
- [X] T021 ✅ DONE [P] [US1] Create tests/unit/components/board/bulk-delete-confirmation-modal.test.tsx covering: title shows correct count, body warns "permanently delete", Cancel closes without firing mutation, Delete button fires mutation with the supplied ids

### Implementation for User Story 1

- [X] T022 ✅ DONE [US1] Implement `bulkDeleteInbox(tx, { projectId, ticketIds, expectedVersions, actorId })` in lib/tickets/bulk-operations.ts: call `assertInboxAndProject`, compare each row's `version` to `expectedVersions[id]` (409 `BULK_CONFLICT_VERSION` on any mismatch with `currentVersions` in body), collect `creatorId` + `ticketKey` for non-actor non-null creators, `tx.notification.createMany` with `type: 'TICKET_DELETED'` + `ticketKeySnapshot` BEFORE the delete (research.md P5), `tx.ticket.deleteMany({ where: { id: { in: ids }, projectId, stage: 'INBOX' } })`, return `{ ok: true; data: { deleted: { count, ticketKeys }, notifiedCreatorIds } }`
- [X] T023 ✅ DONE [US1] Create app/api/projects/[projectId]/tickets/bulk/delete/route.ts: `POST` handler that runs `verifyProjectAccess(projectId, request)`, parses body with `bulkDeleteSchema`, opens `prisma.$transaction`, calls `bulkDeleteInbox`, and maps `BulkResult` to `NextResponse.json` (status + body) — pattern from app/api/projects/[projectId]/tickets/[id]/route.ts:215-282
- [X] T024 ✅ DONE [US1] Create lib/hooks/mutations/useBulkDeleteTickets.ts following research.md P4: `onMutate` cancels in-flight queries on `queryKeys.projects.tickets(projectId)`, snapshots cache, optimistically removes selected ids; `onError` restores snapshot; `onSettled` invalidates the query
- [X] T025 ✅ DONE [US1] Create components/board/bulk-delete-confirmation-modal.tsx using shadcn `<Dialog>` (pattern reference: components/board/delete-confirmation-modal.tsx) — title `Delete {count} tickets?`, destructive button copy `Delete {count} tickets`, fires `useBulkDeleteTickets`
- [X] T026 ✅ DONE [US1] Wire Delete button in components/board/bulk-action-bar.tsx (replace placeholder) to open `<BulkDeleteConfirmationModal>`; in components/board/board.tsx hook up the modal's `onSuccess` to call `selection.clear()` and close (FR-003d)

**Checkpoint**: User Story 1 fully functional and independently testable. MVP candidate.

---

## Phase 4: User Story 2 — Bulk merge duplicate tickets (Priority: P1)

**Goal**: User selects ≥2 INBOX tickets, opens the merge preview with prefilled title/description/attachments, edits if desired, and submits. The smallest-id ticket survives; the rest are deleted atomically; non-actor creators are notified.

**Independent Test**: Create 3 INBOX tickets with distinct ids, titles, descriptions, and at least one attachment each. Select all 3, click Merge, accept the prefilled values, click "Merge 3 tickets" — verify only the smallest-id ticket remains with concatenated description (`---\n## From AIB-X: <title>...` per id), all attachments transferred onto it, and the other two tickets gone.

### Tests for User Story 2

- [X] T027 ✅ DONE [P] [US2] Create tests/integration/tickets/bulk-merge.test.ts covering: smallest-id baseline preservation of `id`/`ticketKey`/`agent`/all 5 model fields/`autoMode`/`clarificationPolicy`/`stage`/`branch`; attachment concatenation order matches `[base, ...sources by id asc]` (research.md D8); source tickets hard-deleted with cascade; 409 `BULK_CONFLICT_STAGE_DRIFT` when a source drifts out of INBOX; 409 `BULK_CONFLICT_VERSION` on stale version; 400 on `baseTicketId` not smallest; 400 on description >10000; FR-029 TICKET_MERGED notification rows created for non-actor creators with `mergedIntoTicketId` populated; SC-006 timing assertion: 50-ticket merge completes in <3000ms
- [X] T028 ✅ DONE [P] [US2] Extend tests/integration/tickets/constraints.test.ts with bulk merge boundaries: title at 100 chars (pass) / 101 chars (fail), description at 10000 chars (pass) / 10001 chars (fail)
- [X] T029 ✅ DONE [P] [US2] Create tests/integration/notifications/bulk-actions.test.ts asserting that TICKET_MERGED notification rows for sources have correct `type`, `actorId`, `recipientId`, `ticketId` (SetNull after cascade — verify via re-fetch after merge), `ticketKeySnapshot` matches the source's key, and `mergedIntoTicketId` equals the base id; no rows when the source's `creatorId === actorId`; no rows when `creatorId IS NULL`
- [X] T030 ✅ DONE [P] [US2] Create tests/unit/components/board/bulk-merge-preview-modal.test.tsx covering: prefilled title equals base title; prefilled description equals `base.description + sources.sort((a,b)=>a.id-b.id).map(s => '\n\n---\n\n## From <ticketKey>: <title>\n<description>').join('')` (FR-019); live char counter under description; counter turns red and submit button disabled when description.length > 10000 (FR-020); base label "Base: AIB-{n} — {title}" renders; source list shows non-base tickets in id-ascending order with "will be deleted" badge

### Implementation for User Story 2

- [X] T031 ✅ DONE [US2] Implement `bulkMergeInbox(tx, { projectId, baseTicketId, sourceTicketIds, title, description, expectedVersions, actorId })` in lib/tickets/bulk-operations.ts: `assertInboxAndProject` for `[baseTicketId, ...sourceTicketIds]`; verify each version against `expectedVersions` (research.md P2); concatenate attachments as `[...base.attachments, ...sourcesByIdAsc.flatMap(s => s.attachments)]` using the `isTicketAttachmentArray` type guard from app/lib/types/ticket.ts:53; `tx.notification.createMany` with `type: 'TICKET_MERGED'`, `mergedIntoTicketId: baseTicketId`, `ticketKeySnapshot: source.ticketKey` BEFORE source deletion (research.md P5); `tx.ticket.update` base with new title/description/attachments and `version: { increment: 1 }` (catch P2025 → re-throw as `BulkConflictError`); `tx.ticket.deleteMany({ where: { id: { in: sourceTicketIds }, projectId, stage: 'INBOX' } })`; return `{ ok: true; data: { base, deleted, notifiedCreatorIds } }`
- [X] T032 ✅ DONE [US2] Create app/api/projects/[projectId]/tickets/bulk/merge/route.ts: `POST` handler — `verifyProjectAccess`, parse with `bulkMergeSchema`, transaction, call `bulkMergeInbox`, map `BulkResult` to NextResponse per contracts/bulk-tickets-api.md §2 error table
- [X] T033 ✅ DONE [US2] Create lib/hooks/mutations/useBulkMergeTickets.ts — NO optimistic update (research.md P4); on success invalidate `queryKeys.projects.tickets(projectId)`; surface `BULK_CONFLICT_*` and `VALIDATION_ERROR` codes back to the caller so the modal can render inline errors
- [X] T034 ✅ DONE [US2] Create components/board/bulk-merge-preview-modal.tsx per contracts/bulk-tickets-api.md "UI Contract: Bulk Merge Preview Modal": shadcn `<Dialog>` with `aurora-*` styling; computes prefilled values from the current TanStack cache (no extra server fetch); editable title (max 100) + description textarea (max 10000) with live counters; "Combined attachments: {n}" line; on submit fires `useBulkMergeTickets`; keeps modal open on 409/400 and renders inline error above buttons
- [X] T035 ✅ DONE [US2] Wire Merge button in components/board/bulk-action-bar.tsx (replace placeholder; disabled when count < 2) to open `<BulkMergePreviewModal>`; in components/board/board.tsx hook up `onSuccess` to call `selection.clear()` and close (FR-003d)

**Checkpoint**: User Story 2 fully functional and independently testable.

---

## Phase 5: User Story 3 — Bulk change agent or model (Priority: P2)

**Goal**: User selects multiple INBOX tickets, picks a new agent or model from a dropdown, and every selected ticket updates atomically. Selection is preserved so the user can chain further actions (FR-004).

**Independent Test**: Create 5 INBOX tickets with agent CLAUDE. Select all 5, open "Change agent" → pick CODEX. Verify all 5 show CODEX, no other field changed, the selection remains, the floating bar still shows "5 selected", and a brief success indication appears.

### Tests for User Story 3

- [X] T036 ✅ DONE [P] [US3] Extend tests/integration/tickets/model-override.test.ts with `describe('POST /api/projects/:projectId/tickets/bulk/model')`: writes the single chosen model value to ALL FIVE per-command override fields (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) atomically across selected tickets; `null` clears all five; non-selected tickets unaffected; 400 on model length > 50; 409 on stage drift
- [X] T037 ✅ DONE [P] [US3] Extend tests/integration/tickets/crud.test.ts with `describe('POST /api/projects/:projectId/tickets/bulk/agent')`: writes only the `agent` field across selected tickets; `null` clears; other fields preserved; 400 on invalid enum; 409 on stage drift; verify no notification rows are created (FR-030)

### Implementation for User Story 3

- [X] T038 ✅ DONE [US3] Implement `bulkUpdateInboxAgent(tx, { projectId, ticketIds, agent })` and `bulkUpdateInboxModel(tx, { projectId, ticketIds, model })` in lib/tickets/bulk-operations.ts: `assertInboxAndProject`; `tx.ticket.updateMany({ where: { id: { in: ids }, projectId, stage: 'INBOX' }, data: { agent, version: { increment: 1 } } })` for agent; for model, `data: { specifyModel: model, planModel: model, implementModel: model, quickImplModel: model, verifyModel: model, version: { increment: 1 } }`; return `{ ok: true; data: { updated: { count, ticketIds, agent | model | appliedFields } } }`
- [X] T039 ✅ DONE [P] [US3] Create app/api/projects/[projectId]/tickets/bulk/agent/route.ts: `POST` handler using `bulkAgentSchema` and `bulkUpdateInboxAgent`
- [X] T040 ✅ DONE [P] [US3] Create app/api/projects/[projectId]/tickets/bulk/model/route.ts: `POST` handler using `bulkModelSchema` and `bulkUpdateInboxModel`; response echoes `appliedFields: ['specifyModel', 'planModel', 'implementModel', 'quickImplModel', 'verifyModel']`
- [X] T041 ✅ DONE [US3] Create lib/hooks/mutations/useBulkUpdateTicketField.ts generic over `{ endpoint: 'agent' | 'model', field: 'agent' | 'modelOverrides' }` following research.md P4 (optimistic field patch + snapshot/rollback)
- [X] T042 ✅ DONE [US3] Wire `<Select aria-label="Change agent">` and `<Select aria-label="Change model">` in components/board/bulk-action-bar.tsx: agent dropdown lists `Agent` enum values; model dropdown reads from lib/models/claude-models.ts (research.md D9); selection commits immediately on change; on success show a brief inline success indication and PRESERVE selection per FR-004 (do NOT call `selection.clear()`)
- [X] T043 ✅ DONE [US3] Extend tests/unit/components/board/bulk-action-bar.test.tsx with: agent dropdown lists all Agent enum values; model dropdown lists models from claude-models constants; selecting a value fires the matching mutation; selection remains after success (FR-004)

**Checkpoint**: User Story 3 fully functional and independently testable.

---

## Phase 6: User Story 4 — Discover and safely exit select mode (Priority: P3)

**Goal**: A user who accidentally enters select mode can back out via Cancel button, Escape key, or by deselecting the last ticket, without taking any destructive action. Checkboxes never appear outside INBOX.

**Independent Test**: Click one checkbox → confirm floating bar appears and bar shows "1 selected". Verify each exit path independently: (a) click Cancel → bar disappears, selection cleared, checkboxes hidden; (b) press Escape → same; (c) click the same checkbox again → same; (d) Cmd/Ctrl+click a card while in select mode → toggles selection but does NOT open the detail panel; (e) hover a SPECIFY/PLAN/BUILD/VERIFY/SHIP card → no checkbox renders.

### Tests for User Story 4

- [X] T044 ✅ DONE [P] [US4] Extend tests/unit/components/keyboard-shortcuts-integration.test.ts with: Escape in select mode clears `selectedIds` and hides the floating bar; Tab in select mode moves focus across INBOX checkboxes in `ticketNumber` order; Space on a focused checkbox toggles selection (FR-032)
- [X] T045 ✅ DONE [P] [US4] Extend tests/unit/components/board/ticket-card-selection.test.tsx (created in T014) with: Cmd/Ctrl+click on the card body in select mode toggles selection AND does NOT open the detail panel (FR-006); plain click on the checkbox toggles selection without opening detail (FR-007); deselecting the last ticket exits select mode (FR-003c)
- [X] T046 ✅ DONE [P] [US4] Extend tests/unit/components/board/bulk-action-bar.test.tsx (created in T017) with: Cancel button click clears selection and exits select mode (FR-003b)

### Implementation for User Story 4

- [X] T047 ✅ DONE [US4] Verify components/board/stage-column.tsx does NOT thread the `selection` prop for non-INBOX stages (added in T015); add a regression assertion as a comment on the relevant branch and confirm via existing stage-column tests if any, otherwise add a focused stage-column test under tests/unit/components/board/ asserting non-INBOX stages render `<TicketCard>` without a `selection` prop
- [X] T048 ✅ DONE [US4] Confirm the Cancel button handler in components/board/bulk-action-bar.tsx (T016) calls `selection.cancel()`, and that `use-bulk-selection.ts` (T011) auto-exits select mode when `selectedIds.size` returns to 0 (FR-003c); no additional code needed if already true — otherwise patch the hook

**Checkpoint**: All four user stories complete and independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T049 ✅ DONE [P] Add structured server logging with `[bulk-action]` prefix at the start and end of each bulk handler in app/api/projects/[projectId]/tickets/bulk/*/route.ts, including actor id, project id, operation type, and affected ticket count (research.md D5 — substitutes for the absent ActivityLog table; FR-031)
- [X] T050 ✅ DONE [P] Run `bun run type-check` and `bun run lint` and resolve any errors introduced anywhere in the diff per CLAUDE.md commit rules
- [X] T051 ✅ DONE [P] Manually smoke-test SC-001 (delete 10 in <15s) and SC-002 (merge 3 in <60s) against a seeded dev project; document timing in the PR description
- [X] T052 ✅ DONE [P] Verify Aurora B+ theming on `<BulkActionBar>`, `<BulkDeleteConfirmationModal>`, `<BulkMergePreviewModal>` matches the project visual style (uses `aurora-card` utility per research.md P6); confirm no hardcoded hex/rgb colors and no dynamically constructed Tailwind class strings (CLAUDE.md)
- [X] T053 ✅ DONE Update `specs/specifications/README.md` index to include the AIB-821 feature entry per CLAUDE.md "Ticket specs in `specs/[ticket-key]/`, consolidated in `specs/specifications/`"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs Prisma client + Zod schemas) — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2; independent of US1 (different routes, different modals)
- **Phase 5 (US3)**: Depends on Phase 2; independent of US1/US2 (different routes, dropdowns slot into existing action bar)
- **Phase 6 (US4)**: Depends on Phase 2 only (foundational already implements selection/cancel/escape); tests in T044–T046 can run as soon as Phase 2 is done
- **Phase 7 (Polish)**: Depends on all desired user stories completing

### User Story Dependencies

- **US1 (P1) Bulk Delete**: Independent — needs Phase 2 only
- **US2 (P1) Bulk Merge**: Independent — needs Phase 2 only
- **US3 (P2) Bulk Agent/Model**: Independent — needs Phase 2 only; shares the action bar with US1/US2 but only adds dropdown slots
- **US4 (P3) Discover & Exit**: Independent — almost entirely covered by Phase 2; this phase is mostly verification tests

### Within Each User Story

- Tests are written and FAIL before implementation
- `bulk-operations.ts` service function → API route → mutation hook → modal/UI → wiring in the action bar
- Each story's UI work is gated on its server-side route returning real responses

### Parallel Opportunities

- All Phase 1 tasks marked [P] (T006, T007, T008) run in parallel after T005
- All Phase 2 tasks marked [P] (T011, T012, T014, T017) run in parallel after their non-parallel predecessors
- Once Phase 2 completes, all four user stories can proceed in parallel (US1, US2, US3, US4)
- Within each user story, all test-creation tasks marked [P] run in parallel
- Within US3, the two route files (T039, T040) are parallel because they live in different files

---

## Parallel Example: User Story 2 (after Phase 2 done)

```bash
# Launch US2 tests in parallel:
Task: T027 Create tests/integration/tickets/bulk-merge.test.ts
Task: T028 Extend tests/integration/tickets/constraints.test.ts with merge boundaries
Task: T029 Create tests/integration/notifications/bulk-actions.test.ts
Task: T030 Create tests/unit/components/board/bulk-merge-preview-modal.test.tsx

# Then sequentially:
Task: T031 Implement bulkMergeInbox in lib/tickets/bulk-operations.ts
Task: T032 Create app/api/projects/[projectId]/tickets/bulk/merge/route.ts
Task: T033 Create lib/hooks/mutations/useBulkMergeTickets.ts
Task: T034 Create components/board/bulk-merge-preview-modal.tsx
Task: T035 Wire Merge button + modal in board.tsx and bulk-action-bar.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema, migrations, Zod scaffolding)
2. Complete Phase 2: Foundational (selection hook, action bar skeleton, card affordance)
3. Complete Phase 3: User Story 1 (Bulk Delete)
4. **STOP and VALIDATE**: Run the independent test for US1 — 10 tickets in INBOX, select 5, delete, verify
5. Ship/demo as the MVP increment

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 (Bulk Delete) → test independently → ship
3. Add US2 (Bulk Merge) → test independently → ship
4. Add US3 (Bulk Agent/Model) → test independently → ship
5. Add US4 verification tests → confirm discoverability/exit behavior holds → ship
6. Polish (logs, theme audit, perf checks) → ship

### Parallel Execution Strategy

After Phase 2 lands:

- Parallel track A: US1 (delete) — owns `bulk/delete/route.ts`, delete modal, delete mutation
- Parallel track B: US2 (merge) — owns `bulk/merge/route.ts`, merge modal, merge mutation, the notifications test
- Parallel track C: US3 (agent/model) — owns `bulk/agent/route.ts`, `bulk/model/route.ts`, shared dropdown mutation
- Parallel track D: US4 — small verification PR, runs as soon as Phase 2 is in

All four tracks touch `lib/tickets/bulk-operations.ts` (different exports), `bulk-action-bar.tsx` (different slots), and `board.tsx` (different mutation wiring). Merge order: US1 first (lowest UI risk), then US2 (most surface area, gets the longest review), then US3, then US4.

---

## Notes

- [P] tasks = different files OR independent edits in the same file with no shared symbol risk
- [Story] label maps each task to the user story it serves
- Tests precede implementation within each story (constitution §III)
- Commit after each task or logical group; pre-commit hook must pass (CLAUDE.md — never `--no-verify`)
- After Prisma schema changes: run `bunx prisma generate` before `bun run type-check`
- E2E tests intentionally omitted (plan §Testing Strategy + constitution §III decision tree — no browser-specific behavior)
