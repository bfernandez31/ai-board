# Contract: Server-side auto-transition hook on PATCH /api/jobs/:id/status

This contract describes the **addition** to the existing `PATCH /api/jobs/[id]/status` route (`app/api/jobs/[id]/status/route.ts`). The existing request/response schema is unchanged; this hook runs as a post-update side effect for terminal-state transitions.

## Trigger

Immediately after a successful job status update **in the existing terminal-state branch** (where `isTerminalState === true` at `app/api/jobs/[id]/status/route.ts:183` and push notification is fired at lines 250-258). The hook runs after the push notification dispatch.

## Inputs (to the hook)

```ts
type AutoTransitionHookInput = {
  jobId: number;
  terminalStatus: 'COMPLETED' | 'FAILED' | 'CANCELLED';
};
```

## Pseudo-code

```ts
async function handleJobCompletionAutoTransition({ jobId, terminalStatus }: AutoTransitionHookInput) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      command: true,
      ticket: {
        select: { id: true, projectId: true, stage: true, workflowType: true, autoMode: true },
      },
    },
  });
  if (!job || !job.ticket) return;

  // Comment-* jobs never drive the stage chain
  if (job.command.startsWith('comment-')) return;

  const ticket = job.ticket;

  // FR-018/019: Turn autoMode off on any failure, regardless of eligibility
  if (terminalStatus === 'FAILED' || terminalStatus === 'CANCELLED') {
    if (ticket.autoMode) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { autoMode: false } });
    }
    return;
  }

  // terminalStatus === 'COMPLETED' from here on

  if (!ticket.autoMode) return;                               // FR-016 guard
  if (!isAutoModeEligible(ticket)) return;                    // FR-001/003/004 guard
  if (ticket.stage !== 'SPECIFY' && ticket.stage !== 'PLAN') return; // only these two drive chain

  const nextStage = getNextStage(ticket.stage); // SPECIFY→PLAN, PLAN→BUILD

  const result = await executeTicketTransition(ticket.projectId, String(ticket.id), nextStage);

  if (!result.ok) {
    // FR-021: Dispatch failed during auto-chain → disengage
    await prisma.ticket.update({ where: { id: ticket.id }, data: { autoMode: false } });
    console.error('[AutoMode] Dispatch failed during auto-chain; disengaged.', {
      ticketId: ticket.id, status: result.status, body: result.body,
    });
  }
}
```

## Integration point

In `app/api/jobs/[id]/status/route.ts`, after the existing `sendJobCompletionNotification(...)` call (around line 252-257), add:

```ts
if (isTerminalState) {
  sendJobCompletionNotification(jobId, requestedStatus as 'COMPLETED'|'FAILED'|'CANCELLED')
    .catch((err) => console.error('[Job Status Update] Push notification error:', err));

  // NEW — AIB-682 auto-mode chain
  handleJobCompletionAutoTransition({ jobId, terminalStatus: requestedStatus as 'COMPLETED'|'FAILED'|'CANCELLED' })
    .catch((err) => console.error('[Job Status Update] Auto-mode hook error:', err));
}
```

## Ordering & failure isolation

- The hook is **fire-and-log** (never awaited in a way that can fail the outer PATCH).
- If the hook throws, the outer 200 response still returns — the job row is already persisted and cannot be unrolled.
- The hook MUST only mutate `Ticket.autoMode` and delegate all stage advancement to `executeTicketTransition` — which owns its own optimistic-concurrency, orphaned-job cleanup, and GitHub dispatch.

## Non-effects (explicit)

- The hook does NOT touch running jobs on unrelated tickets.
- The hook does NOT fire on non-terminal transitions (e.g., PENDING → RUNNING).
- The hook does NOT change `Ticket.stage` directly — only via `executeTicketTransition`.
- The hook does NOT fire for `comment-*`, `deploy-preview`, or `rollback-reset` completions, because those do not drive forward stage chaining.

## Observability

All hook branches log with the `[AutoMode]` prefix so production issues are traceable:
- Disengaged on failure
- Advanced to next stage
- Dispatch failed → disengaged

No new metrics or dashboards introduced in this ticket.
