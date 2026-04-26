# Process: OutcomeCaptureOnShip

**Feature**: AIB-742
**Spec source**: spec.md §"Internal Processes" → OutcomeCaptureOnShip
**Trigger**: Ticket transition into stage `SHIP` (both FULL and QUICK workflows).

## Trigger surface

In-process call from `lib/tickets/transition.ts`, fired AFTER the optimistic ticket update on the SHIP path commits successfully.

**Insertion point** — between lines 352 and 354 of `lib/tickets/transition.ts` (i.e., after `prisma.ticket.update({ ..., data: { stage: targetStage, ... } })` returns, before `return { ok: true, ... }`):

```ts
// Pseudocode — actual call is fire-and-forget; never awaited
if (targetStage === Stage.SHIP) {
  void captureOutcomeOnShip({
    ticketId: updatedTicket.id,
    projectId: updatedTicket.projectId,
    workflowType: updatedTicket.workflowType,
    shippedAt: updatedTicket.updatedAt,
  }).catch((err) => {
    // The catch is the safety net. captureOutcomeOnShip already handles
    // its own retries and persists a partial row on terminal failure.
    // This log path is only hit on truly unexpected errors (e.g., process
    // termination during await). The unique constraint protects future
    // retries from creating duplicates.
    console.error('[outcome-capture] unhandled', { ticketId: updatedTicket.id, err });
  });
}
```

**Why fire-and-forget**: Per FR-002, capture must NOT block SHIP. The caller's response payload is unchanged. If the Vercel function ends before capture completes, the outcome simply doesn't get written for this transition — there is no row, so no rollback is needed; an operator can run the per-project backfill to populate it (idempotent, FR-014).

## Inputs

| Input | Source | Notes |
|---|---|---|
| `ticketId` | The just-updated `Ticket.id` | Required |
| `projectId` | `Ticket.projectId` | Denormalised onto `TicketOutcome` |
| `workflowType` | `Ticket.workflowType` snapshot at SHIP time | FULL / QUICK / CLEAN |
| `shippedAt` | `Ticket.updatedAt` after the SHIP update committed | Recorded as canonical SHIP moment |

The capture function then reads the rest from the database:
- All Jobs of the ticket (telemetry + commit refs + qualityScore)
- The Project's `config` JSON (stack metadata for semantic tagging)

## Phases

### Phase 1: Idempotency check
1. `prisma.ticketOutcome.findUnique({ where: { ticketId } })`. If a row exists → return early (FR-021, immutability).

### Phase 2: Aggregate job telemetry
1. `prisma.job.findMany({ where: { ticketId } })`.
2. If `jobs.length === 0`: persist a `partial = true` row with `partialReason = 'no_jobs'` and exit. Job-aggregate fields are zero (per spec edge case).
3. Compute sums for: `costUsd`, `durationMs`, all token columns. Each sum is `null` only if every contributing value is null.
4. Compute `toolsUsed` as the union (Set) across all jobs.

### Phase 3: Classify jobs
1. For each job, classify by `command`:
   - Starts with `iterate` OR starts with `comment-` → friction
   - Otherwise → pipeline
2. Increment per-prefix counters; build `jobCountByPrefix` map.
3. `pipelineJobCount + frictionJobCount = totalJobCount` invariant.

### Phase 4: Resolve quality score
1. `prisma.job.findFirst({ where: { ticketId, command: 'verify', status: 'COMPLETED', qualityScore: { not: null } }, orderBy: { completedAt: 'desc' } })`.
2. Use `qualityScore` from that row, or `null` if no such row exists (covers QUICK tickets and verify-without-score cases per spec edge case).

### Phase 5: Resolve commit references and fetch files
1. Collect unique `commitSha` values from jobs (filter null and empty strings).
2. If empty: skip to Phase 8 with `partial = true`, `partialReason = 'no_commit_reference'`.
3. Ensure project config is fresh: `await ensureFreshConfig(project)` (existing `lib/config-sync.ts:193-204`).
4. For each unique commit SHA: `await octokit.repos.getCommit({ owner, repo, ref: sha })`. Each response yields `commit.files[]` with `{ filename, additions, deletions, status }`.
5. Aggregate across commits: union of `filename` set; sum of `additions` and `deletions` per filename (a file modified across multiple commits accumulates).

**Retry strategy**:
- Per-commit fetch retries: up to 3 attempts with backoff `[1s, 4s, 16s]` on transient errors (network, 5xx, secondary rate limit).
- Hard 404 on a SHA → record but proceed (use whatever other commits succeeded).
- All commits failed after retries → `partial = true`, `partialReason = 'fetch_failed_after_retry'`.
- Repository unreachable (404 on repo, deleted repo, suspended access) → `partial = true`, `partialReason = 'repository_unreachable'`.

### Phase 6: Compute change-shape
1. `linesAdded` = sum of `additions` across the deduped file set.
2. `linesRemoved` = sum of `deletions`.
3. `filesTouched` = sorted list of unique filenames.
4. Identify "test paths" by intersecting `filesTouched` with the testing patterns from `STACK_INDICATORS` for this project's `testing.framework` and `language` (see data-model.md §STACK_INDICATORS).
5. `linesInTestPaths` = sum of `additions + deletions` for files in the test-path intersection.
6. `testCodeRatio = linesInTestPaths / max(linesAdded + linesRemoved, 1)` (matches spec.md decision §"Test-vs-code ratio").

### Phase 7: Compute structural domains and frequency map
1. For each filename, extract the top-level path segment (split by `/`, take `[0]`). Files at root have segment `""` — preserve as-is per spec edge case.
2. `domains` = unique set, sorted.
3. `domainFileCounts` = map from segment → count.

### Phase 8: Derive semantic tags
1. Apply `deriveSemanticTags(filesTouched, projectConfig)` from `lib/outcomes/stack-indicator-lookup.ts`.
2. Yields three booleans: `touchedDbSchema`, `touchedTests`, `touchedCi`.
3. Missing stack coverage falls through to `false` (FR-009).

### Phase 9: Compute frictionFree
1. `frictionFree = frictionJobCount === 0 && qualityScore !== null && qualityScore >= QUALITY_THRESHOLD_FRICTION_FREE` (= 75 per spec).
2. QUICK tickets (qualityScore null) always get `false`.
3. The threshold and rule are pinned to `RULE_SET_VERSION = 1`.

### Phase 10: Persist
1. Build the full DerivedOutcome object.
2. `prisma.ticketOutcome.create({ data: { ...derived, ruleSetVersion: RULE_SET_VERSION } })` wrapped in try/catch.
3. On `e.code === 'P2002'` (uniqueness violation — concurrent capture or backfill won the race): treat as success and return.
4. On any other Prisma error: log with context. The capture orchestrator returns failure to its caller (which is `.catch`-ed at the call site), and there is no row written. A subsequent backfill will pick it up.

## Output

Exactly one immutable `TicketOutcome` row, queryable via `GET /api/projects/[projectId]/tickets/[ticketId]/outcome` within minutes of SHIP (SC-001).

## Error behaviour

| Scenario | Behaviour |
|---|---|
| Outcome already exists for this ticket | Phase 1 returns early; no write attempted; no error surfaced |
| All commits unreachable after retries | Persist `partial = true`, `partialReason = 'fetch_failed_after_retry'`. All other fields filled in from job aggregation |
| Project repo deleted/suspended | Persist `partial = true`, `partialReason = 'repository_unreachable'` |
| Ticket has no jobs at all | Persist `partial = true`, `partialReason = 'no_jobs'`, all aggregates zero/null |
| No commit refs on any job | Persist `partial = true`, `partialReason = 'no_commit_reference'` |
| Database unreachable during create | No row written; orchestrator's call site logs and moves on. Future backfill will repair the gap |
| Race with backfill (P2002) | Silent skip; the other writer's row is the canonical one |

## Observability

- Each phase logs to `console` with `{ ticketId, phase, durationMs }` (existing console-logging convention; structured-logging adoption is out of scope).
- A successful capture logs `[outcome-capture] success` with `{ ticketId, partial, partialReason, durationMs }`.
- Failures log `[outcome-capture] failed` with the error and which phase it failed in.
- SC-001 / SC-007 measurement: capture's elapsed time can be derived from `capturedAt - shippedAt`.

## Tests this satisfies

- US1 acceptance scenarios 1–5 (live capture path, immutability, partial paths)
- US3 acceptance scenario 5 (live capture continues during concurrent backfill — both write attempts go through the unique-constraint guard)
- US2 acceptance scenarios 1–4 (semantic tagging across stacks — driven by Phase 8 + STACK_INDICATORS)
- Edge cases: zero jobs, no commit refs, repo unreachable, only-non-source-files, missing stack declarations, race conditions
