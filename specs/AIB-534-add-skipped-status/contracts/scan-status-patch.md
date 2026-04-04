# Contract: PATCH /api/projects/{projectId}/health/scans/{scanId}/status

## Changes for SKIPPED Status

### Request Schema (updated)

```typescript
{
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED',  // SKIPPED added
  score?: number,         // 0-100, required for COMPLETED, must be absent/null for SKIPPED
  report?: string,        // Optional JSON string
  issuesFound?: number,
  issuesFixed?: number,
  headCommit?: string,    // 40-char SHA
  durationMs?: number,
  tokensUsed?: number,
  costUsd?: number,
  errorMessage?: string,  // max 2000 chars
}
```

### Validation Rules

| Condition | Response |
|-----------|----------|
| `status === 'SKIPPED'` and `score` is provided | 400 `{ error: "Score must not be provided for skipped scans" }` |
| `status === 'COMPLETED'` and `score` is missing | 400 `{ error: "Score required for completed scans" }` (existing) |
| Transition not in `VALID_TRANSITIONS` | 409 `{ error: "Invalid status transition" }` (existing) |

### Valid Transitions (updated)

```
PENDING  → RUNNING | FAILED | SKIPPED
RUNNING  → COMPLETED | FAILED | SKIPPED
COMPLETED → (none)
FAILED    → (none)
SKIPPED   → (none)
```

### Transaction Behavior

- **SKIPPED**: Update HealthScan record (status, completedAt, optional fields). Do NOT upsert HealthScore. Do NOT recalculate globalScore.
- **COMPLETED**: Existing behavior unchanged — upsert HealthScore, recalculate globalScore.
- **FAILED**: Existing behavior unchanged.

### Response

```json
{
  "scan": {
    "id": 123,
    "status": "SKIPPED",
    "score": null
  }
}
```
