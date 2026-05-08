# Contract: PATCH /api/jobs/:id/status (extension)

## Summary

The existing `PATCH /api/jobs/:id/status` endpoint (`app/api/jobs/[id]/status/route.ts`) is extended to accept two new optional fields, `pluginVersion` and `agentCliVersion`. They are persisted only on the `RUNNING` transition, first-write-wins. No new endpoint is introduced.

## Endpoint

| Method | Path | Auth |
|--------|------|------|
| `PATCH` | `/api/jobs/:id/status` | Workflow Bearer token (`Authorization: Bearer ${WORKFLOW_API_TOKEN}`) — unchanged |

## Request body — extended schema

```ts
// app/lib/job-update-validator.ts (Zod)
export const jobStatusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  qualityScore: z.number().int().min(0).max(100).optional(),
  qualityScoreDetails: z.string().optional(),
  workflowRunId: z.number().int().positive().optional(),
  // ↓ new
  pluginVersion: z.string().min(1).max(40).optional(),
  agentCliVersion: z.string().min(1).max(40).optional(),
});
```

### Field semantics

| Field | When sent | When persisted | Notes |
|-------|-----------|----------------|-------|
| `pluginVersion` | RUNNING transition only (workflow attaches when capture succeeded) | When `status === 'RUNNING'` AND existing column is `null` | Length 1–40 ASCII chars; mirrors first-write-wins semantics of `workflowRunId` |
| `agentCliVersion` | RUNNING transition only | Same | First trimmed line of agent's `--version` output |

If the workflow's capture failed, the field is OMITTED from the body (not sent as empty string). Zod `.optional()` then treats it as not provided.

If the workflow's capture failed for ONLY ONE of the two values, only the successful one is sent. The other column stays `null`.

### Field is ignored if sent on non-RUNNING transition

Sending `pluginVersion` or `agentCliVersion` with `status: 'COMPLETED' | 'FAILED' | 'CANCELLED'` is permitted by the schema (so a single Zod schema serves all transitions) but the route handler MUST silently ignore both fields on non-RUNNING transitions. This mirrors how `workflowRunId` is gated to RUNNING-only at line 204 of the existing handler.

## Request examples

### Successful capture (both values)

```http
PATCH /api/jobs/12345/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "RUNNING",
  "workflowRunId": 9876543210,
  "pluginVersion": "1.0.1",
  "agentCliVersion": "1.0.92 (Claude Code)"
}
```

### Plugin captured, agent CLI capture failed

```http
PATCH /api/jobs/12345/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "RUNNING",
  "workflowRunId": 9876543210,
  "pluginVersion": "1.0.1"
}
```

### Both captures failed

```http
PATCH /api/jobs/12345/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "RUNNING",
  "workflowRunId": 9876543210
}
```

(Identical to today's request shape — backward-compatible.)

## Response

Unchanged from existing contract:

```json
{
  "id": 12345,
  "status": "RUNNING",
  "completedAt": null
}
```

## Error responses

| Code | Trigger | Body |
|------|---------|------|
| 400 | `pluginVersion` or `agentCliVersion` length > 40 | `{ "error": "Invalid request", "details": [...zodErrors] }` |
| 400 | Either field is empty string (rejected by `.min(1)`) | Same |
| 400 | Either field is not a string | Same |
| 401 | Missing/invalid workflow token | `{ "error": "Unauthorized" }` |
| 404 | Job not found | `{ "error": "Job not found" }` |
| 409 | Job already CANCELLED, RUNNING attempted | `{ "error": "Job already cancelled", "status": "CANCELLED" }` (existing behavior) |

All other failure modes (state-machine violations, internal errors) match the current contract verbatim.

## Persistence semantics

Inside `PATCH` handler (`route.ts`):

1. Extend the `findUnique` `select` (currently lines 117-123) with `pluginVersion: true, agentCliVersion: true` so the first-write-wins guard can compare.
2. After existing `workflowRunId` block (line 204), add:
   ```ts
   if (requestedStatus === 'RUNNING'
       && validationResult.data.pluginVersion
       && !job.pluginVersion) {
     updateData.pluginVersion = validationResult.data.pluginVersion;
   }
   if (requestedStatus === 'RUNNING'
       && validationResult.data.agentCliVersion
       && !job.agentCliVersion) {
     updateData.agentCliVersion = validationResult.data.agentCliVersion;
   }
   ```
3. The new fields enter the same atomic `prisma.job.updateMany({ where: { id, status: currentStatus }, data: updateData })` call (existing line 223).
4. `updateData` type literal at line 188-197 gains:
   ```ts
   pluginVersion?: string;
   agentCliVersion?: string;
   ```

No other branch of the handler is touched.

## Idempotency

- Retried RUNNING PATCH with same body → no-op on the version columns (first-write-wins guard).
- Retried RUNNING PATCH with different version values → no-op (first values win); diff is logged via existing `console.log('[Job Status Update] Success:'...)` so operators can see the discarded value.
- Jobs whose RUNNING transition already happened before this feature shipped → version columns stay `null`. Spec FR-005 forbids backfill.

## Telemetry / observability

- The existing `console.log('[Job Status Update] Success:', { transition, ... })` at line 266-271 is extended to include the two version values when present, so operators can confirm capture happened. No new logging system is introduced.

## Backward compatibility

- Workflow-token clients that do NOT send the new fields continue to work unchanged (Zod `.optional()`).
- Old jobs in the database stay readable — both columns are nullable and the GET endpoint surfaces `null` directly.
- No coordination with workflow rollouts is required: the API can be deployed first (extra fields ignored when not provided) or the workflows first (extra fields rejected → resilient because we use `2>/dev/null || true` and never block on the curl exit code in the existing pattern at speckit.yml:228).

## Test coverage

Two new test cases in `tests/integration/jobs/status.test.ts`:

1. **Persistence on RUNNING**: send `{status:'RUNNING', pluginVersion:'1.0.1', agentCliVersion:'1.0.92'}` → 200, verify both columns populated via `prisma.job.findUnique`.
2. **Length validation**: send `agentCliVersion` with 41 characters → 400.
3. (Optional) **First-write-wins**: PATCH RUNNING with values → PATCH RUNNING again with different values (same status, idempotent path triggers) → DB still contains the first values.

One new assertion in `tests/integration/jobs/ticket-jobs.test.ts`:

- Existing "should return jobs with telemetry fields" test extended to update the job with `pluginVersion`/`agentCliVersion` and assert they appear in the response payload.
