# Research: Bulk actions on INBOX tickets

## Decisions

### Decision: Keep ticket selection as board-local client state, not persisted server state

**Rationale**: Selection is ephemeral UI state tied to the current board ordering and modifier-key interactions. The existing board already derives all visible tickets from one flat React Query cache and composes board behavior in `components/board/board.tsx`, so storing `selectedTicketIds`, `selectionAnchorId`, and the current visible INBOX order in the board layer avoids unnecessary server state and keeps selection updates immediate.

**Alternatives considered**:
- Persist selection in the URL or query params: rejected because selection is transient, noisy, and would complicate modifier-click interactions.
- Persist selection in the database: rejected because it adds synchronization complexity with no product value.

### Decision: Introduce dedicated bulk mutation endpoints under `/api/projects/[projectId]/tickets/bulk/*`

**Rationale**: Existing single-ticket endpoints are versioned around one ticket at a time and stage-specific behavior. Bulk delete, bulk agent/model updates, and merge need multi-ticket validation, atomic transaction boundaries, and shared blocking error responses. Dedicated endpoints keep those rules explicit and avoid overloading `PATCH /tickets/[id]` with array-shaped payloads that do not fit the current contract.

**Alternatives considered**:
- Reuse `PATCH /tickets/[id]` in a client loop: rejected because the spec requires atomic all-or-nothing semantics.
- Add one generic `/bulk` endpoint with an `action` discriminator: possible, but rejected in planning because separate routes keep per-action validation and authorization simpler and more consistent with the existing route layout.

### Decision: Use Prisma transactions for all multi-ticket mutations and merge

**Rationale**: The spec explicitly requires full rollback when any selected ticket becomes invalid or unavailable. A transaction allows the server to validate that all selected tickets still belong to the project, remain in `INBOX`, and remain eligible before updating or deleting anything. Merge also needs one survivor update plus source-ticket deletion as one atomic unit.

**Alternatives considered**:
- Sequential writes with compensating rollback: rejected because it is more error-prone and weaker than a database transaction.
- Partial success with per-ticket reporting: rejected because it conflicts with the conservative all-or-nothing spec decision.

### Decision: Reuse existing ticket-level `agent` and per-stage model override columns

**Rationale**: The spec already frames “Change model” as applying existing editable ticket model settings. The schema already exposes `agent`, `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, and `verifyModel` on `Ticket`, so no schema migration is needed. Bulk actions can update these existing fields across a validated ticket set.

**Alternatives considered**:
- Add a new “bulk model” column: rejected because it would create a parallel model concept not present elsewhere in the product.
- Only update a single stage model field: rejected because the spec explicitly treats model change as ticket-level model settings already exposed elsewhere.

### Decision: Compute merge base on the server as the oldest selected ticket by `ticketNumber`, while the client previews merge order from the visible INBOX order

**Rationale**: `lib/db/tickets.ts` sorts INBOX by ascending `ticketNumber`, which matches oldest-first display ordering for the current board. Using the smallest selected `ticketNumber` as the survivor gives the server a stable rule that remains consistent with the client preview. The client should also submit `expectedBaseTicketId` so the server can fail safely if the preview and server ordering diverge.

**Alternatives considered**:
- Let the user choose the survivor ticket manually: rejected because the spec requires the oldest selected ticket to survive.
- Base on `createdAt` only: acceptable but rejected because `ticketNumber` is already the board’s authoritative INBOX ordering key and simpler to reason about.

### Decision: Preserve attachment provenance by deduplicating identical attachment references while recording every source ticket in the merged description scaffold

**Rationale**: The spec requires no attachment loss and asks to avoid confusing duplicates. The safest design is to collect attachments from all source tickets, dedupe by stable reference fields (`url` and `cloudinaryPublicId` when present), and make provenance visible in the merged description sections that include each source ticket key and title.

**Alternatives considered**:
- Keep duplicate attachment entries verbatim: rejected because the spec explicitly calls out avoiding confusing duplicates.
- Add a new attachment provenance schema column: rejected because provenance is already satisfied by the merged description and the current JSON attachment structure does not require schema expansion.

## Existing Files

### Production files

| Path | What it covers | Plan |
|------|----------------|------|
| `app/projects/[projectId]/board/page.tsx` | Server entry point for the project board; fetches grouped tickets and jobs and mounts `Board`. | Reuse as-is; no new page needed. |
| `components/board/board.tsx` | Central board orchestrator for ticket cache seeding, modal state, drag/drop, keyboard shortcuts, and board-wide mutations. | Extend for selection state, Escape/cancel clearing, and bulk dialog orchestration. |
| `components/board/board-grid.tsx` | Renders stage columns and passes ticket/job props through the board surface. | Extend to pass selection props to the INBOX column and action bar anchor region. |
| `components/board/stage-column.tsx` | Renders one stage column, including INBOX new-ticket button and ticket list. | Extend so INBOX can show persistent selection affordances while selected. |
| `components/board/ticket-card.tsx` | Card UI, ticket open behavior, badge rendering, and current click handling. | Extend with checkbox, modifier-click handling, and selected visual state. |
| `components/board/ticket-detail-modal.tsx` | Existing edit flows for title, description, policy, agent, model overrides, duplicate, and modal-local optimistic updates. | Extend only where selection must suppress modal open and where merged/survivor refresh handling should stay aligned with existing update patterns. |
| `components/tickets/agent-edit-dialog.tsx` | Existing agent selection dialog behavior for a single ticket. | Read as a pattern reference; likely create a bulk-specific dialog instead of overloading single-ticket wording. |
| `components/tickets/model-override-dialog.tsx` | Existing model override UI with validation and save-state behavior. | Read as a pattern reference; build a bulk model dialog around the same stage model fields. |
| `app/api/projects/[projectId]/tickets/route.ts` | Existing board ticket GET/POST route. | Reuse list/create behavior; no bulk mutation should be added here. |
| `app/api/projects/[projectId]/tickets/[id]/route.ts` | Existing single-ticket GET/PATCH/DELETE route with validation, auth checks, and structured errors. | Pattern reference for new bulk routes. |
| `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts` | Existing single-ticket model override endpoint. | Pattern reference for model validation and response shape. |
| `lib/db/tickets.ts` | Ticket reads, grouping, sorting, inline patching, duplication, and full clone transaction patterns. | Extend with bulk validation/update/merge helpers. |
| `lib/tickets/deletion.ts` | Delete guardrails and external cleanup ordering for destructive ticket deletion. | Pattern reference for bulk delete pre-flight checks and failure behavior. |
| `lib/db/auth-helpers.ts` | Owner/member authorization helpers for project and ticket access. | Reuse as-is in all new bulk routes. |
| `lib/validations/ticket.ts` | Shared Zod validation for ticket fields and constraints, including 10,000-char description max. | Extend with bulk request schemas and merge title/description validation. |
| `app/lib/hooks/queries/useTickets.ts` | Shared flat React Query ticket cache used by board views. | Reuse as the cache target for optimistic bulk mutations and invalidation. |
| `lib/hooks/mutations/useDeleteTicket.ts` | Existing optimistic remove/rollback/invalidate mutation pattern. | Pattern reference for bulk mutations. |

### Test files

| Path | What it covers | Plan |
|------|----------------|------|
| `tests/unit/components/ticket-detail-modal.test.tsx` | Modal behavior, duplicate action mocking, and prop reactivity. | Extend with “selection should not open modal” or merged-ticket refresh behavior as needed. |
| `tests/unit/components/model-override-dialog.test.tsx` | Model selection dialog behaviors and failure states. | Pattern reference; extend only if bulk model dialog shares the same component. |
| `tests/unit/components/agent-edit-dialog.test.tsx` | Existing single-ticket agent selection UI behavior. | Pattern reference or extension target if a shared selector subcomponent is extracted. |
| `tests/unit/components/board/*.test.tsx` | Board-specific component tests already live in this folder. | Extend with selection-mode, range select, and action-bar visibility tests before creating unrelated new files. |
| `tests/integration/tickets/crud.test.ts` | Ticket create/delete API tests, including single-ticket deletion behavior. | Extend for bulk delete API coverage. |
| `tests/integration/tickets/model-override.test.ts` | Single-ticket model override endpoint coverage and auth cases. | Extend for bulk model update contract and auth cases. |
| `tests/integration/tickets/constraints.test.ts` | Ticket lifecycle and integrity constraints. | Extend if merge integrity or stage guards fit better here. |
| `tests/e2e/board/drag-drop.spec.ts` | Existing board E2E helpers, board seeding, and interaction style. | Use as the reference helper style; add one new bulk-actions E2E file only because the flow is distinct from drag/drop. |
| `tests/e2e/tickets/inline-editing.spec.ts` | Existing user-edit interaction coverage in the board/ticket surface. | Pattern reference for keyboard and focus assertions if needed. |

## Patterns to Follow

### Error handling patterns

- `app/api/projects/[projectId]/tickets/[id]/route.ts:93-211` uses route-level `try/catch`, distinguishes validation/auth/not-found/conflict cases, and returns structured JSON errors. New bulk routes should mirror this shape instead of throwing opaque 500s.
- `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts:69-109` maps `ZodError` to explicit validation responses and logs unexpected failures once. Bulk model updates should keep the same validation discipline.
- `lib/tickets/deletion.ts:47-99` performs all delete blockers and GitHub cleanup before deleting the database row, and returns a typed error result instead of partially succeeding. Bulk delete should preserve this fail-before-delete pattern.
- `components/board/hooks/use-ticket-transitions.ts:57-139` performs optimistic cache updates, reverts immediately on API error, and shows scenario-specific destructive toasts. Bulk client mutations should follow the same optimistic-update then rollback flow.
- `lib/hooks/mutations/useDeleteTicket.ts:75-117` cancels outgoing queries before optimistic mutation, snapshots previous cache state, restores on error, and invalidates on settle. Bulk hooks should reuse this exact race-avoidance pattern.

### Security patterns

- `lib/db/auth-helpers.ts:30-56` and `:66-86` enforce owner-or-member access at the project and ticket levels. Every bulk endpoint must verify project access first, then validate that every selected ticket belongs to that project.
- `lib/validations/ticket.ts:37-49` and `:115-136` keep Zod limits aligned with Prisma constraints, including `title <= 100` and `description <= 10000`. Merge validation must reuse the same maximums, not looser ad hoc checks.
- `app/api/projects/[projectId]/tickets/[id]/route.ts:105-120` resolves numeric IDs and ticket keys explicitly and rejects cross-project access. Bulk routes should similarly reject mismatched project/ticket combinations rather than trusting client-provided IDs.

### State management patterns

- `app/lib/hooks/queries/useTickets.ts:41-66` treats the flat project ticket query as the board’s source of truth and derives grouped stages through `select`. Bulk UI state should not create a second persisted ticket store; it should update the same flat cache.
- `lib/db/tickets.ts:122-135` sorts `INBOX` by ascending `ticketNumber`. Range selection and merge preview order should use the current visible INBOX order derived from this existing rule.
- `components/board/hooks/use-ticket-transitions.ts:316-337` merges updated ticket payloads back into the flat cache by ID rather than rebuilding unrelated ticket state. Bulk success handlers should patch or replace only the affected tickets in the same cache.
- `lib/db/tickets.ts:698-758` shows the repository’s preferred transaction pattern for multi-record ticket/job writes: fetch, validate, create/update/delete within one `prisma.$transaction`, then return the committed state. Merge should use the same structure for survivor update plus source deletions.

## Best-practice notes

### Multi-select interaction model

**Decision**: Support three explicit selection gestures on INBOX cards: checkbox click to enter selection mode, Shift+checkbox click for range select, and Cmd/Ctrl+checkbox click for toggle-without-open.

**Rationale**: This matches the spec and prevents accidental modal opens by isolating selection behavior to the checkbox affordance. It also keeps card drag-and-drop behavior intact outside selection interactions.

**Alternatives considered**:
- Make the whole card selectable: rejected because it conflicts with existing card-open and drag behaviors.
- Add a separate “selection mode” toggle button before allowing selection: rejected as unnecessary friction.

### Merge payload design

**Decision**: Submit merge requests with `ticketIds`, `expectedBaseTicketId`, `title`, and `description`, and have the server recompute eligibility and attachment carryover.

**Rationale**: The client owns the editable preview, but the server must remain authoritative for atomic validation and attachment assembly. Including `expectedBaseTicketId` catches stale previews safely.

**Alternatives considered**:
- Send only `ticketIds` and let the server build the description: rejected because the user must be able to edit the final merged result before submission.
- Send attachment arrays from the client: rejected because server-side re-read is safer and avoids trusting stale client state.
