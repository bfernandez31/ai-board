# Contract: Ticket Jobs API Extension

## Endpoint

`GET /api/projects/{projectId}/tickets/{ticketId}/jobs`

## Response Extension

Add `qualityScore` and `qualityScoreDetails` to the job select clause:

```json
[
  {
    "id": 42,
    "command": "verify",
    "status": "COMPLETED",
    "startedAt": "2026-03-17T10:00:00Z",
    "completedAt": "2026-03-17T10:30:05Z",
    "inputTokens": 150000,
    "outputTokens": 25000,
    "cacheReadTokens": 80000,
    "cacheCreationTokens": 5000,
    "costUsd": 1.25,
    "durationMs": 180000,
    "model": "claude-sonnet-4-6",
    "toolsUsed": ["Read", "Bash", "Edit"],
    "qualityScore": 83,
    "qualityScoreDetails": "{...}"
  }
]
```

## Type Extension

```typescript
export interface TicketJobWithTelemetry {
  // ... existing fields ...
  qualityScore: number | null;
  qualityScoreDetails: string | null;
}
```

## Notes

- `qualityScore` is `null` for all non-verify jobs, QUICK/CLEAN workflow jobs, and failed verify jobs
- `qualityScoreDetails` is `null` whenever `qualityScore` is `null`
- No new endpoint needed — extends existing response shape
