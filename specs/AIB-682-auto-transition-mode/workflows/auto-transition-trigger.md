# Internal Process: Auto-transition trigger on job completion

## Purpose

Drive the "fire-and-forget" chain for a ticket with `autoMode=true`: advance SPECIFY → PLAN → BUILD automatically as each workflow job succeeds, disengage on failure, and never loop.

This is **not** a GitHub Actions workflow — it is an in-process server hook that runs inside the AI-board Next.js API route `PATCH /api/jobs/[id]/status`. The hook itself does not ship its own workflow YAML; it delegates to the existing `speckit.yml` (via `executeTicketTransition` → `handleTicketTransition`) for each stage it advances.

## Inputs

| Field | Source | Notes |
|---|---|---|
| `jobId` | URL param of status PATCH | |
| `terminalStatus` | Request body (`status`) | One of COMPLETED, FAILED, CANCELLED |
| `ticket.stage`, `ticket.workflowType`, `ticket.autoMode`, `ticket.projectId` | Prisma lookup on `job.ticketId` | Re-read inside the hook (do not trust stale snapshots) |
| `job.command` | Prisma lookup | Used to filter out `comment-*` jobs |

## Functional Phases

### Phase 1 — Ineligibility short-circuits

- If `job.command` starts with `comment-` → return (comment jobs do not drive chains).
- If `ticket` was not found → return silently (hook must never fail the outer PATCH).

### Phase 2 — Failure branch (FR-018/019/020)

- If `terminalStatus ∈ {FAILED, CANCELLED}` AND `ticket.autoMode === true`:
  - `prisma.ticket.update({ where: { id }, data: { autoMode: false } })`.
  - Log `[AutoMode] Disengaged on failure`.
  - Return. No dispatch.

### Phase 3 — Success-ineligible branch

- If `terminalStatus === 'COMPLETED'` AND (`ticket.autoMode !== true` OR ticket not `FULL` OR stage not in {SPECIFY, PLAN}):
  - Return. This covers:
    - autoMode is off → no chain.
    - Ticket is QUICK → never eligible for chaining (BUILD→VERIFY is handled by existing speckit.yml path).
    - Ticket is in BUILD → existing post-BUILD verify transition handled by `speckit.yml:719-748`, not by this hook.

### Phase 4 — Success-eligible branch (FR-016)

- Compute `nextStage = getNextStage(ticket.stage)` using `lib/stage-transitions.ts`.
- Call `executeTicketTransition(ticket.projectId, String(ticket.id), nextStage)`.
- This is the **same function** the `/transition` API route uses, so authorization, optimistic concurrency, orphaned-job cleanup, and GitHub workflow dispatch all behave identically to a manual drag.

### Phase 5 — Dispatch-failure branch (FR-021)

- If the call in Phase 4 returns `{ ok: false, ... }`:
  - `prisma.ticket.update({ where: { id }, data: { autoMode: false } })`.
  - Log `[AutoMode] Dispatch failed; disengaged` with the upstream status and body.
  - Return. No retry.

## Outputs

- On success: `Ticket.stage` advanced, new Job row created (via `handleTicketTransition` inside `executeTicketTransition`), GitHub workflow dispatched.
- On failure branch: `Ticket.autoMode` set to `false`.
- On ineligible: no state change.

## Callback / reporting contract

No direct callback. The hook writes to:

1. **Database** — `Ticket.autoMode`, `Ticket.stage`, `Job` table (indirectly).
2. **Server logs** — `[AutoMode]` prefix; no structured events required by this ticket.
3. **Push notifications** — reused via the existing `sendJobCompletionNotification` call in the same status PATCH (not duplicated by the hook).

Failure is communicated to the user through the existing job-failure notification path (per spec §Auto-Resolved decision 2).

## Error behavior

Errors inside the hook MUST be caught and logged; they MUST NOT propagate to the outer `PATCH /api/jobs/:id/status` response. The job row is already persisted and cannot be rolled back retroactively — failing the outer response would lie about the job state.

Specifically:
- Prisma errors during the ticket lookup → caught, logged, return.
- `executeTicketTransition` returning `{ ok: false }` → handled in Phase 5 (explicit disengage).
- `executeTicketTransition` throwing → caught by the outer `.catch(console.error)` around the hook invocation in the status route.

## Invariants

- The hook never advances a ticket past BUILD (BUILD → VERIFY is out of scope; handled by `speckit.yml:719-748`).
- The hook never mutates `autoMode` to `true` — only to `false`. Activation is exclusively through the `/auto-mode` endpoint.
- The hook runs at most one dispatch per invocation, so a single successful COMPLETED cannot chain two stages in the same request.
