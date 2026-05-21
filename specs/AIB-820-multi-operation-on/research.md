# Research: Multi-Ticket Bulk Operations on Inbox (AIB-820)

**Date**: 2026-05-21
**Spec**: [spec.md](./spec.md)

## Decisions

### D1 — Endpoint shape
- **Decision**: Single bulk endpoint per action under `app/api/projects/[projectId]/tickets/bulk/`:
  - `POST /api/projects/[projectId]/tickets/bulk/delete`
  - `POST /api/projects/[projectId]/tickets/bulk/agent`
  - `POST /api/projects/[projectId]/tickets/bulk/model`
  - `POST /api/projects/[projectId]/tickets/bulk/fusion`
- **Rationale**: Distinct payload shape per action, distinct error semantics (best-effort vs all-or-nothing for fusion), distinct authorization re-check semantics. Splitting per action keeps each route handler small and easy to test, mirrors existing single-ticket route layout (`tickets/[id]/route.ts`, `tickets/[id]/model-config/route.ts`).
- **Alternatives considered**:
  - One generic `POST /api/projects/[projectId]/tickets/bulk` with a discriminated `operation` field — rejected: the union type in a single handler creates a wider validation surface and complicates per-action error contracts.
  - PATCH on collection — rejected: delete is not idempotent in the REST sense, and fusion creates a side-effect (cascade delete) that PATCH cannot express cleanly.

### D2 — Authorization model
- **Decision**: Single `verifyProjectAccess(projectId, request)` call at top of every bulk handler. Then `WHERE projectId = X AND id IN (...) AND stage = 'INBOX'` for the bulk query.
- **Rationale**: Project access already implies all-tickets access per `verifyProjectAccess` semantics (owner OR member). Per-ticket access calls would be N round-trips. The `WHERE projectId = X AND id IN (...)` filter applied server-side enforces that only tickets the user can access via this project are touched; any id not belonging to the project is silently filtered (reported in `skipped`). Same authorization model as existing single-ticket routes after their initial `verifyProjectAccess`.
- **Alternatives considered**: `verifyTicketAccess(id)` per id — rejected as O(N) DB hits with no security benefit once project membership is verified.

### D3 — Optimistic concurrency
- **Decision**: All bulk operations accept `tickets: Array<{id, version}>`. Bulk field updates (agent/model) use `prisma.ticket.updateMany({ where: { id, projectId, version, stage: 'INBOX' }, data: { ..., version: { increment: 1 } } })` per ticket inside `Promise.allSettled`. Fusion uses a single `prisma.$transaction` that includes per-id version checks.
- **Rationale**: Mirrors `uploadTicketImage` (lib/tickets/images.ts:175) — `updateMany` with `version` in WHERE returns `count === 0` on conflict instead of throwing P2025, simplifying per-ticket result collection.
- **Alternatives considered**: Bulk `updateMany` with composite WHERE — rejected: cannot distinguish per-ticket failures, breaks FR-016 (best-effort with per-ticket reporting).

### D4 — Bulk delete: best-effort semantics
- **Decision**: Reuse `deleteTicketWithCleanup(...)` from `lib/tickets/deletion.ts` per ticket inside `Promise.allSettled`. Aggregate results into `affected[]` and `skipped[]`.
- **Rationale**: GitHub branch cleanup is the slowest step; sequentializing would push beyond the 3s SC-002 target for the 50-ticket cap. INBOX tickets have no branch (FR-014 + spec confirms "INBOX tickets have no jobs"), so the GitHub path is rarely hit. `Promise.allSettled` ensures one failed cleanup does not abort peers (constitution: "External call failures MUST be propagated to the caller — never silently swallowed" — we DO surface them per-ticket).
- **Alternatives considered**:
  - Sequential delete — rejected: 50× sequential round-trips against Prisma + GitHub far exceeds SC-002.
  - Hand-rolled `prisma.ticket.deleteMany({ where: { id: { in }, projectId, stage: 'INBOX' } })` — rejected: bypasses `deleteTicketWithCleanup` invariants (SHIP guard, active-job guard, branch cleanup) and violates the constitution rule "Use Prisma transactions for operations affecting multiple tables" since branch cleanup is external.

### D5 — Bulk model change: single stage per request
- **Decision**: Payload requires one of `{specifyModel | planModel | implementModel | quickImplModel | verifyModel}` set to either a valid model id or `null` (clear override). `resetAll` not supported in bulk (avoids "Apply to all stages" footgun).
- **Rationale**: Spec D8 — "An 'Inherit project default' option clears the override" — but only for the chosen stage. Reuses `ticketModelOverrideSchema` (app/lib/schemas/model-config.ts:8) for validation per-stage and `isClaudeModelId` (lib/models/claude-models.ts) for the allow-list check.
- **Alternatives considered**: Multi-stage in one request — rejected by spec D8 trade-off (one extra selection per bulk model change is preferred over accidentally overwriting all five stage overrides).

### D6 — Fusion: atomic transaction
- **Decision**: Wrap fusion in `prisma.$transaction(async (tx) => { ... })` with serializable-ish guarantee via per-id version checks. Order: (1) verify all absorbed ids exist with matching version + stage=INBOX, (2) `tx.ticket.update(anchorId, { title, description, attachments, version: { increment: 1 } })` with anchor version check via `updateMany`, (3) `tx.ticket.deleteMany({ where: { id: { in: absorbedIds }, projectId, stage: 'INBOX' } })` — if `count !== absorbedIds.length` throw to roll back.
- **Rationale**: FR-013 (atomic) + spec acceptance scenario 6 (conflict aborts entire fusion). Mirrors the constitution V "Use Prisma transactions for operations affecting multiple tables".
- **Alternatives considered**:
  - Optimistic update + per-id rollback on failure — rejected: not truly atomic; partial deletes leak.
  - DB advisory lock — rejected: overkill; per-id version + `WHERE stage='INBOX'` in the WHERE clause covers the concurrent-modification cases listed in spec edge cases.

### D7 — Selection state location
- **Decision**: Selection state lives in the `Board` component (board.tsx) as a `useState<Set<number>>` plus a `lastClickedTicketId` ref for shift-click range computation. Passed down to `StageColumn` (INBOX only) → `TicketCard`. Cleared on successful bulk mutation via TanStack `onSuccess`.
- **Rationale**: Selection set must be visible to the bulk action bar (rendered at the board level), to every INBOX `TicketCard` (for checkbox state), and to mutation hooks (for cache invalidation). React hook in `Board` is the smallest shared scope. No Redux/Zustand allowed per CLAUDE.md.
- **Alternatives considered**: URL state — rejected: spec says "Not persisted across page reloads" and URL state would leak selection across navigation.

### D8 — Bulk action bar placement
- **Decision**: A fixed-position bar at the bottom of the viewport (`fixed bottom-4 left-1/2 -translate-x-1/2`) inside the `Board` component, conditionally rendered when `selection.size > 0`. Uses `aurora-glass` per CLAUDE.md.
- **Rationale**: Matches spec ("persistent bulk action bar appears at the bottom"). Avoids reflow of the INBOX column. shadcn-friendly: composed of `Button` + `Badge`.

### D9 — Drag-and-drop coexistence
- **Decision**: Checkbox rendered as a 20×20 absolute-positioned overlay in the top-left of the `TicketCard`, with `onMouseDown={(e) => e.stopPropagation()}` and `onClick={(e) => e.stopPropagation()}` so `@dnd-kit/core`'s `useDraggable` listeners (attached to the wrapper `div`) never see the events.
- **Rationale**: FR-021 — drag still affects only one ticket. `@dnd-kit/core`'s pointer sensor activates on `pointerdown` propagation; stopping propagation on the checkbox's pointer event prevents drag initiation. Pattern from existing buttons inside ticket-card.tsx that already use `e.stopPropagation()` (e.g., cancel button on line 329).

### D10 — Fusion modal as inline edit on anchor ticket
- **Decision**: Open the existing `TicketDetailModal` (`components/board/ticket-detail-modal.tsx`) seeded with `fusionDraft` state: anchor's id but with title pre-populated from anchor, description = concatenated string, attachments = union (anchor-first, ascending id, dedup by URL, clipped to 5). Submit calls `POST /tickets/bulk/fusion` instead of the normal PATCH.
- **Rationale**: User asked for "open the first ticket in edit with auto-complete with image and concat description" — reuse the existing detail modal flow rather than building a parallel edit UI. The fusion call replaces the normal save handler.
- **Alternatives considered**: Brand-new `FusionDialog` component — rejected: duplicates description editor + image gallery + character counter; reuse keeps the UX consistent with single-ticket edit.

### D11 — Character limit handling
- **Decision**: Live character counter in the fusion modal's description Textarea. Save button disabled when `description.length > 10000`. Banner reads "Description exceeds 10,000 character limit by N characters — please edit before saving" when overflowing.
- **Rationale**: FR-011 + FR-012 + spec edge case "Description length exactly 10,000 → Save enabled at exactly the limit; disabled at 10,001+".

### D12 — Selection cap of 50
- **Decision**: Enforce client-side (`Math.min(selected.size, 50)`) AND server-side (Zod `.max(50)` on the ticket id array). Client disables bulk action buttons when `selected.size > 50` and shows a hint. "Select all" caps to 50 of `tickets.sort((a, b) => a.id - b.id).slice(0, 50)` and toasts a warning.
- **Rationale**: FR-004 + FR-020. Defense in depth; client UX prevents the request, server protects against tampered clients per Constitution IV.

## Existing Files

### Source files to modify
| Path | Current purpose | Disposition |
|------|----------------|-------------|
| `components/board/board.tsx` | Top-level board state, modals, drag wiring | **Modify** — own selection state, render bulk action bar, host fusion modal |
| `components/board/stage-column.tsx` | Renders one column with droppable + ticket cards | **Modify** — pass selection props through to INBOX cards only (`stage === 'INBOX'`) |
| `components/board/ticket-card.tsx` | Single ticket card with drag, badges, jobs | **Modify** — add optional checkbox overlay; pointer-event stop propagation |
| `components/board/ticket-detail-modal.tsx` | Full ticket detail/edit modal | **Modify** — accept optional `fusionMode` prop that swaps the save handler for the fusion mutation |
| `lib/types.ts` (TicketWithVersion) | Shared TS types | **Reuse as-is** |
| `app/lib/query-keys.ts` | TanStack Query keys | **Reuse as-is** — invalidate `queryKeys.projects.tickets(projectId)` after bulk |

### Source files to create
| Path | Purpose |
|------|---------|
| `components/board/bulk-action-bar.tsx` | Persistent bottom bar: selection count, Change agent / Change model / Fusion / Delete buttons, clear-selection |
| `components/board/bulk-delete-confirmation-modal.tsx` | AlertDialog listing affected ticket keys (mirrors `delete-confirmation-modal.tsx` pattern) |
| `components/board/bulk-agent-dialog.tsx` | Reuses `AgentEditDialog` internally; submits via bulk mutation |
| `components/board/bulk-model-dialog.tsx` | Single-stage select + model select (subset of `ModelOverrideDialog`) |
| `app/api/projects/[projectId]/tickets/bulk/delete/route.ts` | Bulk delete endpoint |
| `app/api/projects/[projectId]/tickets/bulk/agent/route.ts` | Bulk agent endpoint |
| `app/api/projects/[projectId]/tickets/bulk/model/route.ts` | Bulk model endpoint |
| `app/api/projects/[projectId]/tickets/bulk/fusion/route.ts` | Fusion endpoint |
| `lib/tickets/bulk.ts` | `bulkDeleteTickets`, `bulkSetAgent`, `bulkSetModel`, `fuseTickets` lib functions (server-side core logic) |
| `lib/schemas/bulk-ticket.ts` | Zod schemas: `bulkDeleteSchema`, `bulkAgentSchema`, `bulkModelSchema`, `fusionSchema` |
| `lib/hooks/mutations/useBulkDeleteTickets.ts` | TanStack mutation hook |
| `lib/hooks/mutations/useBulkSetAgent.ts` | TanStack mutation hook |
| `lib/hooks/mutations/useBulkSetModel.ts` | TanStack mutation hook |
| `lib/hooks/mutations/useFuseTickets.ts` | TanStack mutation hook |
| `lib/board/selection.ts` | Pure utilities: `computeRangeSelection`, `mergeAttachments` (dedup by URL, clip to 5), `buildFusionDescription` |

### Test files to extend
| Path | Current coverage | What to add |
|------|------------------|-------------|
| `tests/unit/components/ticket-detail-modal.test.tsx` | Modal reactivity, ticket updates | Add `fusionMode` cases: prefilled description, character counter, Save disabled at >10k |
| `tests/unit/components/agent-edit-dialog.test.tsx` | Single-ticket agent edit | (Unchanged — bulk dialog has its own test file) |
| `tests/unit/components/delete-confirmation-modal.test.tsx` | Single-ticket delete UI | (Unchanged — bulk uses dedicated bulk modal) |

### Test files to create
| Path | Scope |
|------|-------|
| `tests/unit/components/bulk-action-bar.test.tsx` | RTL: visible when selection.size ≥ 1; buttons disabled at >50; Fusion disabled at <2 |
| `tests/unit/components/bulk-delete-confirmation-modal.test.tsx` | RTL: lists ticket keys, irreversible warning text |
| `tests/unit/components/ticket-card-selection.test.tsx` | RTL: checkbox renders only when ticket.stage === 'INBOX'; clicking does not start drag (stopPropagation) |
| `tests/unit/lib/selection.test.ts` | Vitest unit: `computeRangeSelection`, `mergeAttachments`, `buildFusionDescription` (separator + heading format) |
| `tests/integration/tickets/bulk-delete.test.ts` | API: 200 with per-ticket results; 403 on non-member; non-INBOX skipped; >50 rejected with 400 |
| `tests/integration/tickets/bulk-agent.test.ts` | API: best-effort; version conflicts reported per-ticket; invalid agent rejected with 400 |
| `tests/integration/tickets/bulk-model.test.ts` | API: invalid model id 400; non-Claude allow-list still enforced via shared schema |
| `tests/integration/tickets/bulk-fusion.test.ts` | API: atomic success; rollback on any version conflict; long description rejected with 400 |
| `tests/e2e/inbox-bulk-operations.spec.ts` | Playwright: select 3 tickets, delete, observe inbox refresh (E2E gated to cover the selection→action UI journey end-to-end once) |

### Test files to deliberately NOT create
- No dedicated test for `useBulkDeleteTickets`/`useBulkSetAgent`/`useBulkSetModel`/`useFuseTickets` mutation hooks; their behavior is covered by integration tests + the component tests that consume them (matches the pattern of `useDeleteTicket` which has no standalone test).

## Patterns to Follow

### P1 — Best-effort + per-ticket result aggregation (NEW pattern, derived from D4)
Mirror this layout for every best-effort bulk handler:

```ts
const results = await Promise.allSettled(
  ids.map(({ id, version }) => doOne(id, version))
);
const affected = [], skipped = [];
results.forEach((r, i) => {
  if (r.status === 'fulfilled' && r.value.ok) affected.push(r.value);
  else skipped.push({ ticketId: ids[i].id, reason: extractReason(r) });
});
return { affected, skipped };
```

### P2 — Version conflict via updateMany (from `lib/tickets/images.ts:175-192`)
```ts
const result = await prisma.ticket.updateMany({
  where: { id: ticketId, projectId, version, stage: 'INBOX' },
  data: { /* ...updates */, version: { increment: 1 } },
});
if (result.count === 0) {
  return { ok: false, status: 409, body: { error: 'Ticket modified or no longer in INBOX', code: 'CONFLICT' } };
}
```
**Why use this**: returns `count` instead of throwing `P2025`; simpler aggregation; and the `stage: 'INBOX'` predicate in the WHERE clause double-enforces FR-014 even after the initial fetch.

### P3 — Authorization (from `app/api/projects/[projectId]/tickets/[id]/route.ts:30, 103, 241`)
- ALWAYS call `await verifyProjectAccess(projectId, request)` first (throws on 401/404).
- ALWAYS wrap in try/catch and translate errors: `Unauthorized` → 401, `Project not found` → 404, P2025 → 409, generic → 500.
- Log with `console.error('Bulk <op> error:', error)`.

### P4 — Optimistic cache update + rollback (from `lib/hooks/mutations/useDeleteTicket.ts:76-117`)
```ts
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
  const previousTickets = queryClient.getQueryData<TicketWithVersion[]>(...) ?? [];
  queryClient.setQueryData<TicketWithVersion[]>(..., (old) => /* optimistic */);
  return { previousTickets };
},
onError: (_e, _v, ctx) => ctx && queryClient.setQueryData(..., ctx.previousTickets),
onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.tickets(projectId) }),
retry: false,
```
**Why use this**: identical UX to single-ticket delete; rollback covers partial-failure scenarios where the server returns 200 but the skipped list re-introduces tickets the client optimistically removed.

### P5 — Drag-and-drop pointer-event isolation (from `components/board/ticket-card.tsx:328-339`)
Existing buttons inside the draggable card already use `e.stopPropagation()` on `onClick`. For the new checkbox, also stop propagation on `onMouseDown` and `onPointerDown` (the events `@dnd-kit/core`'s pointer sensor actually listens to).

### P6 — Discriminated result types (from `lib/tickets/deletion.ts:7`, `lib/tickets/images.ts:10`)
All new `lib/tickets/bulk.ts` functions return discriminated unions:
```ts
type BulkDeleteResult = { ok: true; affected: number[]; skipped: SkippedTicket[] } | { ok: false; status: number; body: Record<string, unknown> };
```
**Why**: route handlers can just `if (!result.ok) return NextResponse.json(result.body, { status: result.status });` — same pattern as `DELETE` handler at `route.ts:259`.

### P7 — Stage scoping by Prisma WHERE (defensive double-check)
Per D6 and FR-014, every bulk WHERE clause includes `stage: 'INBOX'`. Even if the client somehow sends an id that has since transitioned, the WHERE filter excludes it and reports it as skipped (reason `NOT_IN_INBOX`).

## Open Questions / NEEDS CLARIFICATION
None — all spec auto-resolved decisions plus the architecture decisions above cover the implementation surface.
