# Research: Auto-transition mode on full-workflow tickets (AIB-682)

## Unknowns (from Technical Context)

None remain after auto-resolution in the spec. Each originally-ambiguous decision is documented in the spec's "Auto-Resolved Decisions" section:

| Originally unknown | Resolution | Source |
|---|---|---|
| Who may toggle auto-mode | Parity with existing stage-transition authorization (owner or member) | Spec §Auto-Resolved, FR-002 |
| How user learns of failure | Reuse existing job-failure notification path | Spec §Auto-Resolved |
| Persistence scope | Per-ticket, server-side (shared across viewers) | Spec §Auto-Resolved, FR-023–025 |
| Visual treatment of "on" state | Project accent token (indigo-500 ring halo) | Spec §Auto-Resolved, FR-006 |

## Existing Files

### Source — to extend

| Path | Purpose | Action |
|---|---|---|
| `prisma/schema.prisma:130-169` | Ticket model — already has `autoMode Boolean @default(false)` at line 141 | No change; pattern reference |
| `lib/tickets/transition.ts` | `executeTicketTransition()` + `rollbackToPlanWithReset()` | Extend: add `autoMode: false` to rollback-to-PLAN transaction |
| `lib/workflows/transition.ts` | `handleTicketTransition()`, `cleanupOrphanedJob()`, `resolveEffectiveAgent()` | Reuse as-is (pattern reference) |
| `app/api/jobs/[id]/status/route.ts` | `PATCH /api/jobs/:id/status` — terminal-state hook point around lines 250-258 | Extend: call `handleJobCompletionAutoTransition` after push notification |
| `app/lib/job-state-machine.ts` | `canTransition()`, `isTerminalStatus()` | Reuse as-is (`isTerminalStatus` is a useful predicate) |
| `lib/stage-transitions.ts` | `getNextStage()`, `isValidTransition()`, `STAGE_ORDER` | Reuse as-is |
| `components/board/ticket-card.tsx` | Card renderer; owns cancel-X hover icon at lines 259-272 | Extend: add fast-forward icon + modal wiring |
| `components/board/cancel-confirmation-modal.tsx` | Radix AlertDialog confirmation pattern | Pattern reference — copy shape into new modal |
| `components/ui/tooltip.tsx`, `components/ui/alert-dialog.tsx` | shadcn/ui primitives | Reuse as-is |
| `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` | POST `/transition` — auth + `executeTicketTransition` delegation | Pattern reference — new `/auto-mode` route mirrors its auth & delegation shape |

### Source — to create

| Path | Reason no existing file covers this |
|---|---|
| `app/api/projects/[projectId]/tickets/[id]/auto-mode/route.ts` | No endpoint today toggles `autoMode`; `/transition` advances stage, not metadata |
| `app/lib/tickets/auto-mode.ts` | Core service: enable/disable + job-completion hook. Distinct responsibility from `lib/tickets/transition.ts` (that one advances stage) |
| `app/lib/tickets/auto-mode-eligibility.ts` | Pure predicate — colocate with service |
| `lib/utils/auto-mode-stage-preview.ts` | Pure function for modal text; not related to any existing util |
| `components/board/auto-mode-icon.tsx` | New icon component |
| `components/board/auto-mode-confirmation-modal.tsx` | New modal; parallels `cancel-confirmation-modal.tsx` (keep side-by-side to make the pattern obvious) |
| `app/lib/hooks/mutations/useAutoMode.ts` | New mutation — other mutations live in `app/lib/hooks/mutations/` (e.g., `useCancelJob`, `useDeployPreview`) |

### Tests — to extend or create

Constitution §III: "Search existing tests FIRST — extend, don't duplicate."

| Existing file | Decision | Why |
|---|---|---|
| `tests/integration/tickets/transitions.test.ts` | **Extend** with one test: VERIFY→PLAN rollback disengages autoMode | File already covers rollbacks; adding the autoMode assertion is the single-concern extension |
| `tests/unit/components/board/ticket-card-model-badge.test.tsx` | **Do not extend** | Covers an unrelated badge; mixing autoMode tests would break single-concern |
| `tests/unit/components/ticket-detail-modal.test.tsx` | **Do not extend** | Icon lives on card, not detail modal |
| `tests/unit/stage-validation.test.ts` | **Do not extend** | Tests `isValidTransition`; autoMode is orthogonal |

| New file | Reason |
|---|---|
| `tests/integration/tickets/auto-mode.test.ts` | New endpoint surface; keeping separate preserves single-concern per constitution §III |
| `tests/integration/jobs/auto-mode-hook.test.ts` | Job-status hook is unique to this feature; `transitions.test.ts` does not drive hooks |
| `tests/unit/auto-mode-eligibility.test.ts` | Pure predicate — no existing file covers autoMode predicates |
| `tests/unit/auto-mode-stage-preview.test.ts` | Pure stage-preview function |
| `tests/unit/components/board/auto-mode-icon.test.tsx` | New component RTL test |
| `tests/unit/components/board/auto-mode-confirmation-modal.test.tsx` | New modal RTL test |
| `tests/e2e/board/auto-mode.spec.ts` | One happy-path E2E for SC-001 (chain INBOX→BUILD with zero additional clicks after confirmation) |

## Patterns to Follow

### 1. Dispatch-then-rollback on failure (critical for FR-021)

Reference: `lib/tickets/transition.ts:303-384` — `executeTicketTransition` forward-transition branch.

The existing pattern for "mutate DB → dispatch external workflow → rollback mutation on failure" is:

```ts
// 1. Persist DB change (line 349 update + 302-352 overall flow)
const updatedTicket = await prisma.ticket.update({ where: { id, version }, data: {...} });

// 2. If update failed via optimistic-concurrency (P2025), clean up dispatched job
} catch (updateError: unknown) {
  if (/* P2025 */) {
    if (transitionResult.jobId) {
      await cleanupOrphanedJob(transitionResult.jobId);
    }
    return { ok: false, status: 409, ... };
  }
  throw updateError;
}
```

**New code MUST follow**: `enableAutoMode()` sets `autoMode=true`, then calls `executeTicketTransition`. If that returns `{ ok: false }`, the new code MUST revert `autoMode` to `false` before returning (FR-021). This matches the dispatch-then-cleanup shape above.

### 2. Rollback transaction pattern

Reference: `lib/tickets/transition.ts:48-59` — `rollbackTransaction()`.

```ts
return prisma.$transaction(async (tx) => {
  const updated = await tx.ticket.update({ where: { id }, data: updateData });
  if (mostRecentJob) {
    await tx.job.delete({ where: { id: mostRecentJob.id } });
  }
  return updated;
});
```

**New code MUST follow**: Extending `rollbackToPlanWithReset` to also set `autoMode=false` (FR-022) means adding the field to `updateData` (already inside the transaction at `transition.ts:75-79`) — do NOT add a second query.

### 3. Hover-only icon styling

Reference: `components/board/ticket-card.tsx:259-272` — cancel-X button.

```tsx
className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-... "
```

**New code MUST follow**: Off-state fast-forward icon uses the same `opacity-0 group-hover:opacity-100` pattern. Requires the icon to live inside the same `.group` element (the `Card` at line 141).

### 4. Accent halo (on-state)

Reference: `components/board/ticket-card.tsx:182` — custom-models indigo halo.

```tsx
className="ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
```

**New code MUST follow**: On-state icon uses the same indigo ring halo so the visual vocabulary is consistent (and CLAUDE.md explicitly permits these palette classes as accent tokens).

### 5. Confirmation modal shape

Reference: `components/board/cancel-confirmation-modal.tsx` (Radix AlertDialog).

**New code MUST follow**: Identical prop shape (`open`, `onOpenChange`, `onConfirm`) + `AlertDialogHeader`/`Description`/`Footer`/`Action`/`Cancel` composition.

### 6. Terminal-status detection

Reference: `app/lib/job-state-machine.ts:57-61` — `isTerminalStatus()`.

**New code MUST follow**: Use `isTerminalStatus(status)` instead of inlining `['COMPLETED','FAILED','CANCELLED'].includes(...)` (as the job-status route itself does at line 183 — the new hook should lean on the state-machine helper).

### 7. Hook must not fail the outer PATCH

Security/state-management pattern: the existing `sendJobCompletionNotification` at `app/api/jobs/[id]/status/route.ts:252-257` uses `.catch((err) => console.error(...))` so a push-service outage doesn't fail the job-status update.

**New code MUST follow**: `handleJobCompletionAutoTransition` is called the same way — fire-and-log, never throw out of the status route, because the job row is already persisted and we cannot fail the outer request retroactively.

## Consolidated Decisions

### Decision 1 — Trigger mechanism
- **Chosen**: Server-side hook inside `PATCH /api/jobs/:id/status` that calls `executeTicketTransition` when an eligible job completes with success.
- **Rationale**: (a) Uniform behavior regardless of which client/workflow reports the terminal status. (b) Reuses the existing transition path verbatim (authorization, optimistic concurrency, orphaned-job cleanup). (c) Failure handling (FR-018/019) lives next to success handling → single source of truth.
- **Alternatives considered**:
  - *In-workflow calls inside speckit.yml* (similar to the existing BUILD→VERIFY transition): rejected because it would duplicate logic across speckit.yml and quick-impl.yml and would not handle FAILED/CANCELLED as cleanly (the workflow wouldn't fire on cancel).
  - *Client-side polling triggers the next transition*: rejected — relies on a browser being open (violates FR-023 "persists across sessions" semantic where the chain should continue without an observer).

### Decision 2 — Persistence column
- **Chosen**: Use existing `Ticket.autoMode` Boolean column (`prisma/schema.prisma:141`); no migration.
- **Rationale**: Column already exists in `prisma/migrations/0_init/migration.sql`. Avoids a net-new migration.
- **Alternatives considered**: Separate `TicketAutoMode` table with audit timestamps — rejected as over-engineered for a Boolean flag; spec does not require history.

### Decision 3 — Toggle endpoint shape
- **Chosen**: `PATCH /api/projects/[projectId]/tickets/[id]/auto-mode` with body `{ enabled: boolean }`.
- **Rationale**: Mirrors the shape of the existing `/transition` route (POST with body, path scoped to project+ticket). Single endpoint for both on/off keeps client logic simple.
- **Alternatives considered**: POST `/enable` + DELETE `/disable` — rejected; Boolean toggle does not need two verbs.

### Decision 4 — Immediate-dispatch-on-enable
- **Chosen**: When enabling on a ticket with no running workflow job, the toggle endpoint itself calls `executeTicketTransition` inside the same request (FR-010). On dispatch failure, `autoMode` is reverted (FR-021).
- **Rationale**: Keeps the "one-click fire-and-forget" promise (US1). Reusing `executeTicketTransition` means no new dispatch code.
- **Alternatives considered**: Return 202 and have the client chain a second request to `/transition` — rejected; racy, more network round-trips, and client must know the next stage.

### Decision 5 — Icon placement
- **Chosen**: Inline in the left-side workflow-status cluster at `ticket-card.tsx:249-273`, next to the cancel-X.
- **Rationale**: Reuses the `.group` parent so `group-hover:opacity-100` works without extra wrappers; visually grouped with other ticket-action icons.
- **Alternatives considered**: Top-right near the agent badge — rejected; that area uses solid accent pills and would compete with the Agent badge.

### Decision 6 — Testing location for rollback disengage
- **Chosen**: Extend `tests/integration/tickets/transitions.test.ts`.
- **Rationale**: Constitution §III mandates extend-over-duplicate. That file already verifies VERIFY→PLAN rollback semantics.
- **Alternatives considered**: A dedicated `rollback-auto-mode.test.ts` — rejected per constitution.
