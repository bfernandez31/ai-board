# API Contracts: Admin Insights Page — AIB-807

**Branch**: `AIB-807-admin-insights-page`
**Date**: 2026-05-14

---

## Modified Endpoints

### GET `/api/admin/insights/reports`

**Auth**: `requireAdminOrNotFound()`

**Response** (200):
```json
{
  "reports": [
    {
      "id": 42,
      "status": "COMPLETED",
      "generatedAt": "2026-05-14T10:00:00.000Z",
      "periodStart": "2026-05-01T00:00:00.000Z",
      "periodEnd": "2026-05-14T10:00:00.000Z",
      "sessionsCount": 15,
      "ticketsCount": 8,
      "artifactSize": 24500,
      "errorReason": null,
      "completedAt": "2026-05-14T10:05:30.000Z",
      "createdAt": "2026-05-14T10:00:00.000Z",
      "workflowRunId": "12345678901234",
      "githubActionsUrl": "https://github.com/owner/repo/actions/runs/12345678901234"
    }
  ]
}
```

**New fields in each `ReportListEntry`**:

| Field | Type | Description |
|-------|------|-------------|
| `workflowRunId` | `string \| null` | GitHub Actions run ID (BigInt serialized as string). `null` if Job has no `workflowRunId` or report has no linked Job. |
| `githubActionsUrl` | `string \| null` | Full URL to the GitHub Actions run page. `null` when `workflowRunId` is absent or `GITHUB_OWNER`/`GITHUB_REPO` env vars are not configured. |

---

### GET `/api/admin/insights/reports/:id`

Same `ReportListEntry` shape as the list endpoint — gains the same two new fields.

---

### POST `/api/admin/insights/trigger`

**Auth**: `requireAdminOrNotFound()`

**Request body** (extended):
```json
{
  "periodStart": "2026-05-01T00:00:00.000Z",
  "periodEnd": "2026-05-14T10:00:00.000Z"
}
```

**New optional fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `periodStart` | `string` (ISO 8601) | No | Override: reuse the failed report's start. Must be paired with `periodEnd`. |
| `periodEnd` | `string` (ISO 8601) | No | Override: reuse the failed report's end. Must be paired with `periodStart`. |

**Validation rules**:
- Both fields must be present together or both absent (Zod `.refine()`)
- Both must parse as valid ISO 8601 datetime strings
- `periodStart` must be strictly before `periodEnd`
- When present, these override the computed period — the endpoint still runs all preflight checks (NO_CLAUDE_JOBS, NO_NEW_SHIPPED, ALREADY_RUNNING) but the shipped-count check uses the override period's floor instead of `prevEnd`

**Behavior when period params are provided**:
1. Reconcile orphaned RUNNING reports (unchanged)
2. Check concurrency gate: ALREADY_RUNNING (unchanged)
3. Skip NO_CLAUDE_JOBS / NO_NEW_SHIPPED checks — these gates don't apply to retries (the original run already proved eligibility)
4. Use provided `periodStart`/`periodEnd` instead of computing from `getLastCompletedRunEnd()`
5. Create new InsightsReport+Job, dispatch workflow (unchanged)

**Responses**: Unchanged — 201 success, 409 refusal, 502 dispatch failed.

---

## Unchanged Endpoints

| Endpoint | Notes |
|----------|-------|
| GET `/api/admin/insights/preflight` | No changes |
| GET `/api/admin/insights/reports/:id/html` | No changes |
| PATCH `/api/admin/insights/reports/:id/status` | No changes (workflow-only) |
| PUT `/api/admin/insights/reports/:id/finalize` | No changes (workflow-only) |
| GET `/api/admin/insights/jobs` | No changes (workflow-only) |
| GET `/api/admin/insights/jobs/:jobId/raw-native` | No changes (workflow-only) |
