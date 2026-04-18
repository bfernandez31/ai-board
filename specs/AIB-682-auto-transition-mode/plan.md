# Implementation Plan: Auto-transition mode on full-workflow tickets

**Branch**: `AIB-682-auto-transition-mode` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-682-auto-transition-mode/spec.md`

## Summary

Add a per-ticket "auto mode" toggle on FULL-workflow tickets in INBOX/SPECIFY/PLAN that automatically chains stage transitions (INBOX → SPECIFY → PLAN → BUILD) as each workflow job succeeds. Activation via fast-forward icon + confirmation modal; deactivation via single click. Auto mode disengages itself on FAILED/CANCELLED jobs and on VERIFY → PLAN rollback. State is persisted server-side via `Ticket.autoMode` (already present in Prisma schema) and shared across all viewers of a ticket.

Technical approach:
- **Data**: Use existing `Ticket.autoMode` Boolean column (`prisma/schema.prisma:141`); no new migration needed.
- **Server hook**: Extend `PATCH /api/jobs/[id]/status` so that after a terminal-state update, if `ticket.autoMode` is on, either (a) dispatch the next stage via `executeTicketTransition()` on COMPLETED in SPECIFY/PLAN, or (b) set `autoMode=false` on FAILED/CANCELLED. This mirrors the existing BUILD → VERIFY auto-transition pattern where the workflow reaches the transition endpoint after a successful stage.
- **Toggle API**: New `PATCH /api/projects/[projectId]/tickets/[id]/auto-mode`. When enabling without a running job, it also dispatches the next transition inside the same request; if the dispatch fails the flag is reverted (failure-handling rule FR-021).
- **Rollback hook**: Extend `rollbackToPlanWithReset()` (called on VERIFY → PLAN) to set `autoMode=false` inside the existing rollback transaction.
- **UI**: Add fast-forward icon to `components/board/ticket-card.tsx`, matching the cancel-X hover pattern when off and accent-ring when on; add `AutoModeConfirmationModal` (Radix AlertDialog) and a `useAutoMode` TanStack mutation.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node.js 22.20.0
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5.95.2, shadcn/ui + Radix, TailwindCSS 3.4, Zod, Octokit
**Storage**: PostgreSQL 14+ (via Prisma)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel / Linux server; modern evergreen browsers
**Project Type**: web (Next.js monorepo with `app/`, `components/`, `lib/`, `tests/`)
**Performance Goals**: Auto-transition dispatch ≤ 1 additional DB round-trip + workflow dispatch latency (same as manual drag today).
**Constraints**: Must reuse existing authorization (parity with manual stage transitions). Must not interrupt running jobs. Must not introduce infinite loop on rollback. No client-only state — server is source of truth.
**Scale/Scope**: Server hook runs on every job status terminal transition. Estimated < 30 autoMode-enabled tickets per project at any given time.

No NEEDS CLARIFICATION items remain — all ambiguous decisions were auto-resolved in the spec's "Auto-Resolved Decisions" block and confirmed by reading the existing codebase.

## Constitution Check

Gate derived from `.ai-board/memory/constitution.md` v1.8.0:

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. TypeScript-First | PASS | All new code in strict TS with explicit types; Zod schemas for request bodies. |
| II. Component-Driven Architecture | PASS | New icon uses lucide-react + shadcn/ui Tooltip; new modal uses shadcn/ui AlertDialog (same primitive as `CancelConfirmationModal`). No new UI libs. |
| III. Test-Driven Development | PASS | Extends existing test files (`tests/integration/tickets/transitions.test.ts`, new integration test for job-status auto-transition hook, RTL tests in `tests/unit/components/board/`). |
| IV. Security-First | PASS | Toggle endpoint reuses `verifyProjectAccess()`; Zod validates request; no new secrets. |
| V. Database Integrity | PASS | Use Prisma `$transaction` when combining `autoMode` update with job/ticket state changes; re-read ticket after mutation before dispatching (matches existing pattern at `lib/tickets/transition.ts:309-320`). |
| V. Spec Clarification Guardrails | PASS | Auto-resolved decisions documented in spec §"Auto-Resolved Decisions". |

No violations. Complexity Tracking section intentionally empty.

## Project Structure

### Documentation (this feature)

```
specs/AIB-682-auto-transition-mode/
├── spec.md               # Feature specification (input)
├── plan.md               # This file
├── research.md           # Phase 0 output: existing files + patterns
├── data-model.md         # Phase 1 output: Ticket.autoMode semantics
├── contracts/
│   ├── auto-mode-api.md  # PATCH /api/projects/.../tickets/[id]/auto-mode
│   └── job-status-hook.md# Server-side auto-transition hook on PATCH /api/jobs/[id]/status
├── workflows/
│   └── auto-transition-trigger.md  # Internal process: job completion → auto-dispatch
└── tasks.md              # Phase 3 output (NOT generated by /ai-board.plan)
```

### Source Code (repository root)

```
# Server
lib/tickets/transition.ts          # EXTEND: autoMode=false in rollbackToPlanWithReset (VERIFY→PLAN)
lib/workflows/transition.ts        # REUSE AS-IS: handleTicketTransition + cleanupOrphanedJob
app/api/jobs/[id]/status/route.ts  # EXTEND: post-terminal-state hook for autoMode
app/api/projects/[projectId]/tickets/[id]/auto-mode/route.ts  # NEW: PATCH toggle
app/lib/tickets/auto-mode.ts                     # NEW: enableAutoMode, disableAutoMode,
                                                 #      handleJobCompletionAutoTransition
app/lib/tickets/auto-mode-eligibility.ts         # NEW: pure predicate (FR-001/003/004)

# Client
components/board/ticket-card.tsx                 # EXTEND: fast-forward icon + modal wiring
components/board/auto-mode-icon.tsx              # NEW: visual icon (off: hover-only, on: accent)
components/board/auto-mode-confirmation-modal.tsx# NEW: AlertDialog listing chained stages
app/lib/hooks/mutations/useAutoMode.ts           # NEW: TanStack mutation hook (optimistic)
lib/utils/auto-mode-stage-preview.ts             # NEW: computeChainedStages(stage) → Stage[]

# Tests
tests/integration/tickets/auto-mode.test.ts                       # NEW: toggle API
tests/integration/jobs/auto-mode-hook.test.ts                     # NEW: PATCH status hook
tests/integration/tickets/transitions.test.ts                     # EXTEND: rollback disengage
tests/unit/components/board/auto-mode-icon.test.tsx               # NEW
tests/unit/components/board/auto-mode-confirmation-modal.test.tsx # NEW
tests/unit/auto-mode-eligibility.test.ts                          # NEW
tests/unit/auto-mode-stage-preview.test.ts                        # NEW
tests/e2e/board/auto-mode.spec.ts                                 # NEW: one happy-path chain

# Schema
prisma/schema.prisma  # NO CHANGE — autoMode already present at line 141
```

**Structure Decision**: Web application. Server logic in `app/api/` and `app/lib/` + `lib/`; client components in `components/board/`; hooks in `app/lib/hooks/`; tests colocated by type under `tests/`. Follows the repo's existing feature-folder conventions.

## Implementation Phases

Dependency order. Each phase produces a concrete, reviewable diff.

### Phase A — Pure primitives & eligibility

1. `app/lib/tickets/auto-mode-eligibility.ts`: `isAutoModeEligible(ticket)` → true iff `workflowType === 'FULL'` AND `stage ∈ {INBOX, SPECIFY, PLAN}` (FR-001/003/004).
2. `lib/utils/auto-mode-stage-preview.ts`: `computeChainedStages(stage)` — e.g., `INBOX → ['SPECIFY','PLAN','BUILD']`, `SPECIFY → ['PLAN','BUILD']`, `PLAN → ['BUILD']`.
3. Unit tests for both.

### Phase B — Toggle endpoint & core service

1. `app/lib/tickets/auto-mode.ts`:
   - `enableAutoMode({projectId, ticketIdentifier})` — set `autoMode=true`. Determine whether a workflow job is currently running (`PENDING` or `RUNNING`, excluding `comment-*`). If no job is running, call `executeTicketTransition(projectId, ticketIdentifier, nextStage)` (FR-010). **If the dispatch returns a non-OK result, revert `autoMode` to `false` (FR-021) and propagate the error to the caller** — mirrors the dispatch-then-rollback pattern at `lib/tickets/transition.ts:367-384`.
   - `disableAutoMode({projectId, ticketIdentifier})` — set `autoMode=false` (FR-013/014/015). Must NOT touch job rows.
2. `app/api/projects/[projectId]/tickets/[id]/auto-mode/route.ts`:
   - `PATCH` body: `{ enabled: boolean }` (Zod-validated).
   - Auth: `verifyProjectAccess()` — parity with existing `/transition` route (FR-002).
   - Delegates to `enableAutoMode` / `disableAutoMode`. Response: `{ autoMode, jobId? }`.
3. Integration tests in `tests/integration/tickets/auto-mode.test.ts`:
   - Enable with no running job → `autoMode=true` + new PENDING job exists.
   - Enable with RUNNING job → `autoMode=true`, no new job (FR-011).
   - Disable → `autoMode=false`, running job untouched (FR-014).
   - Enable on ineligible ticket (QUICK, or stage BUILD/VERIFY/SHIP) → 400.
   - Enable where dispatch fails (credential missing) → `autoMode` reverts to false, error propagated (FR-021).

### Phase C — Job-status hook (auto-chain driver)

1. Extend `app/api/jobs/[id]/status/route.ts` at the existing terminal-state branch (currently around lines 250-258 where push notification fires). Add a call to `handleJobCompletionAutoTransition({ jobId, terminalStatus })` wrapped in its own `try/catch` so a hook failure cannot fail the original status update (the job row is already persisted).
2. `handleJobCompletionAutoTransition` internals (in `app/lib/tickets/auto-mode.ts`):
   - Load `job.ticketId`, `job.command`, and the ticket's `stage`, `workflowType`, `autoMode`, `projectId`.
   - If `command` starts with `comment-`, return (comment jobs never drive the chain).
   - If `terminalStatus ∈ {FAILED, CANCELLED}` AND `autoMode === true` → `prisma.ticket.update({ data: { autoMode: false } })` and return (FR-018/019).
   - If `terminalStatus === 'COMPLETED'` AND `autoMode === true` AND `isAutoModeEligible(ticket)` AND current stage ∈ {SPECIFY, PLAN}:
     - Compute `nextStage` via `getNextStage(stage)` from `lib/stage-transitions.ts`.
     - Call `executeTicketTransition(projectId, ticketId, nextStage)` — reusing the **same path and authorization** as manual advance (FR-016).
     - If result is `{ ok: false, ... }`, set `autoMode=false` (FR-021) and log the error (do not throw — job status update already succeeded).
3. **Pattern reuse**: `executeTicketTransition` gives us optimistic concurrency, orphaned-job cleanup on P2025, and workflow dispatch. Do not duplicate that logic.
4. Tests in `tests/integration/jobs/auto-mode-hook.test.ts`:
   - SPECIFY COMPLETED + autoMode on → ticket PLAN + PLAN job created.
   - PLAN COMPLETED + autoMode on → ticket BUILD + BUILD job created.
   - SPECIFY FAILED + autoMode on → ticket stays SPECIFY + autoMode=false.
   - SPECIFY CANCELLED + autoMode on → autoMode=false.
   - SPECIFY COMPLETED + autoMode off → no transition.
   - COMPLETED on BUILD-stage ticket with autoMode on → no extra dispatch (BUILD → VERIFY is handled by existing speckit.yml path).
   - Dispatch error in transition → autoMode flipped to false, hook does not throw.

### Phase D — Rollback interaction

1. Extend `rollbackToPlanWithReset()` in `lib/tickets/transition.ts:69-79`: add `autoMode: false` to the update payload inside the existing transaction (FR-022).
2. Extend `tests/integration/tickets/transitions.test.ts`: given ticket in VERIFY with `autoMode=true`, execute rollback to PLAN → stage=PLAN + autoMode=false.
3. BUILD→PLAN rollback uses the same helper; setting autoMode=false there is a safe no-op since BUILD is not eligible for autoMode anyway.

### Phase E — Client UI

1. `components/board/auto-mode-icon.tsx`:
   - Props: `{ autoMode: boolean; onClick(e): void; disabled?: boolean }`.
   - Uses `FastForward` from lucide-react.
   - Off: `opacity-0 group-hover:opacity-100` — mirrors cancel-X at `components/board/ticket-card.tsx:266` (FR-005).
   - On: always visible, `ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]` — mirrors the custom-models halo at `ticket-card.tsx:182` (FR-006). This is explicitly allowed by CLAUDE.md's accent-class exception.
   - Tooltip via shadcn/ui `Tooltip`: "Enable auto-transition" off / "Auto-transition on — click to disable" on (FR-007).
2. `components/board/auto-mode-confirmation-modal.tsx`:
   - Radix AlertDialog, same shape as `components/board/cancel-confirmation-modal.tsx`.
   - Title: "Enable auto-transition?"; description renders `computeChainedStages(currentStage).join(' → ')` followed by " will run automatically." (FR-008).
   - Confirm/Cancel via `AlertDialogAction`/`AlertDialogCancel`. Cancel leaves state unchanged (FR-012).
3. Extend `components/board/ticket-card.tsx`:
   - Import `isAutoModeEligible`. If false, skip the icon (FR-003/004).
   - Add state `showAutoModeModal`. Click handler: if `ticket.autoMode === true`, call disable mutation immediately (FR-013); else open modal.
   - Place new icon in the left-side cluster next to the cancel-X so the hover group applies naturally (`group-hover:`).
4. `app/lib/hooks/mutations/useAutoMode.ts`:
   - TanStack mutation PATCHes `/api/projects/:projectId/tickets/:id/auto-mode`.
   - `onMutate`: optimistic update on ticket cache (constitution §"optimistic updates required").
   - `onError`: rollback optimistic cache.
   - `onSuccess`: invalidate `tickets` and `jobs` queries so a new PENDING job appears.
5. Component tests under `tests/unit/components/board/`.

## Testing Strategy

Constitution §III Test-Selection Decision Tree applied:

| Behavior | Test Type | Location | Rationale |
|----------|-----------|----------|-----------|
| `isAutoModeEligible`, `computeChainedStages` | Vitest unit | `tests/unit/auto-mode-eligibility.test.ts`, `tests/unit/auto-mode-stage-preview.test.ts` | Pure functions; no existing file covers autoMode logic. |
| Toggle endpoint behavior | Vitest integration | `tests/integration/tickets/auto-mode.test.ts` (new) | New API surface; mixing with `transitions.test.ts` would blur concerns. |
| Job-status hook behavior | Vitest integration | `tests/integration/jobs/auto-mode-hook.test.ts` (new) | Hook is unique to this feature; `transitions.test.ts` exercises forward drags, not post-job hooks. |
| VERIFY→PLAN rollback disengages autoMode | Vitest integration | `tests/integration/tickets/transitions.test.ts` (extend) | Existing file covers rollbacks — extend, don't duplicate. |
| Icon hover / accent / tooltip | Vitest RTL | `tests/unit/components/board/auto-mode-icon.test.tsx` (new) | New component; unit-level interaction (no API). |
| Modal stage preview text | Vitest RTL | `tests/unit/components/board/auto-mode-confirmation-modal.test.tsx` (new) | New component. |
| Full drag-free chain INBOX → BUILD (SC-001) | Playwright E2E | `tests/e2e/board/auto-mode.spec.ts` (new) | Touches full browser→API→workflow loop; one happy-path only per constitution "E2E is expensive". |

All integration tests hit a real PostgreSQL DB via `TEST_MODE=true` server and use `[e2e]` project/ticket prefixes per CLAUDE.md.

## Complexity Tracking

*No constitutional violations to justify.*
