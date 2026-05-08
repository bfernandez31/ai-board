# GET /api/projects/:projectId/tickets/:id/jobs — Extension Contract

This feature does **not** introduce a new GET endpoint. It extends the existing
ticket-jobs GET payload with two additional optional fields so the React tree
can render them without a second round-trip.

## Endpoint

`GET /api/projects/:projectId/tickets/:id/jobs`

(Implemented at `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` —
authentication unchanged, see `verifyTicketAccess`.)

## Response shape (extension only)

Each element of the returned array gains two fields. Every other field is
preserved exactly.

```json
[
  {
    "id": 12345,
    "command": "verify",
    "status": "COMPLETED",
    "branch": "AIB-775-tracer-et-afficher",
    "startedAt": "2026-05-08T10:32:11.000Z",
    "completedAt": "2026-05-08T10:34:55.000Z",
    "inputTokens": 12000,
    "outputTokens": 4500,
    "cacheReadTokens": 9000,
    "cacheCreationTokens": 1200,
    "costUsd": 0.187,
    "durationMs": 164000,
    "model": "claude-opus-4-7",
    "toolsUsed": ["Read", "Edit", "Bash"],
    "qualityScore": 88,
    "qualityScoreDetails": "...",
    "peakContextTokens": 84500,
    "avgContextTokens": 53200,
    "turnCount": 12,
    "log": { "captureStatus": "CAPTURED", "preview": "..." },
    "pluginVersion": "1.0.1",
    "agentCliVersion": "claude-code 0.5.12"
  },
  {
    "id": 12344,
    "command": "specify",
    "status": "COMPLETED",
    "...": "...",
    "pluginVersion": null,
    "agentCliVersion": null
  }
]
```

### Field semantics

| Field | Type | Nullable | Source |
|---|---|---|---|
| `pluginVersion` | `string \| null` | yes | `Job.pluginVersion` column. `null` for jobs that pre-date this feature OR when both runner-side capture branches failed. |
| `agentCliVersion` | `string \| null` | yes | `Job.agentCliVersion` column. `null` for jobs that pre-date this feature OR when the `<cli> --version` probe failed/timed out. |

### Backwards compatibility

- Two **additive** nullable fields. No existing field changes type, name, or nullability.
- Existing API consumers that don't read these fields are unaffected (TypeScript widening of the response interface; runtime payload size grows by ≤ 200 bytes per job in the worst case).
- The TypeScript type that materializes this payload — `lib/types/job-types.ts` `TicketJobWithTelemetry` — gains two `string | null` fields. All existing render paths through `TicketStats` → `JobsTimeline` → `JobRow` accept the wider shape without edits.

### What the route does NOT do

- It does NOT enforce visibility gating beyond what `verifyTicketAccess` already does (Auto-Resolved Decision #6 in spec).
- It does NOT compute or derive a placeholder server-side. The em-dash and tooltip are entirely a render-time concern.
- It does NOT expose the capture timestamp — only the captured strings (data-model.md §"What this model does NOT introduce").
