# Job Log Retention Pruning

1. Each retained artifact gets `retainedUntil` set to at least 30 days after capture or completion.
2. `lib/job-logs/storage.ts` exposes `pruneExpiredJobExecutionLogs()` for scheduled retention cleanup.
3. Pruning converts `AVAILABLE` or `PARTIAL` rows to `PRUNED` by removing:
   - `artifactBytes`
   - `artifactEncoding`
   - `artifactSha256`
   - `artifactSizeBytes`
4. The cleanup preserves:
   - `summaryJson`
   - `capturedAt`
   - `retainedUntil`
   - `prunedAt`
   - human-readable audit reasons
5. Read routes continue returning the summary after pruning, with `events: null` so the UI can distinguish retention cleanup from capture failure.

Operational guidance:
- Retention cleanup is safe to retry because the `PRUNED` state is terminal.
- The ticket clone path does not copy `JobExecutionLog` rows, so retained artifacts keep provenance on the original ticket only.
