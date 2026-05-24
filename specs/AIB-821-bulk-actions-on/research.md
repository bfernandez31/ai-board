# Research: Bulk Actions on INBOX Tickets (AIB-821)

**Status**: Phase 0 complete — all NEEDS CLARIFICATION resolved.

## Decisions

### D1. Wire format: one bulk endpoint per action vs. one generic endpoint

- **Decision**: Four dedicated endpoints under `app/api/projects/[projectId]/tickets/bulk/`:
  - `POST .../bulk/delete` — body `{ ticketIds: number[] }`
  - `POST .../bulk/merge` — body `{ baseTicketId, sourceTicketIds[], title, description, expectedVersions: Record<id, version> }`
  - `POST .../bulk/agent` — body `{ ticketIds: number[], agent: Agent | null }`
  - `POST .../bulk/model` — body `{ ticketIds: number[], model: string | null }` (applies to all 5 model fields)
- **Rationale**: Each operation has a distinct request shape, distinct authorization shape (merge needs version map), and distinct error responses (merge can fail validation on the edited description; delete cannot). A single generic endpoint with a discriminated union obscures Zod validation and request typing; separate routes keep the contracts narrow and individually testable. Aligns with existing pattern of per-resource routes (single-ticket PATCH and DELETE both live in one file, but they are different HTTP verbs — bulk operations share a verb so they need different paths).
- **Alternatives considered**: (a) Single `POST .../bulk` with `{ action, ticketIds, payload }` — rejected: weakens type narrowing and conflates unrelated errors. (b) Reuse PATCH on existing single-ticket route with a `?ids=` query param — rejected: REST-impure and cannot express the merge request body.

### D2. Atomicity primitive

- **Decision**: Wrap each bulk handler's mutation phase in `prisma.$transaction(async (tx) => {...})` with default isolation. Re-fetch all selected tickets inside the transaction with `tx.ticket.findMany({ where: { id: { in: ids }, projectId, stage: 'INBOX' } })` and ABORT (throw a typed `BulkConflictError`) if the count returned does not equal the requested count or if any returned row's `version` does not match the expected version sent by the client.
- **Rationale**: The existing `prisma.$transaction(async (tx) => {...})` pattern in `app/api/projects/[projectId]/setup/jobs/route.ts:87-100` does check-then-write atomically. PostgreSQL default Read Committed is sufficient because the version check inside the transaction guards against concurrent updates and the `Stage = 'INBOX'` filter on every write guards against concurrent transitions.
- **Alternatives considered**: (a) `SERIALIZABLE` isolation — rejected: unnecessary for INBOX-scoped row updates; would cause serialization failures with little benefit. (b) Application-level pessimistic locks — rejected: no existing infrastructure for this.

### D3. Per-ticket optimistic concurrency

- **Decision**: Bulk merge and bulk delete MUST include an `expectedVersions: Record<ticketId, number>` map. The transaction body verifies that each affected ticket's current `version` matches the expected value. Bulk agent/model do NOT require expected versions (they bump version on each row anyway and the only conflict mode that matters is stage drift, which is caught by the `stage: 'INBOX'` filter).
- **Rationale**: Mirrors the single-ticket optimistic concurrency in `lib/db/tickets.ts:409` (`patchTicketInline` returns 409 on version mismatch). Bulk merge is destructive (deletes source tickets) and must not silently overwrite concurrent edits to base/source descriptions. Bulk delete is destructive and must not delete a ticket whose content was edited after the user clicked "Delete".
- **Alternatives considered**: Skip version map for delete (just stage check) — rejected because user may click Delete on a ticket that another user just edited; a confirm-then-delete UX must reject if the underlying content has changed.

### D4. FR-029 (notifications to source-ticket creators) — schema gap

- **Decision**: This feature adds a `creatorId` (nullable, `String? @db.VarChar(255)` referencing `User.id`) column to `Ticket`, defaults to NULL for legacy rows. Single-ticket creation routes are updated to populate `creatorId` with the actor's id (best-effort; not required for the bulk feature itself). The bulk merge/delete handlers SKIP notification when `creatorId` is null or equals the actor. The `Notification` model is extended with a nullable `commentId` (drop NOT NULL) and a new enum column `type` (`MENTION | TICKET_DELETED | TICKET_MERGED`) defaulting to `MENTION` for legacy rows.
- **Rationale**: The current `Notification` schema (`prisma/schema.prisma:263-282`) hard-codes `commentId Int NOT NULL` because notifications only exist for @mentions today. FR-029 requires notifying ticket creators on delete/merge — these notifications have no associated comment. The schema gap must be closed (either by extending Notification or by introducing a separate model). Extending the existing model is lower-friction: the polling endpoint, soft-delete cleanup, and read-state already work uniformly, and the UI only needs new copy per `type`.
- **Alternatives considered**: (a) Synthesize a "system comment" on the project to satisfy the FK — rejected: pollutes the comment thread for an unrelated ticket and breaks the `ticketId → comment.ticketId` relationship for deleted tickets. (b) Add a separate `SystemNotification` model — rejected: duplicates polling/cleanup infrastructure and forces two unread counters. (c) Defer FR-029 entirely — rejected: spec marks it MUST, and reviewer notes call out "Confirm notification copy with product" implying the feature is in scope.

### D5. FR-031 (activity log) — schema gap

- **Decision**: No new `ActivityLog` table. Bulk operations are logged via structured `console.log` lines with a stable prefix (`[bulk-action]`) and the activity feed remains derived from existing events (jobs, comments, transitions). The spec's intent — auditability — is preserved through server logs and the notification trail (FR-029) for destructive actions.
- **Rationale**: The codebase has no `ActivityLog` / `AuditLog` table (confirmed across schema and `app/lib/utils/activity-events.ts`). Adding one for this feature would be scope-creep and would require backfill across all existing tickets/jobs to be meaningful. Server logs plus the FR-029 notifications already satisfy "actor + project + affected tickets + operation type" for the destructive operations users care about most. Re-evaluate if product reports auditability gaps.
- **Alternatives considered**: (a) New `BulkOperationLog` table — rejected: persistent storage for a fix-forward feature that hasn't yet validated demand. (b) Reuse `Job` model — rejected: jobs represent long-running workflow executions, not synchronous user actions. Type confusion would propagate to the jobs dashboard.

### D6. Selection state lifecycle and scope

- **Decision**: Selection state lives in React state on the `Board` component (`components/board/board.tsx`), in a new `useBulkSelection` custom hook under `components/board/hooks/use-bulk-selection.ts`. State is scoped per-project (resets when navigating between projects). NOT persisted to URL, localStorage, or React Query cache.
- **Rationale**: The spec explicitly states "purely client-side ephemeral state" and "select mode and selections are discarded" on refresh. Existing board hooks (`use-board-drag-state.ts`, `use-board-keyboard-shortcuts.ts`) follow this pattern. Adding URL persistence would require URL-encoding selections and re-validating them on hydration — neither is needed.
- **Alternatives considered**: React Context — rejected: only `Board` and its INBOX `StageColumn` need access; prop drilling is one level.

### D7. Range-select anchor semantics

- **Decision**: The anchor is the most recently clicked INBOX ticket (whether selected or deselected by that click). Shift+click on a card computes the inclusive range between anchor and target in the displayed INBOX order (ascending `ticketNumber`, matching `sortByStage` in `lib/db/tickets.ts:122`).
- **Rationale**: Matches Mac Finder / Gmail / Linear behavior. Using displayed order (not insertion order) ensures range visually matches what the user sees.

### D8. Merge attachment concatenation order

- **Decision**: Attachments are concatenated in `[base, ...sources ordered by id ascending]` order, preserving the `TicketAttachment[]` shape from `app/lib/types/ticket.ts:9-30`. No deduplication by url or filename; users see all attachments and can delete duplicates after merge.
- **Rationale**: Matches the spec's "ascending id order" rule for description blocks. Deduplication would require choosing a tiebreaker (oldest? latest?) and is out of scope for v1.

### D9. Model dropdown source of truth

- **Decision**: The "Change model" dropdown reads from `lib/models/claude-models.ts` (constants used by `components/board/ticket-card.tsx:29`). The list is the union of all model names across all 5 stage-specific overrides. The selected model is written to all 5 fields on every selected ticket.
- **Rationale**: Spec D3 (`Auto-Resolved Decisions`) says "applies a single chosen model to all five per-command model overrides". Single source list keeps the dropdown stable.

## Existing Files

### Source — REUSE / EXTEND

| Path | What it covers | Action |
|---|---|---|
| `prisma/schema.prisma` (Ticket model lines 175-217) | Ticket schema including `version`, `attachments`, 5 model override fields, `agent`, `stage` | **Extend**: add `creatorId String? @db.VarChar(255)` + relation to User |
| `prisma/schema.prisma` (Notification model lines 263-282) | Notification schema (currently mention-only) | **Extend**: make `commentId` nullable; add `type NotificationType @default(MENTION)`; add new enum `NotificationType { MENTION TICKET_DELETED TICKET_MERGED }` |
| `lib/db/auth-helpers.ts` | `verifyProjectAccess` / `verifyTicketAccess` (owner OR member) | **Reuse as-is** |
| `lib/db/tickets.ts` (lines 388-470, `patchTicketInline`) | Single-ticket inline edit with optimistic concurrency, P2025 handling, INBOX stage guard | **Pattern reference** for bulk handlers (see Patterns to Follow §P1, §P2) |
| `lib/tickets/deletion.ts` | Single-ticket deletion with GitHub cleanup + active-job check | **Pattern reference** for bulk delete (see §P3); bulk delete is INBOX-only so no GitHub cleanup needed |
| `lib/validations/ticket.ts` | Zod schemas (`titleSchema`, `descriptionSchema`, `versionSchema`, `StageSchema`) | **Reuse** for bulk validation |
| `app/lib/db/notifications.ts` | Notification CRUD helpers (currently `createNotificationForMention`) | **Extend**: add `createNotificationForTicketAction({ recipientId, actorId, ticketId, type })` |
| `app/lib/types/ticket.ts` | `TicketAttachment` interface and type guards | **Reuse as-is** for merge attachment merging |
| `lib/models/claude-models.ts` | `STAGE_MODEL_KEYS`, `STAGE_MODEL_LABELS` + model list | **Reuse** as source for "Change model" dropdown |
| `app/lib/query-keys.ts` | `queryKeys.projects.tickets(projectId)` | **Reuse** for cache invalidation |
| `lib/hooks/mutations/useDeleteTicket.ts` | TanStack mutation pattern: optimistic update, rollback context, `onSettled` invalidation | **Pattern reference** for bulk mutation hooks (see §P4) |
| `components/board/board.tsx` | Board container, owns ticket state + modal orchestration | **Extend**: mount `useBulkSelection` hook, render `<BulkActionBar>` + bulk modals |
| `components/board/stage-column.tsx` (lines 47-58, INBOX config) | INBOX column rendering | **Extend**: pass selection context only when `stage === 'INBOX'`, render checkboxes |
| `components/board/ticket-card.tsx` | Ticket card with hover affordances | **Extend**: render hover-visible checkbox when `enableSelection` prop is true, intercept Cmd/Ctrl+click and Shift+click |
| `components/board/delete-confirmation-modal.tsx` | Single-ticket delete confirmation | **Pattern reference**; new `<BulkDeleteConfirmationModal>` uses the same shadcn `<Dialog>` shape but takes a count |

### Source — CREATE NEW

| Path | Purpose |
|---|---|
| `app/api/projects/[projectId]/tickets/bulk/delete/route.ts` | POST handler for bulk delete |
| `app/api/projects/[projectId]/tickets/bulk/merge/route.ts` | POST handler for bulk merge |
| `app/api/projects/[projectId]/tickets/bulk/agent/route.ts` | POST handler for bulk agent change |
| `app/api/projects/[projectId]/tickets/bulk/model/route.ts` | POST handler for bulk model change |
| `lib/tickets/bulk-operations.ts` | Pure functions: `bulkDeleteInbox`, `bulkMergeInbox`, `bulkUpdateInboxFields` — each takes a `Prisma.TransactionClient`, performs preconditions + writes, returns a typed `BulkResult` discriminated union (mirrors `patchTicketInline` shape) |
| `lib/validations/bulk.ts` | Zod schemas: `bulkDeleteSchema`, `bulkMergeSchema`, `bulkAgentSchema`, `bulkModelSchema` (all enforce `ticketIds.length >= 1 && <= 50`, merge requires `>= 2`) |
| `components/board/hooks/use-bulk-selection.ts` | Selection state hook (selected set, anchor id, mode toggles, range-select math) |
| `components/board/bulk-action-bar.tsx` | Floating action bar component (counter, Merge, Delete, agent/model dropdowns, Cancel) |
| `components/board/bulk-delete-confirmation-modal.tsx` | shadcn Dialog confirming bulk delete with count |
| `components/board/bulk-merge-preview-modal.tsx` | shadcn Dialog with editable title + description textarea, live counter, base-labeled list |
| `lib/hooks/mutations/useBulkDeleteTickets.ts` | TanStack mutation with optimistic removal + rollback |
| `lib/hooks/mutations/useBulkMergeTickets.ts` | TanStack mutation (no optimistic update — wait for server response to know final base content) |
| `lib/hooks/mutations/useBulkUpdateTicketField.ts` | Shared TanStack mutation for `bulk/agent` and `bulk/model` |

### Tests — EXTEND (search-existing-first per constitution §III)

| Path | What it covers | Action |
|---|---|---|
| `tests/integration/tickets/crud.test.ts` | Ticket CRUD against real DB | **Extend** with `describe('bulk operations')` covering 50-cap, atomicity, version conflicts, stage-drift conflicts |
| `tests/integration/tickets/constraints.test.ts` | Ticket field constraints (max lengths, INBOX-only edits) | **Extend** with bulk merge description ≤10000 validation, title ≤100 validation |
| `tests/integration/tickets/model-override.test.ts` | Model override field updates | **Extend** with bulk-model atomic write of all 5 fields |
| `tests/unit/components/delete-confirmation-modal.test.tsx` | Single-ticket delete modal | **Pattern reference**; new test file `bulk-delete-confirmation-modal.test.tsx` for the count-aware variant |
| `tests/unit/components/keyboard-shortcuts-integration.test.ts` | Board keyboard interactions | **Extend** with Escape-clears-selection and Tab-traverses-checkboxes coverage |
| `tests/unit/components/board/` (directory) | Existing board component unit tests | **Extend** by adding `bulk-action-bar.test.tsx`, `bulk-merge-preview-modal.test.tsx`, `use-bulk-selection.test.ts` here |

### Tests — CREATE NEW (no existing file covers the domain)

| Path | Purpose |
|---|---|
| `tests/unit/components/board/use-bulk-selection.test.ts` | Hook unit tests: range select math, anchor tracking, mode exit conditions |
| `tests/unit/components/board/bulk-action-bar.test.tsx` | RTL component tests: counter, button enablement, dropdown rendering, 50-cap tooltip |
| `tests/unit/components/board/bulk-merge-preview-modal.test.tsx` | RTL tests: prefill, live counter, submit disabled at >10000, base-label rendering |
| `tests/integration/tickets/bulk-merge.test.ts` | Integration: attachment concatenation order, source ticket deletion, version conflict, stage drift, FR-029 notification dispatch |
| `tests/integration/notifications/bulk-actions.test.ts` | Integration: TICKET_DELETED and TICKET_MERGED notification creation for non-actor creators only |

**No E2E tests required** for v1: the integration tests above plus RTL component tests cover the user stories without needing a real browser (per constitution §III decision tree, "Does it REQUIRE a browser?" — no, all interactions are checkbox/keyboard/click, well-covered by RTL + `userEvent`).

## Patterns to Follow

### P1. Discriminated-union result for handler functions

Reference: `lib/db/tickets.ts:376-378`, `lib/tickets/deletion.ts:7-9`

```ts
export type BulkResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: Record<string, unknown> };
```

New bulk handler functions in `lib/tickets/bulk-operations.ts` MUST return this shape. The route handler then maps `{ ok: false }` to `NextResponse.json(result.body, { status: result.status })` exactly as `app/api/projects/[projectId]/tickets/[id]/route.ts:159-160, 260-261` does today. Never throw for expected business errors (stage drift, version conflict, 50-cap) — throw only for genuinely unexpected failures.

### P2. Optimistic-concurrency + P2025 fallback

Reference: `lib/db/tickets.ts:437-469`

The bulk merge handler MUST follow this two-tier pattern:
1. **Pre-write check inside transaction**: `findMany` with `id IN (...)` and compare each returned `version` to `expectedVersions[id]`. If any mismatch → abort with 409 and the current versions returned in the body so the client can refresh.
2. **Write-time fallback**: each `tx.ticket.update({ where: { id, version: expectedVersion }, ... })` will throw P2025 if the row's version changed between the check and the update (a concurrent writer slipped in mid-transaction). Catch P2025 inside the transaction handler and re-throw as `BulkConflictError` so the route handler returns 409 with the conflicting ids.

### P3. Pre-action authorization re-verification

Reference: `app/api/projects/[projectId]/tickets/[id]/route.ts:30-40`, `:103-113`

Every bulk handler MUST:
1. Call `verifyProjectAccess(projectId, request)` first.
2. Inside the transaction, re-fetch the tickets with `where: { id: { in: ids }, projectId, stage: 'INBOX' }` and verify the returned count matches the requested count. This single query simultaneously enforces (a) cross-project isolation (FR-028), (b) stage drift (FR-027), and (c) existence (deleted-by-another-user).
3. Never trust `request.body.projectId`; the URL path is the only authoritative source.

### P4. TanStack mutation pattern with optimistic update + rollback

Reference: `lib/hooks/mutations/useDeleteTicket.ts:76-117`

The bulk-delete mutation MUST:
- Cancel in-flight queries on `queryKeys.projects.tickets(projectId)` in `onMutate`.
- Snapshot the current cache as `previousTickets` (typed as `Ticket[]`).
- Optimistically remove all selected ids in one `setQueryData` call.
- On error, restore the snapshot.
- On `onSettled`, invalidate `queryKeys.projects.tickets(projectId)`.

The bulk-agent and bulk-model mutations MAY use optimistic updates by patching the affected fields in-place (same snapshot/restore shape). The bulk-merge mutation MUST NOT use optimistic updates because the server-truthful base content depends on the user-edited description that round-trips through the API — a partial optimistic update would flash incorrect content. Invalidate-on-success is sufficient.

### P5. Transaction-scoped notification creation

Reference: `app/api/projects/[projectId]/tickets/[id]/comments/route.ts:170-211`

Notifications for FR-029 MUST be created with `tx.notification.createMany` inside the same transaction that performs the destructive action, so a transaction rollback cancels the notifications. The filtering rule mirrors the comments route:

```ts
const recipients = sources
  .filter(t => t.creatorId && t.creatorId !== actorId)
  .map(t => ({
    recipientId: t.creatorId!,
    actorId,
    ticketId: t.id,           // even though the row is about to be deleted, this id is logged for the notification's reference
    commentId: null,
    type: 'TICKET_MERGED',    // or 'TICKET_DELETED'
  }));
if (recipients.length) await tx.notification.createMany({ data: recipients });
```

Note: for merge, send notifications BEFORE deleting source rows (Prisma cascade would delete the new notifications otherwise — Notification has `onDelete: Cascade` from Ticket). Alternatively change the relation to `SetNull` on `ticketId`. **Recommended**: change to `SetNull` so the notification survives source deletion and the recipient still receives a "ticket X was merged" alert that points to the surviving base ticket. Add `mergedIntoTicketId Int?` on Notification for the base id when type is `TICKET_MERGED`.

### P6. Static Tailwind class names (CLAUDE.md guidance)

Reference: CLAUDE.md "Tailwind Classes" — never construct dynamically.

The `BulkActionBar` and modals MUST use only complete literal class strings. Stage color mapping for the action bar background uses the same `aurora-*` utility classes documented in `globals.css` (CLAUDE.md "Aurora B+ Theme").

## Resolved NEEDS CLARIFICATION

| Unknown | Resolution |
|---|---|
| What activity-stream API exists for FR-031? | None exists. Resolved via D5: structured server logs; revisit if product demands persistent audit trail. |
| Does `Ticket` track creator for FR-029? | No (`creatorId` field does not exist). Resolved via D4: add nullable `creatorId`; skip notification when null or self. |
| Does `Notification` support non-mention types? | No (`commentId NOT NULL`, no `type` discriminator). Resolved via D4: schema migration extends the model. |
| Should bulk operations use 1 generic endpoint or 4 specific endpoints? | Resolved via D1: four dedicated endpoints for narrow Zod schemas. |
| What isolation level for atomic bulk transactions? | Resolved via D2: default Read Committed + version map; sufficient given INBOX-scoped row updates. |
| How is "displayed order" defined for shift+click range select? | Resolved via D7: ascending `ticketNumber` (matches existing INBOX sort in `lib/db/tickets.ts:127`). |
| Where does the "Change model" dropdown source its list? | Resolved via D9: `lib/models/claude-models.ts`. |
