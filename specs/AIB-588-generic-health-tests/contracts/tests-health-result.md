# Contract: TESTS Health Scan Result

## Purpose

Defines the workflow result file written by the shared TESTS orchestrator.

## File

`/tmp/health-scan-result.json`

## Envelope

```json
{
  "score": 87,
  "issuesFound": 3,
  "issuesFixed": 1,
  "report": {
    "type": "TESTS",
    "autoFixed": [],
    "nonFixable": [],
    "generatedTickets": []
  },
  "skipped": false,
  "skipReason": null,
  "tokensUsed": 0,
  "costUsd": 0
}
```

## Rules

- `score` is derived from the first test execution only.
- `report.type` must be `TESTS`.
- `skipped = true` requires:
  - `score = null`
  - `skipReason` non-empty
  - `issuesFound = 0`
  - `issuesFixed = 0`
- `skipped = false` may still include empty `autoFixed` and `nonFixable` arrays.
- Invalid execution or unrecoverable orchestration failures do not produce a skipped result; they should fail the workflow and persist `HealthScan.status = FAILED`.

## Persistence mapping

- `skipped = true` maps to `HealthScan.status = SKIPPED`
- `skipped = false` with a valid report maps to `HealthScan.status = COMPLETED`
- The `report` object is stored in `HealthScan.report`
