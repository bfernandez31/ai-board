# Implementation Plan: Bulk Actions on INBOX Tickets

**Branch**: `AIB-821-bulk-actions-on` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-821-bulk-actions-on/spec.md`

## Summary

Add multi-select and four bulk operations (delete, merge, change-agent, change-model) to the INBOX column of the project board. Selection is ephemeral client state surfaced by a hover-revealed checkbox on each INBOX card and a floating action bar at the bottom of the screen. All bulk operations are atomic (`prisma.$transaction` with INBOX-stage filter + optimistic-concurrency version map) and capped at 50 tickets. Bulk delete and bulk merge are destructive: merge squashes content + attachments onto the smallest-id base ticket and hard-deletes the rest; both notify non-actor source-ticket creators. Bulk agent/model changes preserve selection so the user can chain actions. The feature requires a schema migration to track ticket creators (currently absent) and extend the Notification model to support non-mention types.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5, shadcn/ui, Zod
**Storage**: PostgreSQL 14+ via Prisma; new fields on `Ticket` and `Notification` (see [data-model.md](./data-model.md))
**Testing**: Vitest (unit + integration) with RTL; no E2E required for v1 (per constitution §III decision tree — all interactions are checkbox / keyboard / click)
**Target Platform**: Web (Next.js server + client)
**Project Type**: web (single Next.js codebase, server + client in one project)
**Performance Goals**: SC-006 — bulk operation on 50 tickets completes server-side in <3s p95. Achieved via single `findMany`+`updateMany`/`deleteMany` per operation inside one transaction.
**Constraints**: SC-003 — board reflects change within 2s of submission (TanStack Query invalidation does this naturally). SC-004 — zero partial mutations (single `prisma.$transaction` guarantees this).
**Scale/Scope**: Adds 4 API routes, 1 selection hook, 3 new board components (action bar, 2 modals), 3 TanStack mutation hooks, 1 service module (`lib/tickets/bulk-operations.ts`), 1 Prisma migration. ~6 new test files plus extensions to 5 existing test files.

## Constitution Check

*GATE: must pass before Phase 0 research and re-checked after Phase 1 design.*

### I. TypeScript-First Development

- ✅ All new code is strict TypeScript; every API handler typed end-to-end via Zod-inferred request types and discriminated `BulkResult<T>` return types.
- ✅ No `any` introduced. Existing `Prisma.JsonValue` typing of `attachments` is narrowed via `isTicketAttachmentArray` type guard from `app/lib/types/ticket.ts:53`.

### II. Component-Driven Architecture

- ✅ All new UI components use shadcn/ui primitives (`<Dialog>`, `<Button>`, `<Select>`, `<Checkbox>`). No custom styling from scratch.
- ✅ Three new components — `BulkActionBar`, `BulkDeleteConfirmationModal`, `BulkMergePreviewModal` — each satisfies extraction rule (b) "has its own state" and (c) "would push parent above 300 lines".
- ✅ Selection state extracted to `useBulkSelection` hook in `components/board/hooks/` to match existing `use-board-drag-state.ts` co-location.
- ✅ All new code lives under `components/board/`, `lib/hooks/mutations/`, `lib/validations/`, `lib/tickets/`, `app/api/projects/[projectId]/tickets/bulk/`. No new top-level folders.

### III. Test-Driven Development

- ✅ Each functional requirement has a corresponding test (see Testing Strategy below).
- ✅ Five existing test files are extended (`crud.test.ts`, `constraints.test.ts`, `model-override.test.ts`, `delete-confirmation-modal.test.tsx`, `keyboard-shortcuts-integration.test.ts`) rather than duplicated.
- ✅ Five new test files are created only because no existing file covers those domains (bulk endpoints, selection hook, action-bar component, merge preview modal, bulk notifications).
- ✅ Mocks not used at the API integration layer — tests hit the real DB via the standard integration setup. RTL component tests use `renderWithProviders` from `tests/utils/component-test-utils.tsx`.

### IV. Security-First Design

- ✅ Every endpoint runs `verifyProjectAccess(projectId, request)` (owner OR member) before any read or write.
- ✅ All request bodies validated with Zod; cap of 50 enforced at schema level.
- ✅ Cross-project ticket id smuggling rejected with 403 `FORBIDDEN_CROSS_PROJECT` because the transaction-internal `findMany` includes `projectId` in the `where` clause.
- ✅ Zod constraints match Prisma column constraints (title ≤ 100, description ≤ 10000, model ≤ 50) — see `lib/validations/bulk.ts` reusing existing schemas from `lib/validations/ticket.ts`.
- ✅ No raw SQL.

### V. Database Integrity

- ✅ Schema changes ship as a single Prisma migration (see [data-model.md](./data-model.md) §3).
- ✅ All multi-row writes use `prisma.$transaction(async (tx) => { ... })`.
- ✅ Optimistic concurrency via `version` field follows the `patchTicketInline` pattern (`lib/db/tickets.ts:409`).
- ✅ Bulk delete is hard delete (FR-014) — consistent with the existing single-ticket INBOX delete behavior. Soft-delete carve-out per constitution §V is for "user-generated content with audit needs"; INBOX tickets that the creator chose to delete fall outside that scope.
- ✅ No optional fields without explicit handling: `creatorId` is nullable and every code path checks for null before sending FR-029 notifications; `mergedIntoTicketId` is nullable and the UI handles the SetNull case (deleted target ticket → notification still renders with `ticketKeySnapshot`).
- ✅ External call failure model: no external calls in any bulk handler — INBOX tickets have no `branch`, so no GitHub cleanup is invoked.

### V (bis). Specification Clarification Guardrails

- ✅ Spec includes `Auto-Resolved Decisions` block (5 decisions, all `AUTO → CONSERVATIVE`).
- ✅ Plan honors all five decisions: atomic-or-rollback, 50-cap, single-model-to-all-five-fields, ascending-id ordering in merge preview, notify-on-destructive-only.

**Result: PASS, no violations to justify in Complexity Tracking.**

## Project Structure

### Documentation (this feature)

```
specs/AIB-821-bulk-actions-on/
├── plan.md              # This file
├── research.md          # Phase 0 output (decisions, existing files inventory, patterns)
├── data-model.md        # Phase 1 output (schema changes, transient entities)
├── contracts/
│   └── bulk-tickets-api.md  # Phase 1 output (REST + UI contracts)
├── spec.md              # Existing spec
└── tasks.md             # Phase 2 output (NOT created by /ai-board.plan — created by /ai-board.tasks)
```

### Source Code (repository root)

```
prisma/
├── schema.prisma                                            # MODIFY: add Ticket.creatorId, extend Notification
└── migrations/
    └── <ts>_bulk_actions_inbox/migration.sql                # NEW

lib/
├── validations/
│   ├── bulk.ts                                              # NEW: Zod schemas for bulk endpoints
│   └── ticket.ts                                            # REUSE: titleSchema, descriptionSchema, versionSchema
├── tickets/
│   └── bulk-operations.ts                                   # NEW: pure functions for delete/merge/update inside a tx
├── db/
│   ├── auth-helpers.ts                                      # REUSE: verifyProjectAccess
│   └── tickets.ts                                           # REFERENCE: patchTicketInline pattern (P1, P2)
├── hooks/
│   └── mutations/
│       ├── useBulkDeleteTickets.ts                          # NEW
│       ├── useBulkMergeTickets.ts                           # NEW
│       └── useBulkUpdateTicketField.ts                      # NEW (shared by agent + model)
└── models/
    └── claude-models.ts                                     # REUSE: model list for dropdown

app/
├── api/projects/[projectId]/tickets/bulk/
│   ├── delete/route.ts                                      # NEW
│   ├── merge/route.ts                                       # NEW
│   ├── agent/route.ts                                       # NEW
│   └── model/route.ts                                       # NEW
└── lib/db/notifications.ts                                  # MODIFY: add createNotificationForTicketAction helper

components/board/
├── board.tsx                                                # MODIFY: mount useBulkSelection, render BulkActionBar + modals
├── stage-column.tsx                                         # MODIFY: thread selection props only when stage === 'INBOX'
├── ticket-card.tsx                                          # MODIFY: render hover checkbox; intercept Cmd/Ctrl+click and Shift+click
├── bulk-action-bar.tsx                                      # NEW
├── bulk-delete-confirmation-modal.tsx                       # NEW
├── bulk-merge-preview-modal.tsx                             # NEW
└── hooks/
    └── use-bulk-selection.ts                                # NEW

tests/
├── unit/components/
│   ├── delete-confirmation-modal.test.tsx                   # REFERENCE pattern
│   ├── keyboard-shortcuts-integration.test.ts               # EXTEND: Escape clears selection; Tab traverses checkboxes
│   └── board/
│       ├── use-bulk-selection.test.ts                       # NEW: hook unit tests
│       ├── bulk-action-bar.test.tsx                         # NEW: RTL
│       └── bulk-merge-preview-modal.test.tsx                # NEW: RTL
└── integration/
    ├── tickets/
    │   ├── crud.test.ts                                     # EXTEND: bulk delete success + conflicts
    │   ├── constraints.test.ts                              # EXTEND: bulk merge length validation
    │   ├── model-override.test.ts                           # EXTEND: bulk model atomic write of all 5 fields
    │   └── bulk-merge.test.ts                               # NEW: attachment merge, version conflict, FR-029
    └── notifications/
        └── bulk-actions.test.ts                             # NEW: TICKET_DELETED and TICKET_MERGED dispatch
```

**Structure Decision**: extends the existing single Next.js App Router project. Uses the established `app/api/projects/[projectId]/tickets/...` route pattern for backend, `components/board/` for UI, and `lib/hooks/mutations/` for TanStack mutations. The new `app/api/projects/[projectId]/tickets/bulk/` subtree groups the four bulk endpoints together so they share testing infrastructure and remain clearly distinct from single-ticket routes.

## Implementation Phases

Each phase below is sized to be runnable as a discrete task batch by `/ai-board.tasks`.

### Phase A — Schema and validation (foundation)

1. Add `Ticket.creatorId` (nullable, FK to User with `onDelete: SetNull`) and extend `Notification` per [data-model.md](./data-model.md) §1-§2.
2. Generate Prisma migration; run `bunx prisma migrate dev` locally, then `bunx prisma generate`.
3. Wire `creatorId` population into `lib/db/tickets.ts:475 createTicket`, `lib/db/tickets.ts:602 duplicateTicket`, and any inbox-analysis ticket-creation path. Forward `userId` from the API auth layer.
4. Create `lib/validations/bulk.ts` exporting `bulkDeleteSchema`, `bulkMergeSchema`, `bulkAgentSchema`, `bulkModelSchema` per [contracts/bulk-tickets-api.md](./contracts/bulk-tickets-api.md).

### Phase B — Server: bulk operation service module

5. Create `lib/tickets/bulk-operations.ts` exporting:
   - `bulkDeleteInbox(tx, { projectId, ticketIds, expectedVersions, actorId })`
   - `bulkMergeInbox(tx, { projectId, baseTicketId, sourceTicketIds, title, description, expectedVersions, actorId })`
   - `bulkUpdateInboxAgent(tx, { projectId, ticketIds, agent })`
   - `bulkUpdateInboxModel(tx, { projectId, ticketIds, model })`
   - Each returns `BulkResult<T>` per Pattern P1 from [research.md](./research.md).
   - Each implements the precondition pattern from research.md P3: re-fetch with `where: { id: { in: ids }, projectId, stage: 'INBOX' }`, compare count, compare versions where applicable, abort on mismatch with 409 codes from contracts.
   - `bulkMergeInbox` follows research.md P2 (P2025 fallback) and research.md P5 (notification creation INSIDE the same transaction, BEFORE source-ticket delete, with `Notification.ticketId` SetNull-protected by schema).
   - `bulkDeleteInbox` calls `tx.notification.createMany` for non-actor `creatorId`s with `type: 'TICKET_DELETED'` and `ticketKeySnapshot` populated.
6. Add `createNotificationForTicketAction({ recipientId, actorId, ticketId, ticketKeySnapshot, type, mergedIntoTicketId? })` helper to `app/lib/db/notifications.ts` (mirroring the existing `createNotificationForMention` shape) — but ONLY for use OUTSIDE transactions (the in-transaction path uses `tx.notification.createMany` directly).

### Phase C — Server: route handlers

7. Create `app/api/projects/[projectId]/tickets/bulk/delete/route.ts`. Structure mirrors the single-ticket DELETE in `app/api/projects/[projectId]/tickets/[id]/route.ts:215-282`: `verifyProjectAccess`, parse body with `bulkDeleteSchema`, open transaction, call `bulkDeleteInbox`, map `BulkResult` to NextResponse. Errors mapped per contracts table.
8. Create `app/api/projects/[projectId]/tickets/bulk/merge/route.ts` — same structure, calls `bulkMergeInbox`.
9. Create `app/api/projects/[projectId]/tickets/bulk/agent/route.ts` — calls `bulkUpdateInboxAgent`.
10. Create `app/api/projects/[projectId]/tickets/bulk/model/route.ts` — calls `bulkUpdateInboxModel`.

### Phase D — Client: selection hook and TanStack mutations

11. Create `components/board/hooks/use-bulk-selection.ts`. Returns `{ selectedIds, anchorId, isSelectMode, toggle(id), rangeSelectTo(id, allInboxIds), clear(), cancel() }`. Range-select uses ascending-`ticketNumber` ordering (research.md D7).
12. Create `lib/hooks/mutations/useBulkDeleteTickets.ts` following Pattern P4 from research.md (optimistic removal of selected ids, snapshot/rollback, `onSettled` invalidation of `queryKeys.projects.tickets(projectId)`).
13. Create `lib/hooks/mutations/useBulkMergeTickets.ts` — NO optimistic update (research.md P4 explanation); invalidate on success.
14. Create `lib/hooks/mutations/useBulkUpdateTicketField.ts` — generic over `agent` vs `model`; optimistic patch of affected fields per Pattern P4.

### Phase E — Client: UI components

15. Modify `components/board/ticket-card.tsx`:
    - Accept new prop `selection?: { isSelected: boolean; onToggle: () => void; onRangeSelect: () => void; isSelectMode: boolean }`.
    - When `selection` is non-null (INBOX cards only), render a checkbox top-right (hover-revealed when not in select mode, always visible in select mode).
    - Intercept `onClick` to detect `event.shiftKey` (call `onRangeSelect`) and `event.metaKey || event.ctrlKey` (call `onToggle` and stop propagation — do NOT open detail panel, per FR-006).
    - Plain click on the card body in select mode still opens the detail panel UNLESS the user explicitly Cmd/Ctrl+clicked. This matches FR-007 (toggle is on the checkbox, not on the card body).
16. Modify `components/board/stage-column.tsx`: thread the `selection` prop down to each `<TicketCard>` only when `stage === 'INBOX'`. Compute `allInboxIds` (sorted by `ticketNumber` ascending) once and pass to each card for shift+click math.
17. Create `components/board/bulk-action-bar.tsx` per UI contract in `contracts/bulk-tickets-api.md`. Use only complete literal Tailwind class strings (CLAUDE.md).
18. Create `components/board/bulk-delete-confirmation-modal.tsx` — shadcn Dialog, count-aware copy.
19. Create `components/board/bulk-merge-preview-modal.tsx` — shadcn Dialog with title input, description textarea, live counter, base-labeled source list. Compute prefilled description and attachment count from current cache (no server round-trip needed for preview).
20. Modify `components/board/board.tsx`: mount `useBulkSelection`, pass selection into INBOX `<StageColumn>`, render `<BulkActionBar>` (fixed bottom) when `selectedIds.size > 0`, render `<BulkDeleteConfirmationModal>` / `<BulkMergePreviewModal>` controlled by local React state, wire mutation success callbacks to clear/preserve selection per FR-003 (destructive: clear; non-destructive: preserve).
21. Wire Escape key globally inside `Board` (or extend `use-board-keyboard-shortcuts.ts`) to call `selection.clear()` when select mode is active.

### Phase F — Tests

22. Extend `tests/integration/tickets/crud.test.ts` with `describe('bulk delete')`: success on N tickets, 409 on version conflict, 409 on stage drift, 403 on cross-project, 400 on >50 ids.
23. Create `tests/integration/tickets/bulk-merge.test.ts`: attachment concatenation order, source deletion + base preservation of agent/models/etc., 409 conflicts, 400 description >10000, FR-029 notification firing for non-actor creator.
24. Extend `tests/integration/tickets/constraints.test.ts`: bulk merge title length 100 boundary, description length 10000 boundary.
25. Extend `tests/integration/tickets/model-override.test.ts`: bulk model writes to all 5 fields atomically.
26. Create `tests/integration/notifications/bulk-actions.test.ts`: TICKET_DELETED and TICKET_MERGED rows have correct `type`, `actorId`, `recipientId`, `ticketKeySnapshot`, `mergedIntoTicketId`; no rows for self-as-creator; no rows for bulk agent/model.
27. Create `tests/unit/components/board/use-bulk-selection.test.ts`: toggle, range-select math (mid → end, end → start), clear, anchor tracking after deselect.
28. Create `tests/unit/components/board/bulk-action-bar.test.tsx`: counter live updates, Merge disabled at 1, all actions disabled at >50 with tooltip, dropdowns open and emit correct values.
29. Create `tests/unit/components/board/bulk-merge-preview-modal.test.tsx`: prefilled values match spec format, counter turns red and submit disables at 10001 chars, base label renders.
30. Extend `tests/unit/components/keyboard-shortcuts-integration.test.ts`: Escape in select mode clears selection; Tab in select mode moves focus across INBOX checkboxes.

## Testing Strategy

Per constitution §III decision tree:

| FR / scenario | Test type | File |
|---|---|---|
| FR-001/002/003/004/005 (selection state) | Vitest unit (hook) | `tests/unit/components/board/use-bulk-selection.test.ts` |
| FR-001/006/007 (checkbox affordance + click semantics) | Vitest + RTL component | new `tests/unit/components/board/ticket-card-selection.test.tsx` (kept separate from `ticket-card-deploy.test.tsx` to avoid mixing concerns) |
| FR-008/009/010/011/012 (action bar UI) | Vitest + RTL component | `tests/unit/components/board/bulk-action-bar.test.tsx` |
| FR-013 (delete confirmation modal) | Vitest + RTL component | `tests/unit/components/board/bulk-delete-confirmation-modal.test.tsx` (NEW, sibling of existing `delete-confirmation-modal.test.tsx`) |
| FR-014/015/026/027/028 (delete atomicity + auth) | Vitest integration | extend `tests/integration/tickets/crud.test.ts` |
| FR-016 through FR-022 (merge correctness) | Vitest integration | new `tests/integration/tickets/bulk-merge.test.ts` |
| FR-018/019/020 (merge preview UI) | Vitest + RTL component | `tests/unit/components/board/bulk-merge-preview-modal.test.tsx` |
| FR-023/024/025 (agent + model bulk update) | Vitest integration | extend `tests/integration/tickets/model-override.test.ts` and `tests/integration/tickets/crud.test.ts` |
| FR-029/030 (notifications) | Vitest integration | new `tests/integration/notifications/bulk-actions.test.ts` |
| FR-031 (activity log) | not testable per research.md D5 — server logs only; no assertion needed | — |
| FR-032 (keyboard accessibility) | Vitest + RTL component | extend `tests/unit/components/keyboard-shortcuts-integration.test.ts` |
| SC-001/002 (UX time budgets) | Manual smoke during PR review (no automation — these are usability claims) | — |
| SC-003 (board reflects within 2s) | Implicit via TanStack invalidation pattern (not separately tested) | — |
| SC-004 (zero partial mutations) | Covered by integration tests above (every assertion checks "either-all-or-none") | — |
| SC-005 (80% adoption) | Not testable at PR time — product analytics metric, evaluated post-launch | — |
| SC-006 (<3s p95 at 50 tickets) | Spot-check with timed integration test (assert duration < 3000ms for 50-ticket merge) | add timing assertion to `bulk-merge.test.ts` |

No Playwright E2E tests added. All interactions are pointer/keyboard with no browser-specific requirements (no OAuth, no drag-drop for selection, no viewport-dependent behavior).

## Complexity Tracking

Empty — Constitution Check passed without violations.
