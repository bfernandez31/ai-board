# Contract: Job Status Update Extension

## Endpoint

`PATCH /api/jobs/{id}/status`

## Request Body (Extended)

```json
{
  "status": "COMPLETED",
  "qualityScore": 83,
  "qualityScoreDetails": "{\"dimensions\":[{\"name\":\"Bug Detection\",\"agentId\":\"bug-detection\",\"score\":90,\"weight\":0.3,\"weightedScore\":27},{\"name\":\"Compliance\",\"agentId\":\"compliance\",\"score\":80,\"weight\":0.3,\"weightedScore\":24},{\"name\":\"Code Comments\",\"agentId\":\"code-comments\",\"score\":70,\"weight\":0.2,\"weightedScore\":14},{\"name\":\"Historical Context\",\"agentId\":\"historical-context\",\"score\":85,\"weight\":0.1,\"weightedScore\":8.5},{\"name\":\"PR Comments\",\"agentId\":\"pr-comments\",\"score\":95,\"weight\":0.1,\"weightedScore\":9.5}],\"threshold\":\"Good\",\"computedAt\":\"2026-03-17T10:30:00Z\"}"
}
```

## Validation Schema (Zod)

```typescript
export const jobStatusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  qualityScore: z.number().int().min(0).max(100).optional(),
  qualityScoreDetails: z.string().optional(),
});
```

## Rules

- `qualityScore` and `qualityScoreDetails` are only accepted when `status` is `COMPLETED`
- If provided with non-COMPLETED status, the fields are silently ignored
- Both must be provided together or neither (server validates)
- Backwards compatible: existing callers without quality score fields continue to work

## Response (unchanged)

```json
{
  "id": 123,
  "status": "COMPLETED",
  "completedAt": "2026-03-17T10:30:05.123Z"
}
```
