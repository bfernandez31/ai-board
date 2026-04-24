# API Contract: Context Metrics

## Extended Endpoints

### GET /api/projects/:projectId/tickets/:id/jobs

**Change**: Response includes three new nullable fields per job.

**Additional fields in each job object**:
```json
{
  "peakContextTokens": 82000,
  "avgContextTokens": 41000,
  "turnCount": 12
}
```

All three are `number | null`. Null when agent doesn't provide per-turn telemetry or job predates this feature.

### GET /api/projects/:projectId/analytics

**Change**: Response includes a new `contextHealth` section.

**Additional field in response**:
```json
{
  "contextHealth": {
    "distribution": [
      { "bucket": "0–25K", "count": 8 },
      { "bucket": "25–50K", "count": 15 },
      { "bucket": "50–75K", "count": 7 },
      { "bucket": "75–100K", "count": 3 },
      { "bucket": "100–150K", "count": 2 },
      { "bucket": "150K+", "count": 1 }
    ],
    "averagePeak": 47500,
    "totalJobsWithData": 36,
    "filters": {
      "command": null,
      "workflowType": null,
      "qualityBucket": null
    }
  }
}
```

**New query parameters** (all optional):
- `contextCommand`: Filter by job command (e.g., `implement`, `verify`)
- `contextWorkflowType`: Filter by ticket workflow type (`FULL`, `QUICK`)
- `contextQualityBucket`: Filter by quality score bucket (`excellent`, `good`, `fair`, `poor`, `critical`)

When `contextHealth` has no data (all jobs have null context metrics), the field is:
```json
{
  "contextHealth": {
    "distribution": [],
    "averagePeak": null,
    "totalJobsWithData": 0,
    "filters": { "command": null, "workflowType": null, "qualityBucket": null }
  }
}
```

## Unchanged Endpoints

### POST /api/telemetry/v1/logs

No request/response format changes. The OTLP processor internally computes and persists context metrics from existing `input_tokens` attributes in `claude_code.api_request` and `codex.sse_event` log records.

### PATCH /api/jobs/:id/status

No changes. Context metrics are computed during telemetry ingestion, not during status transitions.
