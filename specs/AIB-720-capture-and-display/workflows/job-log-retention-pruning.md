# Job Log Retention and Pruning

## Purpose

Guarantee at least 30 days of access to retained detailed job logs, then reduce storage usage without losing the audit trail that logs once existed.

## Inputs

| Input | Source |
|-------|--------|
| `retainedUntil` | Stored on `JobExecutionLog` at capture time |
| `availability` | Stored artifact state |
| `artifactBytes` | Stored compressed event payload |

## Selection Rules

Prune only rows where:

1. `availability` is `AVAILABLE` or `PARTIAL`
2. `artifactBytes` is not null
3. `retainedUntil < now()`
4. `prunedAt` is null

## Pruning Steps

1. Find eligible rows in batches.
2. Clear `artifactBytes`, `artifactEncoding`, `artifactSizeBytes`, and any checksum fields tied only to detailed payload retention.
3. Set:
   - `availability = PRUNED`
   - `prunedAt = now()`
4. Preserve:
   - `summaryJson`
   - `capturedAt`
   - `retainedUntil`
   - `eventCount`
   - project/job/ticket foreign-key context

## Output

- Reduced storage footprint
- Summary/audit state still available to UI
- Clear distinction between pruned logs and failed capture

## Execution Model

- Implement in application code, following the same cleanup-job pattern documented in `app/lib/db/notifications.ts`.
- Scheduling mechanism can be wired later to the platform's cleanup runner or scheduled workflow; the pruning contract is independent of the scheduler choice.

## Error Behavior

| Failure | Behavior |
|---------|----------|
| Batch prune fails | Leave artifacts untouched; retry later |
| One row fails in a batch | Log context and continue with other rows when safe |
| Already pruned row selected concurrently | Treat as idempotent no-op |
