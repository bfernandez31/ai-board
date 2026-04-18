# Data Model: Auto-transition mode (AIB-682)

## Entities

### Ticket.autoMode (existing column — no migration)

Source: `prisma/schema.prisma:141`

| Attribute | Value |
|---|---|
| Column | `autoMode` |
| Type | `Boolean` |
| Nullable | No |
| Default | `false` |
| Scope | Per-ticket |
| Persisted in | `0_init` migration (already applied) |

**Semantics**:
- `false` (default) — stage transitions require explicit user action (drag, button, or API call).
- `true` — when an eligible workflow job on this ticket completes successfully and the ticket is in `SPECIFY` or `PLAN`, the system automatically advances the ticket to the next stage and dispatches the corresponding job.

**Invariants** (enforced in application code — no new DB constraints):

1. **Eligibility** — `autoMode` MAY be set to `true` only when the ticket satisfies all of:
   - `workflowType === 'FULL'`
   - `stage ∈ {INBOX, SPECIFY, PLAN}`

   The toggle endpoint MUST reject requests that would set `true` on an ineligible ticket (400). The field MAY remain `true` if a prior transition has moved the ticket beyond eligibility — in practice this only happens transiently, because the job-completion hook either advances the ticket again (stage still eligible) or leaves the field alone (stage no longer eligible; hook treats it as a no-op per FR-016).

2. **Self-disengage on failure** — If a workflow job on a ticket with `autoMode=true` reaches terminal status `FAILED` or `CANCELLED`, `autoMode` MUST be set to `false` in the same server-side hook (FR-018).

3. **Self-disengage on VERIFY→PLAN rollback** — When a ticket is rolled back from VERIFY to PLAN, `autoMode` MUST be set to `false` inside the same rollback transaction (FR-022).

4. **Self-disengage on dispatch failure** — When enabling `autoMode` triggers an immediate dispatch (FR-010) and that dispatch fails, `autoMode` MUST be reverted to `false` (FR-021).

5. **No implicit carryover** — Setting `autoMode=true` on ticket A MUST NOT affect ticket B, even within the same project (FR-024).

6. **No per-user scope** — `autoMode` is a property of the Ticket row; all users viewing the ticket see the same value (FR-025).

**State transitions** (Boolean, but with transition triggers documented for clarity):

```
           ┌──────────── user clicks icon + confirms modal ────────────┐
           │                                                           v
false ────┤                                                         true
           │                                                           │
           │                                                           ├── user clicks icon (no modal) ──────> false
           │                                                           ├── job reaches FAILED / CANCELLED ──> false
           │                                                           ├── dispatch fails (FR-021)  ────────> false
           │                                                           └── VERIFY → PLAN rollback ─────────> false
           └───────────────────────────────────────────────────────────┘

                 (every transition is persisted via prisma.ticket.update)
```

### Job (existing model — no change)

Source: `prisma/schema.prisma` (Job model, lines 29-68)

This feature **reads** `Job.status`, `Job.ticketId`, `Job.command` in the status-PATCH hook. It does not mutate Job rows directly (transitions are created via the existing `handleTicketTransition` flow which already owns Job creation/deletion).

`Job.command` values relevant to the hook:
- `specify`, `plan`, `implement` — drive the chain (COMPLETED → next stage)
- `verify`, `deploy-preview`, `rollback-reset` — ignored by the hook
- `comment-*` — explicitly filtered out by the hook (they do not drive stages)
- `quick-impl` — unreachable because QUICK tickets are never eligible for autoMode (FR-003)

## Relationships

No new relationships. The new flag is a single Boolean column on an existing entity.

## Validation Rules (Zod)

| Entity | Schema | Where |
|---|---|---|
| Toggle request | `z.object({ enabled: z.boolean() })` | `app/api/projects/[projectId]/tickets/[id]/auto-mode/route.ts` |

The auto-mode flag itself has no further validation beyond the Boolean type enforced by Prisma.
