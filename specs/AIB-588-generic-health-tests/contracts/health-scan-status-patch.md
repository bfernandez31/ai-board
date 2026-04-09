# Contract: Health Scan Status PATCH for TESTS

## Endpoint

`PATCH /api/projects/:projectId/health/scans/:scanId/status`

## TESTS-specific payloads

### RUNNING -> COMPLETED

```json
{
  "status": "COMPLETED",
  "score": 87,
  "report": "{\"type\":\"TESTS\",\"autoFixed\":[],\"nonFixable\":[],\"generatedTickets\":[]}",
  "issuesFound": 3,
  "issuesFixed": 1,
  "durationMs": 45000
}
```

### RUNNING -> SKIPPED

```json
{
  "status": "SKIPPED",
  "skipReason": "No executable automated test command was detected in project config",
  "durationMs": 1200
}
```

## Rules

- `TESTS` must be allowed to persist `SKIPPED`.
- `SKIPPED` payloads must not include `score`.
- `COMPLETED` payloads must include `score`.
- `SKIPPED` must not update `HealthScore.testsScore`.
- `skipReason` is persisted for operator-visible reporting.
