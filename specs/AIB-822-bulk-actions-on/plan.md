# Implementation Plan: Bulk Actions on INBOX Tickets

**Branch**: `AIB-822-bulk-actions-on` | **Date**: 2026-05-22 | **Spec**: `specs/AIB-822-bulk-actions-on/spec.md`
**Input**: Feature specification from `specs/AIB-822-bulk-actions-on/spec.md`

## Summary

Add multi-select capability to the INBOX column with a floating action bar supporting bulk delete, merge, change agent, and change model operations. A single `POST /api/projects/[projectId]/tickets/bulk` endpoint handles all four bulk actions with discriminated union payloads. Selection state is managed client-side via a custom React hook; no database schema changes are required.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.95.2, Prisma 6.x, shadcn/ui, @dnd-kit/core
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Bulk operations complete in <2s for up to 50 tickets per SC-001/SC-003
**Constraints**: INBOX column only; max 5 attachments per ticket; max 10,000 chars description
**Scale/Scope**: Typical INBOX size <50 tickets per project

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code uses strict TypeScript with explicit types. Zod schemas for API validation. |
| II. Component-Driven | PASS | New components follow shadcn/ui patterns. FloatingActionBar and modals compose shadcn primitives. Selection hook in `components/board/hooks/` following existing pattern. New files only where no existing file covers the domain. |
| III. Test-Driven | PASS | Integration tests for bulk API in `tests/integration/tickets/bulk-operations.test.ts`. Component tests for new UI components. Existing test files extended where applicable. |
| IV. Security-First | PASS | Server re-validates all ticket IDs belong to project and are in INBOX stage. Zod schemas match DB constraints (title: 100 chars, description: 10,000 chars). Authorization via `verifyProjectAccess`. |
| V. Database Integrity | PASS | Merge uses Prisma interactive transaction. Bulk updates use version-based optimistic concurrency. Cascade deletes handled by Prisma schema. No raw SQL. |
| V. Spec Clarification | PASS | All auto-resolved decisions documented in spec with trade-offs and reviewer notes. |

**Post-Phase-1 Re-check**: All principles confirmed. No violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-822-bulk-actions-on/
├── plan.md              # This file
├── research.md          # Phase 0: Codebase research + decisions
├── data-model.md        # Phase 1: Entity + state model
├── contracts/
│   └── bulk-api.md      # Phase 1: API contract for bulk endpoint
└── tasks.md             # Phase 2 output (not created by /plan)
```

### Source Code (repository root)

```
app/
├── api/projects/[projectId]/tickets/
│   └── bulk/
│       └── route.ts                    # NEW: Bulk operations endpoint
└── lib/hooks/mutations/
    └── useBulkTicketActions.ts         # NEW: TanStack mutations for bulk ops

components/board/
├── board.tsx                           # MODIFY: Add selection state, pass props
├── board-grid.tsx                      # MODIFY: Pass selection props to INBOX column
├── stage-column.tsx                    # MODIFY: Checkbox rendering for INBOX
├── ticket-card.tsx                     # MODIFY: Checkbox, Shift+click, Cmd/Ctrl+click
├── board-modals.tsx                    # MODIFY: Add bulk modal references
├── floating-action-bar.tsx             # NEW: Bottom action bar with bulk buttons
├── bulk-delete-confirmation-modal.tsx  # NEW: Multi-ticket delete confirmation
├── merge-preview-modal.tsx             # NEW: Merge preview with editable fields
└── hooks/
    ├── use-ticket-selection.ts         # NEW: Selection state management
    └── use-board-keyboard-shortcuts.ts # MODIFY: Escape to clear selection

lib/
├── tickets/
│   ├── deletion.ts                     # MODIFY: Add bulkDeleteInboxTickets
│   └── merge.ts                        # NEW: Server-side merge logic
└── validations/
    └── bulk-actions.ts                 # NEW: Zod schemas for bulk payloads
```

**Structure Decision**: Follows existing web application structure. New files placed alongside existing domain files. Board hooks stay in `components/board/hooks/` per convention. API route follows `app/api/projects/[projectId]/tickets/bulk/route.ts` pattern.

## Implementation Phases

### Phase 1: Selection Infrastructure + Bulk Delete (P1)

**Goal**: Multi-select checkboxes on INBOX cards, floating action bar, bulk delete with confirmation.

**Server-side**:
1. `lib/validations/bulk-actions.ts` — Zod discriminated union schema (see `contracts/bulk-api.md`)
2. `lib/tickets/deletion.ts` — Add `bulkDeleteInboxTickets(projectId, ticketIds)`:
   - Fetch all tickets by ID + projectId + INBOX stage in one query
   - Check for active jobs on each (batch query: `prisma.job.findMany` with `ticketId: { in: [...] }`)
   - Partition into deletable vs skipped (active job tickets)
   - INBOX tickets have no branches (per spec assumption) — skip GitHub cleanup
   - `prisma.ticket.deleteMany({ where: { id: { in: deletableIds } } })` — cascade handles related records
   - Return discriminated result with per-ticket success/skip reporting
3. `app/api/projects/[projectId]/tickets/bulk/route.ts` — POST handler:
   - `verifyProjectAccess(projectId)` once
   - Parse body with `bulkActionSchema`
   - Route to appropriate handler by `action` discriminator
   - For "delete": call `bulkDeleteInboxTickets`, return results

**Client-side**:
4. `components/board/hooks/use-ticket-selection.ts` — `useTicketSelection(inboxTickets)`:
   - State: `selectedIds: Set<number>`, `lastClickedId: number | null`
   - Methods: `toggleSelect(id)`, `rangeSelect(id, allIds)`, `clearSelection()`, `isSelected(id)`
   - Derived: `isSelectMode = selectedIds.size > 0`, `selectedCount`
   - Auto-clear when a selected ticket disappears from inboxTickets (concurrent delete/move)
5. `components/board/floating-action-bar.tsx` — Fixed-position bottom bar:
   - Shows when `isSelectMode` is true
   - Displays: "{N} selected", Merge (disabled if <2), Delete, Change Agent, Change Model, Cancel
   - Uses `aurora-*` glass styling consistent with design system
   - Animate in/out with CSS transition
6. `components/board/ticket-card.tsx` — Modify:
   - Add `isSelectMode`, `isSelected`, `onSelectToggle`, `onRangeSelect` props
   - Render checkbox (lucide `Square`/`CheckSquare`) on hover when not in select-mode, always when in select-mode
   - `onClick` with Cmd/Ctrl: call `onSelectToggle` instead of `onTicketClick`
   - `onClick` with Shift on checkbox: call `onRangeSelect`
   - Checkbox click stops propagation (prevents opening ticket modal)
7. `components/board/stage-column.tsx` — Modify:
   - Accept selection props from parent
   - Pass selection state and callbacks to each `TicketCard` (INBOX only)
8. `components/board/board-grid.tsx` — Modify: Pass selection props to INBOX `StageColumn`
9. `components/board/board.tsx` — Modify:
   - Initialize `useTicketSelection(ticketsByStage[Stage.INBOX])`
   - Pass selection state to `BoardGrid`
   - Pass selection state to `BoardModals`
10. `components/board/bulk-delete-confirmation-modal.tsx` — AlertDialog:
    - Lists all selected tickets by ticketKey + title
    - Warning: "This action is irreversible. Jobs, comments, and notifications will be permanently removed."
    - Calls bulk delete mutation on confirm
11. `lib/hooks/mutations/useBulkTicketActions.ts` — `useBulkDeleteTickets(projectId)`:
    - Optimistic: remove all selected tickets from cache immediately
    - On error: rollback from snapshot
    - On success: toast with success/skip summary, clear selection
12. `components/board/hooks/use-board-keyboard-shortcuts.ts` — Modify:
    - Add Escape handler: if `isSelectMode`, clear selection (takes priority over other Escape behaviors)
13. `components/board/board-modals.tsx` — Modify: Add `BulkDeleteConfirmationModal`

### Phase 2: Merge Operation (P2)

**Goal**: Merge 2+ INBOX tickets into the base ticket (lowest ID).

**Server-side**:
1. `lib/tickets/merge.ts` — `mergeInboxTickets(projectId, ticketIds, mergedTitle, mergedDescription, selectedAttachments)`:
   - Fetch all tickets by ID + projectId + INBOX stage
   - Verify none have active jobs (block entire merge if any do)
   - Sort by ID ascending; first = base ticket
   - Validate merged description ≤ 10,000 chars, attachments ≤ 5
   - Prisma interactive transaction:
     a. Update base ticket: set title, description, attachments, bump version
     b. Delete source tickets: `prisma.ticket.deleteMany({ where: { id: { in: sourceIds } } })`
   - Return updated base ticket + list of deleted tickets
2. `app/api/projects/[projectId]/tickets/bulk/route.ts` — Add "merge" action handler

**Client-side**:
3. `components/board/merge-preview-modal.tsx`:
   - Display tickets ordered by ID, base ticket marked with badge
   - Editable title field (pre-filled from base ticket, max 100 chars)
   - Editable description textarea (pre-filled with concatenated format per FR-012, max 10,000 chars with live counter)
   - Attachment manager: if combined > 5, show checkboxes for user to select which to keep
   - Warnings: "Job history, comments, and notifications from non-base tickets will be permanently lost"
   - Submit button: "Merge {N} tickets" (disabled when description exceeds limit or attachments exceed 5)
4. `lib/hooks/mutations/useBulkTicketActions.ts` — Add `useMergeTickets(projectId)`:
   - Optimistic: update base ticket in cache, remove source tickets
   - On success: toast, clear selection
5. `components/board/board-modals.tsx` — Add `MergePreviewModal`

### Phase 3: Bulk Agent + Model Change (P3)

**Goal**: Change agent or model for all selected INBOX tickets at once.

**Server-side**:
1. `app/api/projects/[projectId]/tickets/bulk/route.ts` — Add "update-agent" and "update-model" handlers:
   - Fetch all tickets, verify INBOX stage
   - For agent: loop with `prisma.ticket.update` per ticket (version check), collect success/skip
   - For model: loop with `prisma.ticket.update` per ticket setting all 5 STAGE_MODEL_KEYS, collect success/skip
   - Return results with per-ticket reporting

**Client-side**:
2. `components/board/floating-action-bar.tsx` — Implement agent + model dropdowns:
   - "Change agent" button opens dropdown (reuse agent list from `agent-icons.ts` — CLAUDE, CODEX, MISTRAL, GEMINI)
   - "Change model" button opens dropdown (reuse model list from `claude-models.ts`)
   - On selection: trigger bulk mutation immediately
3. `lib/hooks/mutations/useBulkTicketActions.ts` — Add `useBulkUpdateAgent`, `useBulkUpdateModel`:
   - Optimistic: update all selected tickets in cache with new agent/model values
   - On error: rollback from snapshot
   - On success: toast with success/skip summary

## Testing Strategy

### Unit Tests (Vitest)

| Test File | What It Tests |
|-----------|--------------|
| `tests/unit/hooks/use-ticket-selection.test.ts` (NEW) | Selection toggle, range select, Shift+click logic, auto-cleanup on ticket removal |
| `tests/unit/components/board/floating-action-bar.test.tsx` (NEW) | Render with selection count, button enable/disable states, merge disabled when <2 |
| `tests/unit/components/board/bulk-delete-confirmation-modal.test.tsx` (NEW) | Ticket list display, warning text, confirm/cancel callbacks |
| `tests/unit/components/board/merge-preview-modal.test.tsx` (NEW) | Title/description pre-fill, character counter, attachment limit warning, submit disabled states |

### Integration Tests (Vitest)

| Test File | What It Tests |
|-----------|--------------|
| `tests/integration/tickets/bulk-operations.test.ts` (NEW) | All 4 bulk actions via API: auth, validation, partial success, concurrent modification, active job handling, merge transaction, cascade delete |

### Component Tests (extend existing)

| Test File | What to Add |
|-----------|-------------|
| `tests/unit/components/ticket-card-deploy.test.tsx` | Checkbox rendering in/out of select-mode (or create separate file if scope warrants) |

### E2E Tests

No new Playwright tests for this feature. The multi-select interaction (checkboxes, Shift+click, floating bar) involves complex pointer interactions that are better verified via component + integration tests. E2E would be added post-launch if regressions occur.

## Complexity Tracking

No constitution violations. No complexity exceptions needed.
