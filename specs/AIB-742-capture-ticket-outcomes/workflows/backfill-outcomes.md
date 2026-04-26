# Process: HistoricalOutcomeBackfill

**Feature**: AIB-742
**Spec source**: spec.md §"Internal Processes" → HistoricalOutcomeBackfill
**Trigger**: Manual via `POST /api/projects/[projectId]/backfill-outcomes` (project owner only) which dispatches `.github/workflows/backfill-outcomes.yml`.

## Workflow definition (high-level)

File: `.github/workflows/backfill-outcomes.yml`

```yaml
name: Backfill Ticket Outcomes
on:
  workflow_dispatch:
    inputs:
      project_id:
        description: 'Project ID to backfill'
        required: true
        type: string
      resume_cursor:
        description: 'Resume from this Ticket.id (lower bound, exclusive)'
        required: false
        type: string

jobs:
  backfill:
    runs-on: ubuntu-latest
    timeout-minutes: 360   # 6 hours — generous for very large projects
    env:
      APP_URL: ${{ vars.APP_URL }}
      WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      GITHUB_TOKEN: ${{ secrets.GH_PAT }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.3.1
      - run: bun install --frozen-lockfile
      - run: bunx prisma generate
      - run: bun run scripts/backfill-outcomes.ts \
          --project-id ${{ github.event.inputs.project_id }} \
          --resume-cursor "${{ github.event.inputs.resume_cursor }}"
```

The actual backfill loop lives in `scripts/backfill-outcomes.ts` (a new file in the same `scripts/` directory that already hosts `pull-prod-project.ts`). The script imports the same `lib/outcomes/capture.ts` module the live path uses — single derivation logic, two trigger paths.

## Inputs

| Input | Source | Notes |
|---|---|---|
| `project_id` | Workflow input from API trigger | Required |
| `resume_cursor` | Workflow input — `BackfillProgress.lastProcessedTicketId` from API at dispatch time | Optional. Empty = start from newest |

Environment requirements:
- `DATABASE_URL` — direct Postgres access for both reads (ticket enumeration) and writes (outcome rows + progress updates).
- `GITHUB_TOKEN` — Octokit auth for `repos.getCommit` on the project's external repo. Reuses the existing `GH_PAT` secret (FR-016: no new secrets).
- `APP_URL`, `WORKFLOW_API_TOKEN` — only needed if implementation chooses the API-callback variant of writes (see contracts/backfill-api.md §3).

## Phases (script logic)

### Phase 1: Bootstrap
1. Connect to DB. Load the Project record + parsed config.
2. If `Project.config` is stale, refresh via `ensureFreshConfig(project)` once (single GitHub round-trip).
3. Read or initialise `BackfillProgress` for the project. If `status === COMPLETED`, log and exit cleanly (idempotent; no work to do). If `IN_PROGRESS`, continue (we're either resuming after a crash or this is a fresh run after the API endpoint set up the row).

### Phase 2: Enumerate target tickets
1. Query (newest-first per spec assumption):
   ```sql
   SELECT t.id FROM "Ticket" t
   WHERE t."projectId" = $1
     AND t.stage = 'SHIP'
     AND NOT EXISTS (SELECT 1 FROM "TicketOutcome" o WHERE o."ticketId" = t.id)
     AND ($2::int IS NULL OR t.id < $2)
   ORDER BY t.id DESC
   ```
   (`$2` = resume cursor.) Paginate in chunks of 100.
2. For each chunk, iterate sequentially (NOT in parallel) — sequential processing is needed for the rate-limit detect-and-yield logic (Phase 5).

### Phase 3: Per-ticket capture (reuses live path)
For each ticket id:
1. Call `captureOutcomeOnShip({ ticketId, projectId, workflowType, shippedAt })` from `lib/outcomes/capture.ts`. Same derivation as live path. Same idempotency guard (P2002 → no-op).
2. If the call wrote a `partial = true` row, increment `BackfillProgress.ticketsWithPartial`.
3. Increment `BackfillProgress.ticketsProcessed`.
4. Update `BackfillProgress.lastProcessedTicketId = ticketId` and `version++`. This update uses `updateMany({ where: { projectId, version: prevVersion }, data: { lastProcessedTicketId, ticketsProcessed, version: { increment: 1 } } })`. On `count === 0` (concurrent run), re-read the row and skip the rest of this run cleanly (another worker is doing it).

### Phase 4: Rate-limit detection and yield
1. After each Octokit call (inside `lib/outcomes/github-files.ts`), inspect the response for `x-ratelimit-remaining` and `x-ratelimit-reset` headers (Octokit exposes these via its REST plugin).
2. If `remaining < 100`, `await sleep(reset_at - now())` before the next call.
3. On a 403 with body matching `rate limit` or `secondary rate limit`, sleep for the documented retry-after window (Octokit's auto-throttle plugin handles this; if not enabled, fall back to `sleep(60s)` then retry).

### Phase 5: Termination
1. When the enumeration query returns 0 tickets, mark `BackfillProgress.status = COMPLETED`, set `completedAt = now()`, clear `lastError`.
2. Exit 0.

### Phase 6: Failure
1. On unhandled error: mark `BackfillProgress.status = FAILED`, set `lastError`, increment `version`. Exit non-zero.
2. Operator can re-dispatch the workflow; Phase 1 picks up `IN_PROGRESS`/`FAILED` and resumes.

## Output

- One `TicketOutcome` row per previously-shipped ticket of the project (some marked `partial`).
- `BackfillProgress.status = COMPLETED` with summary counters.
- Workflow run log shows per-ticket processing with timestamps.

## Error behaviour

| Scenario | Behaviour |
|---|---|
| Workflow runner times out (6h) | Whatever progress was committed remains. Re-dispatch resumes from `lastProcessedTicketId` |
| Database connection drops mid-loop | Script exits non-zero; partial progress committed; re-dispatch resumes |
| One ticket's commit unreachable | Per-ticket Phase 5 of capture-on-ship.md persists `partial = true`; backfill continues to the next ticket |
| Rate-limit hit | Phase 4 yields and resumes when window resets |
| Two concurrent dispatches | Phase 3.4 optimistic-lock collision causes the loser to exit cleanly (one row updated by the other process). The unique constraint on `TicketOutcome.ticketId` prevents duplicate writes if both happened to pick the same ticket simultaneously |
| Re-dispatch on a `COMPLETED` project | Phase 1 short-circuits; exits 0 with a "nothing to do" log line (SC-005) |

## Concurrency safety

- `BackfillProgress.version` is incremented on every cursor advance via `updateMany` — same optimistic-lock pattern as `lib/config-sync.ts:151-179`.
- `TicketOutcome` writes are idempotent (`@@unique(ticketId)` + P2002 catch).
- Live capture and backfill writing the same ticket: at most one row lands; the other gets P2002 and silently skips. SC-009 satisfied.

## Performance budget

- Per-ticket processing: ~1–3 commit fetches × ~300ms each + DB writes ≈ 1–3 seconds.
- 1000-ticket project: ~30–60 minutes wall clock (well under the 6h workflow timeout).
- GitHub API budget: ≤ 5000 requests/hour per token. With ~3 calls per ticket and rate-limit yielding at 100 remaining, even a 5000-ticket project stays in budget if the workflow runs through one rate-limit window (3600s wait). For very large projects, multiple workflow runs (resumable) keep total wall time bounded.

## Tests this satisfies

- US3 acceptance scenarios 1–6 (idempotency, resume, rate-limit handling, partial rows, concurrent live capture)
- SC-002 (every historical shipped ticket gets a row, ≤5% partial)
- SC-004 (no rate-limit-error rows in the run log on a typical project)
- SC-005 (re-running on a fully populated project is a no-op)

## Open implementation choices (Phase 2 to resolve)

- **DB access from runner vs. internal API callback**: see contracts/backfill-api.md §3. Either choice produces the same observable behaviour; pick whichever the existing infrastructure supports more cleanly.
- **Octokit throttle plugin**: opt-in to `@octokit/plugin-throttling` for automatic secondary-rate-limit handling, OR roll a minimal sleep-on-403 in `lib/outcomes/github-files.ts`. Decide based on whether the plugin is already in the dep tree.
